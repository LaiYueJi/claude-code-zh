#!/usr/bin/env node
/**
 * 把翻譯包套到 index.js 原始檔並輸出成新檔，供語法檢查、抽查與 mixed.py／puresweep.py 掃描。
 *
 * 用法：node scripts/dev/emit.js <translations/zh-TW.json> <index.js 原始檔> <輸出檔> [要抽查的片語...]
 * 抽查的片語會印出前後文，找不到會標「!! 找不到」。
 */
const fs = require("fs");
const pack = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
let c = fs.readFileSync(process.argv[3], "utf8");
for (const r of pack.translations) {
    if (r.regex) c = c.replace(new RegExp(r.original, r.flags || "g"), r.chinese);
    else c = c.replaceAll(r.original, r.chinese);
}
fs.writeFileSync(process.argv[4], c);
for (const needle of process.argv.slice(5)) {
    const i = c.indexOf(needle);
    console.log(i === -1 ? "!! 找不到: " + needle : "   " + JSON.stringify(c.slice(i - 20, i + 230)));
}
