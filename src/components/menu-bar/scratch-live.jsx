import React from 'react';
import PropTypes from 'prop-types';

// JARVIS 二次开发：Scratch「直播观看」（只读围观/演示）。
// ----------------------------------------------------------------------------
// 需求（2026-11-01）：多人/多设备同时看同一个项目。
//
// 为什么只做「单向围观」而不是实时协作编辑：
//   实时协作需要 WebSocket + OT/CRDT 合并冲突，代价大；而且两个人同时写同一份
//   .sb3 会互相覆盖。先做单向：**一个演示者推、其他人只读地看**，安全且够用。
//
// 工作方式：
//   1. 演示者点「开始演示」→ 生成本地 session id，按固定间隔把当前项目导出成
//      .sb3（base64）POST 到网关 /api/scratch/live/publish，seq 单调递增；
//   2. 观看者点「观看演示」→ 每秒轮询 /api/scratch/live?sid=xxx，
//      发现 seq 变化就重新拉快照，用 vm.loadProject 原地替换，画面跟着更新。
//
// ⚠️ 文案必须用模块级常量再 {CONST} 引用：生产构建 terser 会丢弃 JSX 裸文本子节点。
// ----------------------------------------------------------------------------

const T_LIVE_START = '开始演示（他人可观看）';
const T_LIVE_STOP = '结束演示';
const T_LIVE_TITLE = '演示中';
const T_LIVE_HINT = '把下面链接发给其他设备，他们打开即可实时观看你的项目。';
const T_LIVE_COPY = '复制链接';
const T_LIVE_COPIED = '已复制';
const T_LIVE_ERR = '连接失败：';

// 演示端推送间隔（毫秒）。太短会频繁打包 sb3 拖慢编辑，太长则观看端迟钝。
export const LIVE_PUSH_INTERVAL = 3000;
const LIVE_BASE = '/api/scratch/live';
const T_LIVE_DOT = '●';
const T_LIVE_FRAME_OPEN = '（第 ';
const T_LIVE_FRAME_CLOSE = ' 帧）';
const T_LIVE_COPY_FAIL = '复制失败，请手动选中链接';

/**
 * 生成符合网关校验规则的会话 id（4~64 位）。
 * @returns {string} 会话 id，仅含 [A-Za-z0-9_-]
 */
const makeSessionId = function () {
    const rnd = Math.random().toString(36)
        .slice(2, 10);
    return `s${Date.now().toString(36)}${rnd}`;
};

/**
 * 拼出观看端链接（player 只读页 + live 参数）。
 * @param {string} sid 会话 id
 * @returns {string} 完整观看地址
 */
const watchUrl = function (sid) {
    const origin = (typeof location !== 'undefined' && location.origin) || '';
    return `${origin}/scratch/player.html?jarvis=1&live=${encodeURIComponent(sid)}`;
};

/**
 * 把 vm 当前项目导出成 base64 的 .sb3。
 * @param {object} vm scratch-vm 实例
 * @returns {Promise<string>} base64 数据（不含 dataURL 前缀）
 */
const exportProjectBase64 = function (vm) {
    return new Promise((resolve, reject) => {
        if (!vm || typeof vm.saveProjectSb3 !== 'function') {
            reject(new Error('vm 不可用'));
            return;
        }
        Promise.resolve(vm.saveProjectSb3())
            .then(blob => {
                const reader = new FileReader();
                reader.onload = () => {
                    // dataURL 形如 data:...;base64,XXXX
                    const s = String(reader.result || '');
                    const i = s.indexOf(',');
                    resolve(i >= 0 ? s.slice(i + 1) : '');
                };
                reader.onerror = () => reject(reader.error || new Error('读取导出数据失败'));
                reader.readAsDataURL(blob);
            })
            .catch(reject);
    });
};

