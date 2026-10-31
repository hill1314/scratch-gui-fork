import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import LanguageMenu from './language-menu.jsx';
import MenuBarMenu from './menu-bar-menu.jsx';
import ThemeMenu from './theme-menu.jsx';
import {MenuSection, MenuItem} from '../menu/menu.jsx';
import SavePathSettings from './save-path-settings.jsx';
import TurboMode from '../../containers/turbo-mode.jsx';

import menuBarStyles from './menu-bar.css';
import styles from './settings-menu.css';

import dropdownCaret from './dropdown-caret.svg';
import settingsIcon from './icon--settings.svg';

// JARVIS 定制开关：隐藏「语言」「配色」与「项目保存路径(即设置里那个 ScratchProjects 输入框)」。
// 按需求全部关闭；日后要恢复，把对应常量改回 true 即可（组件与样式均未删除）。
const SHOW_LANGUAGE = false;
const SHOW_THEME = false;
const SHOW_SAVE_PATH = true;

const SettingsMenu = ({
    canChangeLanguage,
    canChangeTheme,
    isRtl,
    onRequestClose,
    onRequestOpen,
    settingsMenuOpen
}) => (
    <div
        className={classNames(menuBarStyles.menuBarItem, menuBarStyles.hoverable, menuBarStyles.themeMenu, {
            [menuBarStyles.active]: settingsMenuOpen
        })}
        onMouseUp={onRequestOpen}
    >
        <img
            src={settingsIcon}
        />
        <span className={styles.dropdownLabel}>
            <FormattedMessage
                defaultMessage="Settings"
                description="Settings menu"
                id="gui.menuBar.settings"
            />
        </span>
        <img src={dropdownCaret} />
        <MenuBarMenu
            className={menuBarStyles.menuBarMenu}
            open={settingsMenuOpen}
            place={isRtl ? 'left' : 'right'}
            onRequestClose={onRequestClose}
        >
            {SHOW_LANGUAGE && canChangeLanguage && (
                <MenuSection>
                    <LanguageMenu onRequestCloseSettings={onRequestClose} />
                </MenuSection>
            )}
            {SHOW_THEME && canChangeTheme && (
                <MenuSection>
                    <ThemeMenu onRequestCloseSettings={onRequestClose} />
                </MenuSection>
            )}
            <MenuSection>
                <TurboMode>{(toggleTurboMode, {turboMode}) => (
                    <MenuItem onClick={toggleTurboMode}>
                        {turboMode ? (
                            <FormattedMessage
                                defaultMessage="Turn off Turbo Mode"
                                description="Menu bar item for turning off turbo mode"
                                id="gui.menuBar.turboModeOff"
                            />
                        ) : (
                            <FormattedMessage
                                defaultMessage="Turn on Turbo Mode"
                                description="Menu bar item for turning on turbo mode"
                                id="gui.menuBar.turboModeOn"
                            />
                        )}
                    </MenuItem>
                )}</TurboMode>
            </MenuSection>
            {SHOW_SAVE_PATH && (
                <MenuSection>
                    <SavePathSettings />
                </MenuSection>
            )}
        </MenuBarMenu>
    </div>
);

SettingsMenu.propTypes = {
    canChangeLanguage: PropTypes.bool,
    canChangeTheme: PropTypes.bool,
    isRtl: PropTypes.bool,
    onRequestClose: PropTypes.func,
    onRequestOpen: PropTypes.func,
    settingsMenuOpen: PropTypes.bool
};

export default SettingsMenu;
