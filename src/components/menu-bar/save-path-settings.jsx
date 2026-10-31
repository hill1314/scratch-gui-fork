import React from 'react';
import PropTypes from 'prop-types';

// JARVIS 二次开发：
// 「设置 ⚙」里的「项目统一存储位置」。
// 2026-10-31 起保存改为「统一存储」：无论用哪个设备访问，项目都写入当前 Mac 的固定目录
//   /Users/hill/ScratchProjects（网关 JARVIS_SCRATCH_SAVE_DIR，可按环境变量改）。
// 因此这里不再让用户输入/浏览路径（那会破坏统一存储语义），只做只读展示 + 提示，
// 真正的「查看列表 / 加载」由「项目 ▸ 打开项目」弹窗完成。
export const SAVE_PATH_KEY = 'jarvis.scratch.savePath';
export const DEFAULT_SAVE_PATH = '/Users/hill/ScratchProjects';

class SavePathSettings extends React.Component {
    render () {
        const wrapStyle = {
            padding: '8px 10px 10px',
            boxSizing: 'border-box',
            width: '100%',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700
        };
        const pathStyle = {
            display: 'block',
            width: '100%',
            boxSizing: 'border-box',
            padding: '5px 7px',
            fontSize: 12,
            fontFamily: 'inherit',
            borderRadius: 4,
            border: '1px solid rgba(0, 0, 0, .15)',
            background: '#fff',
            color: '#575e75',
            wordBreak: 'break-all',
            minHeight: 26
        };
        const helpStyle = {
            marginTop: 6,
            fontSize: 10,
            lineHeight: 1.4,
            fontWeight: 400,
            color: 'rgba(255, 255, 255, .78)',
            wordBreak: 'break-all'
        };
        return (
            <div style={wrapStyle}>
                <div style={{marginBottom: 6}}>
                    项目统一存储位置
                </div>
                <div style={pathStyle}>
                    {DEFAULT_SAVE_PATH}
                </div>
                <div style={helpStyle}>
                    所有保存的项目都落在当前 Mac 的这个固定目录，与访问设备无关；
                    可在「项目 ▸ 打开项目」中查看列表并加载。
                </div>
            </div>
        );
    }
}

SavePathSettings.propTypes = {
    onChange: PropTypes.func
};

export default SavePathSettings;
