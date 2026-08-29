const vscode = require('vscode');
const fs = require('fs');
const Locator = require('./lib/locator');
const Translator = require('./lib/translator');
const BackupManager = require('./lib/backup');
const ConfigManager = require('./lib/config');
const { LANGUAGES, ALL_MARKERS, getStrings } = require('./lib/i18n');
const { Updater, RELEASE_PAGE } = require('./lib/updater');

// globalState 鍵
const KEY_RESTORED = 'manuallyRestored';   // 使用者手動還原成原版 → 不再自動套用
const KEY_LAST_VERSION = 'lastClaudeVersion';
const KEY_LAST_TRANSLATION = 'lastTranslationSignature'; // 上次套用的翻譯包簽章
const KEY_DEAD_RULES = 'deadRules';        // 上次掃描時已對不上的規則（用來只回報「新增的」）
const KEY_SEEN_UNTRANSLATED = 'seenUntranslated'; // 上次掃描時已知的漏翻字串（同樣只回報「新增的」）
const KEY_LAST_UPDATE_CHECK = 'lastUpdateCheck';  // 上次線上檢查更新的時間戳
const KEY_SKIPPED_VERSION = 'skippedExtVersion';  // 使用者選擇略過的擴充功能版本

// 自動檢查更新的最小間隔：開太頻繁沒有意義（翻譯包大約隨 Claude 改版才會動）
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

// 偵測未翻譯字串時要掃描的介面屬性（比對「prop:值」）
// children 於 2.3.0 納入：側邊提問面板整區文案都寫成 children:"文字"，舊版掃描一條都看不到。
const LITERAL_PROPS = ['title', 'placeholder', 'aria-label', 'ariaLabel', 'label', 'tooltip', 'heading', 'subheading', 'children'];
// 變數參照掃描（prop:變數名）額外納入 description：
// Monaco 內嵌大量 description:"色彩說明…" 字面值會造成洪水，故 description 僅用於變數參照，靠片語過濾把關。
const VAR_PROPS = LITERAL_PROPS.concat('description');
// 會把文案直接當引數傳進去的介面函式：showNotification(`…`) 這類寫法不掛在屬性上，
// 只認 prop: 一律看不到（2.1.229 的意見回饋提示即是如此）。
const UI_CALLS = ['showNotification'];
// 已知非 Claude（多為內嵌 Monaco 編輯器）之誤判，掃描時略過
const SCAN_IGNORE = new Set(['Find and Replace', 'Start Linked Editing', 'editorWorkerService', 'Go to Line/Column', 'diagnosticSubtitle']);

// ── 樣板字串掃描參數 ────────────────────────────────
// Claude 有不少介面文案是 template literal（`… ${變數} …`），不符合 prop:"字面值" 樣式，
// 前兩階段一律抓不到。2.1.220 把「訊息被標記」對話框整段改成樣板字串即是一例：
// 畫面上明明是英文，掃描卻回報 0 漏翻。
const TPL_MIN_WORDS = 4;        // 至少幾個英文單字才視為文案
const TPL_LOCALITY = 3000;      // 「鄰近是否有中文」的前後取樣範圍（字元）
const TPL_LOCALITY_CJK = 20;    // 取樣範圍內至少要有幾個中文字

