import React from 'react';
import PropTypes from 'prop-types';

// JARVIS 二次开发：Scratch「直播观看」——观看端（只读）。
// 挂载在 player 页（?live=<sid>），定时轮询网关的会话版本号，发现 seq 变化就
// 拉最新快照并 vm.loadProject 原地替换，画面自动跟随演示者。
// 演示端见 scratch-live-presenter.jsx。

const T_LIVE_HINT = '自动跟随更新';
// 常驻观看模式下，编辑端还没推第一帧时不是「结束」，而是在等画面
const T_LIVE_WAITING = '等待画面…';
// 观看页自己的编辑器（vm）还没就绪时别假装加载成功
const T_LIVE_WAIT_VM = '等待编辑器就绪…';
const T_LIVE_CONNECTING = '连接中…';
const T_LIVE_ERR = '连接失败：';
const T_LIVE_DOT = '●';
const T_LIVE_SQUARE = '■';

// 观看端轮询间隔（毫秒）
export const LIVE_POLL_INTERVAL = 1500;
const LIVE_BASE = '/api/scratch/live';

class LiveViewer extends React.Component {
    constructor (props) {
        super(props);
        this.state = {text: T_LIVE_CONNECTING, ended: false};
        this.timer = null;
        this.lastSeq = 0;
        this.handlePoll = this.handlePoll.bind(this);
        this.handleSnapshotLoaded = this.handleSnapshotLoaded.bind(this);
        this.handleSnapshotFailed = this.handleSnapshotFailed.bind(this);
    }
    componentDidMount () {
        this.handlePoll();
        this.timer = setInterval(this.handlePoll, LIVE_POLL_INTERVAL);
    }
    componentWillUnmount () {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    handlePoll () {
        const sid = this.props.sid;
        if (!sid) {
            return;
        }
        fetch(`${LIVE_BASE}?sid=${encodeURIComponent(sid)}`, {credentials: 'same-origin'})
            .then(r => r.json().then(j => ({status: r.status, body: j})))
            .then(({status, body}) => {
                if (status === 404 || !body || !body.ok) {
                    if (!this.state.ended) {
                        this.setState({text: T_LIVE_WAITING, ended: true});
                    }
                    return;
                }
                if (this.state.ended) {
                    // 编辑端又推上来了（打开项目/刚从后台回来），恢复跟随状态
                    this.setState({ended: false, text: T_LIVE_WAITING});
                }
                if (body.seq && body.seq !== this.lastSeq) {
                    this.lastSeq = body.seq;
                    this.loadSnapshot(body.seq);
                }
            })
            .catch(() => {
                // 网络抖动不改变已显示的画面，等下次轮询
            });
    }
    loadSnapshot (seq) {
        const sid = this.props.sid;
        const vm = this.props.vm;
        if (!vm || typeof vm.loadProject !== 'function') {
            // 观看页的 vm 还没注入：直接说清楚，别让标签假装成「已跟随」
            this.setState({text: T_LIVE_WAIT_VM});
            return;
        }
        const url = `${LIVE_BASE}/project?sid=${encodeURIComponent(sid)}&seq=${seq}`;
        fetch(url, {credentials: 'same-origin'})
            .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
            .then(buf => vm.loadProject(buf))
            .then(() => {
                // loadProject 后 renderer 不会自动重画，不主动请求会一直停在旧画面
                // 观看页没有绿旗在跑，run loop 是停的，所以必须直接让 renderer 画一帧，
                // 否则 targets 换了、画面却还停在旧项目上。
                if (vm.runtime && vm.runtime.renderer && vm.runtime.renderer.draw) {
                    vm.runtime.renderer.draw();
                }
                this.handleSnapshotLoaded();
            })
            .catch(this.handleSnapshotFailed);
    }
    handleSnapshotLoaded () {
        if (!this.state.ended) {
            this.setState({text: T_LIVE_HINT});
        }
    }
    handleSnapshotFailed (err) {
        this.setState({text: `${T_LIVE_ERR}${(err && err.message) || err}`});
    }
    render () {
        const ended = this.state.ended;
        return (
            <div
                style={{
                    position: 'fixed',
                    right: 10,
                    bottom: 10,
                    zIndex: 9999,
                    padding: '4px 10px',
                    borderRadius: 14,
                    background: ended ?
                        'rgba(120,120,120,.85)' : 'rgba(76,151,255,.92)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    userSelect: 'none',
                    pointerEvents: 'none'
                }}
            >
                {ended ?
                    `${T_LIVE_SQUARE} ${this.state.text}` :
                    `${T_LIVE_DOT} ${this.state.text}`}
            </div>
        );
    }
}

LiveViewer.propTypes = {
    sid: PropTypes.string,
    vm: PropTypes.object
};

export default LiveViewer;
