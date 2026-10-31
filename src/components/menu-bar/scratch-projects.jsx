import React from 'react';
import PropTypes from 'prop-types';

// JARVIS 二次开发：项目统一存储
// ----------------------------------------------------------------------------
// 设计目标：
//   1. 保存时要求输入「项目名称」（必填），避免每次都取默认标题。
//   2. 在页面顶栏展示当前项目名称（ProjectNameBadge）。
//   3. 统一存储落在当前 Mac 的固定目录（网关 JARVIS_SCRATCH_SAVE_DIR，
//      默认 /Users/hill/ScratchProjects）。无论从哪个设备访问，都写进这台 Mac，
//      实现「统一存储」。
//   4. 可从该目录查看项目列表并加载（ProjectStoreModal 的「打开项目」）。
//
// 状态：项目名存 localStorage（key 见下），并通过 window 事件做跨组件实时同步。
// 弹窗通过 window 自定义事件触发（jarvis-open-save / jarvis-open-load），
// 由 menu-bar 渲染一次 ProjectStoreModal 并传入 vm。
//
// ⚠️ 文案必须用「模块级常量」再 {CONST} 引用：生产构建的 terser 会丢弃 JSX 里的
//    裸文本子节点，但保留作为表达式引用的字符串常量（参见 SAVE_TO_LOCAL_LABEL）。
// ----------------------------------------------------------------------------

// 模块级文案常量（terser 会保留，作为表达式子节点被引用）
// 文案统一去掉「本机」：项目存在当前 Mac 的统一目录，与访问设备无关
const T_SAVE_TITLE = '保存项目';
const T_LOAD_TITLE = '打开项目';
const T_NAME_LABEL = '项目名称（必填）';
const T_NAME_PLACEHOLDER = '例如：我的小猫冒险';
const T_SAVE_HINT = '将保存到统一项目目录，任何设备访问都能打开；同名会覆盖。';
const T_SAVE_BTN = '保存';
const T_SAVING_BTN = '保存中…';
const T_CANCEL = '取消';
const T_LOADING_LIST = '读取项目列表…';
const T_LOAD_FAIL = '读取失败：';
const T_EMPTY_HINT = '统一项目目录还没有项目，先去「文件 ▸ 保存项目」创建一个吧。';
const T_LOADING_FILE = '加载中…';
const T_OPEN = '打开 ▸';
const T_STORE_LOC = '统一存储位置：';
// 项目列表行的操作（删除 / 重命名）
const T_RENAME = '重命名';
const T_DELETE = '删除';
const T_RENAME_TITLE = '重命名项目';
const T_RENAME_LABEL = '新的项目名称';
const T_RENAME_BTN = '确定';
const T_RENAMING_BTN = '处理中…';
const T_DELETE_CONFIRM_PREFIX = '确定要删除项目「';
const T_DELETE_CONFIRM_SUFFIX = '」吗？\n\n删除后文件会移入统一目录下的 .trash 子目录，如需找回可从该目录取回。';

export const PROJECT_NAME_KEY = 'jarvis.scratch.projectName';

export function getProjectName () {
    try {
        return (window.localStorage.getItem(PROJECT_NAME_KEY) || '').trim();
    } catch (e) {
        return '';
    }
}

export function setProjectName (name) {
    try {
        window.localStorage.setItem(PROJECT_NAME_KEY, name || '');
    } catch (e) {
        // 隐私模式等场景 localStorage 不可写，忽略即可
    }
    try {
        window.dispatchEvent(new CustomEvent('jarvis-project-name-changed', {
            detail: {name: name || ''}
        }));
    } catch (e) {
        // 事件派发失败也不影响主流程
    }
}