// ============================ 演示端 ============================
export class LivePresenter extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            sid: null,
            seq: 0,
            copied: false,
            error: null
        };
        this.timer = null;
        this.lastPushAt = 0;
        this.busy = false;
        this.handleTick = this.handleTick.bind(this);
        this.handleStart = this.handleStart.bind(this);
        this.handleStop = this.handleStop.bind(this);
        this.handleCopy = this.handleCopy.bind(this);
    }
    componentWillUnmount () {
        this.handleStop(true);
    }
    handleStart () {
        const sid = makeSessionId();
        this.setState({sid, seq: 0, error: null, copied: false});
        this.lastPushAt = 0;
        this.timer = setInterval(this.handleTick, LIVE_PUSH_INTERVAL);
        // 立刻推第一帧，观看端不用等一个周期
        this.handleTick();
    }
    handleStop (silent) {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        const sid = this.state.sid;
        if (sid && !silent) {
            fetch(`${LIVE_BASE}/stop`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({sid})
            }).catch(() => {});
        }
        this.setState({sid: null, seq: 0, copied: false});
    }
    handleTick () {
        // 上一次还没推完就跳过，避免请求堆积
        if (this.busy || !this.state.sid) {
            return;
        }
        this.busy = true;
        exportProjectBase64(this.props.vm)
            .then(data => {
                if (!data || !this.state.sid) {
                    return null;
                }
                return fetch(`${LIVE_BASE}/publish`, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        sid: this.state.sid,
                        title: this.props.title || '',
                        data
                    })
                }).then(r => r.json());
            })
            .then(res => {
                if (res && res.ok) {
                    this.setState({seq: res.seq, error: null});
                } else if (res && res.error) {
                    this.setState({error: res.error});
                }
            })
            .catch(err => {
                this.setState({error: String(err)});
            })
            .then(() => {
                this.busy = false;
            });
    }
    handleCopy () {
        const url = watchUrl(this.state.sid);
        try {
            // navigator.clipboard 在 http://局域网IP 下不可用（非安全上下文），需兜底
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(url);
            } else {
                const ta = document.createElement('textarea');
                ta.value = url;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            this.setState({copied: true});
            setTimeout(() => this.setState({copied: false}), 2000);
        } catch (e) {
            this.setState({error: T_LIVE_COPY_FAIL});
        }
    }
    render () {
        const wrap = {padding: '8px 10px 10px',
            width: '100%',
            boxSizing: 'border-box',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700};
        const btn = {
            display: 'block',
            width: '100%',
            boxSizing: 'border-box',
            padding: '6px 8px',
            fontSize: 12,
            fontFamily: 'inherit',
            fontWeight: 700,
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,.25)',
            color: '#fff',
            background: 'rgba(255,255,255,.12)',
            cursor: 'pointer',
            marginBottom: 6
        };
        const hint = {fontSize: 10,
            lineHeight: 1.35,
            fontWeight: 400,
            color: 'rgba(255,255,255,.78)',
            wordBreak: 'break-all',
            marginBottom: 6};

        if (!this.state.sid) {
            return (
                <div style={wrap}>
                    <button
                        type="button"
                        style={btn}
                        onClick={this.handleStart}
                    >
                        {T_LIVE_START}
                    </button>
                    {this.state.error && (
                        <div style={{...hint, color: '#ffb4b4'}}>
                            {`${T_LIVE_ERR}${this.state.error}`}
                        </div>
                    )}
                </div>
            );
        }

        const url = watchUrl(this.state.sid);
        return (
            <div style={wrap}>
                <div style={{marginBottom: 6, color: '#bfe3bf'}}>
                    {`${T_LIVE_DOT} ${T_LIVE_TITLE}${T_LIVE_FRAME_OPEN}` +
                        `${this.state.seq}${T_LIVE_FRAME_CLOSE}`}
                </div>
                <div style={hint}>{T_LIVE_HINT}</div>
                <div
                    style={{
                        ...hint,
                        background: '#fff',
                        color: '#575e75',
                        padding: '5px 7px',
                        borderRadius: 4,
                        userSelect: 'all'
                    }}
                >
                    {url}
                </div>
                <button
                    type="button"
                    style={btn}
                    onClick={this.handleCopy}
                >
                    {this.state.copied ? T_LIVE_COPIED : T_LIVE_COPY}
                </button>
                <button
                    type="button"
                    style={{...btn,
                        background: 'rgba(220,120,120,.35)',
                        borderColor: 'rgba(220,120,120,.6)'}}
                    onClick={this.handleStop}
                >
                    {T_LIVE_STOP}
                </button>
                {this.state.error && (
                    <div style={{...hint, color: '#ffb4b4'}}>
                        {`${T_LIVE_ERR}${this.state.error}`}
                    </div>
                )}
            </div>
        );
    }
}

LivePresenter.propTypes = {
    title: PropTypes.string,
    vm: PropTypes.object
};

export {makeSessionId, watchUrl};
export default LivePresenter;
