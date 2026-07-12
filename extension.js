const vscode = require('vscode');
const fs = require('fs');
const Locator = require('./lib/locator');
const Translator = require('./lib/translator');
const BackupManager = require('./lib/backup');
const ConfigManager = require('./lib/config');
const { LANGUAGES, ALL_MARKERS, getStrings } = require('./lib/i18n');

// globalState 鍵
const KEY_RESTORED = 'manuallyRestored';   // 使用者手動還原成原版 → 不再自動套用
const KEY_LAST_VERSION = 'lastClaudeVersion';
const KEY_LAST_TRANSLATION = 'lastTranslationSignature'; // 上次套用的翻譯包簽章

// 偵測未翻譯字串時要掃描的介面屬性（比對「prop:"字面值"」）
const LITERAL_PROPS = ['title', 'placeholder', 'aria-label', 'ariaLabel', 'label', 'tooltip', 'heading', 'subheading'];
// 變數參照掃描（prop:變數名）額外納入 description：
// Monaco 內嵌大量 description:"色彩說明…" 字面值會造成洪水，故 description 僅用於變數參照，靠片語過濾把關。
const VAR_PROPS = LITERAL_PROPS.concat('description');
// 已知非 Claude（多為內嵌 Monaco 編輯器）之誤判，掃描時略過
const SCAN_IGNORE = new Set(['Find and Replace', 'Start Linked Editing', 'editorWorkerService', 'Go to Line/Column', 'diagnosticSubtitle']);

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
            // 翻譯包簽章（語言＋版本＋日期＋條數）有變 → 強制重新套用，讓更新後的翻譯生效
            const packChanged = context.globalState.get(KEY_LAST_TRANSLATION) !== translator.getSignature();
            await applyTranslation(locator, translator, backup, config, true, packChanged);
            updateStatusBar(locator, backup, translator, config);
            await checkVersionChange(locator, translator, backup, config);
        }, 2000);
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
 * 從「翻譯後」的內容中找出仍為英文的介面字串（偵測漏翻）。
 * 兩階段：(1) prop:"字面值"（精準）；(2) prop:變數名 → 查對照表還原（補抓被 minify 提取成變數的長字串）。
 */
function findUntranslated(translatedContent) {
    const results = new Set();

    // (1) 直接字面值：prop:"文字"
    for (const p of LITERAL_PROPS) {
        const pe = p.replace(/-/g, '\\-');
        const re = new RegExp(pe + ':"((?:[^"\\\\]|\\\\.){2,120})"', 'g');
        let m;
        while ((m = re.exec(translatedContent))) {
            if (looksLikeUiText(m[1])) results.add(m[1]);
        }
    }

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

    return [...results].sort();
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
        const list = findUntranslated(translated);

        // 保存結果供「跳到字串」定位
        lastScan = { list, filePath: mainFilePath };

        const version = locator.getClaudeCodeVersion();
        const meta = config.getLanguageMeta();
        outputChannel.clear();
        outputChannel.appendLine(s.scanHeaderTitle);
        outputChannel.appendLine(s.scanHeaderMeta(version, meta.label));
        outputChannel.appendLine(s.scanHeaderCount(list.length));
        list.forEach((str, i) => outputChannel.appendLine(`${String(i + 1).padStart(3, ' ')}. ${str}`));
        outputChannel.appendLine(s.scanHeaderTip);

        if (list.length > 0) {
            const choice = await vscode.window.showWarningMessage(s.scanFoundWarn(list.length), s.btnGoto, s.btnViewList);
            if (choice === s.btnViewList) outputChannel.show(true);
            else if (choice === s.btnGoto) await gotoUntranslated(locator, translator, backup, config);
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
