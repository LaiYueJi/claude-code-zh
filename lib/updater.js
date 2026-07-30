const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { LANGUAGES } = require('./i18n');
const { parsePack, readPack, comparePack, compareVersion } = require('./pack');

const REPO = 'LaiYueJi/claude-code-zh';
// 主來源 raw.githubusercontent；備援 jsDelivr（部分網路環境連不上 raw 時仍可更新）
const DEFAULT_SOURCES = [
    `https://raw.githubusercontent.com/${REPO}/main/translations/`,
    `https://cdn.jsdelivr.net/gh/${REPO}@main/translations/`,
];
const RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASE_PAGE = `https://github.com/${REPO}/releases/latest`;

const MAX_BYTES = 4 * 1024 * 1024;   // 翻譯包約 70 KB，留足餘裕即可，避免無上限下載
const TIMEOUT_MS = 15000;

/** 下載文字內容（處理轉址、逾時、大小上限） */
function httpsGetText(url, headers = {}, redirectsLeft = 4) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: { 'User-Agent': 'claude-code-zh-updater', 'Accept-Encoding': 'identity', ...headers },
            timeout: TIMEOUT_MS,
        }, res => {
            const { statusCode, headers: h } = res;
            if ([301, 302, 303, 307, 308].includes(statusCode) && h.location) {
                res.resume();
                if (redirectsLeft <= 0) return reject(new Error('轉址次數過多'));
                const next = new URL(h.location, url).toString();
                return resolve(httpsGetText(next, headers, redirectsLeft - 1));
            }
            if (statusCode !== 200) {
                res.resume();
                return reject(new Error(`HTTP ${statusCode}`));
            }
            let size = 0;
            const chunks = [];
            res.on('data', c => {
                size += c.length;
                if (size > MAX_BYTES) {
                    req.destroy();
                    return reject(new Error('回應內容超過大小上限'));
                }
                chunks.push(c);
            });
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        });
        req.on('timeout', () => req.destroy(new Error('連線逾時')));
        req.on('error', reject);
    });
}

/** 下載二進位檔並存到 destPath */
function httpsDownload(url, destPath, redirectsLeft = 4) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: { 'User-Agent': 'claude-code-zh-updater' },
            timeout: TIMEOUT_MS * 4,
        }, res => {
            const { statusCode, headers: h } = res;
            if ([301, 302, 303, 307, 308].includes(statusCode) && h.location) {
                res.resume();
                if (redirectsLeft <= 0) return reject(new Error('轉址次數過多'));
                return resolve(httpsDownload(new URL(h.location, url).toString(), destPath, redirectsLeft - 1));
            }
            if (statusCode !== 200) {
                res.resume();
                return reject(new Error(`HTTP ${statusCode}`));
            }
            const file = fs.createWriteStream(destPath);
            res.pipe(file);
            file.on('finish', () => file.close(() => resolve(destPath)));
            file.on('error', reject);
        });
        req.on('timeout', () => req.destroy(new Error('連線逾時')));
        req.on('error', reject);
    });
}

/**
 * 線上更新：翻譯包與擴充功能新版檢查。
 *
 * 翻譯包更新後存到 globalStorage，Translator 會在「快取版比內建版新」時改用快取版。
 * 因此多數「Claude 改版造成漏翻」的修正，使用者不必重裝 VSIX 就能拿到。
 */
class Updater {
    constructor(config, context) {
        this.config = config;
        this.context = context;
    }

    /** 快取翻譯包的存放目錄（globalStorage 不會因擴充功能更新而消失） */
    getCacheDir() {
        return path.join(this.context.globalStorageUri.fsPath, 'translations');
    }

    getCachePath(lang) {
        const meta = LANGUAGES[lang] || LANGUAGES['zh-TW'];
        return path.join(this.getCacheDir(), meta.file);
    }

    /** 目前快取中的翻譯包（沒有或不合法則回傳 null） */
    getCachedPack(lang) {
        return readPack(this.getCachePath(lang), lang);
    }

    /** 刪除快取，回到內建翻譯包 */
    clearCache() {
        const dir = this.getCacheDir();
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    }

    getSources() {
        const custom = this.config.get('translationSourceUrls');
        const list = (Array.isArray(custom) && custom.length > 0) ? custom : DEFAULT_SOURCES;
        return list.map(u => (u.endsWith('/') ? u : u + '/'));
    }

    /** 依序嘗試各來源下載並驗證翻譯包 */
    async fetchRemotePack(lang) {
        const meta = LANGUAGES[lang] || LANGUAGES['zh-TW'];
        const errors = [];
        for (const base of this.getSources()) {
            const url = base + meta.file;
            try {
                const text = await httpsGetText(url);
                const result = parsePack(text, lang);
                if (!result.ok) throw new Error(`翻譯包不合法：${result.reason}`);
                return { pack: result.pack, text, url };
            } catch (e) {
                errors.push(`${url} → ${e.message}`);
            }
        }
        throw new Error(errors.join('；'));
    }

    /**
     * 檢查並套用翻譯包更新。
     * @returns {{updated: boolean, from: string, to: string, reason?: string}}
     */
    async updateTranslationPack(lang, currentPack) {
        const { pack, text } = await this.fetchRemotePack(lang);
        if (comparePack(pack, currentPack) <= 0) {
            return { updated: false, from: currentPack && currentPack.version, to: pack.version, reason: 'up-to-date' };
        }
        const dir = this.getCacheDir();
        fs.mkdirSync(dir, { recursive: true });
        // 先寫暫存再改名，避免中途失敗留下半個檔案
        const dest = this.getCachePath(lang);
        const tmp = dest + '.tmp';
        fs.writeFileSync(tmp, text, 'utf8');
        fs.renameSync(tmp, dest);
        return { updated: true, from: currentPack && currentPack.version, to: pack.version, pack };
    }

    /** 查詢 GitHub 最新 Release；回傳 null 表示已是最新 */
    async checkExtensionUpdate(currentVersion) {
        const text = await httpsGetText(RELEASE_API, { Accept: 'application/vnd.github+json' });
        const data = JSON.parse(text);
        const tag = String(data.tag_name || '');
        const latest = tag.replace(/^v/, '');
        if (!latest || compareVersion(latest, currentVersion) <= 0) return null;
        const asset = (data.assets || []).find(a => String(a.name || '').endsWith('.vsix'));
        return {
            version: latest,
            tag,
            pageUrl: data.html_url || RELEASE_PAGE,
            vsixUrl: asset && asset.browser_download_url,
            vsixName: asset && asset.name,
        };
    }

    /** 下載新版 VSIX 到暫存資料夾，回傳檔案路徑 */
    async downloadVsix(info) {
        if (!info || !info.vsixUrl) throw new Error('這個 Release 沒有 .vsix 附件');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-code-zh-'));
        const dest = path.join(dir, info.vsixName || `claude-code-zh-${info.version}.vsix`);
        await httpsDownload(info.vsixUrl, dest);
        return dest;
    }
}

module.exports = { Updater, RELEASE_PAGE, DEFAULT_SOURCES };
