import {addLocaleData} from 'react-intl';

import {localeData, isRtl} from 'scratch-l10n';
import editorMessages from 'scratch-l10n/locales/editor-msgs';

addLocaleData(localeData);

// JARVIS 二次开发：上游 zh-cn 包里少数条目没汉化（值直接就是英文原文）。
// 已知两类：
//   1) 个别菜单项，如 gui.menuBar.settings -> "Settings"、gui.menuBar.colorMode -> "Color Mode"；
//   2) gui.debugModal.* 整个「卡住了怎么办」弹窗（52 个键，标题+说明全是英文），
//      上游 zh-cn 的键都在、值都还是英文，所以必须覆盖而不是新增。
// 这里做一份本地覆盖，只补真正缺译的键，其它一律沿用上游翻译。
// ⚠️ 这里分两类，语义不同，别混：
//   ZH_CN_OVERRIDES      —— 「补译」：只在键缺失或值仍是英文原文时才覆盖，
//                           避免盖掉上游后续改进的中文翻译（大部分 debugModal 词条属于这类）。
//   ZH_CN_FORCED         —— 「强制改写」：产品上我们就是要用这套措辞，无论上游翻译成什么都要覆盖。
// 早期把两者混在一起时，`文件→项目` 这类「上游已是中文、但我们要换说法」的条目会被
// 「有汉字就不覆盖」的规则跳过，改了不生效。
const ZH_CN_OVERRIDES = {
    'gui.menuBar.settings': '设置',
    'gui.menuBar.colorMode': '配色模式',
    'gui.menuBar.theme': '主题',
    'gui.menuBar.language': '语言',
    'gui.menuBar.languageSelector': '语言',

    // ---- 调试提示弹窗（Debugging | Getting Unstuck）----
    'gui.debugModal.title': '调试 | 卡住了怎么办',
    'gui.debugModal.readAloud.title': '把代码读出来',
    'gui.debugModal.readAloud.description1': '一边把代码读出声，一边试着站在计算机的角度想。',
    'gui.debugModal.readAloud.description2': '是不是多了一些其实并不存在的步骤？',
    'gui.debugModal.readAloud.description3': '你的指令说得够清楚吗？',
    'gui.debugModal.readAloud.description4': '每次程序跑完需要复位的东西，对应的指令写进去了吗？',
    'gui.debugModal.breakItDown.title': '拆成小块',
    'gui.debugModal.breakItDown.description1': '把积木拆成更小的几段（或几组序列），挨个点击看看每一段各自做了什么。',
    'gui.debugModal.breakItDown.description2': '等这些小段都能按你预期工作时，再把它们拼回主程序里。',
    'gui.debugModal.breakItDown.description3': '这个过程叫做「分解」。',
    'gui.debugModal.slowItDown.title': '放慢速度',
    'gui.debugModal.slowItDown.description1': '程序跑得太快，眼睛往往跟不上它到底做了什么。',
    'gui.debugModal.slowItDown.description2': '临时加一些「等待」或「等待直到」积木把节奏放慢，这样你才有时间去判断某一步到底成没成功。',
    'gui.debugModal.slowItDown.description3': '代码跑通之后，记得把这些等待积木删掉。',
    'gui.debugModal.addSoundCheckpoints.title': '加入声音路标',
    'gui.debugModal.addSoundCheckpoints.description1': '和「放慢速度」类似：你可以在几个关键位置放上「播放声音直到结束」积木，用它来检查某一段执行到没执行到。',
    'gui.debugModal.addSoundCheckpoints.description2': '如果某个声音没响，问题多半在这块积木之前；如果响了，问题大概率在它之后。',
    'gui.debugModal.addSoundCheckpoints.description3': '代码跑通之后，记得把这些声音删掉。',
    'gui.debugModal.tinkerWithBlockOrder.title': '调一调积木顺序',
    'gui.debugModal.tinkerWithBlockOrder.description1': '试试调整积木的先后顺序。',
    'gui.debugModal.tinkerWithBlockOrder.description2': '哪件事需要先发生？',
    'gui.debugModal.tinkerWithBlockOrder.description3': '接下来该发生什么？',
    'gui.debugModal.tinkerWithBlockOrder.description4': '下一段代码运行之前，变量或角色是不是需要先复位？',
    'gui.debugModal.tinkerWithBlockOrder.description5': '试试把积木放到循环或条件判断的里面，对比放在外面时的效果。',
    'gui.debugModal.toLoopOrNot.title': '到底用不用循环',
    'gui.debugModal.toLoopOrNot.description1': '如果用到了「重复执行」「重复执行 n 次」这类控制积木，' +
        '先确认循环里的积木是不是都该在里面，有没有漏掉「等待」这类用来复位动作或调整节奏的积木。' +
        '你的循环是要一直执行，还是只执行固定次数？需要有什么条件来结束循环吗？',
    'gui.debugModal.toLoopOrNot.description2': '也有可能是该用循环的时候没用循环。' +
        '比如你用了「如果…那么」这种条件积木：程序只需要判断一次真假，还是需要一直判断？' +
        '如果是后者，就应该把这个条件判断放进「重复执行」里面。',
    'gui.debugModal.timingAndParallelism.title': '想想时序与并发',
    'gui.debugModal.timingAndParallelism.sectionTitle': '时序与并发',
    'gui.debugModal.timingAndParallelism.description1': '是不是有好几件事在同时运行？如果两段程序被设定在同一时刻开始，结果可能会变得难以预测。',
    'gui.debugModal.timingAndParallelism.description2': '加一点短暂的等待、广播，或者让用户操作一下（点击、按键），看看结果会不会不一样。',
    'gui.debugModal.thinkAboutBlockOptions.title': '想想还有别的积木吗',
    'gui.debugModal.thinkAboutBlockOptions.description1': '有没有长得差不多、但作用不一样的积木可以用？',
    'gui.debugModal.thinkAboutBlockOptions.description2': '有些积木看着相似，行为却不同，比如「设为」和「增加」，或者「播放声音直到结束」和「开始播放声音」。',
    'gui.debugModal.thinkAboutBlockOptions.description3': '试着用相似的积木替换掉现在这块，看看结果会不会变化。',
    'gui.debugModal.checkTheValues.title': '检查变量的值',
    'gui.debugModal.checkTheValues.description1': '如果用了变量或「报告」类积木，请检查代码执行到那一步时变量的实际值是多少。',
    'gui.debugModal.checkTheValues.description2': '是所有角色都该控制这个变量，还是只应该由一个角色控制？',
    'gui.debugModal.checkTheValues.description3': '这个值在哪里被重置？在哪里被改变？',
    'gui.debugModal.checkCodeSequence.title': '检查代码挂在哪里',
    'gui.debugModal.checkCodeSequence.description1': '确认这段代码挂在了正确的角色或背景上。',
    'gui.debugModal.checkCodeSequence.description2': '如果要把代码挪到别的角色，按住它拖到目标角色上悬停，等角色抖动一下再松手。',
    'gui.debugModal.checkCodeSequence.description3': '也可以用屏幕下方的「背包」来暂存和搬运代码或素材。',
    'gui.debugModal.commentYourCode.title': '给代码加注释',
    'gui.debugModal.commentYourCode.description1': '加注释能让别人更容易看懂你的代码，也能让你以后回头看时想起它是怎么工作的。',
    'gui.debugModal.commentYourCode.description2': '在脚本区点右键选「添加注释」，用大白话说明某块积木或某一小段积木在做什么。',
    'gui.debugModal.takeABreak.title': '休息一下，离开一会儿',
    'gui.debugModal.takeABreak.description1': '有时候盯一个问题盯太久，反而效率更低，还会让人烦躁。',
    'gui.debugModal.takeABreak.description2': '休息一下，离开屏幕让脑子放空。歇一会儿、去做点别的事，或者喝口水，回来时往往就能用新的眼光看这个问题。',
    'gui.debugModal.askForHelp.title': '找人帮忙',
    'gui.debugModal.askForHelp.description1': '如果还是卡着，可以请身边的人帮帮忙。把你的项目分享出来，在注释或项目说明里讲清楚你卡在哪里。',
    'gui.debugModal.askForHelp.description2': '找一到三个人来试试你的代码——不同的人会有不同的视角和思路！'
};

