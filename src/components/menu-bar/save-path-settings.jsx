import React from 'react';
import PropTypes from 'prop-types';

// JARVIS 二次开发：Scratch「设置 ⚙」里的「项目保存路径」。
// 值存 localStorage（key 见下），保存项目时由 menu-bar.jsx 读取并随请求发给网关，
// 网关把 .sb3 写入该目录。必须是 /Users/hill 下的绝对路径（网关侧会校验）。
//
// 2026-10-31 改造：不再让用户手敲路径（容易写错、写越界），改为「浏览文件夹」选择器——
// 通过网关 /api/scratch/list-dir 逐级浏览本机目录，点选即写入 localStorage。
// 之所以不用浏览器原生 <input webkitdirectory>：它会刻意隐藏真实绝对路径，
// 而网关写入 .sb3 必须拿到绝对路径，所以文件夹浏览必须由网关侧目录列表支撑。
//
// ⚠️ 布局约束：菜单容器 .menu 有 max-width: 260px、颜色为深底白字。
//   这里所有尺寸都必须在这个宽度内自适应（width:100%），否则会撑破菜单、
//   文字换行挤成一团。别再写 minWidth。
export const SAVE_PATH_KEY = 'jarvis.scratch.savePath';
export const DEFAULT_SAVE_PATH = '/Users/hill/ScratchProjects';
// 保存根（与网关 JARVIS_SCRATCH_SAVE_ROOT 默认值保持一致；仅用于前端初判）
const SAVE_ROOT = '/Users/hill';

// 把 cwd 与子目录名安全拼接成一个绝对路径（cwd 末尾可能有/也可能没有）
function joinPath (cwd, name) {
    if (cwd.endsWith('/')) {
        return cwd + name;
    }
    return `${cwd}/${name}`;
}

class SavePathSettings extends React.Component {
    constructor (props) {
        super(props);
        let initial = '';
        try {
            initial = window.localStorage.getItem(SAVE_PATH_KEY) || '';
        } catch (e) {
            initial = '';
        }
        this.state = {
            path: initial,          // 已选中的保存路径（写入 localStorage）
            browsing: false,        // 是否正在浏览文件夹
            cwd: SAVE_ROOT,         // 当前浏览所在目录
            parent: null,           // 上一级目录（根为 null）
            dirs: [],               // 当前目录下的子目录列表
            loading: false,         // 列表加载中
            error: null,            // 错误提示
            newName: ''             // 新建子文件夹的名字
        };
        this.openBrowser = this.openBrowser.bind(this);
        this.closeBrowser = this.closeBrowser.bind(this);
        this.fetchDir = this.fetchDir.bind(this);
        this.enterDir = this.enterDir.bind(this);
        this.upDir = this.upDir.bind(this);
        this.confirm = this.confirm.bind(this);
        this.createDir = this.createDir.bind(this);
        this.onNewNameChange = this.onNewNameChange.bind(this);
    }

    // 是否像「保存根下的绝对路径」——用于决定浏览器初始位置
    isAbsUnderRoot (p) {
        return typeof p === 'string' && p.startsWith('/') && p.indexOf(SAVE_ROOT) === 0;
    }

    openBrowser () {
        const start = this.isAbsUnderRoot(this.state.path) ? this.state.path : SAVE_ROOT;
        this.setState({
            browsing: true,
            loading: true,
            error: null,
            dirs: [],
            cwd: start,
            parent: null,
            newName: ''
        });
        this.fetchDir(start);
    }

    closeBrowser () {
        // 取消浏览：保留原已选路径，不写入
        this.setState({browsing: false, error: null});
    }

    fetchDir (p) {
        this.setState({loading: true, error: null});
        const url = `/api/scratch/list-dir?path=${encodeURIComponent(p)}`;
        fetch(url, {credentials: 'same-origin'})
            .then(r => r.json())
            .then(res => {
                if (res && res.ok) {
                    this.setState({
                        cwd: res.cwd,
                        parent: res.parent,
                        dirs: res.dirs || [],
                        loading: false
                    });
                } else if (p !== SAVE_ROOT) {
                    // 目标不存在（例如路径还没创建）：回退到根再列一次
                    this.fetchDir(SAVE_ROOT);
                } else {
                    this.setState({
                        cwd: p,
                        parent: null,
                        dirs: [],
                        error: (res && res.error) || '读取目录失败',
                        loading: false
                    });
                }
            })
            .catch(err => {
                this.setState({error: String(err), loading: false, dirs: []});
            });
    }

    enterDir (name) {
        this.fetchDir(joinPath(this.state.cwd, name));
    }

    upDir () {
        if (this.state.parent) {
            this.fetchDir(this.state.parent);
        }
    }

    confirm () {
        const p = this.state.cwd;
        this.setState({path: p, browsing: false, error: null});
        try {
            window.localStorage.setItem(SAVE_PATH_KEY, p);
        } catch (e) {
            // 隐私模式等场景下 localStorage 可能不可写，忽略即可
        }
    }

    onNewNameChange (e) {
        this.setState({newName: e.target.value});
    }

