#!/usr/bin/env node
/**
 * 在命令列重現擴充功能的「掃描未翻譯字串」。
 *
 * 用法：node scripts/dev/scan-sim.js <專案根目錄> <index.js.bak> <zh-TW|zh-CN>
 *
 * 直接把 extension.js 載進來用它自己的掃描函式，確保這裡看到的結果與使用者按下
 * 「掃描未翻譯字串」看到的一致；vscode 模組以空殼替身代入。
 */
const fs = require('fs'), path = require('path'), Module = require('module');
const ROOT = process.argv[2], BAK = process.argv[3], LANG = process.argv[4];

const origLoad = Module._load;
Module._load = function (req) {
    if (req === 'vscode') return { window: {}, commands: {}, workspace: { getConfiguration: () => ({ get: () => undefined }) }, extensions: {}, Uri: {}, ViewColumn: {} };
    return origLoad.apply(this, arguments);
};

const src = fs.readFileSync(path.join(ROOT, 'extension.js'), 'utf8')
    + '\nmodule.exports.__scan = { findUntranslated, findDeadRules, normalizePlaceholders };\n';
const m = new Module(path.join(ROOT, 'extension.js'), null);
m.filename = path.join(ROOT, 'extension.js');
m.paths = Module._nodeModulePaths(ROOT);
m._compile(src, m.filename);

const { findUntranslated, normalizePlaceholders } = m.exports.__scan;
const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'translations', LANG + '.json'), 'utf8'));
let c = fs.readFileSync(BAK, 'utf8');
for (const r of pack.translations) {
    if (r.regex) c = c.replace(new RegExp(r.original, r.flags || 'g'), r.chinese);
    else c = c.replaceAll(r.original, r.chinese);
}
const ignore = new Set((pack.scanIgnore || []).map(normalizePlaceholders));
const all = findUntranslated(c);
const list = all.filter(s => !ignore.has(normalizePlaceholders(s)));
console.log(`[${LANG}] ${path.basename(path.dirname(path.dirname(BAK)))}：需處理 ${list.length} 條（掃出 ${all.length}，刻意不翻 ${all.length - list.length}）`);
list.slice(0, 80).forEach((s, i) => console.log(` ${i + 1}. ${JSON.stringify(s)}`));
