const fs = require('fs');

/**
 * 翻譯包的共用處理：讀取、驗證、版本比較。
 *
 * 翻譯包有兩個來源——隨擴充功能打包的內建版，以及線上更新後存在 globalStorage 的快取版。
 * 兩邊都會經過同一套驗證，避免一次壞掉的線上更新讓整個介面翻不出來。
 */

/** 單一規則是否合法（欄位齊全、正規表達式可編譯） */
function isValidRule(rule) {
    if (!rule || typeof rule.original !== 'string' || typeof rule.chinese !== 'string') return false;
    if (!rule.original) return false;
    if (rule.regex) {
        try {
            new RegExp(rule.original, rule.flags || 'g');
        } catch (e) {
            return false;
        }
    }
    return true;
}

/**
 * 驗證翻譯包結構。
 * @returns {{ok: true, pack: object} | {ok: false, reason: string}}
 */
function validatePack(pack, expectedLocale) {
    if (!pack || typeof pack !== 'object') return { ok: false, reason: '內容不是物件' };
    if (expectedLocale && pack.locale !== expectedLocale) {
        return { ok: false, reason: `locale 為 ${pack.locale}，應為 ${expectedLocale}` };
    }
    if (typeof pack.version !== 'string' || !pack.version) return { ok: false, reason: '缺少 version' };
    if (!Array.isArray(pack.translations) || pack.translations.length === 0) {
        return { ok: false, reason: '沒有任何翻譯規則' };
    }
    const bad = pack.translations.findIndex(r => !isValidRule(r));
    if (bad !== -1) return { ok: false, reason: `第 ${bad + 1} 條規則不合法` };
    return { ok: true, pack };
}

/** 解析並驗證 JSON 文字 */
function parsePack(text, expectedLocale) {
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        return { ok: false, reason: `不是合法 JSON（${e.message}）` };
    }
    return validatePack(data, expectedLocale);
}

/** 讀取翻譯包檔案；檔案不存在或不合法時回傳 null */
function readPack(filePath, expectedLocale) {
    try {
        if (!fs.existsSync(filePath)) return null;
        const result = parsePack(fs.readFileSync(filePath, 'utf8'), expectedLocale);
        return result.ok ? result.pack : null;
    } catch (e) {
        return null;
    }
}

/** 以數字逐段比較版本字串（2.1.10 > 2.1.9） */
function compareVersion(a, b) {
    const pa = String(a || '').split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b || '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) return d < 0 ? -1 : 1;
    }
    return 0;
}

/**
 * 比較兩個翻譯包的新舊：先比 version，同版再比 updatedAt。
 * 同一版本內若只改了翻譯內容（例如補幾條漏翻），靠 updatedAt 就能分出先後。
 */
function comparePack(a, b) {
    if (!a) return b ? -1 : 0;
    if (!b) return 1;
    const v = compareVersion(a.version, b.version);
    if (v !== 0) return v;
    const da = String(a.updatedAt || '');
    const db = String(b.updatedAt || '');
    return da === db ? 0 : (da < db ? -1 : 1);
}

/** 供顯示用的版本字串 */
function describePack(pack) {
    if (!pack) return '?';
    return pack.updatedAt ? `${pack.version}（${pack.updatedAt}）` : String(pack.version);
}

module.exports = { isValidRule, validatePack, parsePack, readPack, compareVersion, comparePack, describePack };