    createDir () {
        const name = (this.state.newName || '').trim();
        if (!name) {
            return;
        }
        fetch('/api/scratch/make-dir', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({parent: this.state.cwd, name})
        })
            .then(r => r.json())
            .then(res => {
                if (res && res.ok) {
                    this.setState({newName: ''});
                    // 新建完回到当前目录刷新列表，让新文件夹出现并可被选中
                    this.fetchDir(this.state.cwd);
                } else {
                    this.setState({error: (res && res.error) || '创建失败'});
                }
            })
            .catch(err => {
                this.setState({error: String(err)});
            });
    }

    render () {
        // 复用的样式片段
        const btnStyle = {
            display: 'block',
            width: '100%',
            boxSizing: 'border-box',
            padding: '6px 8px',
            fontSize: 12,
            fontFamily: 'inherit',
            fontWeight: 700,
            borderRadius: 4,
            border: '1px solid rgba(255, 255, 255, .25)',
            color: '#fff',
            background: 'rgba(255, 255, 255, .12)',
            cursor: 'pointer'
        };
        const wrapStyle = {
            padding: '8px 10px 10px',
            boxSizing: 'border-box',
            width: '100%',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700
        };
        const helpStyle = {
            marginTop: 5,
            fontSize: 10,
            lineHeight: 1.35,
            fontWeight: 400,
            color: 'rgba(255, 255, 255, .78)',
            wordBreak: 'break-all'
        };

        if (!this.state.browsing) {
            // ---------- 未浏览：显示已选路径 + 浏览按钮 ----------
            return (
                <div style={wrapStyle}>
                    <div style={{marginBottom: 6}}>
                        项目保存路径
                    </div>
                    <div style={{
                        display: 'block',
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '5px 7px',
                        fontSize: 12,
                        fontFamily: 'inherit',
                        borderRadius: 4,
                        border: '1px solid rgba(0, 0, 0, .15)',
                        background: '#fff',
                        color: this.state.path ? '#575e75' : 'rgba(87, 94, 117, .55)',
                        // 长路径提示不撑破 260px：允许在任意位置折行
                        wordBreak: 'break-all',
                        minHeight: 26
                    }}>
                        {this.state.path || DEFAULT_SAVE_PATH}
                    </div>
                    <button
                        type="button"
                        style={{...btnStyle, marginTop: 8}}
                        onClick={this.openBrowser}
                    >
                        浏览文件夹…
                    </button>
                    <div style={helpStyle}>
                        /Users/hill 下的目录，用于「文件 ▸ 保存项目到本机」
                    </div>
                </div>
            );
        }

        // ---------- 浏览中：目录导航 + 选择 ----------
        const dirRows = this.state.dirs.map(name => (
            <div
                key={name}
                onClick={() => this.enterDir(name)}
                title={name}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 6px',
                    fontSize: 12,
                    fontWeight: 400,
                    borderRadius: 3,
                    cursor: 'pointer',
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.14)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
                <span style={{flex: '0 0 auto'}}>📁</span>
                <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>{name}</span>
            </div>
        ));

        return (
            <div style={wrapStyle}>
                <div style={{marginBottom: 6}}>
                    项目保存路径 · 浏览
                </div>

                {/* 工具栏：上一级 + 当前位置 */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 6
                }}>
                    <button
                        type="button"
                        disabled={!this.state.parent}
                        onClick={this.upDir}
                        style={{
                            ...btnStyle,
                            flex: '0 0 auto',
                            width: 'auto',
                            opacity: this.state.parent ? 1 : .4,
                            cursor: this.state.parent ? 'pointer' : 'default'
                        }}
                    >
                        ↑ 上一级
                    </button>
                    <div style={{
                        flex: '1 1 auto',
                        fontSize: 10,
                        fontWeight: 400,
                        color: 'rgba(255, 255, 255, .8)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }} title={this.state.cwd}>
                        {this.state.cwd}
                    </div>
                </div>

                {/* 目录列表（可滚动，避免撑破 260px 菜单） */}
                <div style={{
                    maxHeight: 160,
                    overflowY: 'auto',
                    border: '1px solid rgba(255, 255, 255, .18)',
                    borderRadius: 4,
                    padding: 4,
                    background: 'rgba(0, 0, 0, .18)',
                    marginBottom: 6
                }}>
                    {this.state.loading && (
                        <div style={{padding: '6px', fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,.7)'}}>
                            读取中…
                        </div>
                    )}
                    {!this.state.loading && this.state.dirs.length === 0 && (
                        <div style={{padding: '6px', fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,.7)'}}>
                            （此目录下没有子文件夹）
                        </div>
                    )}
                    {dirRows}
                </div>

                {/* 新建子文件夹 */}
                <div style={{display: 'flex', gap: 4, marginBottom: 6}}>
                    <input
                        type="text"
                        value={this.state.newName}
                        onChange={this.onNewNameChange}
                        placeholder="新建子文件夹名"
                        spellCheck={false}
                        style={{
                            flex: '1 1 auto',
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '5px 7px',
                            fontSize: 12,
                            fontFamily: 'inherit',
                            borderRadius: 4,
                            border: '1px solid rgba(0, 0, 0, .15)',
                            outline: 'none',
                            color: '#575e75',
                            background: '#fff',
                            minWidth: 0
                        }}
                    />
                    <button
                        type="button"
                        onClick={this.createDir}
                        style={{
                            ...btnStyle,
                            flex: '0 0 auto',
                            width: 'auto'
                        }}
                    >
                        新建
                    </button>
                </div>

                {this.state.error && (
                    <div style={{...helpStyle, color: '#ffb4b4', marginBottom: 6}}>
                        {this.state.error}
                    </div>
                )}

                {/* 选择 / 取消 */}
                <button
                    type="button"
                    onClick={this.confirm}
                    style={{...btnStyle, background: 'rgba(120, 200, 120, .35)', borderColor: 'rgba(120,200,120,.6)', marginBottom: 6}}
                >
                    ✓ 选择此文件夹
                </button>
                <button
                    type="button"
                    onClick={this.closeBrowser}
                    style={btnStyle}
                >
                    取消
                </button>
            </div>
        );
    }
}

SavePathSettings.propTypes = {
    onChange: PropTypes.func
};

export default SavePathSettings;
