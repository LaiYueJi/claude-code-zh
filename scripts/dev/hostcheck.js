#!/usr/bin/env node
/**
 * 驗證擴充主程式（extension.js）的翻譯規則。
 *
 * 用法：node scripts/dev/hostcheck.js <專案根目錄> <extension.js 原始檔> <zh-TW|zh-CN>
 *
 * 主程式改壞不是「某句沒翻到」，而是 Claude Code 整個無法啟用，所以這裡檢查三件事：
 *   1. 每條規則都命中（0 次＝寫錯或 Claude Code 改過，會悄悄失效）
 *   2. 命中超過一次的要看清楚（錨點太鬆容易誤傷程式碼）
 *   3. 套用後能不能通過編譯——擴充功能在寫檔前也會做同一道檢查
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const [ROOT, SRC, LANG] = process.argv.slice(2);

const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'translations', LANG + '.json'), 'utf8'));
const rules = pack.hostTranslations || [];
const orig = fs.readFileSync(SRC, 'utf8');

let content = orig, zero = 0, many = 0;
for (const r of rules) {
    let n;
    if (r.regex) {
        const re = new RegExp(r.original, r.flags || 'g');
        n = (orig.match(re) || []).length;
        content = content.replace(new RegExp(r.original, r.flags || 'g'), r.chinese);
    } else {
        n = orig.split(r.original).length - 1;
        content = content.split(r.original).join(r.chinese);
    }
    if (n === 0) zero++;
    if (n > 1) many++;
    const tag = n === 0 ? '✗ 沒命中' : n > 1 ? `! ${n} 次` : `  ${n} 次`;
    console.log(`  ${tag}  ${JSON.stringify(r.original).slice(0, 86)}`);
}

let compiles = true, err = '';
try {
    new vm.Script(content, { filename: SRC });
} catch (e) {
    compiles = false;
    err = e.message;
}

console.log();
console.log(`[${LANG}] 規則 ${rules.length} 條，沒命中 ${zero}，命中多次 ${many}，` +
    `套用後編譯：${compiles ? '通過' : '失敗 → ' + err}`);
console.log(`檔案大小 ${orig.length} -> ${content.length}`);
process.exit(zero === 0 && compiles ? 0 : 1);