function bytesToBase64 (bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

function fmtSize (n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtTime (ms) {
    try {
        const d = new Date(ms);
        const p = x => (x < 10 ? '0' : '') + x;
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
            `${p(d.getHours())}:${p(d.getMinutes())}`;
    } catch (e) {
        return '';
    }
}

// ============================ 顶部项目名徽标 ============================
export class ProjectNameBadge extends React.Component {
    constructor (props) {
        super(props);
        this.state = {name: getProjectName()};
        this.onChange = this.onChange.bind(this);
    }
    componentDidMount () {
        window.addEventListener('jarvis-project-name-changed', this.onChange);
    }
    componentWillUnmount () {
        window.removeEventListener('jarvis-project-name-changed', this.onChange);
    }
    onChange () {
        this.setState({name: getProjectName()});
    }
    render () {
        const name = this.state.name || '未命名项目';
        return (
            <div
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: 32,
                    padding: '0 10px',
                    margin: '0 6px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#fff',
                    background: 'rgba(76,151,255,.30)',
                    border: '1px solid rgba(76,151,255,.55)',
                    borderRadius: 6,
                    whiteSpace: 'nowrap',
                    cursor: 'default',
                    userSelect: 'none'
                }}
                title={'当前项目：' + name}
            >
                <span style={{opacity: 0.8, marginRight: 6}}>📋</span>
                {name}
            </div>
        );
    }
}

