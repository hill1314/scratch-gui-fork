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
            <MenuSection>
                {canChangeLanguage && <LanguageMenu onRequestCloseSettings={onRequestClose} />}
                {canChangeTheme && <ThemeMenu onRequestCloseSettings={onRequestClose} />}
            </MenuSection>
            {/* 加速模式（原「编辑」菜单里的 Turbo Mode）。
                「编辑」菜单只剩「恢复删除」+ 这一项，为精简顶栏已整个去掉，
                把这唯一还有用的开关挪到「设置」里来，由 TurboMode 容器提供
                toggle 与当前状态（它内部连的是 redux 的 vmStatus.turbo）。 */}
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
            {/* 项目保存路径单独一个分区：与上面的语言/主题拉开分隔线，避免挤在一起看不清 */}
            <MenuSection>
                <SavePathSettings />
            </MenuSection>
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
