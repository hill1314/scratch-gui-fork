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
const T_EMPTY_HINT = '统一项目目录还没有项目，先去「项目 ▸ 保存项目」创建一个吧。';
const T_LOADING_FILE = '加载中…';
const T_OPEN = '打开 ▸';
const T_STORE_LOC = '统一存储位置：';
// 项目列表行的操作（删除 / 重命名 / 复制）
const T_RENAME = '重命名';
const T_DELETE = '删除';
const T_COPY = '复制';
const T_CURRENT = '当前打开';
const T_COPY_TITLE = '复制一份项目（原项目不受影响）';
const T_RENAME_TITLE = '重命名项目';
const T_RENAME_LABEL = '新的项目名称';
const T_RENAME_BTN = '确定';
const T_RENAMING_BTN = '处理中…';
const T_DELETE_CONFIRM_PREFIX = '确定要删除项目「';
const T_DELETE_CONFIRM_SUFFIX = '」吗？\n\n删除后文件会移入统一目录下的 .trash 子目录，如需找回可从该目录取回。';
// 新建项目后的默认项目名（顶栏徽标显示它，保存时会作为「项目名称」预填值）
export const DEFAULT_PROJECT_NAME = '未命名';

// ---------- 启动选择项目 / 自动保存 文案 ----------
// 进页面第一件事是先选项目：要么打开一个已有项目，要么新建一个（必须命名）。
const T_START_TITLE = '先选一个项目';
const T_START_HINT = '每次打开编辑器都要先确定在改哪个项目，避免改动落在不该落的地方。';
const T_START_NEW_SECTION = '新建项目';
const T_START_NEW_NAME = '项目名称（必填）';
const T_START_NEW_PH = '例如：小猫冒险';
const T_START_NEW_BTN = '新建并开始';
const T_START_CREATING = '创建中…';
const T_START_OPEN_SECTION = '打开已有项目';
const T_START_EMPTY = '还没有项目，直接在上面新建一个吧。';
const T_RELOAD = '刷新列表';
const T_NEW_AUTOSAVED_PREFIX = '原项目「';
const T_NEW_AUTOSAVED_SUFFIX = '」已自动保存。';
const T_NEW_NEED_NAME = '给新项目起个名字再开始，避免和已有项目混在一起。';
// 自动保存（每 10 秒一次，静默覆盖同名文件）
export const AUTOSAVE_INTERVAL_MS = 10000;
const T_AUTO_SAVING = '保存中…';
const T_AUTO_SAVED = '已自动保存';
const T_AUTO_FAIL = '自动保存失败';
const T_AUTO_IDLE = '每 10 秒自动保存';

// 手动保存与自动保存共用一把锁：同一时刻只允许一个保存请求在飞，
// 否则两次 saveProjectSb3 交错会把较早的内容当成最新版覆盖上去。
let SAVE_IN_FLIGHT = false;

// 保存当前画布为指定项目名（同名覆盖）。成功返回 true，失败抛错。
function saveProjectAsName (vm, name) {
    if (!vm || !vm.saveProjectSb3) {
        return Promise.reject(new Error('编辑器尚未就绪，请稍候再试'));
    }
    return Promise.resolve(vm.saveProjectSb3())
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
            if (!size) throw new Error('当前项目内容为空，请先添加角色或积木再保存');
            const b64 = bytesToBase64(bytes);
            return fetch('/api/scratch/save', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name: name, data: b64})
            })
                .then(r => r.json())
                .then(res => {
                    if (!res || !res.ok) throw new Error((res && res.error) || '保存失败');
                    setProjectName(name);
                    setProjectFile(res.file || '');
                    return res.file || '';
                });
        });
}

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

// 当前打开的是哪个文件（用于项目列表高亮）。名字可能重名、也可能与文件名不同，
// 所以单独存一份文件名，比靠名字猜更准。
export const PROJECT_FILE_KEY = 'jarvis.scratch.projectFile';

// 页面级「是否真的载入过项目」标记：只活在当前页面，刷新即失效。
// 用途：自动保存、直播推送都不能在「只是打开了编辑器」时动手，
// 否则默认小猫项目会把同名的真实项目覆盖掉。
export function markProjectReady (ready) {
    try {
        window.__jarvisProjectReady = !!ready;
    } catch (e) {}
}

export function isProjectReady () {
    try {
        return window.__jarvisProjectReady === true;
    } catch (e) {
        return false;
    }
}

