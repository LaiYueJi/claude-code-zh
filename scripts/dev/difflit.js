#!/usr/bin/env node
/**
 * 比對兩個版本的 webview/index.js，列出新版才有的字面值。
 *
 * 用法：node scripts/dev/difflit.js <專案根目錄> <舊版 index.js> <新版 index.js> <輸出檔>
 *
 * 掃描器只看得到介面屬性上的字串，`Error("…")`、指令說明、對照表的值一律抓不到。
 * 要補齊就得拿舊版逐字面值比對——舊版可用 OpenVSX 的 vsix 以 HTTP Range 取得。
 * 輸出每行標 EN／zh，表示套用現有規則後該字面值是否仍存在（仍是英文）。
 */
const fs = require('fs'), path = require('path');
const BS = String.fromCharCode(92);
const [ROOT, OLD, NEW, OUT] = process.argv.slice(2);

function literals(seg) {
    const out = new Map();
    for (let i = 0; i < seg.length; i++) {
        const q = seg[i];
        if (q !== '"' && q !== '`') continue;
        let j = i + 1, buf = '';
        while (j < seg.length && j - i < 2000) {
            if (seg[j] === BS) { buf += seg[j] + (seg[j + 1] || ''); j += 2; continue; }
            if (seg[j] === q || seg[j] === '\n' && q === '"') break;
            buf += seg[j]; j++;
        }
        if (j < seg.length && seg[j] === q) { if (!out.has(buf)) out.set(buf, i); i = j; }
    }
    return out;
}

const texty = t => /[A-Za-z]{2}/.test(t) && !/^[a-z0-9_$.:\-\/#@]+$/.test(t) && !/_[A-Za-z0-9]{6}$/.test(t)
    && !/^[a-z]+[A-Z][A-Za-z0-9]*$/.test(t) && !(/[{};=]|=>/.test(t.replace(/\$\{[^{}]*\}/g, '')) && !/ [a-z]+ /.test(t));

const oldSet = new Set([...literals(fs.readFileSync(OLD, 'utf8')).keys()].map(s => s.replace(/\$\{[^{}]*\}/g, '${}')));
const src = fs.readFileSync(NEW, 'utf8');
const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'translations', 'zh-TW.json'), 'utf8'));
let c = src;
for (const r of pack.translations) {
    if (r.regex) c = c.replace(new RegExp(r.original, r.flags || 'g'), r.chinese);
    else c = c.replaceAll(r.original, r.chinese);
}
const after = literals(c);
const rows = [];
for (const [t, pos] of literals(src)) {
    if (!texty(t)) continue;
    if (oldSet.has(t.replace(/\$\{[^{}]*\}/g, '${}'))) continue;
    rows.push([pos, after.has(t) ? 'EN ' : 'zh ', t]);
}
rows.sort((a, b) => a[0] - b[0]);
fs.writeFileSync(OUT, rows.map(r => `${r[1]}@${r[0]}  ${JSON.stringify(r[2]).slice(0, 400)}`).join('\n'), 'utf8');
console.log('new literals', rows.length, 'still EN', rows.filter(r => r[1] === 'EN ').length);