// ── 屬性值掃描參數（2.3.0 新增）──────────────────────
// 屬性值往後取樣的長度：children 陣列可能包住整個子元件，取太短會漏掉排在後面的文字。
const PROP_VALUE_WINDOW = 600;
// 掛在介面屬性上的樣板字串，門檻放寬到 1 個英文單字：
// `Collapse ${群組名}` 只有一個單字，但既然寫在 title 上就必定是使用者看得到的文案。
const TPL_PROP_MIN_WORDS = 1;
// 內部診斷訊息（throw new Error(`…`)、console.warn(`…`)）不是使用者看得到的文案
const TPL_DIAGNOSTIC_CTX = /(?:throw|Error|TypeError|RangeError|console\.\w+|assert\w*|warn|reject)\s*\(?\s*$/;
// 少數躲過上述條件的 Monaco 內部訊息，直接列為已知誤判
const TPL_IGNORE = [/^Invalid value for key /, /^Missing \$\{\w+\} property in key$/, /^Pattern length exceeds max of /];
const RE_CJK = /[一-鿿]/;
const RE_CJK_G = /[一-鿿]/g;

let statusBarItem = null;
let outputChannel = null;
let extContext = null;
// 最近一次掃描結果（供「跳到字串」使用）
let lastScan = { list: [], filePath: null };

/** 取得目前生效語言的 UI 字串包 */
function S(config) {
    return getStrings(config.getEffectiveLanguage());
}

/** 從檔案內容判斷目前已套用哪一種語言（找不到回傳 null） */
function detectAppliedLanguage(content) {
    for (const [id, meta] of Object.entries(LANGUAGES)) {
        if (meta.markers.some(m => content.includes(m))) return id;
    }
    return null;
}

/**
 * 擴充功能啟用
 */
async function activate(context) {
    console.log('Claude Code 中文化擴充功能已啟用');
    extContext = context;

    const config = new ConfigManager();
    const locator = new Locator(config);
    const backup = new BackupManager(config);
    const translator = new Translator(config);
    const updater = new Updater(config, context);
    // 線上更新的翻譯包存在 globalStorage；比內建版新時由 Translator 自動改用
    translator.setCacheDir(updater.getCacheDir());

    outputChannel = vscode.window.createOutputChannel(S(config).outputChannel);
    context.subscriptions.push(outputChannel);

    // ── 狀態列按鈕 ─────────────────────────────
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'claudeCodeZh.showMenu';
    context.subscriptions.push(statusBarItem);
    updateStatusBar(locator, backup, translator, config);
    if (config.get('showStatusBar') !== false) statusBarItem.show();

    // ── 註冊指令 ───────────────────────────────
    const register = (id, fn) =>
        context.subscriptions.push(vscode.commands.registerCommand(id, fn));

    register('claudeCodeZh.showMenu', () => showQuickMenu(locator, translator, backup, config));

    register('claudeCodeZh.applyTranslation', async () => {
        context.globalState.update(KEY_RESTORED, false); // 使用者主動套用 → 解除「還原」狀態
        await applyTranslation(locator, translator, backup, config);
        updateStatusBar(locator, backup, translator, config);
    });

    register('claudeCodeZh.reloadTranslation', async () => {
        context.globalState.update(KEY_RESTORED, false);
        await applyTranslation(locator, translator, backup, config, false, true);
        updateStatusBar(locator, backup, translator, config);
    });

    register('claudeCodeZh.restoreOriginal', async () => {
        await restoreOriginal(locator, backup, config);
        updateStatusBar(locator, backup, translator, config);
    });

    register('claudeCodeZh.switchLanguage', () => switchLanguage(config));

    register('claudeCodeZh.openConfig', () =>
        vscode.commands.executeCommand('workbench.action.openSettings', 'claudeCodeZh'));

    register('claudeCodeZh.openCommandPalette', () =>
        vscode.commands.executeCommand('workbench.action.quickOpen', '>Claude Code 中文化: '));

    register('claudeCodeZh.reloadWindow', () =>
        vscode.commands.executeCommand('workbench.action.reloadWindow'));

    register('claudeCodeZh.showStatus', () => showStatusInfo(locator, backup, translator, config));

    register('claudeCodeZh.scanUntranslated', () =>
        scanUntranslated(locator, translator, backup, config, false));

    register('claudeCodeZh.viewUntranslatedList', () =>
        viewUntranslatedList(locator, translator, backup, config));

    register('claudeCodeZh.gotoUntranslated', () =>
        gotoUntranslated(locator, translator, backup, config));

    register('claudeCodeZh.checkUpdate', () =>
        checkUpdates(updater, locator, translator, backup, config, false));

    register('claudeCodeZh.resetTranslationPack', () =>
        resetTranslationPack(updater, locator, translator, backup, config));

    // ── 監聽 Claude Code 安裝/更新 → 自動重新套用並掃描新字串 ──
    context.subscriptions.push(vscode.extensions.onDidChange(async () => {
        const claudeExt = vscode.extensions.getExtension(
            config.get('claudeCodeExtensionId') || 'Anthropic.claude-code'
        );
        if (!claudeExt) return;
        if (config.get('autoApplyOnUpdate') && !context.globalState.get(KEY_RESTORED)) {
            setTimeout(async () => {
                await applyTranslation(locator, translator, backup, config, true, true);
                updateStatusBar(locator, backup, translator, config);
                await checkVersionChange(locator, translator, backup, config);
            }, 1500);
        }
    }));

    // ── 監聽本擴充功能設定變更（切換狀態列顯示、語言變更即重新套用） ──
    context.subscriptions.push(config.onDidChange((all, event) => {
        if (all.showStatusBar === false) statusBarItem.hide();
        else statusBarItem.show();

        if (config.affectsLanguage(event) && !context.globalState.get(KEY_RESTORED)) {
            // 語言設定變更 → 以新語言重新套用（讀取原始英文備份為基底）
            applyTranslation(locator, translator, backup, config, false, true)
                .then(() => updateStatusBar(locator, backup, translator, config));
        } else {
            updateStatusBar(locator, backup, translator, config);
        }
    }));

    // ── 啟動時自動套用（除非使用者已手動還原成原版） ──
    if (config.get('autoApplyOnStartup') && !context.globalState.get(KEY_RESTORED)) {
        setTimeout(async () => {
            // 翻譯包簽章（語言＋版本＋日期＋條數＋來源）有變 → 強制重新套用，讓更新後的翻譯生效
            const packChanged = context.globalState.get(KEY_LAST_TRANSLATION) !== translator.getSignature();
            await applyTranslation(locator, translator, backup, config, true, packChanged);
            updateStatusBar(locator, backup, translator, config);
            await checkVersionChange(locator, translator, backup, config);
        }, 2000);
    }

    // ── 啟動後靜默檢查線上更新（翻譯包／擴充功能新版） ──
    setTimeout(() => {
        checkUpdates(updater, locator, translator, backup, config, true).catch(e => console.error(e));
    }, 8000);
}

/**
 * 線上檢查更新：翻譯包 + 擴充功能新版。
 *
 * 翻譯包是重點——Claude 每次改版造成的漏翻，只要作者更新了 translations/*.json，
 * 使用者這邊就能直接拿到，不必重裝 VSIX。
 *
 * @param {boolean} quiet 由啟動流程呼叫時為 true：受檢查間隔節流，且沒有更新時不打擾
 */
async function checkUpdates(updater, locator, translator, backup, config, quiet) {
    const s = S(config);
    if (!extContext) return;

    const wantPack = config.get('autoUpdateTranslations') !== false;
    const wantExt = config.get('checkExtensionUpdate') !== false;
    if (quiet && !wantPack && !wantExt) return;

    if (quiet) {
        const last = extContext.globalState.get(KEY_LAST_UPDATE_CHECK) || 0;
        if (Date.now() - last < UPDATE_CHECK_INTERVAL_MS) return;
        await extContext.globalState.update(KEY_LAST_UPDATE_CHECK, Date.now());
    }

    // ── 翻譯包 ──────────────────────────────
    if (wantPack || !quiet) {
        const lang = config.getEffectiveLanguage();
        try {
            const current = translator.getCurrentRules();
            const result = await updater.updateTranslationPack(lang, current);
            if (result.updated) {
                translator.invalidate();          // 下次載入即改用新翻譯包
                // 立刻重新套用，讓使用者重新載入視窗後直接看到新翻譯
                if (!extContext.globalState.get(KEY_RESTORED)) {
                    await applyTranslation(locator, translator, backup, config, true, true);
                    updateStatusBar(locator, backup, translator, config);
                }
                const choice = await vscode.window.showInformationMessage(
                    s.updPackUpdated(result.from, result.to), s.btnReloadNow, s.btnLater);
                if (choice === s.btnReloadNow) vscode.commands.executeCommand('workbench.action.reloadWindow');
            } else if (!quiet) {
                vscode.window.showInformationMessage(s.updPackLatest(translator.getPackVersion()));
            }
        } catch (e) {
            if (!quiet) vscode.window.showWarningMessage(s.updPackFailed(e.message));
            else console.warn('翻譯包線上更新失敗：', e.message);
        }
    }

    // ── 擴充功能新版 ─────────────────────────
    if (wantExt || !quiet) {
        try {
            const currentVersion = getOwnVersion();
            const info = await updater.checkExtensionUpdate(currentVersion);
            if (!info) {
                if (!quiet) vscode.window.showInformationMessage(s.updExtLatest(currentVersion));
                return;
            }
            if (quiet && extContext.globalState.get(KEY_SKIPPED_VERSION) === info.version) return;

            const buttons = info.vsixUrl
                ? [s.updBtnInstall, s.updBtnOpenPage, s.updBtnSkip]
                : [s.updBtnOpenPage, s.updBtnSkip];
            const choice = await vscode.window.showInformationMessage(
                s.updExtFound(currentVersion, info.version), ...buttons);

            if (choice === s.updBtnSkip) {
                await extContext.globalState.update(KEY_SKIPPED_VERSION, info.version);
            } else if (choice === s.updBtnOpenPage) {
                vscode.env.openExternal(vscode.Uri.parse(info.pageUrl || RELEASE_PAGE));
            } else if (choice === s.updBtnInstall) {
                await installExtensionUpdate(updater, info, config);
            }
        } catch (e) {
            if (!quiet) vscode.window.showWarningMessage(s.updExtFailed(e.message));
            else console.warn('檢查擴充功能新版失敗：', e.message);
        }
    }
}

/** 下載並安裝新版 VSIX；失敗時退回開啟 Release 頁面讓使用者手動處理 */
async function installExtensionUpdate(updater, info, config) {
    const s = S(config);
    try {
        const vsixPath = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: s.updDownloading(info.version) },
            () => updater.downloadVsix(info)
        );
        // installExtension 接受 VSIX 的 Uri（等同「從 VSIX 安裝…」）。
        // 這道指令並非正式公開 API，因此失敗時一律退回手動流程。
        await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(vsixPath));
        const choice = await vscode.window.showInformationMessage(
            s.updInstalled(info.version), s.btnReloadNow, s.btnLater);
        if (choice === s.btnReloadNow) vscode.commands.executeCommand('workbench.action.reloadWindow');
    } catch (e) {
        vscode.window.showWarningMessage(s.updInstallFailed(e.message));
        vscode.env.openExternal(vscode.Uri.parse(info.pageUrl || RELEASE_PAGE));
    }
}

