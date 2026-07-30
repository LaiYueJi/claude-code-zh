#!/usr/bin/env node
/**
 * 由 CHANGELOG.md 取出指定版本的段落，組成 GitHub Release 說明。
 *
 * 用法：node scripts/release-notes.js [版本號] > RELEASE_NOTES.md
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = process.argv[2] || pkg.version;
const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');

// 取 "## [版本]" 到下一個 "## [" 之間的內容
const esc = version.replace(/\./g, '\\.');
const m = changelog.match(new RegExp(`^## \\[${esc}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|\\Z)`, 'm'));
const section = m ? m[1].trim() : '';

const counts = (() => {
    try {
        const zh = JSON.parse(fs.readFileSync(path.join(ROOT, 'translations/zh-TW.json'), 'utf8'));
        return zh.translations.length;
    } catch { return null; }
})();

const out = [];
out.push('繁體中文（台灣）與簡體中文（中國大陸）雙語語言包' + (counts ? `，內建翻譯 **各 ${counts} 條**。` : '。'));
out.push('');
out.push('## 📦 安裝');
out.push('');
out.push(`下載下方 \`claude-code-zh-${version}.vsix\` → VS Code \`擴充功能\` 面板 → 右上角 \`⋯\` → \`從 VSIX 安裝…\` → 依提示 **重新載入視窗**。`);
out.push('');
out.push('> 已安裝舊版者直接安裝新版即可。另外，翻譯包本身支援線上更新——擴充功能會定期向本專案取得最新的 `translations/*.json`，多數「Claude 改版造成漏翻」的修正不必重裝 VSIX 就會生效。');
out.push('');
out.push('---');
out.push('');
if (section) {
    out.push(section);
} else {
    out.push(`（CHANGELOG.md 中找不到 ${version} 的段落）`);
}
out.push('');
out.push('---');
out.push('');
out.push('📜 完整變更記錄：[CHANGELOG.md](https://github.com/LaiYueJi/claude-code-zh/blob/main/CHANGELOG.md)');

process.stdout.write(out.join('\n') + '\n');
