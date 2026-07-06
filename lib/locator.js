const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * 擴充功能定位器：負責找到 Claude Code 擴充功能與其 webview 檔案
 */
class Locator {
    constructor(config) {
        this.config = config;
    }

    /** 找到 Claude Code 擴充功能的安裝路徑 */
    async findClaudeCodeExtension() {
        const extensionId = this.config.get('claudeCodeExtensionId') || 'Anthropic.claude-code';

        // 優先使用 VS Code API（最可靠）
        const extension = vscode.extensions.getExtension(extensionId);
        if (extension) {
            return extension.extensionPath;
        }

        // 備援：直接掃描擴充功能目錄（大小寫不敏感比對）
        for (const dir of this.getExtensionDirectories()) {
            if (!fs.existsSync(dir)) continue;
            try {
                const files = fs.readdirSync(dir)
                    .filter(f => f.toLowerCase().startsWith('anthropic.claude-code'))
                    .sort();
                if (files.length > 0) {
                    // 取版本號最新（字串排序後的最後一個）
                    const latest = files[files.length - 1];
                    const fullPath = path.join(dir, latest);
                    if (fs.statSync(fullPath).isDirectory()) {
                        return fullPath;
                    }
                }
            } catch (error) {
                console.error('掃描目錄出錯：', dir, error);
            }
        }

        console.error('✗ 找不到 Claude Code 擴充功能');
        return null;
    }

    /** VS Code 擴充功能可能所在的目錄 */
    getExtensionDirectories() {
        const userProfile = process.env.USERPROFILE || process.env.HOME || '';
        return [
            path.join(userProfile, '.vscode', 'extensions'),
            path.join(userProfile, '.vscode-insiders', 'extensions'),
            path.join(userProfile, '.vscode-server', 'extensions'),
        ];
    }

    /** 找到 Claude Code 的介面檔案（webview/index.js） */
    findMainFile(extensionPath) {
        const possiblePaths = [
            path.join(extensionPath, 'webview', 'index.js'),
        ];
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) return p;
        }
        return null;
    }

    /** 讀取 Claude Code 擴充功能版本 */
    getClaudeCodeVersion() {
        const extensionId = this.config.get('claudeCodeExtensionId') || 'Anthropic.claude-code';
        const extension = vscode.extensions.getExtension(extensionId);
        if (extension && extension.packageJSON) {
            return extension.packageJSON.version || null;
        }
        return null;
    }
}

module.exports = Locator;