/** 清除線上翻譯包快取，回到內建版本 */
async function resetTranslationPack(updater, locator, translator, backup, config) {
    const s = S(config);
    if (translator.getPackSource() !== 'remote') {
        vscode.window.showInformationMessage(s.updPackResetNone);
        return;
    }
    updater.clearCache();
    translator.invalidate();
    if (extContext && !extContext.globalState.get(KEY_RESTORED)) {
        await applyTranslation(locator, translator, backup, config, true, true);
        updateStatusBar(locator, backup, translator, config);
    }
    const choice = await vscode.window.showInformationMessage(s.updPackReset, s.btnReloadNow, s.btnLater);
    if (choice === s.btnReloadNow) vscode.commands.executeCommand('workbench.action.reloadWindow');
}

/** 本擴充功能自身的版本號 */
function getOwnVersion() {
    const ext = vscode.extensions.getExtension('LaiYueJi.claude-code-zh');
    if (ext && ext.packageJSON && ext.packageJSON.version) return ext.packageJSON.version;
    try {
        return require('./package.json').version;
    } catch (e) {
        return '0.0.0';
    }
}

/**
 * 狀態列快速指令選單
 */
async function showQuickMenu(locator, translator, backup, config) {
    const s = S(config);
    const state = await getState(locator, backup);
    const statusText = state.translated
        ? s.menuStateTranslated
        : (state.hasFile ? s.menuStateOriginal : s.menuStateNotFound);

    const items = [
        { label: s.menuApplyLabel, description: s.menuApplyDesc, cmd: 'claudeCodeZh.applyTranslation' },
        { label: s.menuReloadLabel, description: s.menuReloadDesc, cmd: 'claudeCodeZh.reloadTranslation' },
        { label: s.menuRestoreLabel, description: s.menuRestoreDesc, cmd: 'claudeCodeZh.restoreOriginal' },
        { label: s.menuSwitchLabel, description: s.menuSwitchDesc, cmd: 'claudeCodeZh.switchLanguage' },
        { label: '', kind: vscode.QuickPickItemKind.Separator },
        { label: s.menuScanLabel, description: s.menuScanDesc, cmd: 'claudeCodeZh.scanUntranslated' },
        { label: s.menuViewListLabel, description: s.menuViewListDesc, cmd: 'claudeCodeZh.viewUntranslatedList' },
        { label: s.menuGotoLabel, description: s.menuGotoDesc, cmd: 'claudeCodeZh.gotoUntranslated' },
        { label: '', kind: vscode.QuickPickItemKind.Separator },
        { label: s.menuCheckUpdateLabel, description: s.menuCheckUpdateDesc, cmd: 'claudeCodeZh.checkUpdate' },
        { label: s.menuResetPackLabel, description: s.menuResetPackDesc, cmd: 'claudeCodeZh.resetTranslationPack' },
        { label: '', kind: vscode.QuickPickItemKind.Separator },
        { label: s.menuPaletteLabel, description: s.menuPaletteDesc, cmd: 'claudeCodeZh.openCommandPalette' },
        { label: s.menuConfigLabel, description: s.menuConfigDesc, cmd: 'claudeCodeZh.openConfig' },
        { label: s.menuStatusLabel, description: s.menuStatusDesc, cmd: 'claudeCodeZh.showStatus' },
        { label: s.menuReloadWindowLabel, description: s.menuReloadWindowDesc, cmd: 'claudeCodeZh.reloadWindow' },
    ];

    const pick = await vscode.window.showQuickPick(items, {
        title: s.menuTitle,
        placeHolder: statusText + s.menuPlaceholderSuffix
    });
    if (pick && pick.cmd) vscode.commands.executeCommand(pick.cmd);
}

/**
 * 取得目前套用狀態
 */
