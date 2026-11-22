import React from 'react';
import PropTypes from 'prop-types';

import {
    markProjectReady,
    setProjectName,
    setProjectFile,
    getProjectName,
    getProjectFile
} from './scratch-projects.jsx';

// JARVIS 二次开发：「观看他人」——在完整编辑器界面里只读围观某个正在编辑的会话。
//
// 和 player.html 观看页的区别：
//   player 页只有舞台；这里保留完整编辑器布局，舞台 + 脚本都能看到，
//   适合「他在改什么」这种盯屏场景。
//
// 只读的实现方式：不遮罩、不改 vm，只把本页的自动保存/常驻推送停掉
// （markProjectReady(false)），所以就算误拖一个积木，也只改到本地内存，
// 不会写进任何人的 .sb3，退出围观时再把原来的项目重新载回来。

const LIVE_BASE = '/api/scratch/live';
const PROJECT_API = '/api/scratch/project';
const POLL_INTERVAL = 1500;

const T_WATCHING = '围观中：';
const T_READONLY = '只读浏览：拖动积木只影响你这边，不会改到对方的项目';
const T_EXIT = '退出围观';
const T_WAIT = '正在连接对方画面…';
const T_CONNECT_FAIL = '连接失败：';
const T_RESTORE = '正在恢复你的项目…';
const T_RESTORE_FAIL = '恢复自己的项目失败：';
const T_CLIENT_UNKNOWN = '未知设备';
const T_SYNCED = '已同步，只读';

// 同一台机器上开的另一个标签页，client 会是 ::1 / 127.0.0.1，对观众没意义，直接说「本机」
const fmtClient = c => {
    const v = String(c || '').trim();
    if (!v) return T_CLIENT_UNKNOWN;
    if (/^(::1|::ffff:127\.0\.0\.1|127\.0\.0\.1|localhost)$/i.test(v)) return '本机';
    return v;
};

const fmtTime = ms => {
    try {
        const d = new Date(Number(ms) * 1000);
        const p = x => (x < 10 ? '0' : '') + x;
        return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    } catch (e) {
        return '';
    }
};

