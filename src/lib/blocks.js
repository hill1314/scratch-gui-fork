/**
 * Connect scratch blocks with the vm
 * @param {VirtualMachine} vm - The scratch vm
 * @param {Bool} useCatBlocks - Whether to use cat blocks rendering of ScratchBlocks
 * @return {ScratchBlocks} ScratchBlocks connected with the vm
 */
export default function (vm, useCatBlocks) {
    const ScratchBlocks = useCatBlocks ? require('cat-blocks') : require('scratch-blocks');
    const jsonForMenuBlock = function (name, menuOptionsFn, colors, start) {
        return {
            message0: '%1',
            args0: [
                {
                    type: 'field_dropdown',
                    name: name,
                    options: function () {
                        return start.concat(menuOptionsFn());
                    }
                }
            ],
            inputsInline: true,
            output: 'String',
            colour: colors.secondary,
            colourSecondary: colors.secondary,
            colourTertiary: colors.tertiary,
            colourQuaternary: colors.quaternary,
            outputShape: ScratchBlocks.OUTPUT_SHAPE_ROUND
        };
    };

    const jsonForHatBlockMenu = function (hatName, name, menuOptionsFn, colors, start) {
        return {
            message0: hatName,
            args0: [
                {
                    type: 'field_dropdown',
                    name: name,
                    options: function () {
                        return start.concat(menuOptionsFn());
                    }
                }
            ],
            colour: colors.primary,
            colourSecondary: colors.secondary,
            colourTertiary: colors.tertiary,
            colourQuaternary: colors.quaternary,
            extensions: ['shape_hat']
        };
    };


    const jsonForSensingMenus = function (menuOptionsFn) {
        return {
            message0: ScratchBlocks.Msg.SENSING_OF,
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'PROPERTY',
                    options: function () {
                        return menuOptionsFn();
                    }

                },
                {
                    type: 'input_value',
                    name: 'OBJECT'
                }
            ],
            output: true,
            colour: ScratchBlocks.Colours.sensing.primary,
            colourSecondary: ScratchBlocks.Colours.sensing.secondary,
            colourTertiary: ScratchBlocks.Colours.sensing.tertiary,
            colourQuaternary: ScratchBlocks.Colours.sensing.quaternary,
            outputShape: ScratchBlocks.OUTPUT_SHAPE_ROUND
        };
    };

    const soundsMenu = function () {
        let menu = [['', '']];
        if (vm.editingTarget && vm.editingTarget.sprite.sounds.length > 0) {
            menu = vm.editingTarget.sprite.sounds.map(sound => [sound.name, sound.name]);
        }
        menu.push([
            ScratchBlocks.ScratchMsgs.translate('SOUND_RECORD', 'record...'),
            ScratchBlocks.recordSoundCallback
        ]);
        return menu;
    };

    const costumesMenu = function () {
        if (vm.editingTarget && vm.editingTarget.getCostumes().length > 0) {
            return vm.editingTarget.getCostumes().map(costume => [costume.name, costume.name]);
        }
        return [['', '']];
    };

    const backdropsMenu = function () {
        const next = ScratchBlocks.ScratchMsgs.translate('LOOKS_NEXTBACKDROP', 'next backdrop');
        const previous = ScratchBlocks.ScratchMsgs.translate('LOOKS_PREVIOUSBACKDROP', 'previous backdrop');
        const random = ScratchBlocks.ScratchMsgs.translate('LOOKS_RANDOMBACKDROP', 'random backdrop');
        if (vm.runtime.targets[0] && vm.runtime.targets[0].getCostumes().length > 0) {
            return vm.runtime.targets[0].getCostumes().map(costume => [costume.name, costume.name])
                .concat([[next, 'next backdrop'],
                    [previous, 'previous backdrop'],
                    [random, 'random backdrop']]);
        }
        return [['', '']];
    };

    const backdropNamesMenu = function () {
        const stage = vm.runtime.getTargetForStage();
        if (stage && stage.getCostumes().length > 0) {
            return stage.getCostumes().map(costume => [costume.name, costume.name]);
        }
        return [['', '']];
    };

    const spriteMenu = function () {
        const sprites = [];
        for (const targetId in vm.runtime.targets) {
            if (!Object.prototype.hasOwnProperty.call(vm.runtime.targets, targetId)) continue;
            if (vm.runtime.targets[targetId].isOriginal) {
                if (!vm.runtime.targets[targetId].isStage) {
                    if (vm.runtime.targets[targetId] === vm.editingTarget) {
                        continue;
                    }
                    sprites.push([vm.runtime.targets[targetId].sprite.name, vm.runtime.targets[targetId].sprite.name]);
                }
            }
        }
        return sprites;
    };

    const cloneMenu = function () {
        if (vm.editingTarget && vm.editingTarget.isStage) {
            const menu = spriteMenu();
            if (menu.length === 0) {
                return [['', '']]; // Empty menu matches Scratch 2 behavior
            }
            return menu;
        }
        const myself = ScratchBlocks.ScratchMsgs.translate('CONTROL_CREATECLONEOF_MYSELF', 'myself');
        return [[myself, '_myself_']].concat(spriteMenu());
    };

    const soundColors = ScratchBlocks.Colours.sounds;

    const looksColors = ScratchBlocks.Colours.looks;

    const motionColors = ScratchBlocks.Colours.motion;

    const sensingColors = ScratchBlocks.Colours.sensing;

    const controlColors = ScratchBlocks.Colours.control;

    const eventColors = ScratchBlocks.Colours.event;

    ScratchBlocks.Blocks.sound_sounds_menu.init = function () {
        const json = jsonForMenuBlock('SOUND_MENU', soundsMenu, soundColors, []);
        this.jsonInit(json);
    };

    ScratchBlocks.Blocks.looks_costume.init = function () {
        const json = jsonForMenuBlock('COSTUME', costumesMenu, looksColors, []);
        this.jsonInit(json);
    };

    ScratchBlocks.Blocks.looks_backdrops.init = function () {
        const json = jsonForMenuBlock('BACKDROP', backdropsMenu, looksColors, []);
        this.jsonInit(json);
    };

    ScratchBlocks.Blocks.event_whenbackdropswitchesto.init = function () {
        const json = jsonForHatBlockMenu(
            ScratchBlocks.Msg.EVENT_WHENBACKDROPSWITCHESTO,
            'BACKDROP', backdropNamesMenu, eventColors, []);
        this.jsonInit(json);
    };

    ScratchBlocks.Blocks.motion_pointtowards_menu.init = function () {
        const mouse = ScratchBlocks.ScratchMsgs.translate('MOTION_POINTTOWARDS_POINTER', 'mouse-pointer');
        const json = jsonForMenuBlock('TOWARDS', spriteMenu, motionColors, [
            [mouse, '_mouse_']
        ]);
        this.jsonInit(json);
    };

    ScratchBlocks.Blocks.motion_goto_menu.init = function () {
        const random = ScratchBlocks.ScratchMsgs.translate('MOTION_GOTO_RANDOM', 'random position');
        const mouse = ScratchBlocks.ScratchMsgs.translate('MOTION_GOTO_POINTER', 'mouse-pointer');
        const json = jsonForMenuBlock('TO', spriteMenu, motionColors, [
            [random, '_random_'],
            [mouse, '_mouse_']
        ]);
        this.jsonInit(json);
    };

    ScratchBlocks.Blocks.motion_glideto_menu.init = function () {
        const random = ScratchBlocks.ScratchMsgs.translate('MOTION_GLIDETO_RANDOM', 'random position');
        const mouse = ScratchBlocks.ScratchMsgs.translate('MOTION_GLIDETO_POINTER', 'mouse-pointer');
        const json = jsonForMenuBlock('TO', spriteMenu, motionColors, [
            [random, '_random_'],
            [mouse, '_mouse_']
        ]);
        this.jsonInit(json);
    };

    ScratchBlocks.Blocks.sensing_of_object_menu.init = function () {
        const stage = ScratchBlocks.ScratchMsgs.translate('SENSING_OF_STAGE', 'Stage');
        const json = jsonForMenuBlock('OBJECT', spriteMenu, sensingColors, [
            [stage, '_stage_']
        ]);
        this.jsonInit(json);
    };

    ScratchBlocks.Blocks.sensing_of.init = function () {
        const blockId = this.id;
        const blockType = this.type;

        // Get the sensing_of block from vm.
        let defaultSensingOfBlock;
        const blocks = vm.runtime.flyoutBlocks._blocks;
        Object.keys(blocks).forEach(id => {
            const block = blocks[id];
            if (id === blockType || (block && block.opcode === blockType)) {
                defaultSensingOfBlock = block;
            }
        });

        // Function that fills in menu for the first input in the sensing block.
        // Called every time it opens since it depends on the values in the other block input.
        const menuFn = function () {
            const stageOptions = [
                [ScratchBlocks.Msg.SENSING_OF_BACKDROPNUMBER, 'backdrop #'],
                [ScratchBlocks.Msg.SENSING_OF_BACKDROPNAME, 'backdrop name'],
                [ScratchBlocks.Msg.SENSING_OF_VOLUME, 'volume']
            ];
            const spriteOptions = [
                [ScratchBlocks.Msg.SENSING_OF_XPOSITION, 'x position'],
                [ScratchBlocks.Msg.SENSING_OF_YPOSITION, 'y position'],
                [ScratchBlocks.Msg.SENSING_OF_DIRECTION, 'direction'],
                [ScratchBlocks.Msg.SENSING_OF_COSTUMENUMBER, 'costume #'],
                [ScratchBlocks.Msg.SENSING_OF_COSTUMENAME, 'costume name'],
                [ScratchBlocks.Msg.SENSING_OF_SIZE, 'size'],
                [ScratchBlocks.Msg.SENSING_OF_VOLUME, 'volume']
            ];
            if (vm.editingTarget) {
                let lookupBlocks = vm.editingTarget.blocks;
                let sensingOfBlock = lookupBlocks.getBlock(blockId);

                // The block doesn't exist, but should be in the flyout. Look there.
                if (!sensingOfBlock) {
                    sensingOfBlock = vm.runtime.flyoutBlocks.getBlock(blockId) || defaultSensingOfBlock;
                    // If we still don't have a block, just return an empty list . This happens during
                    // scratch blocks construction.
                    if (!sensingOfBlock) {
                        return [['', '']];
                    }
                    // The block was in the flyout so look up future block info there.
                    lookupBlocks = vm.runtime.flyoutBlocks;
                }
                const sort = function (options) {
                    options.sort(ScratchBlocks.scratchBlocksUtils.compareStrings);
                };
                // Get all the stage variables (no lists) so we can add them to menu when the stage is selected.
                const stageVariableOptions = vm.runtime.getTargetForStage().getAllVariableNamesInScopeByType('');
                sort(stageVariableOptions);
                const stageVariableMenuItems = stageVariableOptions.map(variable => [variable, variable]);
                if (sensingOfBlock.inputs.OBJECT.shadow !== sensingOfBlock.inputs.OBJECT.block) {
                    // There's a block dropped on top of the menu. It'd be nice to evaluate it and
                    // return the correct list, but that is tricky. Scratch2 just returns stage options
                    // so just do that here too.
                    return stageOptions.concat(stageVariableMenuItems);
                }
                const menuBlock = lookupBlocks.getBlock(sensingOfBlock.inputs.OBJECT.shadow);
                const selectedItem = menuBlock.fields.OBJECT.value;
                if (selectedItem === '_stage_') {
                    return stageOptions.concat(stageVariableMenuItems);
                }
                // Get all the local variables (no lists) and add them to the menu.
                const target = vm.runtime.getSpriteTargetByName(selectedItem);
                let spriteVariableOptions = [];
                // The target should exist, but there are ways for it not to (e.g. #4203).
                if (target) {
                    spriteVariableOptions = target.getAllVariableNamesInScopeByType('', true);
                    sort(spriteVariableOptions);
                }
                const spriteVariableMenuItems = spriteVariableOptions.map(variable => [variable, variable]);
                return spriteOptions.concat(spriteVariableMenuItems);
            }
            return [['', '']];
        };

        const json = jsonForSensingMenus(menuFn);
        this.jsonInit(json);
    };

    ScratchBlocks.Blocks.sensing_distancetomenu.init = function () {
        const mouse = ScratchBlocks.ScratchMsgs.translate('SENSING_DISTANCETO_POINTER', 'mouse-pointer');
        const json = jsonForMenuBlock('DISTANCETOMENU', spriteMenu, sensingColors, [
            [mouse, '_mouse_']
        ]);
        this.jsonInit(json);
    };

    ScratchBlocks.Blocks.sensing_touchingobjectmenu.init = function () {
        const mouse = ScratchBlocks.ScratchMsgs.translate('SENSING_TOUCHINGOBJECT_POINTER', 'mouse-pointer');
        const edge = ScratchBlocks.ScratchMsgs.translate('SENSING_TOUCHINGOBJECT_EDGE', 'edge');
        const json = jsonForMenuBlock('TOUCHINGOBJECTMENU', spriteMenu, sensingColors, [
            [mouse, '_mouse_'],
            [edge, '_edge_']
        ]);
        this.jsonInit(json);
    };

    ScratchBlocks.Blocks.control_create_clone_of_menu.init = function () {
        const json = jsonForMenuBlock('CLONE_OPTION', cloneMenu, controlColors, []);
        this.jsonInit(json);
    };

    ScratchBlocks.VerticalFlyout.getCheckboxState = function (blockId) {
        const monitoredBlock = vm.runtime.monitorBlocks._blocks[blockId];
        return monitoredBlock ? monitoredBlock.isMonitored : false;
    };

    ScratchBlocks.FlyoutExtensionCategoryHeader.getExtensionState = function (extensionId) {
        if (vm.getPeripheralIsConnected(extensionId)) {
            return ScratchBlocks.StatusButtonState.READY;
        }
        return ScratchBlocks.StatusButtonState.NOT_READY;
    };

    ScratchBlocks.FieldNote.playNote_ = function (noteNum, extensionId) {
        vm.runtime.emit('PLAY_NOTE', noteNum, extensionId);
    };

    // Use a collator's compare instead of localeCompare which internally
    // creates a collator. Using this is a lot faster in browsers that create a
    // collator for every localeCompare call.
    const collator = new Intl.Collator([], {
        sensitivity: 'base',
        numeric: true
    });
    ScratchBlocks.scratchBlocksUtils.compareStrings = function (str1, str2) {
        return collator.compare(str1, str2);
    };

    // Blocks wants to know if 3D CSS transforms are supported. The cross
    // section of browsers Scratch supports and browsers that support 3D CSS
    // transforms will make the return always true.
    //
    // Shortcutting to true lets us skip an expensive style recalculation when
    // first loading the Scratch editor.
    ScratchBlocks.utils.is3dSupported = function () {
        return true;
    };

    // ---------------------------------------------------------------------
    // JARVIS 定制：放宽积木连接吸附半径，改善嵌套块（「如果」里的条件、
    // 「或/与」前后的判断等）的拖拽插入体验。
    //
    // 背景：scratch-blocks 默认 SNAP_RADIUS=48 / CONNECTING_SNAP_RADIUS=68。
    // 布尔槽和 C 形块内部的连接点很小、又常被相邻积木遮挡，鼠标要精确凑近才
    // 能连上；手指（触屏）更是几乎对不准。这里按输入设备分档放大吸附半径：
    //   - SNAP_RADIUS：开始寻找最近连接点的半径（越大越容易"吸"上）
    //   - CONNECTING_SNAP_RADIUS：已有连接点高亮后继续允许吸附的半径
    //     （这是嵌套块插入是否顺畅的关键，默认只比 SNAP_RADIUS 大 20）
    //   - DRAG_RADIUS：移动多少像素才算开始拖拽（触屏防抖，避免误拖）
    //   - FLYOUT_DRAG_RADIUS：从左侧积木区拖出的启动阈值
    //   - CURRENT_CONNECTION_PREFERENCE：已连点上"粘住"的偏好，触屏下略增
    //     防止刚连上又跳到旁边的槽
    //
    // 仅在运行时覆盖常量，不修改 node_modules 里的 scratch-blocks 包，
    // 因此 npm install 不会冲掉；如需关闭，把 JARVIS_BLOCK_SNAP_TUNING
    // 置为 false 即可回到上游默认手感。
    // ---------------------------------------------------------------------
    const JARVIS_BLOCK_SNAP_TUNING = true;
    if (JARVIS_BLOCK_SNAP_TUNING) {
        // 触屏判定：优先用 media query（和 index.ejs 里的 pointer:coarse 一致），
        // 无 matchMedia 时退化为 'ontouchstart' 检测。
        let isCoarsePointer = false;
        try {
            isCoarsePointer = typeof window !== 'undefined' &&
                typeof window.matchMedia === 'function' &&
                window.matchMedia('(pointer: coarse)').matches;
            if (!isCoarsePointer && typeof window !== 'undefined' && 'ontouchstart' in window) {
                isCoarsePointer = (navigator.maxTouchPoints || 0) > 0;
            }
        } catch (e) {
            isCoarsePointer = false;
        }

        const tuning = isCoarsePointer ?
            {
                snapRadius: 80,
                connectingSnapRadius: 110,
                dragRadius: 8,
                flyoutDragRadius: 14,
                currentConnectionPreference: 28
            } :
            {
                snapRadius: 60,
                connectingSnapRadius: 85,
                dragRadius: 5,
                flyoutDragRadius: 10,
                currentConnectionPreference: 20
            };

        ScratchBlocks.SNAP_RADIUS = tuning.snapRadius;
        ScratchBlocks.CONNECTING_SNAP_RADIUS = tuning.connectingSnapRadius;
        ScratchBlocks.DRAG_RADIUS = tuning.dragRadius;
        ScratchBlocks.FLYOUT_DRAG_RADIUS = tuning.flyoutDragRadius;
        ScratchBlocks.CURRENT_CONNECTION_PREFERENCE = tuning.currentConnectionPreference;

        // 便于在控制台核对实际生效值
        ScratchBlocks.jarvisSnapTuning = {
            coarsePointer: isCoarsePointer,
            values: tuning
        };
    }

    // ---------------------------------------------------------------------
    // JARVIS 定制：积木右键菜单增加「剪切」/「粘贴」。
    //
    // 上游 scratch-blocks 的操作菜单只有「复制 / 添加注释 / 删除」，没有剪切。
    // 想「把这堆积木挪到别处」时，只能先复制再删掉原块，两步而且容易忘删。
    // 这里补上标准剪贴板语义：
    //   - 剪切：把整叠积木（含其下挂的子块/嵌套）序列化成 XML 存进剪贴板，
    //     然后把原积木从工作区移除（走 dispose，可被撤销）。
    //   - 粘贴：从剪贴板 XML 反序列化，在右键位置旁边生成新积木。
    //
    // 剪贴板同时写进内存（跨角色、跨项目都能用）和 navigator.clipboard
    // 的纯文本（剪切成 XML 文本，可粘到别处），内存那份是主用。
    //
    // 实现方式：包装 BlockSvg.prototype.showContextMenu_，在它把菜单项交给
    // Blockly.ContextMenu.show 之前，用 customContextMenu 钩子把我们的项塞进去
    // （customContextMenu 是官方预留的扩展点，见 block_svg.js:926）。
    // 这样不碰 node_modules 里的包，npm install 不会冲掉。
    // ---------------------------------------------------------------------
    const JARVIS_CUT_PASTE = true;
    if (JARVIS_CUT_PASTE && ScratchBlocks.BlockSvg && ScratchBlocks.ContextMenu) {
        const CLIPBOARD_KEY = '__jarvisBlockClipboard';
        // 剪贴板：{ xml: Element, count: number, ts: number }
        ScratchBlocks[CLIPBOARD_KEY] = null;

        const LABEL_CUT = '剪切';
        const LABEL_PASTE = '粘贴';

        /**
         * 把积木（含下挂积木）序列化为 XML 克隆，同时返回包含块数量。
         * @param {!Blockly.BlockSvg} block 起点积木。
         * @return {{xml: !Element, count: number}} 克隆与数量。
         */
        const serializeBlock = function (block) {
            // opt_noId=true 必须传：否则 XML 里会带上原积木的 id，
            // 粘贴时 domToBlock 用同一 id 新建块会和原块冲突（id 重复）。
            // blockToDomWithXY 还会带上 x/y，粘贴时我们随后会覆盖坐标。
            const dom = ScratchBlocks.Xml.blockToDomWithXY(block, true);
            const count = block.getDescendants(false, true).length;
            return {xml: dom, count: count};
        };

        /**
         * 剪切：复制到剪贴板后从工作区删除。
         * @param {!Blockly.BlockSvg} block 要剪切的积木。
         */
        const cutBlock = function (block) {
            if (!block || !block.isDeletable() || !block.isMovable() || block.isInFlyout) {
                return;
            }
            const snapshot = serializeBlock(block);
            ScratchBlocks[CLIPBOARD_KEY] = {
                xml: snapshot.xml,
                count: snapshot.count,
                ts: Date.now()
            };
            // 尽力把 XML 文本也放到系统剪贴板（失败无所谓，内存那份够用）
            try {
                const text = ScratchBlocks.Xml.domToText(snapshot.xml);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).catch(() => {});
                }
            } catch (e) {
                // 忽略：非安全上下文或用户未授权
            }
            // 删除原积木（包一个事件组，撤销时能整组回来）
            ScratchBlocks.Events.setGroup(true);
            block.dispose(true, true);
            ScratchBlocks.Events.setGroup(false);
        };

        /**
         * 粘贴：把剪贴板里的积木放到工作区。
         * @param {!Blockly.WorkspaceSvg} workspace 目标工作区。
         * @param {!Blockly.BlockSvg} atBlock 右键所在积木（用来定位）。
         * @param {!Event} e 触发事件（取鼠标坐标）。
         */
        const pasteBlock = function (workspace, atBlock, e) {
            const clip = ScratchBlocks[CLIPBOARD_KEY];
            if (!clip || !clip.xml) {
                return;
            }
            const dom = clip.xml;
            // 位置：优先落在右键点附近，其次参考原块的相对位置。
            let x = 24;
            let y = 24;
            try {
                if (typeof workspace.getOriginOffsetInPixels === 'function' &&
                    e && typeof e.clientX === 'number' && typeof e.clientY === 'number') {
                    const offset = workspace.getOriginOffsetInPixels();
                    const scale = workspace.scale || 1;
                    x = ((e.clientX - offset.x) / scale) + 20;
                    y = ((e.clientY - offset.y) / scale) + 20;
                } else if (atBlock) {
                    const xy = atBlock.getRelativeToSurfaceXY();
                    x = xy.x + 30;
                    y = xy.y + 40;
                }
            } catch (err) {
                // 取不到坐标就用默认值
            }
            dom.setAttribute('x', Math.round(x));
            dom.setAttribute('y', Math.round(y));

            ScratchBlocks.Events.setGroup(true);
            try {
                const newBlock = ScratchBlocks.Xml.domToBlock(dom, workspace);
                if (newBlock) {
                    if (typeof newBlock.select === 'function') {
                        newBlock.select();
                    }
                    // 让粘贴出的积木贴到视野内
                    if (typeof workspace.centerOnBlock === 'function') {
                        try {
                            workspace.centerOnBlock(newBlock.id);
                        } catch (err) {
                            // 非关键
                        }
                    }
                }
            } finally {
                ScratchBlocks.Events.setGroup(false);
            }
        };

        // 挂到 ContextMenu 上，便于单测/调试调用
        ScratchBlocks.ContextMenu.jarvisCutOption = function (block) {
            return {
                text: LABEL_CUT,
                enabled: !!(block && block.isDeletable() && block.isMovable() && !block.isInFlyout),
                callback: function () {
                    ScratchBlocks.ContextMenu.hide();
                    cutBlock(block);
                }
            };
        };
        ScratchBlocks.ContextMenu.jarvisPasteOption = function (workspace, atBlock, e) {
            const clip = ScratchBlocks[CLIPBOARD_KEY];
            let label = LABEL_PASTE;
            if (clip && clip.count > 1) {
                label = `${LABEL_PASTE}（${clip.count} 块）`;
            }
            return {
                text: label,
                enabled: !!(clip && clip.xml),
                callback: function () {
                    ScratchBlocks.ContextMenu.hide();
                    pasteBlock(workspace, atBlock, e);
                }
            };
        };

        // 包装 showContextMenu_：在官方拼装完菜单后、弹出前插入我们的两项。
        // 放在「复制」之后、「删除」之前，符合常见编辑器的操作顺序。
        const origShowContextMenu = ScratchBlocks.BlockSvg.prototype.showContextMenu_;
        ScratchBlocks.BlockSvg.prototype.showContextMenu_ = function (e) {
            if (this.workspace && this.workspace.options && this.workspace.options.readOnly) {
                origShowContextMenu.call(this, e);
                return;
            }
            if (this.isInFlyout) {
                origShowContextMenu.call(this, e);
                return;
            }
            const block = this;
            const ws = this.workspace;
            // 用 customContextMenu 钩子插入（官方扩展点），先备份再还原，
            // 避免覆盖业务代码可能已经设置的钩子。
            const prevHook = block.customContextMenu;
            block.customContextMenu = function (menuOptions) {
                if (typeof prevHook === 'function') {
                    prevHook.call(block, menuOptions);
                }
                if (!menuOptions) {
                    return;
                }
                // 定位「复制」项：它紧跟在菜单开头（showContextMenu_ 先 push
                // blockDuplicateOption），但为了稳妥按文本匹配定位。
                const dupText = ScratchBlocks.Msg && ScratchBlocks.Msg.DUPLICATE;
                let anchor = dupText ?
                    menuOptions.findIndex(opt => opt && opt.text === dupText) : -1;
                if (anchor < 0) {
                    // 找不到复制项就插到最前面
                    anchor = -1;
                }
                const cutOption = ScratchBlocks.ContextMenu.jarvisCutOption(block);
                const pasteOption =
                    ScratchBlocks.ContextMenu.jarvisPasteOption(ws, block, e);
                // 顺序：复制 → 剪切 → 粘贴 → （注释/删除）
                menuOptions.splice(anchor + 1, 0, cutOption, pasteOption);
            };
            try {
                origShowContextMenu.call(this, e);
            } finally {
                // ContextMenu.show 是同步的，钩子只在本次调用内生效，及时还原
                block.customContextMenu = prevHook;
            }
        };

        // 注：scratch-blocks 1.3.0 没有 ShortcutRegistry（该 API 是后续 Blockly
        // 才引入的），所以这里只做右键菜单入口，不注册键盘快捷键。
        // 若将来要加 Ctrl+X/V，应在 scratch-gui 的 containers/blocks.jsx 里挂
        // keydown 监听，而不是在这里操作 Blockly 的快捷键体系。
    }

    return ScratchBlocks;
}
