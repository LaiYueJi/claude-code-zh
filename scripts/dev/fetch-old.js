#!/usr/bin/env node
/**
 * 從 OpenVSX 取得舊版 Claude Code 的 webview/index.js，供差異比對使用。
 *
 * 用法：node scripts/dev/fetch-old.js <版本> <輸出檔>
 *   例：node scripts/dev/fetch-old.js 2.1.286 /tmp/index-286.js
 *
 * vsix 本身超過 100MB（內含 CLI 的原生執行檔），但它就是個 zip：
 * 先用 HTTP Range 取尾端的中央目錄，找出 extension/webview/index.js 的位移與壓縮大小，
 * 再只抓那一段解壓，實際傳輸約 5MB。取回的內容與本機 index.js.bak 位元組相同。
 */
const fs = require('fs'), zlib = require('zlib');
const [VERSION, OUT] = process.argv.slice(2);
const ENTRY = 'extension/webview/index.js';
const URL_ = `https://open-vsx.org/api/Anthropic/claude-code/win32-x64/${VERSION}/file/Anthropic.claude-code-${VERSION}@win32-x64.vsix`;

async function range(a, b) {
    const r = await fetch(URL_, { headers: { Range: `bytes=${a}-${b}` }, redirect: 'follow' });
    if (r.status !== 206) throw new Error('預期 206，實際收到 ' + r.status);
    return { buf: Buffer.from(await r.arrayBuffer()), total: +r.headers.get('content-range').split('/')[1] };
}

(async () => {
    const { total } = await range(0, 0);
    const tailLen = Math.min(total, 1 << 20);
    const { buf: tail } = await range(total - tailLen, total - 1);
    const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const cdSize = tail.readUInt32LE(eocd + 12), cdOff = tail.readUInt32LE(eocd + 16);
    const cd = (await range(cdOff, cdOff + cdSize - 1)).buf;
    let p = 0;
    while (p < cd.length && cd.readUInt32LE(p) === 0x02014b50) {
        const method = cd.readUInt16LE(p + 10), csize = cd.readUInt32LE(p + 20);
        const nlen = cd.readUInt16LE(p + 28), elen = cd.readUInt16LE(p + 30), clen = cd.readUInt16LE(p + 32);
        const lho = cd.readUInt32LE(p + 42), name = cd.slice(p + 46, p + 46 + nlen).toString();
        if (name === ENTRY) {
            const lh = (await range(lho, lho + 29)).buf;
            const start = lho + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
            const data = (await range(start, start + csize - 1)).buf;
            fs.writeFileSync(OUT, method === 8 ? zlib.inflateRawSync(data) : data);
            console.log('ok', VERSION, '->', OUT, fs.statSync(OUT).size, 'bytes');
            return;
        }
        p += 46 + nlen + elen + clen;
    }
    throw new Error('zip 裡找不到 ' + ENTRY);
})().catch(e => { console.error(e.message); process.exit(1); });
