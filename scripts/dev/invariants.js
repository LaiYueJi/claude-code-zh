#!/usr/bin/env node
/**
 * 行為不變式：翻譯只能動「顯示用」的字串。
 *
 * 用法：node scripts/dev/invariants.js <專案根目錄> <zh-TW|zh-CN> <index.js.bak> [版本標籤]
 *
 * 兩類檢查：
 *   [值]   程式拿來比較、查表、當識別字用的英文必須原封不動——翻了功能會壞，而且畫面上
 *          看不出異狀，是漢化包最容易踩的坑。一律問「翻譯前後出現次數有沒有變」，
 *          不寫死次數：Claude 每次改版都在換 minify 變數名、同一句也可能多出一處，
 *          寫死只會換來一堆假警報，掩蓋真正的問題。
 *   [顯示] 確認該翻的地方真的翻到了，避免規則被改壞卻沒人發現。
 *
 * 每次補完漏翻、發版前都要跑過繁簡兩種語言。新規則若動到任何比較位置，就在這裡補一條。
 */
const fs = require('fs'), path = require('path');
const [ROOT, LANG, SRC, TAG = ''] = process.argv.slice(2);
const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'translations', LANG + '.json'), 'utf8'));
const raw = fs.readFileSync(SRC, 'utf8');
let c = raw;
for (const r of pack.translations) {
    if (r.regex) c = c.replace(new RegExp(r.original, r.flags || 'g'), r.chinese);
    else c = c.replaceAll(r.original, r.chinese);
}
const n = s => c.split(s).length - 1;
/** 這個字串翻譯前後的出現次數相同（而且原本就存在） */
const keep = s => {
    const before = raw.split(s).length - 1;
    return before > 0 && c.split(s).length - 1 === before;
};
const keepRx = re => {
    const before = (raw.match(re) || []).length;
    return before > 0 && (c.match(re) || []).length === before;
};
const tw = LANG === 'zh-TW';

