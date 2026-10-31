import React from 'react';
import PropTypes from 'prop-types';

// JARVIS 二次开发：Scratch「设置 ⚙」里的「项目保存路径」输入框。
// 值存 localStorage（key 见下），保存项目时由 menu-bar.jsx 读取并随请求发给网关，
// 网关把 .sb3 写入该目录。必须是 /Users/hill 下的绝对路径（网关侧会校验）。
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
                    padding: '10px 12px',
                    minWidth: 280,
                    boxSizing: 'border-box'
                }}
            >
                <div style={{
                    fontWeight: 700,
                    marginBottom: 6,
                    color: '#575e75',
                    fontSize: 13
                }}>
                    项目保存路径
                </div>
                <input
                    type="text"
                    value={this.state.path}
                    onChange={this.handleChange}
                    placeholder={DEFAULT_SAVE_PATH}
                    style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '6px 8px',
                        fontSize: 13,
                        borderRadius: 6,
                        border: '1px solid #d9d9d9',
                        outline: 'none'
                    }}
                />
                <div style={{
                    marginTop: 6,
                    fontSize: 11,
                    lineHeight: 1.4,
                    color: '#9aa0b0'
                }}>
                    保存项目时写入此目录（须为 /Users/hill 下的绝对路径）。
                    在「文件 ▸ 保存项目到本机」中生效。
                </div>
            </div>
        );
    }
}

SavePathSettings.propTypes = {
    onChange: PropTypes.func
};

export default SavePathSettings;
