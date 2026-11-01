import React from 'react';
import PropTypes from 'prop-types';

// JARVIS 二次开发：Scratch「直播观看」——观看端（只读）。
// 挂载在 player 页（?live=<sid>），定时轮询网关的会话版本号，发现 seq 变化就
// 拉最新快照并 vm.loadProject 原地替换，画面自动跟随演示者。
// 演示端见 scratch-live-presenter.jsx。

const T_LIVE_HINT = '自动跟随更新';
const T_LIVE_ENDED = '演示已结束';
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
                        this.setState({text: T_LIVE_ENDED, ended: true});
                    }
                    return;
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
        const url = `${LIVE_BASE}/project?sid=${encodeURIComponent(sid)}&seq=${seq}`;
        fetch(url, {credentials: 'same-origin'})
            .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
            .then(buf => {
                const vm = this.props.vm;
                if (!vm) {
                    return null;
                }
                return vm.loadProject(buf);
            })
            .then(this.handleSnapshotLoaded)
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