async function getState(locator, backup) {
    const claudePath = await locator.findClaudeCodeExtension();
    if (!claudePath) return { hasFile: false, translated: false, mainFilePath: null, appliedLang: null };
    const mainFilePath = locator.findMainFile(claudePath);
    if (!mainFilePath) return { hasFile: false, translated: false, mainFilePath: null, appliedLang: null };
    let translated = false;
    let appliedLang = null;
    try {
        const content = fs.readFileSync(mainFilePath, 'utf8');
        translated = ALL_MARKERS.some(m => content.includes(m));
        appliedLang = detectAppliedLanguage(content);
    } catch (e) { /* ignore */ }
    return { hasFile: true, translated, appliedLang, mainFilePath, hasBackup: backup.hasBackup(mainFilePath) };
}

/**
 * 更新狀態列文字與提示
 */
async function updateStatusBar(locator, backup, translator, config) {
    if (!statusBarItem) return;
    const s = S(config);
    const state = await getState(locator, backup);
    if (!state.hasFile) statusBarItem.text = s.sbNotFound;
    else if (state.translated) statusBarItem.text = s.sbTranslated;
    else statusBarItem.text = s.sbUntranslated;

    const version = locator.getClaudeCodeVersion();
    const effLang = config.getEffectiveLanguage();
    const meta = LANGUAGES[effLang] || LANGUAGES['zh-TW'];
    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = true;
    md.appendMarkdown(s.ttTitle);
    md.appendMarkdown(state.translated ? s.ttStateTranslated : s.ttStateOriginal);
    md.appendMarkdown(s.ttLanguage(meta.label));
    md.appendMarkdown(s.ttVersion(version));
    md.appendMarkdown(s.ttCount(translator.getBuiltInCount()));
    md.appendMarkdown(s.ttClickHint);
    statusBarItem.tooltip = md;
}

/**
 * 套用翻譯（一律以原始英文備份為基底，確保冪等、不疊加）
 */
