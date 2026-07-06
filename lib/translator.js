const path = require('path');
const fs = require('fs');
const { LANGUAGES } = require('./i18n');

/**
 * 翻譯引擎：依目前生效語言載入對應規則檔（zh-TW.json / zh-CN.json），
 * 套用三階段替換（前置 → 內建 → 後置）。
 */
class Translator {
    constructor(config) {
        this.config = config;
        this.rulesCache = {}; // { 'zh-TW': {...}, 'zh-CN': {...} }
    }

    /** 載入指定語言的內建規則（含快取） */
    loadRules(lang) {
        if (this.rulesCache[lang]) return this.rulesCache[lang];

        const meta = LANGUAGES[lang] || LANGUAGES['zh-TW'];
        const fallback = { version: '', locale: lang, translations: [] };
        try {
            const rulesPath = path.join(__dirname, '..', 'translations', meta.file);
            if (fs.existsSync(rulesPath)) {
                const content = fs.readFileSync(rulesPath, 'utf8');
                this.rulesCache[lang] = JSON.parse(content);
                console.log(`已載入 ${lang} 內建翻譯規則，共`, this.rulesCache[lang].translations.length, '條');
            } else {
                console.warn('找不到內建翻譯規則檔：', rulesPath);
                this.rulesCache[lang] = fallback;
            }
        } catch (error) {
            console.error('載入內建翻譯規則出錯：', error);
            this.rulesCache[lang] = fallback;
        }
        return this.rulesCache[lang];
    }

    /** 目前生效語言的內建規則 */
    getCurrentRules() {
        return this.loadRules(this.config.getEffectiveLanguage());
    }

    /** 目前語言翻譯包的可讀版本（版本 + 日期） */
    getPackVersion() {
        const r = this.getCurrentRules();
        const ver = r.version || '?';
        return r.updatedAt ? `${ver}（${r.updatedAt}）` : ver;
    }

    /**
     * 目前語言翻譯包的簽章：語言 + 版本 + 更新日期 + 條數。
     * 只要內建翻譯檔有任何更新（版本號、日期或條數改變），簽章即不同，
     * 供啟動時判斷「翻譯包是否已更新、需重新套用」。
     */
    getSignature() {
        const r = this.getCurrentRules();
        return `${r.locale || ''}@${r.version || ''}#${r.updatedAt || ''}~${(r.translations || []).length}`;
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