const checks = [
    // ── 工具識別字與 Monaco 內部表 ─────────────────────────
    ['值', keep('question,"Other")'), 'AskUserQuestion 的 "Other" 保持英文'],
    ['值', keepRx(/=\"ExitPlanMode\",[A-Za-z0-9_$]+=\"Edit\",[A-Za-z0-9_$]+=\"Write\"/g), '工具識別常數 Edit／Write 保持英文'],
    ['值', keep('["Edit","Write","MultiEdit"]'), '工具名陣列保持英文'],
    ['值', keep('["Read","Grep","Search"'), '唯讀工具 Set 保持英文'],
    ['值', keep('"Const","Continue","CSByte"'), 'Monaco VB 關鍵字表保持英文'],
    ['值', keepRx(/=\"Agent\";var [A-Za-z0-9_$]+=/g), 'Agent 工具識別常數保持英文'],
    ['值', keepRx(/name="Bash";commandLabel="bash"/g), 'Bash 工具類別 name 保持英文'],
    ['值', keepRx(/name="PowerShell";commandLabel="PowerShell"/g), 'PowerShell 工具類別 name 保持英文'],
    ['值', keepRx(/name="WebFetch"/g), 'WebFetch 工具類別 name 保持英文'],
    ['值', keep('?"Agent":'), 'Task→Agent 工具名對映保持英文'],
    ['值', keep('$[$.Idle=0]="Idle"'), 'Monaco Idle 列舉保持英文'],
    ['值', keepRx(/\$\[\$\.Event=\d+\]="Event"/g), 'Monaco Event 列舉保持英文'],
    ['值', keep('case"Type":return'), 'Monaco InlayHint "Type" 比較保持英文'],
    ['值', keep('["If","EndIf"]'), 'Monaco If 關鍵字保持英文'],
    ['值', keep('"Declare","Default","Delegate"'), 'Monaco VB Default 關鍵字保持英文'],
    ['值', keep('"Step","Stop","String"'), 'Monaco VB Stop 關鍵字保持英文'],
    ['值', keep('"Optional","Or","OrElse"'), 'Monaco Or 關鍵字保持英文'],
    ['值', keep('Del:"Delete"') && keep('46:"Delete"'), '鍵碼表 Delete 保持英文'],
    ['值', keepRx(/\("accessibilitySignals\.save","Save"\)/g), 'Monaco 無障礙訊號 Save 保持英文'],

    // ── 權限、勾點、沙箱、技能的行為鍵 ───────────────────
    ['值', keep('"Free space"'), '上下文用量類別 "Free space" 比較保持英文'],
    ['值', keep('{allow:[],ask:[],deny:[]}'), '權限行為鍵 allow/ask/deny 保持英文'],
    ['值', keep('.startsWith("Skipped")'), '外掛更新訊息判斷 "Skipped" 保持英文'],
    ['值', keep('value:"auto-allow"') && keep('value:"regular"'), '沙箱模式 value 保持英文'],
    ['值', keep('["on","name-only","user-invocable-only","off"]'), '技能狀態鍵陣列保持英文'],
    ['值', keep('"Peer address":') && keep('"Session kind":'), '狀態欄位對照表的鍵保持英文'],
    ['值', keep('==="saving"?') && keep('==="deleting"'), '記憶編輯器狀態值 saving／deleting 保持英文'],
    ['值', keep('{value:"both",label:') && keep('{value:"code",label:'), '回溯選項 value 保持英文'],
    ['值', keep('local_agent:') && keep('mcp_task:'), '任務種類鍵保持英文'],
    ['值', keep('hostCredential:'), '設定來源鍵保持英文'],
    ['值', keep('G("interrupt")') && keep('G("continue")'), '自動模式按鈕的 interrupt／continue 值保持英文'],

    // ── 拿 CLI 原文比對的字串 ───────────────────────────
    ['值', keep('==="Saving a file is not available here"'), '匯出比較值保持英文'],
    ['值', keep('.includes("Unsupported control request subtype")'), '控制請求比較值保持英文'],
    ['值', keep('.includes("not available in a cloud-hosted session")'), '雲端對話階段比較值保持英文'],
    ['值', keep('empty_remote_control_session:"This Remote Control session'), '遠端控制訊息對照表保持英文（反查用）'],
    ['值', keep('.startsWith("Browser extension is not connected:")'), 'Chrome 錯誤比對用的 CLI 原文保持英文'],
    ['值', keep('.startsWith("Marketplace ")'), '外掛錯誤比對用的 CLI 原文保持英文'],
    ['值', keep('"No conversation found with session ID:"') && keep('"Failed to resume session"'), '續接對話失敗的比對值保持英文'],
    ['值', keep('"Tool permission request failed"'), '工具權限錯誤的比對值保持英文'],
    ['值', keep('this.name="ActionFailed"'), '外掛操作錯誤的 Error.name 保持英文'],

    // ── 送給模型的內容 ─────────────────────────────────
    ['值', keep('"[Request interrupted by user]"'), '送給模型的中斷訊息保持英文'],
    ['值', keep('[Tool call did not complete: the turn was ended'), '送給模型的合成工具結果保持英文'],
    ['值', keep('"The user doesn\'t want to take this action right now. STOP what you are doing'), '拒絕動作時送給模型的指示保持英文'],
    ['值', keep('"Monitor event:"'), '訊息協定標記 Monitor event: 保持英文'],
    ['值', keep('"The user did not answer the questions."'), '問題未作答時送給模型的說明保持英文'],
    ['值', keep('"Your questions have been answered: "'), '問題已作答時送給模型的前綴保持英文'],

    // ── 品牌名 ────────────────────────────────────────
    ['值', keep('"Amazon Bedrock"') && keep('"Google Vertex AI"') && keep('"Microsoft Foundry"'), '雲端供應商品牌名保持英文'],

    // ── 顯示位置確實翻到 ───────────────────────────────
    ['顯示', n(tw ? '"權限規則"' : '"权限规则"') >= 1, '權限規則標題已翻譯'],
    ['顯示', n(tw ? 'value:"command",label:"指令"' : 'value:"command",label:"命令"') === 1, '勾點類型選項已翻譯'],
    ['顯示', n(tw ? '{allow:"允許",ask:"詢問",deny:"拒絕"}' : '{allow:"允许",ask:"询问",deny:"拒绝"}') === 1, '權限行為標籤已翻譯'],
    ['顯示', n(',"agent")') === 0 && n('"hook":"hooks"') === 0, '代理與勾點數量不再輸出英文單複數'],
    ['顯示', n(tw ? '"回溯程式碼與對話"' : '"回溯代码与对话"') === 1, '回溯選項已翻譯'],
    ['顯示', n(tw ? '到剪貼簿`' : '到剪贴板`') === 1, '複製按鈕 aria-label 已翻譯'],
    ['顯示', n(tw ? '" 個背景任務 · ' : '" 个后台任务 · ') === 1, '背景任務標題已翻譯'],
    ['顯示', n('移除 from') === 0, '權限規則移除訊息不再中英混雜'],
    ['顯示', n(tw ? '{title:"沙箱",onClose:' : '{title:"沙箱",onClose:') === 1, '沙箱對話框標題已翻譯'],
    ['顯示', n(tw ? '{title:"匯出對話",onClose:' : '{title:"导出对话",onClose:') === 1, '匯出對話框標題已翻譯'],
    ['顯示', n(tw ? '{title:"狀態",onClose:' : '{title:"状态",onClose:') === 1, '狀態對話框標題已翻譯'],
    ['顯示', n(tw ? 'formLabel,children:"擴充功能"' : 'formLabel,children:"扩展"') === 1, 'Claude in Chrome 對話框欄位已翻譯'],
    ['顯示', n(tw ? '的安全防護機制標記了' : '的安全防护机制标记了') >= 2, '安全防護訊息已翻譯'],
    ['顯示', n('你可能是第一次') === 3, '安全防護「第一次遇到」三句已翻譯'],
    ['顯示', n('invisible characters`') === 0, '隱藏字元提示已翻譯'],
    ['顯示', n(tw ? '"info",["檢視"]' : '"info",["查看"]') === 2, '通知的檢視按鈕已翻譯'],
    ['顯示', n(tw ? '"已封存的對話階段"' : '"已归档的会话"') === 1, '對話階段清單的已封存分組已翻譯'],
    ['顯示', n(tw ? '"它無法載入。"' : '"它无法加载。"') === 1, '外掛載入失敗的預設說明已翻譯'],
    ['顯示', n(tw ? '它的語言伺服器 ' : '它的语言服务器 ') >= 4, '語言伺服器錯誤句已翻譯'],
    ['顯示', n(tw ? '"儲存報告"' : '"保存报告"') === 1, '意見回饋存檔按鈕已翻譯'],
    ['顯示', n(tw ? '"書籤"' : '"书签"') >= 1, '書籤面板已翻譯'],
    ['顯示', n(tw ? '"為所有人解除安裝"' : '"为所有人卸载"') === 1, '外掛解除安裝對話框已翻譯'],
];

let bad = 0;
console.log('--- ' + LANG + (TAG ? ' @ ' + TAG : '') + ' ---');
for (const [kind, ok, msg] of checks) {
    if (!ok) bad++;
    console.log('  ' + (ok ? 'OK  ' : 'FAIL') + ' [' + kind + '] ' + msg);
}
console.log(`  => ${checks.length} 項，${bad ? bad + ' 項失敗' : '全部通過'}`);
process.exit(bad ? 1 : 0);