export function getProjectFile () {
    try {
        return (window.localStorage.getItem(PROJECT_FILE_KEY) || '').trim();
    } catch (e) {
        return '';
    }
}

export function setProjectFile (file) {
    try {
        window.localStorage.setItem(PROJECT_FILE_KEY, file || '');
    } catch (e) {
        // 隐私模式等场景 localStorage 不可写，忽略即可
    }
    try {
        window.dispatchEvent(new CustomEvent('jarvis-project-file-changed', {
            detail: {file: file || ''}
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
        const name = this.state.name || DEFAULT_PROJECT_NAME;
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
            mode: null,          // null | 'start' | 'save' | 'load'
            notice: '',          // 弹窗顶部的绿色提示（例如「原项目已自动保存」）
            allowStartCancel: false, // 「新建」进到命名弹窗后允许取消（首次进站仍必须选项目）
            startSettled: false, // 启动选择弹窗是否已经处理过（选过项目后不再自动弹）
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
            rowBusy: null,       // 正在删除/重命名中的项目文件名
            currentFile: getProjectFile()   // 当前打开的项目文件名，用于列表高亮
        };
        this.maybeOpenStart = this.maybeOpenStart.bind(this);
        this.openStart = this.openStart.bind(this);
        this.openCreate = this.openCreate.bind(this);
        this.cancelCreate = this.cancelCreate.bind(this);
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
        this.doCopy = this.doCopy.bind(this);
        this.onProjectFileChanged = this.onProjectFileChanged.bind(this);
    }
    onProjectFileChanged (e) {
        const file = (e && e.detail && e.detail.file) || '';
        if (file !== this.state.currentFile) this.setState({currentFile: file});
    }
    componentDidMount () {
        window.addEventListener('jarvis-open-save', this.openSave);
        window.addEventListener('jarvis-open-create', this.openCreate);
        window.addEventListener('jarvis-open-load', this.openLoad);
        window.addEventListener('jarvis-project-file-changed', this.onProjectFileChanged);
        this.maybeOpenStart();
    }
    componentDidUpdate () {
        // vm 由 App 注入、可能晚于本组件就绪，所以每次 props 变化都再看一眼
        this.maybeOpenStart();
    }
    componentWillUnmount () {
        window.removeEventListener('jarvis-open-save', this.openSave);
        window.removeEventListener('jarvis-open-create', this.openCreate);
        window.removeEventListener('jarvis-open-load', this.openLoad);
        window.removeEventListener('jarvis-project-file-changed', this.onProjectFileChanged);
    }
    // 启动选择：只要编辑器就绪、且还没处理过，就强制弹一次「选项目 / 新建项目」
    maybeOpenStart () {
        if (this.state.startSettled || this.state.mode) return;
        const vm = this.props.vm;
        if (!vm || !vm.saveProjectSb3) return;
        this.openStart();
    }
    openStart () {
        setProjectName('');   // 还没确定项目：先让徽标回到「未命名」，别显示上次的名字
        setProjectFile('');   // 启动阶段还没打开任何项目，列表里不该有高亮
        // 本页实例还没真正载入过项目：自动保存/直播推送都必须按兵不动，
        // 否则一打开编辑器就用默认小猫项目把用户的 .sb3 覆盖掉
        markProjectReady(false);
        this.setState({
            mode: 'start', name: '', error: null, busy: false,
            allowStartCancel: false,
            listError: null, loadingList: true, projects: [], root: '',
            renamingFile: null, rowBusy: null, loadingFile: null
        });
        this.refreshList();
    }
    /**
     * 顶栏「新建项目」：如果当前确实打开着某个项目，先把它的最新画布存盘，
     * 存成功后再弹「给新项目命名」，避免一路新建把上一個项目丢掉或落在旧文件名下。
     */
    openCreate () {
        const vm = this.props.vm;
        const name = getProjectName();
        const needSave = isProjectReady() && name && name !== DEFAULT_PROJECT_NAME &&
            vm && vm.saveProjectSb3;
        // 记住当前项目：命名弹窗里点取消要能回到它继续改
        this.prevName = name || '';
        this.prevFile = getProjectFile() || '';
        if (!needSave) {
            this.openStart();
            this.setState({allowStartCancel: true});
            return;
        }
        this.setState({busy: true, error: null, notice: ''});
        saveProjectAsName(vm, name)
            .then(() => {
                this.openStart();
                this.setState({
                    busy: false, allowStartCancel: true,
                    notice: T_NEW_AUTOSAVED_PREFIX + name + T_NEW_AUTOSAVED_SUFFIX
                });
            })
            .catch(err => {
                // 原项目没存成功就不要往下走：宁可什么都不发生，也不让它被新项目顶掉
                this.setState({
                    busy: false,
                    error: '原项目保存失败，已取消新建：' + ((err && err.message) || String(err))
                });
            });
    }
    // 命名弹窗里反悔：回到原来的项目接着改（画布没被清过，只需把名字/高亮恢复）
    cancelCreate () {
        if (this.prevName) {
            setProjectName(this.prevName);
            setProjectFile(this.prevFile || '');
            markProjectReady(true);
        }
        this.setState({mode: null, allowStartCancel: false, notice: '', error: null, busy: false});
    }
    openSave () {
        this.setState({mode: 'save', name: getProjectName(), error: null, busy: false});
    }
    openLoad () {
        this.setState({
            mode: 'load', error: null, listError: null,
            loadingList: true, projects: [], root: '',
            renamingFile: null, rowBusy: null,
            currentFile: getProjectFile()   // 重新读一次，页面刷新后也能对上
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
        // 启动选择弹窗是「强制」的：不选项目就直接关掉等于回到未归属状态，
        // 所以这里只在 save/load 弹窗里生效；start 模式点遮罩/取消也走这里兜底。
        this.setState({mode: null, startSettled: true});
    }
    onName (e) {
        this.setState({name: e.target.value});
    }
    doSave () {
        const name = (this.state.name || '').trim();
        if (!name || name === DEFAULT_PROJECT_NAME) {
            this.setState({error: '请输入项目名称（新建项目必须命名）'});
            return;
        }
        if (SAVE_IN_FLIGHT) return;
        const vm = this.props.vm;
        if (!vm || !vm.saveProjectSb3) {
            this.setState({error: '编辑器尚未就绪，请稍候再试'});
            return;
        }
        const isStart = this.state.mode === 'start';
        this.setState({busy: true, error: null});
        SAVE_IN_FLIGHT = true;
        saveProjectAsName(vm, name)
            .then(() => {
                SAVE_IN_FLIGHT = false;
                markProjectReady(true);
                this.setState({
                    busy: false, mode: null,
                    startSettled: isStart ? true : this.state.startSettled
                });
            })
            .catch(err => {
                SAVE_IN_FLIGHT = false;
                this.setState({busy: false, error: (err && err.message) || String(err)});
            });
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
                setProjectFile(file);
                markProjectReady(true);
                this.setState({loadingFile: null, mode: null, startSettled: true});
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
                // 若重命名的正是当前打开的项目，同步更新顶栏徽标与高亮标记
                if (getProjectName() === p.name) {
                    setProjectName(res.name);
                }
                if (this.state.currentFile === p.file) {
                    setProjectFile(res.file || '');
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
                // 删掉的正好是当前打开的项目：清掉高亮，别留一个不存在的标记
                if (this.state.currentFile === p.file) {
                    setProjectFile('');
                    setProjectName('');
                }
                this.setState({rowBusy: null});
                return this.refreshList();
            })
            .catch(err => this.setState({
                rowBusy: null,
                listError: (err && err.message) || String(err)
            }));
    }
    // ---------- 项目复制 ----------
    // 孩子改坏自己的作品时常要「留个备份再试」，所以复制是独立操作：
    // 服务端自动命名「原名 副本」，原项目不动，不弹确认框。
    doCopy (p) {
        this.setState({rowBusy: p.file, listError: null});
        fetch('/api/scratch/copy', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({file: p.file})
        })
            .then(r => r.json().then(res => {
                if (!r.ok || !res || !res.ok) {
                    throw new Error((res && res.error) || ('复制失败（HTTP ' + r.status + '）'));
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
        const isStart = this.state.mode === 'start';
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
                    if (e.target === e.currentTarget && !isStart) this.close();
                }}
            >
                <div style={card}>
                    <div style={{fontSize: 16, fontWeight: 700, marginBottom: isStart ? 4 : 14}}>
                        {isStart ? T_START_TITLE : (isSave ? T_SAVE_TITLE : T_LOAD_TITLE)}
                    </div>
                    {isStart && (
                        <div style={{fontSize: 12, color: '#575e75', marginBottom: 14}}>
                            {T_START_HINT}
                        </div>
                    )}
                    {this.state.notice && (
                        <div
                            style={{
                                fontSize: 12, color: '#1f7a3d', background: '#eaf7ee',
                                border: '1px solid #bfe5cb', borderRadius: 6,
                                padding: '6px 8px', marginBottom: 12
                            }}
                        >
                            {this.state.notice}
                        </div>
                    )}

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
                            {isStart && (
                                <div
                                    style={{
                                        marginBottom: 16, padding: '12px 12px 10px',
                                        border: '1px solid #cfdcff', background: '#f4f8ff',
                                        borderRadius: 8
                                    }}
                                >
                                    <div style={{fontSize: 13, fontWeight: 700, marginBottom: 8}}>
                                        {T_START_NEW_SECTION}
                                    </div>
                                    <label
                                        style={{
                                            display: 'block', fontSize: 12, fontWeight: 700,
                                            marginBottom: 6, color: '#575e75'
                                        }}
                                    >
                                        {T_START_NEW_NAME}
                                    </label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={this.state.name}
                                        onChange={this.onName}
                                        placeholder={T_START_NEW_PH}
                                        spellCheck={false}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') this.doSave();
                                        }}
                                        style={{
                                            display: 'block', width: '100%', boxSizing: 'border-box',
                                            padding: '8px 10px', fontSize: 14, fontFamily: 'inherit',
                                            borderRadius: 6, border: '1px solid #c9cdd4', outline: 'none'
                                        }}
                                    />
                                </div>
                            )}
                            {isStart && (
                                <div style={{fontSize: 13, fontWeight: 700, marginBottom: 8}}>
                                    {T_START_OPEN_SECTION}
                                </div>
                            )}
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
                                <div style={{fontSize: 13, color: '#969da5'}}>
                                    {isStart ? T_START_EMPTY : T_EMPTY_HINT}
                                </div>
                            )}
                            <div style={{marginTop: 8}}>
                                {this.state.projects.map(p => {
                                    const isRenaming = this.state.renamingFile === p.file;
                                    const isRowBusy = this.state.rowBusy === p.file;
                                    const isCurrent = !!this.state.currentFile &&
                                        this.state.currentFile === p.file;
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
                                                borderRadius: 6,
                                                border: isCurrent ? '1px solid #4c97ff' : '1px solid #e5e7eb',
                                                cursor: 'pointer',
                                                background: isCurrent ? '#eaf2ff' : '#fafbfc',
                                                boxShadow: isCurrent ? 'inset 3px 0 0 #4c97ff' : 'none'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = isCurrent ? '#eaf2ff' : '#f0f4ff';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = isCurrent ? '#eaf2ff' : '#fafbfc';
                                            }}
                                        >
                                            <div style={{minWidth: 0, flex: 1}}>
                                                <div style={{display: 'flex', alignItems: 'center', minWidth: 0}}>
                                                    <div
                                                        style={{
                                                            fontSize: 14, fontWeight: 600, minWidth: 0,
                                                            whiteSpace: 'nowrap', overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        }}
                                                    >
                                                        {p.name}
                                                    </div>
                                                    {isCurrent ? (
                                                        <span
                                                            style={{
                                                                flex: 'none', marginLeft: 6,
                                                                padding: '1px 7px', fontSize: 10, lineHeight: '14px',
                                                                fontWeight: 600, color: '#fff',
                                                                background: '#4c97ff', borderRadius: 9,
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                        >
                                                            {T_CURRENT}
                                                        </span>
                                                    ) : null}
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
                                                        title={T_COPY_TITLE}
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            this.doCopy(p);
                                                        }}
                                                        style={{
                                                            padding: '4px 8px', fontSize: 12,
                                                            borderRadius: 5, whiteSpace: 'nowrap',
                                                            border: '1px solid #c9cdd4', background: '#fff',
                                                            color: '#575e75', cursor: 'pointer'
                                                        }}
                                                    >
                                                        {T_COPY}
                                                    </button>
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

                    {this.state.error && !isSave && (
                        <div style={{marginTop: 12, fontSize: 12, color: '#d93025'}}>
                            {this.state.error}
                        </div>
                    )}
                    <div
                        style={{
                            display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18
                        }}
                    >
                        {isStart ? (
                            <React.Fragment>
                                {this.state.allowStartCancel ? (
                                    <button
                                        type="button"
                                        disabled={this.state.busy}
                                        onClick={this.cancelCreate}
                                        style={{
                                            padding: '8px 16px', fontSize: 13, borderRadius: 6,
                                            border: '1px solid #c9cdd4', background: '#fff',
                                            color: '#575e75',
                                            cursor: this.state.busy ? 'default' : 'pointer'
                                        }}
                                    >
                                        {T_CANCEL}
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    disabled={this.state.busy}
                                    onClick={this.refreshList}
                                    style={{
                                        padding: '8px 14px', fontSize: 13, borderRadius: 6,
                                        border: '1px solid #c9cdd4', background: '#fff',
                                        color: '#575e75', cursor: this.state.busy ? 'default' : 'pointer'
                                    }}
                                >
                                    {T_RELOAD}
                                </button>
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
                                    {this.state.busy ? T_START_CREATING : T_START_NEW_BTN}
                                </button>
                            </React.Fragment>
                        ) : (
                            <React.Fragment>
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
                            </React.Fragment>
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

// ============================ 自动保存 ============================
// 编辑过程中每 10 秒把当前画布覆盖保存到「当前项目名」对应的 .sb3。
// 只有已经选定项目（项目名不是「未命名」）才落盘，避免把没命名的草稿写进统一目录。
function fmtClock (ms) {
    try {
        const d = new Date(ms);
        const p = x => (x < 10 ? '0' : '') + x;
        return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    } catch (e) {
        return '';
    }
}

export class AutoSaver extends React.Component {
    constructor (props) {
        super(props);
        this.state = {status: 'idle', at: 0, error: null};
        this.timer = null;
        this.tick = this.tick.bind(this);
        this.handleQuickSave = this.handleQuickSave.bind(this);
    }
    componentDidMount () {
        this.timer = setInterval(this.tick, AUTOSAVE_INTERVAL_MS);
        // 顶栏「保存项目」在项目已命名时走这里：不弹框，直接存一次
        window.addEventListener('jarvis-quick-save', this.handleQuickSave);
    }
    componentWillUnmount () {
        if (this.timer) clearInterval(this.timer);
        window.removeEventListener('jarvis-quick-save', this.handleQuickSave);
    }
    handleQuickSave () {
        this.tick();
    }
    tick () {
        const vm = this.props.vm;
        if (!vm || !vm.saveProjectSb3) return;
        if (!isProjectReady()) return;                        // 本页还没载入项目：不自动保存
        const name = getProjectName();
        if (!name || name === DEFAULT_PROJECT_NAME) return;   // 没选定项目：不自动保存
        if (SAVE_IN_FLIGHT) return;                            // 上一次还在飞：跳过这一轮
        SAVE_IN_FLIGHT = true;
        this.setState({status: 'saving'});
        saveProjectAsName(vm, name)
            .then(() => {
                SAVE_IN_FLIGHT = false;
                this.setState({status: 'saved', at: Date.now(), error: null});
            })
            .catch(err => {
                SAVE_IN_FLIGHT = false;
                this.setState({status: 'fail', error: (err && err.message) || String(err)});
            });
    }
    render () {
        const {status, at, error} = this.state;
        const fail = status === 'fail';
        let text = T_AUTO_IDLE;
        if (status === 'saving') text = T_AUTO_SAVING;
        else if (status === 'saved') text = T_AUTO_SAVED + ' ' + fmtClock(at);
        else if (status === 'fail') text = T_AUTO_FAIL + (error ? '：' + error : '');
        return (
            <div
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: 32,
                    padding: '0 8px',
                    margin: '0 6px 0 0',
                    fontSize: 11,
                    color: fail ? '#d93025' : '#8a919a',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    maxWidth: 260,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}
                title={text}
            >
                {text}
            </div>
        );
    }
}

AutoSaver.propTypes = {
    vm: PropTypes.object
};

// 便捷触发函数：供 menu-bar 直接调用
export function openSaveDialog () {
    try { window.dispatchEvent(new CustomEvent('jarvis-open-save')); } catch (e) {}
}

// 新建项目：先保存当前项目再弹「给新项目命名」，所以同样交给弹窗组件处理
export function openCreateDialog () {
    try { window.dispatchEvent(new CustomEvent('jarvis-open-create')); } catch (e) {}
}

// 已命名项目点「保存项目」：不弹框，直接存
export function requestQuickSave () {
    try { window.dispatchEvent(new CustomEvent('jarvis-quick-save')); } catch (e) {}
}
export function openLoadDialog () {
    try { window.dispatchEvent(new CustomEvent('jarvis-open-load')); } catch (e) {}
}