// ============================ 保存 / 加载弹窗 ============================
export class ProjectStoreModal extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            mode: null,          // null | 'save' | 'load'
            name: '',
            busy: false,
            error: null,
            projects: [],
            root: '',
            listError: null,
            loadingList: false,
            loadingFile: null,   // 正在加载的项目名
            renamingFile: null,  // 正在重命名的项目文件名（null 表示未处于重命名）
            renameValue: '',     // 重命名输入框内容
            rowBusy: null        // 正在删除/重命名中的项目文件名
        };
        this.openSave = this.openSave.bind(this);
        this.openLoad = this.openLoad.bind(this);
        this.close = this.close.bind(this);
        this.onName = this.onName.bind(this);
        this.doSave = this.doSave.bind(this);
        this.doLoad = this.doLoad.bind(this);
        this.refreshList = this.refreshList.bind(this);
        this.startRename = this.startRename.bind(this);
        this.cancelRename = this.cancelRename.bind(this);
        this.onRenameInput = this.onRenameInput.bind(this);
        this.doRename = this.doRename.bind(this);
        this.doDelete = this.doDelete.bind(this);
    }
    componentDidMount () {
        window.addEventListener('jarvis-open-save', this.openSave);
        window.addEventListener('jarvis-open-load', this.openLoad);
    }
    componentWillUnmount () {
        window.removeEventListener('jarvis-open-save', this.openSave);
        window.removeEventListener('jarvis-open-load', this.openLoad);
    }
    openSave () {
        this.setState({mode: 'save', name: getProjectName(), error: null, busy: false});
    }
    openLoad () {
        this.setState({
            mode: 'load', error: null, listError: null,
            loadingList: true, projects: [], root: '',
            renamingFile: null, rowBusy: null
        });
        this.refreshList();
    }
    // 重新拉取项目列表（删除/重命名后刷新用，不重置弹窗其余状态）
    refreshList () {
        return fetch('/api/scratch/projects', {credentials: 'same-origin'})
            .then(r => r.json())
            .then(res => {
                if (res && res.ok) {
                    this.setState({
                        projects: res.projects || [],
                        root: res.root || '',
                        loadingList: false,
                        listError: null
                    });
                } else {
                    this.setState({
                        listError: (res && res.error) || '读取失败',
                        loadingList: false
                    });
                }
            })
            .catch(err => this.setState({listError: String(err), loadingList: false}));
    }
    close () {
        this.setState({mode: null});
    }
    onName (e) {
        this.setState({name: e.target.value});
    }
    doSave () {
        const name = (this.state.name || '').trim();
        if (!name) {
            this.setState({error: '请输入项目名称'});
            return;
        }
        const vm = this.props.vm;
        if (!vm || !vm.saveProjectSb3) {
            this.setState({error: '编辑器尚未就绪，请稍候再试'});
            return;
        }
        this.setState({busy: true, error: null});
        // vm.saveProjectSb3() 返回 Blob（不是 ArrayBuffer），需先读成二进制再 base64
        vm.saveProjectSb3()
            .then(content => {
                if (content instanceof Blob) {
                    return content.arrayBuffer().then(ab => ({
                        bytes: new Uint8Array(ab), size: content.size
                    }));
                }
                if (content && content.buffer) {
                    return {
                        bytes: new Uint8Array(content.buffer, content.byteOffset, content.byteLength),
                        size: content.byteLength
                    };
                }
                return {bytes: new Uint8Array(0), size: 0};
            })
            .then(({bytes, size}) => {
                if (!size) {
                    throw new Error('当前项目内容为空，请先添加角色或积木再保存');
                }
                const b64 = bytesToBase64(bytes);
                return fetch('/api/scratch/save', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({name: name, data: b64})
                })
                    .then(r => r.json())
                    .then(res => {
                        if (res && res.ok) {
                            setProjectName(name);
                            this.setState({busy: false, mode: null});
                            window.alert('已保存项目「' + name + '」到统一项目目录：\n' + (res.path || ''));
                        } else {
                            throw new Error((res && res.error) || '保存失败');
                        }
                    });
            })
            .catch(err => this.setState({
                busy: false,
                error: (err && err.message) || String(err)
            }));
    }
    doLoad (file, name) {
        this.setState({loadingFile: name, listError: null});
        fetch('/api/scratch/project?name=' + encodeURIComponent(file), {credentials: 'same-origin'})
            .then(r => {
                if (!r.ok) throw new Error('下载失败（HTTP ' + r.status + '）');
                return r.blob();
            })
            .then(blob => blob.arrayBuffer())
            .then(buf => {
                const vm = this.props.vm;
                if (!vm || !vm.loadProject) throw new Error('编辑器尚未就绪');
                return vm.loadProject(buf);
            })
            .then(() => {
                setProjectName(name);
                this.setState({loadingFile: null, mode: null});
                window.alert('已加载项目「' + name + '」');
            })
            .catch(err => this.setState({
                loadingFile: null,
                listError: (err && err.message) || String(err)
            }));
    }
    // ---------- 项目重命名 ----------
    startRename (p) {
        this.setState({renamingFile: p.file, renameValue: p.name, listError: null});
    }
    cancelRename () {
        this.setState({renamingFile: null, renameValue: ''});
    }
    onRenameInput (e) {
        this.setState({renameValue: e.target.value});
    }
    doRename (p) {
        const newName = (this.state.renameValue || '').trim();
        if (!newName) {
            this.setState({listError: '新项目名称不能为空'});
            return;
        }
        if (newName === p.name) {
            this.cancelRename();
            return;
        }
        this.setState({rowBusy: p.file, listError: null});
        fetch('/api/scratch/rename', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({file: p.file, newName: newName})
        })
            .then(r => r.json().then(res => {
                if (!r.ok || !res || !res.ok) {
                    throw new Error((res && res.error) || ('重命名失败（HTTP ' + r.status + '）'));
                }
                return res;
            }))
            .then(res => {
                // 若重命名的正是当前打开的项目，同步更新顶栏徽标
                if (getProjectName() === p.name) {
                    setProjectName(res.name);
                }
                this.setState({rowBusy: null, renamingFile: null, renameValue: ''});
                return this.refreshList();
            })
            .catch(err => this.setState({
                rowBusy: null,
                listError: (err && err.message) || String(err)
            }));
    }
    // ---------- 项目删除 ----------
    doDelete (p) {
        if (!window.confirm(T_DELETE_CONFIRM_PREFIX + p.name + T_DELETE_CONFIRM_SUFFIX)) {
            return;
        }
        this.setState({rowBusy: p.file, listError: null});
        fetch('/api/scratch/delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({file: p.file})
        })
            .then(r => r.json().then(res => {
                if (!r.ok || !res || !res.ok) {
                    throw new Error((res && res.error) || ('删除失败（HTTP ' + r.status + '）'));
                }
                return res;
            }))
            .then(() => {
                this.setState({rowBusy: null});
                return this.refreshList();
            })
            .catch(err => this.setState({
                rowBusy: null,
                listError: (err && err.message) || String(err)
            }));
    }
    render () {
            if (!this.state.mode) return null;
        const isSave = this.state.mode === 'save';
        const overlay = {
            position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,.45)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        };
        const card = {
            width: 460, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto',
            background: '#fff', color: '#3b3b3b', borderRadius: 10,
            boxShadow: '0 12px 40px rgba(0,0,0,.35)', fontFamily: 'inherit', padding: 20
        };
        return (
            <div
                style={overlay}
                onMouseDown={e => {
                    if (e.target === e.currentTarget) this.close();
                }}
            >
                <div style={card}>
                    <div style={{fontSize: 16, fontWeight: 700, marginBottom: 14}}>
                        {isSave ? T_SAVE_TITLE : T_LOAD_TITLE}
                    </div>

                    {isSave ? (
                        <div>
                            <label
                                style={{
                                    display: 'block', fontSize: 12, fontWeight: 700,
                                    marginBottom: 6, color: '#575e75'
                                }}
                            >
                                {T_NAME_LABEL}
                            </label>
                            <input
                                autoFocus
                                type="text"
                                value={this.state.name}
                                onChange={this.onName}
                                placeholder={T_NAME_PLACEHOLDER}
                                spellCheck={false}
                                style={{
                                    display: 'block', width: '100%', boxSizing: 'border-box',
                                    padding: '8px 10px', fontSize: 14, fontFamily: 'inherit',
                                    borderRadius: 6, border: '1px solid #c9cdd4', outline: 'none'
                                }}
                            />
                            <div style={{marginTop: 6, fontSize: 11, color: '#969da5'}}>
                                {T_SAVE_HINT}
                            </div>
                            {this.state.error && (
                                <div style={{marginTop: 10, fontSize: 12, color: '#d93025'}}>
                                    {this.state.error}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                            {this.state.loadingList && (
                                <div style={{fontSize: 13, color: '#969da5'}}>{T_LOADING_LIST}</div>
                            )}
                            {this.state.listError && (
                                <div style={{fontSize: 12, color: '#d93025'}}>
                                    {T_LOAD_FAIL}{this.state.listError}
                                </div>
                            )}
                            {!this.state.loadingList && !this.state.listError &&
                                this.state.projects.length === 0 && (
                                <div style={{fontSize: 13, color: '#969da5'}}>{T_EMPTY_HINT}</div>
                            )}
                            <div style={{marginTop: 8}}>
                                {this.state.projects.map(p => {
                                    const isRenaming = this.state.renamingFile === p.file;
                                    const isRowBusy = this.state.rowBusy === p.file;
                                    if (isRenaming) {
                                        // 重命名态：整行换成输入框 + 确定/取消，避免误触打开
                                        return (
                                            <div
                                                key={p.file}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                    padding: '8px 10px', marginBottom: 6,
                                                    borderRadius: 6, border: '1px solid #4c97ff',
                                                    background: '#f0f4ff'
                                                }}
                                            >
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={this.state.renameValue}
                                                    onChange={this.onRenameInput}
                                                    placeholder={T_RENAME_LABEL}
                                                    spellCheck={false}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') this.doRename(p);
                                                        if (e.key === 'Escape') this.cancelRename();
                                                    }}
                                                    style={{
                                                        flex: 1, minWidth: 0, boxSizing: 'border-box',
                                                        padding: '6px 8px', fontSize: 13,
                                                        fontFamily: 'inherit', borderRadius: 5,
                                                        border: '1px solid #c9cdd4', outline: 'none'
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    disabled={isRowBusy}
                                                    onClick={() => this.doRename(p)}
                                                    style={{
                                                        padding: '6px 12px', fontSize: 12,
                                                        fontWeight: 700, borderRadius: 5,
                                                        border: 'none', whiteSpace: 'nowrap',
                                                        background: isRowBusy ? '#a9c7ff' : '#4c97ff',
                                                        color: '#fff',
                                                        cursor: isRowBusy ? 'default' : 'pointer'
                                                    }}
                                                >
                                                    {isRowBusy ? T_RENAMING_BTN : T_RENAME_BTN}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={this.cancelRename}
                                                    style={{
                                                        padding: '6px 12px', fontSize: 12,
                                                        borderRadius: 5, whiteSpace: 'nowrap',
                                                        border: '1px solid #c9cdd4', background: '#fff',
                                                        color: '#575e75', cursor: 'pointer'
                                                    }}
                                                >
                                                    {T_CANCEL}
                                                </button>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div
                                            key={p.file}
                                            onClick={() => this.doLoad(p.file, p.name)}
                                            style={{
                                                display: 'flex', alignItems: 'center',
                                                justifyContent: 'space-between', gap: 10,
                                                padding: '10px 12px', marginBottom: 6,
                                                borderRadius: 6, border: '1px solid #e5e7eb',
                                                cursor: 'pointer', background: '#fafbfc'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = '#f0f4ff'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = '#fafbfc'; }}
                                        >
                                            <div style={{minWidth: 0, flex: 1}}>
                                                <div
                                                    style={{
                                                        fontSize: 14, fontWeight: 600,
                                                        whiteSpace: 'nowrap', overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}
                                                >
                                                    {p.name}
                                                </div>
                                                <div style={{fontSize: 11, color: '#969da5'}}>
                                                    {fmtSize(p.size)} · {fmtTime(p.mtime)}
                                                </div>
                                            </div>
                                            {this.state.loadingFile === p.name ? (
                                                <span style={{fontSize: 12, color: '#4c97ff'}}>{T_LOADING_FILE}</span>
                                            ) : (
                                                <span style={{display: 'flex', alignItems: 'center', gap: 4}}>
                                                    <button
                                                        type="button"
                                                        disabled={isRowBusy || !!this.state.loadingFile}
                                                        title={T_RENAME_TITLE}
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            this.startRename(p);
                                                        }}
                                                        style={{
                                                            padding: '4px 8px', fontSize: 12,
                                                            borderRadius: 5, whiteSpace: 'nowrap',
                                                            border: '1px solid #c9cdd4', background: '#fff',
                                                            color: '#575e75', cursor: 'pointer'
                                                        }}
                                                    >
                                                        {T_RENAME}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={isRowBusy || !!this.state.loadingFile}
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            this.doDelete(p);
                                                        }}
                                                        style={{
                                                            padding: '4px 8px', fontSize: 12,
                                                            borderRadius: 5, whiteSpace: 'nowrap',
                                                            border: '1px solid #f3b5ae', background: '#fff',
                                                            color: '#d93025', cursor: 'pointer'
                                                        }}
                                                    >
                                                        {T_DELETE}
                                                    </button>
                                                    <span style={{fontSize: 12, color: '#4c97ff', whiteSpace: 'nowrap'}}>
                                                        {T_OPEN}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {this.state.root && (
                                <div
                                    style={{
                                        marginTop: 10, fontSize: 11, color: '#969da5',
                                        wordBreak: 'break-all'
                                    }}
                                >
                                    {T_STORE_LOC}{this.state.root}
                                </div>
                            )}
                        </div>
                    )}

                    <div
                        style={{
                            display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18
                        }}
                    >
                        <button
                            type="button"
                            onClick={this.close}
                            style={{
                                padding: '8px 16px', fontSize: 13, borderRadius: 6,
                                border: '1px solid #c9cdd4', background: '#fff',
                                color: '#575e75', cursor: 'pointer'
                            }}
                        >
                            {T_CANCEL}
                        </button>
                        {isSave && (
                            <button
                                type="button"
                                disabled={this.state.busy}
                                onClick={this.doSave}
                                style={{
                                    padding: '8px 18px', fontSize: 13, fontWeight: 700,
                                    borderRadius: 6, border: 'none',
                                    background: this.state.busy ? '#a9c7ff' : '#4c97ff',
                                    color: '#fff', cursor: this.state.busy ? 'default' : 'pointer'
                                }}
                            >
                                {this.state.busy ? T_SAVING_BTN : T_SAVE_BTN}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }
}

ProjectStoreModal.propTypes = {
    vm: PropTypes.object
};

// 便捷触发函数：供 menu-bar 直接调用
export function openSaveDialog () {
    try { window.dispatchEvent(new CustomEvent('jarvis-open-save')); } catch (e) {}
}
export function openLoadDialog () {
    try { window.dispatchEvent(new CustomEvent('jarvis-open-load')); } catch (e) {}
}
