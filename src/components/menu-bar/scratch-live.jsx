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
// 顶栏平铺形态（variant="bar"）用的短文案
const T_LIVE_BAR_START = '开始演示';
const T_LIVE_BAR_ON = '演示中';
const T_LIVE_CLOSE = '收起';

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
            error: null,
            showPanel: false,   // 顶栏形态下，演示链接卡片的展开状态
        };
        this.timer = null;
        this.lastPushAt = 0;
        this.busy = false;
        this.handleTick = this.handleTick.bind(this);
        this.handleStart = this.handleStart.bind(this);
        this.handleStop = this.handleStop.bind(this);
        this.handleCopy = this.handleCopy.bind(this);
        this.handleBarClick = this.handleBarClick.bind(this);
        this.togglePanel = this.togglePanel.bind(this);
    }
    componentWillUnmount () {
        this.handleStop(true);
    }
    // 顶栏形态：没在演示就一键开播，已在演示就展开/收起链接卡片
    handleBarClick () {
        if (this.state.sid) {
            this.togglePanel();
        } else {
            this.handleStart();
        }
    }
    togglePanel () {
        this.setState({showPanel: !this.state.showPanel});
    }
    handleStart () {
        const sid = makeSessionId();
        this.setState({sid, seq: 0, error: null, copied: false, showPanel: true});
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
        this.setState({sid: null, seq: 0, copied: false, showPanel: false});
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
    // 顶栏平铺形态：一个和「新建/保存/打开」同级的按钮，点一下直接开播，
    // 开播后按钮变成「● 演示中」，再点展开链接卡片（复制/结束演示都在卡片里）。
    renderBar () {
        const {sid, seq, copied, error, showPanel} = this.state;
        const item = {
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            boxSizing: 'border-box',
            padding: '0 12px',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            userSelect: 'none'
        };
        const card = {
            position: 'absolute',
            top: 'calc(100% + 2px)',
            right: 0,
            zIndex: 20000,
            width: 300,
            boxSizing: 'border-box',
            padding: 12,
            background: '#fff',
            color: '#575e75',
            borderRadius: 8,
            boxShadow: '0 12px 30px rgba(0,0,0,.22)',
            textAlign: 'left',
            cursor: 'default'
        };
        const primary = {
            flex: 1,
            padding: '7px 10px',
            fontSize: 12,
            fontFamily: 'inherit',
            fontWeight: 700,
            borderRadius: 5,
            border: 'none',
            cursor: 'pointer',
            color: '#fff',
            background: '#4c97ff',
            whiteSpace: 'nowrap'
        };
        const danger = Object.assign({}, primary, {background: '#ff6680'});
        const linkBox = {
            width: '100%',
            boxSizing: 'border-box',
            padding: '6px 8px',
            border: '1px solid #d9dde3',
            borderRadius: 5,
            background: '#f7f9fc',
            fontSize: 11,
            lineHeight: 1.4,
            color: '#575e75',
            wordBreak: 'break-all',
            userSelect: 'all',
            marginBottom: 8
        };
        return (
            <div style={{position: 'relative', height: '100%', display: 'flex',
                alignItems: 'stretch'}}>
                <div
                    style={item}
                    title={sid ? T_LIVE_TITLE : T_LIVE_START}
                    onMouseUp={this.handleBarClick}
                >
                    {sid ? `${T_LIVE_DOT} ${T_LIVE_BAR_ON}` : T_LIVE_BAR_START}
                </div>
                {sid && showPanel ? (
                    <div style={card}>
                        <div style={{display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between', marginBottom: 6}}>
                            <span style={{color: '#0f9d58', fontWeight: 700}}>
                                {`${T_LIVE_DOT} ${T_LIVE_TITLE}${T_LIVE_FRAME_OPEN}` +
                                    `${seq}${T_LIVE_FRAME_CLOSE}`}
                            </span>
                            <button
                                type="button"
                                onClick={this.togglePanel}
                                style={{
                                    border: 'none', background: 'none', padding: 0,
                                    color: '#8a919a', fontSize: 11, cursor: 'pointer'
                                }}
                            >
                                {T_LIVE_CLOSE}
                            </button>
                        </div>
                        <div style={{fontSize: 11, lineHeight: 1.45, color: '#7c828b',
                            marginBottom: 8}}>
                            {T_LIVE_HINT}
                        </div>
                        <div style={linkBox}>{watchUrl(sid)}</div>
                        <div style={{display: 'flex', gap: 8}}>
                            <button
                                type="button"
                                style={primary}
                                onClick={this.handleCopy}
                            >
                                {copied ? T_LIVE_COPIED : T_LIVE_COPY}
                            </button>
                            <button
                                type="button"
                                style={danger}
                                onClick={this.handleStop}
                            >
                                {T_LIVE_STOP}
                            </button>
                        </div>
                        {error ? (
                            <div style={{fontSize: 11, color: '#d93025', marginTop: 8}}>
                                {`${T_LIVE_ERR}${error}`}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        );
    }
    render () {
        if (this.props.variant === 'bar') {
            return this.renderBar();
        }
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
    variant: PropTypes.oneOf(['menu', 'bar']),
    vm: PropTypes.object
};
LivePresenter.defaultProps = {
    variant: 'menu'
};

export {makeSessionId, watchUrl};
export default LivePresenter;

// ============================ 常驻观看（无需「开始演示」） ============================
// 需求（2026-11-21）：把「开始演示」这套手动流程简化掉——其他人应该随时能看，
// 不需要演示者先点开始、也不需要每次复制一条新链接。
//
// 做法：编辑端用固定会话 id 常驻推送当前项目（每 5 秒一帧），观看端固定地址不变，
// 打开就一直跟随；地址形如 /scratch/player.html?jarvis=1&live=main，另有短入口
// /scratch/watch 由网关 302 过来。

export const LIVE_AUTO_SID = 'main';
export const LIVE_AUTO_PUSH_INTERVAL = 5000;

const T_WATCH = '观看';
const T_WATCH_ADDR = '观看地址（固定不变，别人打开就能看）';
const T_WATCH_HINT = '不用手动开始：这边编辑的内容会自动同步，别人打开这个地址就能实时看到。';
const T_WATCH_OPEN = '打开观看页';
const T_WATCH_OPEN_POPUP = '浏览器拦截了新窗口，请允许弹出窗口或手动复制地址。';

const watchAutoUrl = function () {
    const origin = (typeof location !== 'undefined' && location.origin) || '';
    return `${origin}/scratch/player.html?jarvis=1&live=${LIVE_AUTO_SID}`;
};

/**
 * 常驻推送端：只要编辑页开着、并且已经选定了项目，就持续把快照推给固定会话。
 * 页签切到后台时暂停推送，省 CPU；回来后下一次 tick 自然续上。
 */
export class LiveAutoPublisher extends React.Component {
    constructor (props) {
        super(props);
        this.state = {error: null, at: 0};
        this.busy = false;
        this.timer = null;
        this.push = this.push.bind(this);
    }
    componentDidMount () {
        this.timer = setInterval(this.push, LIVE_AUTO_PUSH_INTERVAL);
        this.push();
    }
    componentWillUnmount () {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    push () {
        if (typeof document !== 'undefined' && document.hidden) {
            return;
        }
        if (this.busy) {
            return;
        }
        const vm = this.props.vm;
        if (!vm || typeof vm.saveProjectSb3 !== 'function') {
            return;
        }
        // 只有本页真的载入过项目才推：刚进编辑器时的默认小猫项目不能盖掉观看端
        let ready = false;
        let name = '';
        try {
            ready = window.__jarvisProjectReady === true;
            name = (window.localStorage.getItem('jarvis.scratch.projectName') || '').trim();
        } catch (e) {
            ready = false;
            name = '';
        }
        if (!ready || !name || name === '未命名') {
            return;
        }
        this.busy = true;
        exportProjectBase64(vm)
            .then(data => {
                if (!data) {
                    return null;
                }
                return fetch(`${LIVE_BASE}/publish`, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        sid: LIVE_AUTO_SID,
                        title: this.props.title || name,
                        data
                    })
                }).then(r => r.json());
            })
            .then(res => {
                this.busy = false;
                if (res && res.ok) {
                    this.setState({error: null, at: Date.now()});
                } else if (res && res.error) {
                    this.setState({error: res.error});
                }
            })
            .catch(err => {
                this.busy = false;
                this.setState({error: String(err)});
            });
    }
    render () {
        return null;
    }
}

LiveAutoPublisher.propTypes = {
    title: PropTypes.string,
    vm: PropTypes.object
};

/**
 * 顶栏「观看」入口：一个和「新建项目」等平级的按钮，点开一张只读卡片，
 * 显示固定观看地址 + 「打开观看页」。没有开始/结束，因为推送是常驻的。
 */
export class LiveWatchButton extends React.Component {
    constructor (props) {
        super(props);
        this.state = {open: false, hint: ''};
        this.toggle = this.toggle.bind(this);
        this.openWatch = this.openWatch.bind(this);
    }
    toggle () {
        this.setState({open: !this.state.open, hint: ''});
    }
    openWatch () {
        const w = window.open(watchAutoUrl(), '_blank');
        if (!w) {
            this.setState({hint: T_WATCH_OPEN_POPUP});
        }
    }
    render () {
        const {open, hint} = this.state;
        const item = {
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            boxSizing: 'border-box',
            padding: '0 12px',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            userSelect: 'none'
        };
        const card = {
            position: 'absolute',
            top: 'calc(100% + 2px)',
            right: 0,
            zIndex: 20000,
            width: 300,
            boxSizing: 'border-box',
            padding: 12,
            background: '#fff',
            color: '#575e75',
            borderRadius: 8,
            boxShadow: '0 12px 30px rgba(0,0,0,.22)',
            textAlign: 'left',
            cursor: 'default'
        };
        const addr = {
            width: '100%',
            boxSizing: 'border-box',
            padding: '6px 8px',
            border: '1px solid #d9dde3',
            borderRadius: 5,
            background: '#f7f9fc',
            fontSize: 11,
            lineHeight: 1.4,
            color: '#575e75',
            wordBreak: 'break-all',
            userSelect: 'all',
            marginBottom: 8
        };
        const primary = {
            width: '100%',
            padding: '7px 10px',
            fontSize: 12,
            fontFamily: 'inherit',
            fontWeight: 700,
            borderRadius: 5,
            border: 'none',
            cursor: 'pointer',
            color: '#fff',
            background: '#4c97ff',
            whiteSpace: 'nowrap'
        };
        return (
            <div style={{position: 'relative', height: '100%', display: 'flex',
                alignItems: 'stretch'}}>
                <div
                    style={item}
                    title={T_WATCH_ADDR}
                    onMouseUp={this.toggle}
                >
                    {T_WATCH}
                </div>
                {open ? (
                    <div style={card}>
                        <div style={{fontWeight: 700, marginBottom: 6}}>{T_WATCH_ADDR}</div>
                        <div style={addr}>{watchAutoUrl()}</div>
                        <div style={{fontSize: 11, lineHeight: 1.45, color: '#7c828b',
                            marginBottom: 10}}>
                            {T_WATCH_HINT}
                        </div>
                        <button
                            type="button"
                            style={primary}
                            onClick={this.openWatch}
                        >
                            {T_WATCH_OPEN}
                        </button>
                        {hint ? (
                            <div style={{fontSize: 11, color: '#d93025', marginTop: 8}}>
                                {hint}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        );
    }
}
