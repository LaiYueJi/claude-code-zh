#!/usr/bin/env node
/**
 * 新規則上線前的稽核：每條規則在「原始檔」與「套用現有規則後」各命中幾次，
 * 以及命中位置的前 40 個字元是否看起來像比較運算（=== / startsWith / case / includes…）。
 *
 * 用法：node scripts/dev/audit.js <專案根目錄> <index.js> <rules.json>
 *
 * rules.json 格式：{"rules": [[original, zh-TW, zh-CN, isRegex], …], "ignore": [...]}
 *
 * 命中 0 次＝規則寫錯或已經被別條吃掉；命中數異常多＝錨點太鬆（CSS class 樣板最常見）；
 * 標 SUS＝命中落在比較位置，翻了會讓判斷失效。這三種都要先查清楚再套。
 */
const fs = require('fs');
const path = require('path');
const [ROOT, SRC, RULES] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(RULES, 'utf8'));
const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'translations', 'zh-TW.json'), 'utf8'));
const orig = fs.readFileSync(SRC, 'utf8');
let pre = orig;
for (const r of pack.translations) {
    if (r.regex) pre = pre.replace(new RegExp(r.original, r.flags || 'g'), r.chinese);
    else pre = pre.replaceAll(r.original, r.chinese);
}
function hits(text, [o, , , rx]) {
    const out = [];
    if (rx) {
        const re = new RegExp(o, 'g');
        let m;
        while ((m = re.exec(text))) { out.push(m.index); if (!m[0].length) re.lastIndex++; }
    } else {
        let i = text.indexOf(o);
        while (i >= 0) { out.push(i); i = text.indexOf(o, i + 1); }
    }
    return out;
}
const SUS = /(===|!==|==|!=|\bcase\s*|\.has\(|\.includes\(|\.startsWith\(|\.endsWith\(|\.indexOf\(|\bname=)\s*$/;
const lines = [];
let zero = 0, sus = 0;
for (const rule of data.rules) {
    const a = hits(orig, rule), b = hits(pre, rule);
    const flags = a.map(i => orig.slice(Math.max(0, i - 40), i)).filter(p => SUS.test(p));
    if (!b.length) zero++;
    if (flags.length) sus++;
    lines.push(`${b.length ? '     ' : 'ZERO '}${flags.length ? 'SUS ' : '    '}${a.length}/${b.length}  ${rule[0].slice(0, 110)}`);
    for (const f of flags) lines.push('          prefix: ' + JSON.stringify(f));
    for (const i of a.slice(0, 2)) lines.push('          ctx: ' + JSON.stringify(orig.slice(Math.max(0, i - 70), i + 30)));
}
console.log(`rules=${data.rules.length}  套既有規則後命中為 0：${zero}  可疑比較位置：${sus}`);
console.log(lines.join('\n'));
