const path = require('path');
const fs = require('fs');
const { LANGUAGES } = require('./i18n');
const { readPack, comparePack, describePack } = require('./pack');

/**
 * 翻譯引擎：依目前生效語言載入對應規則檔（zh-TW.json / zh-CN.json），
 * 套用三階段替換（前置 → 內建 → 後置）。
 *
 * 規則檔有兩個來源：隨擴充功能打包的內建版，以及線上更新後存在 globalStorage 的快取版。
 * 兩者取較新者，因此翻譯包可以獨立於 VSIX 更新。
 */
class Translator {
    constructor(config) {
        this.config = config;
        this.rulesCache = {}; // { 'zh-TW': {...}, 'zh-CN': {...} }
        this.packSource = {};  // { 'zh-TW': 'bundled' | 'remote' }
        this.cacheDir = null;  // 由 extension.js 於啟用時注入（globalStorage 內的翻譯包目錄）
    }

    /** 設定線上更新快取目錄；變更時清空已載入的規則 */
    setCacheDir(dir) {
        if (this.cacheDir === dir) return;
        this.cacheDir = dir;
        this.invalidate();
    }

    /** 清掉已載入的規則，下次使用時重新選版 */
    invalidate() {
        this.rulesCache = {};
        this.packSource = {};
    }

    /** 載入指定語言的規則：內建版與線上快取版取較新者（含快取） */
    loadRules(lang) {
        if (this.rulesCache[lang]) return this.rulesCache[lang];

        const meta = LANGUAGES[lang] || LANGUAGES['zh-TW'];
        const fallback = { version: '', locale: lang, translations: [] };
        let chosen = null;
        let source = 'bundled';

        const bundled = readPack(path.join(__dirname, '..', 'translations', meta.file), lang);
        if (!bundled) console.warn('找不到（或無法解析）內建翻譯規則檔：', meta.file);

        const cached = this.cacheDir ? readPack(path.join(this.cacheDir, meta.file), lang) : null;
        if (cached && comparePack(cached, bundled) > 0) {
            chosen = cached;
            source = 'remote';
        } else {
            chosen = bundled;
        }

        this.rulesCache[lang] = chosen || fallback;
        this.packSource[lang] = chosen ? source : 'bundled';
        console.log(
            `已載入 ${lang} 翻譯規則（${this.packSource[lang] === 'remote' ? '線上更新' : '內建'} ${describePack(chosen)}），共`,
            this.rulesCache[lang].translations.length, '條'
        );
        return this.rulesCache[lang];
    }

    /** 目前語言的規則來源：'bundled'（內建）或 'remote'（線上更新） */
    getPackSource() {
        const lang = this.config.getEffectiveLanguage();
        this.loadRules(lang);
        return this.packSource[lang] || 'bundled';
    }

    /** 目前生效語言的內建規則 */
    getCurrentRules() {
        return this.loadRules(this.config.getEffectiveLanguage());
    }

    /** 目前語言翻譯包的可讀版本（版本 + 日期） */
    getPackVersion() {
        return describePack(this.getCurrentRules());
    }

    /**
     * 目前語言翻譯包的簽章：語言 + 版本 + 更新日期 + 條數 + 來源。
     * 只要翻譯包有任何更新（版本號、日期、條數改變，或改用線上更新版），簽章即不同，
     * 供啟動時判斷「翻譯包是否已更新、需重新套用」。
     */
    getSignature() {
        const r = this.getCurrentRules();
        const src = this.getPackSource();
        return `${r.locale || ''}@${r.version || ''}#${r.updatedAt || ''}~${(r.translations || []).length}!${src}`;
    }

    /**
     * 目前語言的「刻意不翻」清單。
     *
     * 掃描器分不出「還沒翻」與「決定不翻」——鍵碼表、SQL 關鍵字、工具識別字這些
     * 判讀過後確定不該翻的字串，每次掃描都會照列，把真正需要處理的訊號洗掉。
     * 清單放在翻譯包而非程式碼裡，是為了跟著熱更新走，日後增減不必重發 VSIX。
     */
    getScanIgnore() {
        const list = this.getCurrentRules().scanIgnore;
        return new Set(Array.isArray(list) ? list : []);
    }

    /** 內建規則條數（供狀態顯示） */
    getBuiltInCount() {
        return this.getCurrentRules().translations.length;
    }

    /** 套用三階段翻譯（以目前生效語言為準） */
    async translate(content) {
        const originalLength = content.length;

        // 階段 1：前置規則（使用者自訂，最優先）
        const preRules = this.config.get('preTranslationRules') || [];
        if (preRules.length > 0) {
            content = this.applyRules(content, preRules);
        }

        // 階段 2：內建規則（依語言）
        const builtInRules = this.getCurrentRules();
        if (builtInRules.translations && builtInRules.translations.length > 0) {
            content = this.applyRules(content, builtInRules.translations);
        }

        // 階段 3：後置規則（使用者自訂，最後覆蓋）
        const postRules = this.config.get('postTranslationRules') || [];
        if (postRules.length > 0) {
            content = this.applyRules(content, postRules);
        }

        console.log('翻譯完成，檔案大小變化：', originalLength, '->', content.length);
        return content;
    }

    /** 套用一組翻譯規則 */
    applyRules(content, rules) {
        for (const rule of rules) {
            if (!rule || !rule.original || !rule.chinese) continue;
            try {
                if (rule.regex) {
                    const flags = rule.flags || 'g';
                    const regex = new RegExp(rule.original, flags);
                    content = content.replace(regex, rule.chinese);
                } else if (rule.replaceAll === false) {
                    content = content.replace(rule.original, rule.chinese);
                } else {
                    content = content.replaceAll(rule.original, rule.chinese);
                }
            } catch (error) {
                console.warn('套用規則出錯：', rule, error);
            }
        }
        return content;
    }
}

module.exports = Translator;
