import {addLocaleData} from 'react-intl';

import {localeData, isRtl} from 'scratch-l10n';
import editorMessages from 'scratch-l10n/locales/editor-msgs';

addLocaleData(localeData);

// JARVIS 二次开发：上游 zh-cn 包里少数菜单项没汉化（值直接就是英文），
// 例如 gui.menuBar.settings -> "Settings"、gui.menuBar.colorMode -> "Color Mode"。
// 这里做一份本地覆盖，只补真正缺译的键，其它一律沿用上游翻译。
const ZH_CN_OVERRIDES = {
    'gui.menuBar.settings': '设置',
    'gui.menuBar.colorMode': '配色模式',
    'gui.menuBar.theme': '主题',
    'gui.menuBar.language': '语言',
    'gui.menuBar.languageSelector': '语言'
};

const applyOverrides = messages => {
    const merged = Object.assign({}, messages);
    if (merged['zh-cn']) {
        merged['zh-cn'] = Object.assign({}, merged['zh-cn']);
        const zh = merged['zh-cn'];
        Object.keys(ZH_CN_OVERRIDES).forEach(key => {
            // 只在「缺失」或「值仍是英文原文」时覆盖，避免盖掉上游后续改进的翻译
            const cur = zh[key];
            if (cur === undefined || cur === '' || /^[A-Za-z][A-Za-z\s]*$/.test(cur)) {
                zh[key] = ZH_CN_OVERRIDES[key];
            }
        });
    }
    return merged;
};

const localizedEditorMessages = applyOverrides(editorMessages);

const UPDATE_LOCALES = 'scratch-gui/locales/UPDATE_LOCALES';
const SELECT_LOCALE = 'scratch-gui/locales/SELECT_LOCALE';

const initialState = {
    isRtl: false,
    locale: 'en',
    messagesByLocale: localizedEditorMessages,
    messages: localizedEditorMessages.en
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case SELECT_LOCALE:
        return Object.assign({}, state, {
            isRtl: isRtl(action.locale),
            locale: action.locale,
            messagesByLocale: state.messagesByLocale,
            messages: state.messagesByLocale[action.locale]
        });
    case UPDATE_LOCALES:
        return Object.assign({}, state, {
            isRtl: state.isRtl,
            locale: state.locale,
            messagesByLocale: action.messagesByLocale,
            messages: action.messagesByLocale[state.locale]
        });
    default:
        return state;
    }
};

const selectLocale = function (locale) {
    return {
        type: SELECT_LOCALE,
        locale: locale
    };
};

const setLocales = function (localesMessages) {
    return {
        type: UPDATE_LOCALES,
        messagesByLocale: localesMessages
    };
};
const initLocale = function (currentState, locale) {
    if (Object.prototype.hasOwnProperty.call(currentState.messagesByLocale, locale)) {
        return Object.assign(
            {},
            currentState,
            {
                isRtl: isRtl(locale),
                locale: locale,
                messagesByLocale: currentState.messagesByLocale,
                messages: currentState.messagesByLocale[locale]
            }
        );
    }
    // don't change locale if it's not in the current messages
    return currentState;
};
export {
    reducer as default,
    initialState as localesInitialState,
    initLocale,
    selectLocale,
    setLocales
};
