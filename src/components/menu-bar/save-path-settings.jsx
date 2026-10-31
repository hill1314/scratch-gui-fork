import React from 'react';
import PropTypes from 'prop-types';

// JARVIS 二次开发：Scratch「设置 ⚙」里的「项目保存路径」输入框。
// 值存 localStorage（key 见下），保存项目时由 menu-bar.jsx 读取并随请求发给网关，
// 网关把 .sb3 写入该目录。必须是 /Users/hill 下的绝对路径（网关侧会校验）。
//
// ⚠️ 布局约束：菜单容器 .menu 有 max-width: 260px、颜色为深底白字。
//   这里所有尺寸都必须在这个宽度内自适应（width:100%），否则会撑破菜单、
//   文字换行挤成一团。别再写 minWidth。
export const SAVE_PATH_KEY = 'jarvis.scratch.savePath';
export const DEFAULT_SAVE_PATH = '/Users/hill/ScratchProjects';

class SavePathSettings extends React.Component {
    constructor (props) {
        super(props);
        let initial = '';
        try {
            initial = window.localStorage.getItem(SAVE_PATH_KEY) || '';
        } catch (e) {
            initial = '';
        }
        this.state = {path: initial};
        this.handleChange = this.handleChange.bind(this);
    }
    handleChange (e) {
        const value = e.target.value;
        this.setState({path: value});
        try {
            window.localStorage.setItem(SAVE_PATH_KEY, value);
        } catch (e) {
            // 隐私模式等场景下 localStorage 可能不可写，忽略即可
        }
    }
    render () {
        return (
            <div
                style={{
                    padding: '8px 10px 10px',
                    boxSizing: 'border-box',
                    width: '100%',
                    // 菜单是深色底，这里统一用白字，与 Language / Color Mode 行一致
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700
                }}
            >
                <div style={{marginBottom: 6}}>
                    项目保存路径
                </div>
                <input
                    type="text"
                    value={this.state.path}
                    onChange={this.handleChange}
                    placeholder={DEFAULT_SAVE_PATH}
                    spellCheck={false}
                    style={{
                        display: 'block',
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '5px 7px',
                        fontSize: 12,
                        fontFamily: 'inherit',
                        borderRadius: 4,
                        border: '1px solid rgba(0, 0, 0, .15)',
                        outline: 'none',
                        color: '#575e75',
                        background: '#fff'
                    }}
                />
                <div style={{
                    marginTop: 5,
                    fontSize: 10,
                    lineHeight: 1.35,
                    fontWeight: 400,
                    color: 'rgba(255, 255, 255, .78)',
                    // 长路径提示不撑破 260px：允许在任意位置折行
                    wordBreak: 'break-all'
                }}>
                    /Users/hill 下的绝对路径，用于「文件 ▸ 保存项目到本机」
                </div>
            </div>
        );
    }
}

SavePathSettings.propTypes = {
    onChange: PropTypes.func
};

export default SavePathSettings;
