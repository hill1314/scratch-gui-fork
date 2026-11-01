import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';
import {compose} from 'redux';

import Box from '../components/box/box.jsx';
import GUI from '../containers/gui.jsx';
import HashParserHOC from '../lib/hash-parser-hoc.jsx';
import AppStateHOC from '../lib/app-state-hoc.jsx';

import {setPlayer} from '../reducers/mode';

if (process.env.NODE_ENV === 'production' && typeof window === 'object') {
    // Warn before navigating away
    window.onbeforeunload = () => true;
}

import styles from './player.css';
import LiveViewer from '../components/menu-bar/scratch-live-viewer.jsx';

// JARVIS 二次开发：直播观看模式。
// URL 带 ?live=<sid> 时进入只读围观：不加载 projectId，改由 LiveViewer 轮询网关快照，
// 把最新的 .sb3 灌进 vm，画面自动跟随演示者更新。
const LIVE_SID = (() => {
    try {
        const q = new URLSearchParams(window.location.search);
        return (q.get('live') || '').trim();
    } catch (e) {
        return '';
    }
})();

const Player = ({isPlayerOnly, onSeeInside, projectId, vm}) => (
    <Box className={classNames(isPlayerOnly ? styles.stageOnly : styles.editor)}>
        {/* 演示者用的是「查看内部」按钮，直播观看时隐藏，避免误操作离开围观页 */}
        {isPlayerOnly && !LIVE_SID && <button onClick={onSeeInside}>{'See inside'}</button>}
        <GUI
            canEditTitle
            enableCommunity
            isPlayerOnly={isPlayerOnly}
            projectId={projectId}
        />
        {LIVE_SID && <LiveViewer
            sid={LIVE_SID}
            vm={vm}
        />}
    </Box>
);

Player.propTypes = {
    isPlayerOnly: PropTypes.bool,
    onSeeInside: PropTypes.func,
    projectId: PropTypes.string,
    vm: PropTypes.object
};

const mapStateToProps = state => ({
    isPlayerOnly: state.scratchGui.mode.isPlayerOnly,
    // 直播观看需要直接操作 vm 来载入快照（与 gui.jsx 同源）
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    onSeeInside: () => dispatch(setPlayer(false))
});

const ConnectedPlayer = connect(
    mapStateToProps,
    mapDispatchToProps
)(Player);

// note that redux's 'compose' function is just being used as a general utility to make
// the hierarchy of HOC constructor calls clearer here; it has nothing to do with redux's
// ability to compose reducers.
const WrappedPlayer = compose(
    AppStateHOC,
    HashParserHOC
)(ConnectedPlayer);

const appTarget = document.createElement('div');
document.body.appendChild(appTarget);

ReactDOM.render(<WrappedPlayer isPlayerOnly />, appTarget);
