const vscode = require('vscode');
const { LANGUAGES } = require('./i18n');

/**
 * 設定管理器：負責讀取與管理擴充功能設定，並解析目前生效的語言
 */
class ConfigManager {
    constructor() {
        this.configPrefix = 'claudeCodeZh';
    }

    /** 取得單一設定項 */
    get(key) {
        const config = vscode.workspace.getConfiguration(this.configPrefix);
        return config.get(key);
    }

    /** 設定單一設定項 */
    async set(key, value, global = true) {
        const config = vscode.workspace.getConfiguration(this.configPrefix);
        await config.update(
            key,
            value,
            global ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.Workspace
        );
    }

    /**
     * 解析目前生效的語言（'zh-TW' 或 'zh-CN'）。
     * language 設定為 'auto' 時，依 VS Code 顯示語言自動判斷；無法判斷則回退繁體。
     */
    getEffectiveLanguage() {
        const setting = this.get('language') || 'auto';
        if (setting === 'zh-TW' || setting === 'zh-CN') return setting;
        return ConfigManager.detectLanguage(vscode.env.language);
    }

    /** 由系統語言碼推斷繁體或簡體 */
    static detectLanguage(envLang) {
        const l = (envLang || '').toLowerCase();
        // 簡體：中國大陸、新加坡、簡體標記
        if (/\b(cn|hans|sg)\b/.test(l) || l.includes('hans')) return 'zh-CN';
        if (l.includes('zh-cn') || l.includes('zh_cn') || l.includes('zh-sg')) return 'zh-CN';
        // 繁體：台灣、香港、澳門、繁體標記
        if (l.includes('hant') || /zh[-_](tw|hk|mo)/.test(l)) return 'zh-TW';
        // 其餘（含純 'zh' 或非中文介面）回退繁體
        return 'zh-TW';
    }

    /** 目前生效語言的中繼資料（file / label / markers） */
    getLanguageMeta() {
        return LANGUAGES[this.getEffectiveLanguage()] || LANGUAGES['zh-TW'];
    }

    /** 取得全部設定 */
    getAll() {
        const config = vscode.workspace.getConfiguration(this.configPrefix);
        return {
            language: config.get('language'),
            autoApplyOnStartup: config.get('autoApplyOnStartup'),
            autoApplyOnUpdate: config.get('autoApplyOnUpdate'),
            preTranslationRules: config.get('preTranslationRules'),
            postTranslationRules: config.get('postTranslationRules'),
            createBackup: config.get('createBackup'),
            showNotifications: config.get('showNotifications'),
            showStatusBar: config.get('showStatusBar'),
            claudeCodeExtensionId: config.get('claudeCodeExtensionId')
        };
    }

    /** 監聽設定變更 */
    onDidChange(callback) {
        return vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration(this.configPrefix)) {
                callback(this.getAll(), event);
            }
        });
    }

    /** 判斷某次設定變更是否影響語言（language 設定改變） */
    affectsLanguage(event) {
        return event && event.affectsConfiguration(`${this.configPrefix}.language`);
    }
}

module.exports = ConfigManager;