class LiveWatchSession extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            visible: false,
            sid: '',
            title: '',
            client: '',
            text: '',
            restoring: false,
            error: ''
        };
        this.lastSeq = 0;
        this.timer = null;
        this.prevName = '';
        this.prevFile = '';
        this.onStart = this.onStart.bind(this);
        this.poll = this.poll.bind(this);
        this.exit = this.exit.bind(this);
        this.hideToolbarActions = this.hideToolbarActions.bind(this);
    }

    componentDidMount () {
        window.addEventListener('jarvis-watch-session', this.onStart);
    }

    componentWillUnmount () {
        window.removeEventListener('jarvis-watch-session', this.onStart);
        this.stopTimer();
    }

    stopTimer () {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    onStart (e) {
        const detail = (e && e.detail) || {};
        const sid = String(detail.sid || '').trim();
        if (!sid) return;
        // 进围观前记住自己的项目，退出时原样载回来
        this.prevName = getProjectName();
        this.prevFile = getProjectFile();
        // 停掉自动保存与常驻推送：这两件事都看 projectReady 标记
        markProjectReady(false);
        this.lastSeq = 0;
        this.hideToolbarActions(true);
        this.setState({
            visible: true,
            sid,
            title: String(detail.title || ''),
            client: String(detail.client || ''),
            text: T_WAIT,
            restoring: false,
            error: ''
        });
        this.stopTimer();
        this.poll();
        this.timer = setInterval(this.poll, POLL_INTERVAL);
    }

    // 围观期间把顶栏的项目操作暂时收起来，避免误点保存/新建/打开
    hideToolbarActions (hide) {
        try {
            const bar = document.querySelector('.jarvis-menu-bar');
            if (!bar) return;
            const items = bar.querySelectorAll('[data-jarvis-action]');
            items.forEach(el => {
                el.style.display = hide ? 'none' : '';
            });
        } catch (e) {}
    }

    poll () {
        const sid = this.state.sid;
        if (!sid) return;
        fetch(`${LIVE_BASE}?sid=${encodeURIComponent(sid)}`, {credentials: 'same-origin'})
            .then(r => r.json().then(j => ({status: r.status, body: j})))
            .then(({status, body}) => {
                if (status === 404 || !body || !body.ok) {
                    this.setState({text: '对方已经关掉编辑器了'});
                    return;
                }
                if (body.title && body.title !== this.state.title) {
                    this.setState({title: body.title});
                }
                if (body.client && body.client !== this.state.client) {
                    this.setState({client: body.client});
                }
                if (body.seq && body.seq !== this.lastSeq) {
                    this.lastSeq = body.seq;
                    this.load(body.seq);
                }
            })
            .catch(() => {
                // 网络抖动：保持当前画面，等下一轮
            });
    }

    load (seq) {
        const sid = this.state.sid;
        const vm = this.props.vm;
        if (!vm || typeof vm.loadProject !== 'function') {
            this.setState({text: '编辑器还没就绪…'});
            return;
        }
        fetch(`${LIVE_BASE}/project?sid=${encodeURIComponent(sid)}&seq=${seq}`,
            {credentials: 'same-origin'})
            .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
            .then(buf => vm.loadProject(buf))
            .then(() => {
                // 让代码区停在第一个非舞台角色的脚本上，观众直接能看到积木
                try {
                    const targets = vm.runtime.targets.filter(t => !t.isStage);
                    if (targets.length) vm.setEditingTarget(targets[0].id);
                } catch (e) {}
                // 观看端没有绿旗在跑，必须主动画一帧，否则画面停在旧项目
                try {
                    if (vm.runtime && vm.runtime.renderer && vm.runtime.renderer.draw) {
                        vm.runtime.renderer.draw();
                    }
                } catch (e) {}
                this.setState({text: T_SYNCED});
            })
            .catch(err => this.setState({text: T_CONNECT_FAIL + ((err && err.message) || err)}));
    }

    exit () {
        this.stopTimer();
        const vm = this.props.vm;
        const file = this.prevFile;
        this.setState({restoring: true, error: '', text: T_RESTORE});
        const redraw = () => {
            try {
                if (vm && vm.runtime && vm.runtime.renderer && vm.runtime.renderer.draw) {
                    vm.runtime.renderer.draw();
                }
            } catch (e) {}
        };
        // 有自己打开的项目 → 按文件名从磁盘重新载回来
        const restoreFromFile = () =>
            fetch(`${PROJECT_API}?name=${encodeURIComponent(file)}`, {credentials: 'same-origin'})
                .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status))))
                )
                .then(buf => vm.loadProject(buf))
                .then(() => {
                    setProjectName(this.prevName);
                    setProjectFile(file);
                    markProjectReady(true);
                    redraw();
                    return true;
                });
        // 进围观前自己什么项目都没打开 → 用序列化快照回到原来的画布，
        // 项目名/文件保持未命名，仍然不允许自动保存
        const restoreFromSnapshot = () =>
            (this.prevBufPromise || Promise.resolve(null))
                .then(buf => (buf && vm && vm.loadProject ? vm.loadProject(buf) : null))
                .then(() => {
                    redraw();
                    return true;
                });
        let restore;
        if (!vm || typeof vm.loadProject !== 'function') {
            restore = Promise.resolve(false);
        } else if (file) {
            restore = restoreFromFile();
        } else {
            restore = restoreFromSnapshot();
        }
        restore
            .then(() => {
                this.hideToolbarActions(false);
                this.setState({visible: false, restoring: false, sid: '', text: ''});
            })
            .catch(err => {
                this.hideToolbarActions(false);
                this.setState({
                    restoring: false,
                    error: T_RESTORE_FAIL + ((err && err.message) || err)
                });
            });
    }

    render () {
        if (!this.state.visible) return null;
        const banner = {
            position: 'fixed',
            left: '50%',
            top: 52,
            transform: 'translateX(-50%)',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 10px',
            borderRadius: 8,
            background: 'rgba(30,34,44,.92)',
            color: '#fff',
            fontSize: 12,
            fontFamily: 'inherit',
            boxShadow: '0 8px 24px rgba(0,0,0,.28)',
            maxWidth: '92vw'
        };
        const title = this.state.title || '未命名项目';
        const client = fmtClient(this.state.client);
        return (
            <div style={banner}>
                <span style={{fontWeight: 700, whiteSpace: 'nowrap'}}>
                    {`${T_WATCHING}${title}`}
                </span>
                <span style={{color: '#a9b4c8', whiteSpace: 'nowrap'}}>{client}</span>
                <span style={{color: '#a9b4c8', whiteSpace: 'nowrap', overflow: 'hidden',
                    textOverflow: 'ellipsis'}}>
                    {this.state.text || T_READONLY}
                </span>
                <button
                    type="button"
                    disabled={this.state.restoring}
                    onClick={this.exit}
                    style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: 'inherit',
                        color: '#fff',
                        background: this.state.restoring ? '#7c8598' : '#4c97ff',
                        border: 'none',
                        borderRadius: 5,
                        cursor: this.state.restoring ? 'default' : 'pointer',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {this.state.restoring ? T_RESTORE : T_EXIT}
                </button>
                {this.state.error ? (
                    <span style={{color: '#ff9b93', whiteSpace: 'nowrap'}}>
                        {this.state.error}
                    </span>
                ) : null}
            </div>
        );
    }
}

LiveWatchSession.propTypes = {
    vm: PropTypes.object
};

export {fmtTime, fmtClient};
export default LiveWatchSession;