async function applyTranslation(locator, translator, backup, config, silent = false, forceReapply = false) {
    const s = S(config);
    try {
        const claudePath = await locator.findClaudeCodeExtension();
        if (!claudePath) {
            if (!silent) vscode.window.showErrorMessage(s.errNoExt);
            return;
        }
        const mainFilePath = locator.findMainFile(claudePath);
        if (!mainFilePath) {
            if (!silent) vscode.window.showErrorMessage(s.errNoFile);
            return;
        }

        const hasExistingBackup = backup.hasBackup(mainFilePath);

        // 靜默且非強制：若「目前生效語言」已套用則略過（語言不同時仍會重新套用）
        if (silent && !forceReapply) {
            const content = fs.readFileSync(mainFilePath, 'utf8');
            const meta = config.getLanguageMeta();
            if (meta.markers.some(m => content.includes(m))) return;
        }

        // 建立備份（原始英文）。若無備份，以目前檔案內容為基底建立。
        if (config.get('createBackup') !== false && !hasExistingBackup) {
            await backup.createBackup(mainFilePath);
        }

        // 以「乾淨的原始英文」為翻譯基底：優先讀取 .bak，確保不疊加、可自由切換語言
        let baseContent = backup.readBackup(mainFilePath);
        if (baseContent == null) baseContent = fs.readFileSync(mainFilePath, 'utf8');

        const translated = await translator.translate(baseContent);
        fs.writeFileSync(mainFilePath, translated, 'utf8');

        // 記錄本次套用的翻譯包簽章，供下次啟動判斷是否需因翻譯包更新而重新套用
        if (extContext) extContext.globalState.update(KEY_LAST_TRANSLATION, translator.getSignature());

        if (config.get('showNotifications') !== false && !silent) {
            const choice = await vscode.window.showInformationMessage(
                s.applySuccess, s.btnReloadNow, s.btnLater
            );
            if (choice === s.btnReloadNow) vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    } catch (error) {
        if (!silent) vscode.window.showErrorMessage(s.errApplyFail(error.message));
        console.error(error);
    }
}

/**
 * 還原官方原版（並記住使用者選擇，避免下次啟動又自動套用）
 */
async function restoreOriginal(locator, backup, config) {
    const s = S(config);
    try {
        const claudePath = await locator.findClaudeCodeExtension();
        if (!claudePath) { vscode.window.showErrorMessage(s.errNoExtShort); return; }
        const mainFilePath = locator.findMainFile(claudePath);
        if (!mainFilePath) { vscode.window.showErrorMessage(s.errNoWebview); return; }

        const restored = await backup.restoreBackup(mainFilePath);
        if (!restored) { vscode.window.showErrorMessage(s.errNoBackup); return; }

        // 記住「已還原」，讓啟動/更新時不再自動套用
        if (extContext) await extContext.globalState.update(KEY_RESTORED, true);

        if (config.get('showNotifications') !== false) {
            const choice = await vscode.window.showInformationMessage(
                s.restoreSuccess, s.btnReloadNow, s.btnLater
            );
            if (choice === s.btnReloadNow) vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    } catch (error) {
        vscode.window.showErrorMessage(s.errRestoreFail(error.message));
        console.error(error);
    }
}

/**
 * 切換介面語言（繁體 / 簡體 / 跟隨系統）。
 * 僅更新 language 設定；實際重新套用由設定變更監聽器處理。
 */
async function switchLanguage(config) {
    const s = S(config);
    const current = config.get('language') || 'auto';
    const tag = v => (current === v ? ' ' + s.switchCurrentTag : '');
    const items = [
        { label: s.switchAutoLabel + tag('auto'), description: s.switchAutoDesc, value: 'auto' },
        { label: s.switchTwLabel + tag('zh-TW'), value: 'zh-TW' },
        { label: s.switchCnLabel + tag('zh-CN'), value: 'zh-CN' },
    ];
    const pick = await vscode.window.showQuickPick(items, {
        title: s.switchTitle,
        placeHolder: s.switchPlaceholder
    });
    if (!pick || pick.value === current) return;

    // 切換語言即視為要套用 → 先解除「還原」狀態，再更新設定觸發重新套用
    if (extContext) await extContext.globalState.update(KEY_RESTORED, false);
    await config.set('language', pick.value);
}

/**
 * 顯示狀態資訊
 */
async function showStatusInfo(locator, backup, translator, config) {
    const s = S(config);
    const state = await getState(locator, backup);
    const version = locator.getClaudeCodeVersion();
    const restored = extContext && extContext.globalState.get(KEY_RESTORED);
    const meta = config.getLanguageMeta();
    const stateText = state.translated ? s.siStateTranslated : (state.hasFile ? s.siStateOriginal : s.siStateNotFound);
    const lines = [
        s.siStateLabel(stateText),
        s.siLangLabel(meta.label),
        s.siPackLabel(translator.getPackVersion()),
        s.siPackSource(translator.getPackSource()),
        s.siVersionLabel(version),
        s.siCountLabel(translator.getBuiltInCount()),
        restored ? s.siAutoOff : s.siAutoOn,
        state.mainFilePath ? s.siTargetLabel(state.mainFilePath) : '',
        state.hasFile ? s.siBackupLabel(state.hasBackup) : '',
    ].filter(Boolean);

    const choice = await vscode.window.showInformationMessage(
        s.siTitle + lines.join('\n'),
        { modal: true },
        s.siBtnApply, s.siBtnScan, s.siBtnRestore
    );
    if (choice === s.siBtnApply) vscode.commands.executeCommand('claudeCodeZh.reloadTranslation');
    else if (choice === s.siBtnScan) vscode.commands.executeCommand('claudeCodeZh.scanUntranslated');
    else if (choice === s.siBtnRestore) vscode.commands.executeCommand('claudeCodeZh.restoreOriginal');
}

/** 判斷字串是否像「使用者看得到的介面文案」（排除識別字、路徑、程式碼片段） */
function looksLikeUiText(str) {
    if (/[一-鿿]/.test(str)) return false;             // 已含中文
    if (!/[A-Za-z]/.test(str)) return false;                   // 無英文字母
    if (/^[a-z0-9_]+$/.test(str)) return false;                // 純識別字
    if (/^\//.test(str)) return false;                         // 斜線指令 /login…
    if (!/\s/.test(str) && /[_]/.test(str)) return false;      // css module / 內部識別字
    if (/^\$|[{}]|=>|;|:\/\//.test(str)) return false;
    if (SCAN_IGNORE.has(str)) return false;
    return true;
}

/**
 * 判斷是否為「多字自然語言片語」。
 * 供變數參照掃描使用：變數對照表較容易誤收 CSS 類名／識別字（如 "ghost-text"），
 * 但真正的使用者文案幾乎都是含空格的多字句子，故以此再收斂以避免雜訊。
 */
function isNaturalPhrase(str) {
    if (!/ /.test(str)) return false;                          // 需含空格（多字）
    if (/[{}<>$\\`=;|~^*[\]]/.test(str)) return false;         // 含程式碼字元
    if (/=>|:\/\//.test(str)) return false;
    const words = str.trim().split(/\s+/);
    if (words.length < 2) return false;
    const alpha = words.filter(w => /^[A-Za-z][A-Za-z'.,!?():;/-]*$/.test(w)).length;
    return alpha / words.length >= 0.7;                        // 七成以上為字母詞才算自然語言
}

/**
 * 建立「變數／常數名 → 字串字面值」對照表。
 * minify 常把較長的字串提取成模組層級變數（如 var dN="Enable Remote Control…"），
 * UI 再以 label:dN 參照，導致純字面值掃描抓不到。此表用來還原這類字串。
 * 只收 ≥2 字元的識別字（單字母多為 scope-local 且會互相衝突）；同名多次賦值取第一個。
 */
function buildConstMap(content) {
    const map = Object.create(null);
    const re = /(?:^|[,;{(\s])([A-Za-z_$][A-Za-z0-9_$]+)\s*=\s*"((?:[^"\\]|\\.){2,200})"/g;
    let m;
    while ((m = re.exec(content))) {
        if (!(m[1] in map)) map[m[1]] = m[2];
    }
    return map;
}

/**
 * 從「翻譯後」的內容中找出仍為英文的樣板字串（`… ${變數} …`）。
 *
 * 樣板字串沒有 prop:"…" 這種好認的外框，得靠兩層判斷才不會把程式碼一起撈進來：
 *  a. 形態：不含程式碼字元、以大寫或佔位符開頭、四個以上英文單字、佔位符內不得再包字串。
 *  b. 位置：前後 TPL_LOCALITY 字元內要有足夠中文。本函式吃的是「已套用翻譯」的內容，
 *     Claude 自家 UI 翻完後中文密集，內嵌的 Monaco 編輯器區段幾乎不會有中文，
 *     以此擋掉 Tree element not found、Semantic token… 之類的內部訊息。
 */
function findTemplateUntranslated(translatedContent) {
    const results = new Set();
    const re = /`((?:[^`\\]|\\.){12,300})`/g;
    let m;
    while ((m = re.exec(translatedContent))) {
        const raw = m[1];
        if (!templateLooksLikeText(raw, TPL_MIN_WORDS)) continue;
        if (TPL_DIAGNOSTIC_CTX.test(translatedContent.slice(Math.max(0, m.index - 24), m.index))) continue;
        const near = translatedContent.slice(Math.max(0, m.index - TPL_LOCALITY), m.index + TPL_LOCALITY);
        if ((near.match(RE_CJK_G) || []).length < TPL_LOCALITY_CJK) continue;
        results.add(raw);
    }
    return results;
}

/**
 * 樣板字串的「形態」判斷：把佔位符抽掉之後，看起來是不是一句人話。
 *
 * 兩處共用，差別只在單字數門檻：
 *  - 全域樣板字串掃描用 TPL_MIN_WORDS（較嚴），另以「鄰近是否有中文」把關；
 *  - 掛在介面屬性上的樣板字串用 TPL_PROP_MIN_WORDS（較寬），因為屬性本身已是夠強的證據。
 *    Collapse ${群組名}、Move to "${群組名}" 只有一到兩個單字，舊門檻一律擋掉。
 */
function templateLooksLikeText(raw, minWords) {
    if (RE_CJK.test(raw)) return false;                          // 已翻譯
    if (/\$\{[^{}]*[`'"][^{}]*\}/.test(raw)) return false;       // 佔位符內含字串 → 巢狀程式碼
    const plain = raw.replace(/\$\{[^{}]*\}/g, '\u0000');        // 佔位符換成單一標記再判形態
    if (/[<>\\/=;|~^&*+\[\]{}()#@]/.test(plain)) return false;   // 程式碼字元
    if (/\n|\t|  /.test(plain)) return false;                    // 多行／縮排 → 程式碼或樣板
    if (/:\S/.test(plain)) return false;                         // key:value
    if (!/^["\u0000A-Z]/.test(plain)) return false;             // 需以大寫、佔位符或引號開頭（濾掉串接片段）
    // 外圍的引號／括號會被切成獨立「單字」，把 Move to "${名稱}" 的字母詞比例壓到 0.5，
    // 故先剝掉外圍標點再算比例，純標點的詞不列入分母。
    const words = plain.split(/[\u0000\s]+/)
        .map(w => w.replace(/^["'`(\[]+|["'`)\].,!?;:]+$/g, ''))
        .filter(Boolean);
    if (words.length === 0) return false;
    const alpha = words.filter(w => /^[A-Za-z][A-Za-z'’.,!?%:;-]*$/.test(w));
    if (alpha.length < minWords || alpha.length / words.length < 0.8) return false;
    if (SCAN_IGNORE.has(raw) || TPL_IGNORE.some(re2 => re2.test(raw))) return false;
    return true;
}

// 屬性值的四種寫法（用途見 findPropValueStrings）
const RE_VALUE_STR = /^"((?:[^"\\]|\\.){2,160})"/;
const RE_VALUE_TPL = /^`((?:[^`\\]|\\.){2,300})`/;
const RE_VALUE_TERNARY = /^[^,;{}]{0,120}?\?\s*("(?:[^"\\]|\\.){2,160}"|`(?:[^`\\]|\\.){2,300}`)\s*:\s*("(?:[^"\\]|\\.){2,160}"|`(?:[^`\\]|\\.){2,300}`)/;

/** 跳過字串／樣板字面值，回傳結束引號的位置（處理跳脫字元） */
function skipQuoted(text, i) {
    const quote = text[i];
    for (let j = i + 1; j < text.length; j++) {
        if (text[j] === '\\') { j++; continue; }
        if (text[j] === quote) return j;
    }
    return text.length;
}

/** 取出以括號開頭的完整範圍；字串內的括號不計入巢狀深度 */
function readBalanced(text) {
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"' || ch === "'" || ch === '`') { i = skipQuoted(text, i); continue; }
        if (ch === '[' || ch === '{' || ch === '(') depth++;
        else if (ch === ']' || ch === '}' || ch === ')') { if (--depth === 0) return text.slice(0, i + 1); }
    }
    return text;
}

/**
 * 取出陣列的「直接元素」中的字串／樣板字面值。
 *
 * children:[b("span",{className:…,"aria-hidden":"true"}),"Answering…"] 這種寫法裡，
 * 真正的文案是排在子元件後面的直接元素；巢狀在 b(…) 內的 "true"、CSS 類名、
 * aria-* 屬性名全都不是文案。不分深度一律撈的話，一次掃描會多出三百條雜訊。
 */
function readArrayElements(span) {
    const out = [];
    let depth = 0;
    for (let i = 0; i < span.length; i++) {
        const ch = span[i];
        if (ch === '"' || ch === "'" || ch === '`') {
            const end = skipQuoted(span, i);
            if (depth === 1 && ch !== "'") out.push({ text: span.slice(i + 1, end), tpl: ch === '`' });
            i = end;
            continue;
        }
        if (ch === '[' || ch === '{' || ch === '(') depth++;
        else if (ch === ']' || ch === '}' || ch === ')') depth--;
    }
    return out;
}

/**
 * 掃描介面屬性的「值」。minify 之後同一個屬性有四種常見寫法，
 * 舊版只認第一種，2.1.229 的側邊提問與分組功能因此一次漏掉 17 條：
 *
 *   label:"New group"                             ← 字面值
 *   title:`Collapse ${群組名}`                     ← 樣板字串
 *   label:x?"Switch to session":"Resume session"   ← 三元運算子
 *   children:[b(圖示),"New group"]                 ← 陣列元素
 *
 * 一律以「屬性名」為錨點，這是雜訊壓得住的關鍵：同樣的字串出現在其他位置不看。
 */
function findPropValueStrings(translatedContent, results) {
    const names = LITERAL_PROPS.map(p => p.replace(/-/g, '\\-')).join('|');
    // 屬性名可能帶引號（"aria-label":"…"）；前方需為非識別字字元，以免 xxxLabel: 之類誤命中。
    // 另一種錨點是介面函式的引數位置（showNotification(…)），值的寫法與屬性完全相同，共用同一套解析。
    const re = new RegExp('(?<![A-Za-z0-9_$])(?:"?(?:' + names + ')"?\\s*:|(?:' + UI_CALLS.join('|') + ')\\s*\\()', 'g');
    const take = (raw, isTpl) => {
        if (isTpl) { if (templateLooksLikeText(raw, TPL_PROP_MIN_WORDS)) results.add(raw); }
        else if (looksLikeUiText(raw)) results.add(raw);
    };
    let m;
    while ((m = re.exec(translatedContent))) {
        const from = m.index + m[0].length;
        const tail = translatedContent.slice(from, from + PROP_VALUE_WINDOW);
        let v;
        if ((v = RE_VALUE_STR.exec(tail))) { take(v[1], false); continue; }
        if ((v = RE_VALUE_TPL.exec(tail))) { take(v[1], true); continue; }
        if ((v = RE_VALUE_TERNARY.exec(tail))) {
            for (const branch of [v[1], v[2]]) take(branch.slice(1, -1), branch[0] === '`');
            continue;
        }
        if (tail[0] === '[') {
            for (const el of readArrayElements(readBalanced(tail))) {
                // 陣列元素比屬性值鬆散得多，需再過一道文案門檻：
                // 大寫開頭（Answering…／New group）或多字片語（← Back to list），
                // 否則像 "and "、"from " 這種串接碎片會把清單灌爆。
                if (el.tpl) take(el.text, true);
                else if (/^[A-Z]/.test(el.text) || isNaturalPhrase(el.text)) take(el.text, false);
            }
        }
    }
}

/**
 * 找出「已對不上」的規則：original 在原始英文檔中完全比對不到。
 *
 * 舊版遺留的規則本來就會對不上（留著服務尚未更新的使用者，無副作用），
 * 所以呼叫端只回報「上次還對得上、這次忽然對不上」的那些——
 * 這幾乎都代表 Claude 把該段英文改寫了。2.1.220 將 safety measures 改為 safeguards 即屬此類：
 * 漏翻掃描看不出來（新字串不在掃描樣式內），但規則失效這件事看得出來。
 */
function findDeadRules(baseContent, rules) {
    const dead = [];
    for (const rule of rules || []) {
        if (!rule || !rule.original || !rule.chinese) continue;
        try {
            const hit = rule.regex
                ? new RegExp(rule.original, (rule.flags || '').replace(/g/g, '')).test(baseContent)
                : baseContent.includes(rule.original);
            if (!hit) dead.push(rule.original);
        } catch (e) {
            // 規則本身寫錯（正規表達式無法編譯）→ 套用時 translator 會記錄，此處略過
        }
    }
    return dead;
}

/**
 * 從「翻譯後」的內容中找出仍為英文的介面字串（偵測漏翻）。
 * 三階段：(1) prop:值（字面值／樣板字串／三元運算子／陣列元素）；(2) prop:變數名 → 查對照表還原（補抓被 minify 提取成變數的長字串）；
 *        (3) 樣板字串 `… ${變數} …`（補抓改寫成 template literal 的文案）。
 */
function findUntranslated(translatedContent) {
    const results = new Set();

    // (1) 介面屬性的值：字面值／樣板字串／三元運算子／陣列元素
    findPropValueStrings(translatedContent, results);

    // (2) 變數參照：prop:變數名（如 label:dN）→ 透過對照表還原其字串值
    const constMap = buildConstMap(translatedContent);
    for (const p of VAR_PROPS) {
        const pe = p.replace(/-/g, '\\-');
        const re = new RegExp(pe + ':([A-Za-z_$][A-Za-z0-9_$]+)(?![A-Za-z0-9_$:])', 'g');
        let m;
        while ((m = re.exec(translatedContent))) {
            const val = constMap[m[1]];
            if (val && looksLikeUiText(val) && isNaturalPhrase(val)) results.add(val);
        }
    }

    // (3) 樣板字串：`… ${變數} …`
    for (const val of findTemplateUntranslated(translatedContent)) results.add(val);

    return [...results].sort();
}

/**
 * 把樣板字串裡的 ${變數名} 一律正規化成 ${}，供 scanIgnore 比對使用。
 *
 * minify 的變數名每次改版都可能換人做——Fuse.js 那兩條內部錯誤訊息在 Claude Code 2.1.238
 * 是 `${e}`，2.1.251 變成 `${$}`。清單若寫死變數名，Claude 一改版該條就失效，
 * 本來判讀過「刻意不翻」的字串又回頭洗版。比對前兩邊都正規化即可免疫於改名。
 */
function normalizePlaceholders(str) {
    return str.replace(/\$\{[^{}]*\}/g, '${}');
}

/**
 * 取得「這次才出現」的漏翻字串，並把最新清單存回 globalState。
 *
 * 與失效規則同樣的理由：掃描器涵蓋面擴大後，一次會列出近兩百條歷來未翻的字串，
 * 那是既有債務而非改版訊號。真正需要立刻處理的是「上次沒有、這次冒出來」的那些——
 * 幾乎都代表 Claude 這一版新增或改寫了介面。首次執行僅建立基準線，不回報。
 */
async function collectNewUntranslated(list, config) {
    if (!extContext) return [];
    const lang = config.getEffectiveLanguage();
    const store = extContext.globalState.get(KEY_SEEN_UNTRANSLATED) || {};
    const prev = store[lang];
    const newly = Array.isArray(prev) ? list.filter(s => !prev.includes(s)) : [];

    store[lang] = list;
    await extContext.globalState.update(KEY_SEEN_UNTRANSLATED, store);
    return newly;
}

/**
 * 取得「這次才失效」的規則，並把最新的失效清單存回 globalState。
 *
 * 只回報差異而非全部：內建翻譯刻意保留舊版字串的規則（例如 2.1.216 以前的 safety measures 版文案），
 * 這些在新版本本來就對不上，每次都列出來只會變成雜訊。反之「上次還對得上、這次忽然對不上」，
 * 代表 Claude 動了那段英文，才是需要人工確認的訊號。
 * 首次執行僅建立基準線，不回報。
 */
async function collectNewlyDeadRules(baseContent, translator, config) {
    if (!extContext) return [];
    const lang = config.getEffectiveLanguage();
    const rules = (translator.getCurrentRules().translations) || [];
    const dead = findDeadRules(baseContent, rules);

    const store = extContext.globalState.get(KEY_DEAD_RULES) || {};
    const prev = store[lang];
    const newly = Array.isArray(prev) ? dead.filter(d => !prev.includes(d)) : [];

    store[lang] = dead;
    await extContext.globalState.update(KEY_DEAD_RULES, store);
    return newly;
}

/**
 * 掃描目前版本尚未翻譯的介面字串
 * @param {boolean} quiet 由更新流程呼叫時為 true（不彈「沒有漏翻」的提示）
 */
async function scanUntranslated(locator, translator, backup, config, quiet) {
    const s = S(config);
    try {
        const claudePath = await locator.findClaudeCodeExtension();
        if (!claudePath) { if (!quiet) vscode.window.showErrorMessage(s.errScanNoExt); return 0; }
        const mainFilePath = locator.findMainFile(claudePath);
        if (!mainFilePath) { if (!quiet) vscode.window.showErrorMessage(s.errScanNoWebview); return 0; }

        let base = backup.readBackup(mainFilePath);
        if (base == null) base = fs.readFileSync(mainFilePath, 'utf8');
        const translated = await translator.translate(base);
        const all = findUntranslated(translated);
        // 翻譯包裡列為「刻意不翻」的先濾掉，只留下真正需要處理的
        const ignoreSet = new Set([...translator.getScanIgnore()].map(normalizePlaceholders));
        const list = all.filter(str => !ignoreSet.has(normalizePlaceholders(str)));
        const ignoredCount = all.length - list.length;
        const newly = await collectNewUntranslated(list, config);
        const newlyDead = await collectNewlyDeadRules(base, translator, config);

        // 保存結果供「跳到字串」定位
        lastScan = { list, filePath: mainFilePath };

        const version = locator.getClaudeCodeVersion();
        const meta = config.getLanguageMeta();
        outputChannel.clear();
        outputChannel.appendLine(s.scanHeaderTitle);
        outputChannel.appendLine(s.scanHeaderMeta(version, meta.label));
        outputChannel.appendLine(s.scanHeaderCount(list.length));
        if (newly.length > 0) {
            // 新增的排在最前面並另立標題：一次列兩百條時，這幾條才是要看的
            outputChannel.appendLine(s.scanNewTitle(newly.length));
            newly.forEach((str, i) => outputChannel.appendLine(`${String(i + 1).padStart(3, ' ')}. ${str}`));
            outputChannel.appendLine(s.scanAllTitle(list.length));
        }
        list.forEach((str, i) => outputChannel.appendLine(`${String(i + 1).padStart(3, ' ')}. ${str}`));
        outputChannel.appendLine(s.scanHeaderTip);
        if (ignoredCount > 0) outputChannel.appendLine(s.scanIgnoredNote(ignoredCount));
        if (newlyDead.length > 0) {
            outputChannel.appendLine(s.scanDeadTitle(newlyDead.length));
            newlyDead.forEach((str, i) => outputChannel.appendLine(`${String(i + 1).padStart(3, ' ')}. ${str}`));
            outputChannel.appendLine(s.scanDeadTip);
        }

        if (list.length > 0) {
            const found = newly.length > 0 ? s.scanFoundWarnNew(list.length, newly.length) : s.scanFoundWarn(list.length);
            const warn = newlyDead.length > 0 ? s.scanFoundWarnBoth(list.length, newlyDead.length) : found;
            const choice = await vscode.window.showWarningMessage(warn, s.btnGoto, s.btnViewList);
            if (choice === s.btnViewList) outputChannel.show(true);
            else if (choice === s.btnGoto) await gotoUntranslated(locator, translator, backup, config);
        } else if (newlyDead.length > 0) {
            const choice = await vscode.window.showWarningMessage(s.scanDeadWarn(newlyDead.length), s.btnViewList);
            if (choice === s.btnViewList) outputChannel.show(true);
        } else if (!quiet) {
            vscode.window.showInformationMessage(s.scanClean);
        }
        return list.length;
    } catch (error) {
        if (!quiet) vscode.window.showErrorMessage(s.errScanFail(error.message));
        console.error(error);
        return 0;
    }
}

/**
 * 檢視未翻譯清單：直接呈現「上次掃描」的結果，不重新掃描。
 * 僅在本工作階段從未掃描過（無快取）時，才自動掃描一次以產生清單。
 */
async function viewUntranslatedList(locator, translator, backup, config) {
    const s = S(config);
    // 尚未掃描過（例如剛重新載入視窗）→ 先掃一次，scanUntranslated 會自行輸出並提示
    if (!lastScan.filePath) {
        await scanUntranslated(locator, translator, backup, config, false);
        return;
    }
    // 已有快取 → 直接開啟輸出頻道呈現先前清單（不重新掃描）
    outputChannel.show(true);
    if (!lastScan.list.length) vscode.window.showInformationMessage(s.scanClean);
}

/** 計算 needle 在 hay 中的出現次數 */
function countOccurrences(hay, needle) {
    if (!needle) return 0;
    let n = 0, i = hay.indexOf(needle);
    while (i !== -1) { n++; i = hay.indexOf(needle, i + needle.length); }
    return n;
}

/**
 * 跳到未翻譯字串在 webview/index.js 中的位置：
 * 以 QuickPick 選擇字串，開啟檔案並選取（跳至）該字串第一個出現處。
 */
async function gotoUntranslated(locator, translator, backup, config) {
    const s = S(config);
    // 若尚無掃描結果，先靜默掃描一次
    if (!lastScan.list.length || !lastScan.filePath) {
        await scanUntranslated(locator, translator, backup, config, true);
    }
    if (!lastScan.list.length || !lastScan.filePath) {
        vscode.window.showInformationMessage(s.gotoNoResults);
        return;
    }

    let doc;
    try {
        doc = await vscode.workspace.openTextDocument(lastScan.filePath);
    } catch (e) {
        vscode.window.showErrorMessage(s.errScanNoWebview);
        return;
    }
    const text = doc.getText();

    const items = lastScan.list.map(str => {
        const count = countOccurrences(text, '"' + str + '"') || countOccurrences(text, str);
        return { label: str, description: s.gotoOccur(count), value: str };
    });

    const pick = await vscode.window.showQuickPick(items, {
        title: s.gotoTitle,
        placeHolder: s.gotoPlaceholder,
        matchOnDescription: true,
    });
    if (!pick) return;

    const quoted = '"' + pick.value + '"';
    let idx = text.indexOf(quoted);
    let len = quoted.length;
    if (idx < 0) { idx = text.indexOf(pick.value); len = pick.value.length; }
    if (idx < 0) { vscode.window.showInformationMessage(s.gotoNotFound); return; }

    const editor = await vscode.window.showTextDocument(doc, { preview: false });
    const start = doc.positionAt(idx);
    const end = doc.positionAt(idx + len);
    editor.selection = new vscode.Selection(start, end);
    editor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
}

/**
 * 偵測 Claude Code 版本是否變動，若變動則自動掃描未翻譯字串並提示
 */
async function checkVersionChange(locator, translator, backup, config) {
    if (!extContext) return;
    const version = locator.getClaudeCodeVersion();
    if (!version) return;
    const last = extContext.globalState.get(KEY_LAST_VERSION);
    if (last === version) return;
    await extContext.globalState.update(KEY_LAST_VERSION, version);
    if (!last) return; // 首次安裝本擴充，不打擾
    if (extContext.globalState.get(KEY_RESTORED)) return; // 使用者選擇原版
    // 版本已更新 → 靜默掃描，有漏翻才提示
    await scanUntranslated(locator, translator, backup, config, true);
}

function deactivate() {
    console.log('Claude Code 中文化擴充功能已停用');
}

module.exports = { activate, deactivate };
