#!/usr/bin/env node
/**
 * 在「套用現有規則後」的內容裡找片語，印出前後文。寫規則前用來確認錨點與用途。
 *
 * 用法：node scripts/dev/ctx.js <專案根目錄> <index.js> <輸出檔> <片語>...
 * 環境變數：B=前文長度（預設 260）、A=後文長度（預設 200）、MAX=每個片語最多列幾處（預設 6）
 *
 * 看前後文最重要的目的是判斷「這個字串是拿來顯示的，還是拿來比較的」——
 * 比較用的值（startsWith、===、對照表反查）翻了會讓功能壞掉。
 */
const fs = require('fs'), path = require('path');
const [ROOT, SRC, OUT, ...needles] = process.argv.slice(2);
const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'translations', 'zh-TW.json'), 'utf8'));
let c = fs.readFileSync(SRC, 'utf8');
for (const r of pack.translations) {
    if (r.regex) c = c.replace(new RegExp(r.original, r.flags || 'g'), r.chinese);
    else c = c.replaceAll(r.original, r.chinese);
}
const B = +(process.env.B || 260), A = +(process.env.A || 200), MAX = +(process.env.MAX || 6);
const out = [];
for (const p of needles) {
    const idx = [];
    let i = c.indexOf(p);
    while (i >= 0) { idx.push(i); i = c.indexOf(p, i + 1); }
    out.push('='.repeat(100), `### ${JSON.stringify(p)} -> ${idx.length}`);
    for (const i of idx.slice(0, MAX)) out.push(`  @${i} ...${c.slice(Math.max(0, i - B), i)}<<|>>${c.slice(i, i + p.length + A)}...`, '');
}
fs.writeFileSync(OUT, out.join('\n'), 'utf8');
console.log('ok', needles.length);