// 产品措辞：无论上游翻译成什么都要覆盖
const ZH_CN_FORCED = {
    // 顶栏菜单叫「项目」而不沿用上游的「文件」：这里管理的是作品档案（新建/保存/打开），
    // 不涉及文件系统操作，叫「文件」会和「导入项目文件」混淆。
    'gui.menuBar.file': '项目',
    // 上游 zh-cn 是「新作品」，统一改为「新建项目」，与「打开项目 / 保存项目」动宾一致。
    'gui.menuBar.new': '新建项目'
};

const applyOverrides = messages => {
    const merged = Object.assign({}, messages);
    if (merged['zh-cn']) {
        merged['zh-cn'] = Object.assign({}, merged['zh-cn']);
        const zh = merged['zh-cn'];
        Object.keys(ZH_CN_OVERRIDES).forEach(key => {
            // 只在「缺失」或「值仍是英文原文」时覆盖，避免盖掉上游后续改进的翻译。
            // ⚠️ 判定不能只认「纯字母+空格」：debugModal 的英文句子含 ’ “ ” 、, . - 等标点，
            // 用旧规则会被误判成「已有翻译」而跳过，导致覆盖不生效。
            // 这里改成：只要值里没有汉字，就认为还没汉化。
            const cur = zh[key];
            if (cur === undefined || cur === '' || !/[\u4e00-\u9fa5]/.test(cur)) {
                zh[key] = ZH_CN_OVERRIDES[key];
            }
        });
        // 强制改写：不看上游当前值，直接覆盖（产品措辞由我们定）
        Object.keys(ZH_CN_FORCED).forEach(key => {
            zh[key] = ZH_CN_FORCED[key];
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
