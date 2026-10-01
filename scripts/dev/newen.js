#!/usr/bin/env node
/**
 * 從 difflit.js 的輸出裡挑出「真的是新文案」的英文字串。
 *
 * 用法：node scripts/dev/newen.js <舊版 index.js> <difflit 輸出> <輸出檔>
 *
 * difflit 的字面值解析是土法煉鋼，遇到含引號的正規表達式會把引號狀態弄反，
 * 因而冒出一堆根本不是字串的片段。這裡再過一道：丟掉明顯是程式碼的、
 * 並且把「舊版其實就有（變數名不同而已）」的濾掉。
 */
const fs = require('fs');
const [OLD, DIFF, OUT] = process.argv.slice(2);
const old = fs.readFileSync(OLD, 'utf8');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const out = [];
for (const line of fs.readFileSync(DIFF, 'utf8').split('\n')) {
    const m = /^(EN|zh) +@(\d+) +(.*)$/.exec(line);
    if (!m || m[1] !== 'EN') continue;
    let t; try { t = JSON.parse(m[3]); } catch { continue; }
    if (t.length > 300 || !/[A-Za-z]{2,}/.test(t)) continue;
    if (/^[,;:)\]}]/.test(t) || /[({\[=]$/.test(t.trim())) continue;
    if (/_[A-Za-z0-9-]{6}$/.test(t) || /^\$Zod|^Zod/.test(t)) continue;
    if (!/ /.test(t) && !/^[A-Z][a-z]+(?:[A-Z][a-z]+)?[…:.]?$/.test(t)) continue;
    const parts = t.split(/\$\{[^{}]*\}/).map(esc);
    const re = new RegExp('["`]' + parts.join('\\$\\{[^{}]*\\}') + '["`]');
    if (re.test(old)) continue;
    out.push(`@${m[2]}  ${JSON.stringify(t)}`);
}
fs.writeFileSync(OUT, out.join('\n'), 'utf8');
console.log(out.length);
