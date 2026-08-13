# 更新紀錄

本檔案記錄「Claude Code for VS Code 繁體／簡體中文語言包」的版本變更。

## [2.2.2] - 2026-08-14（翻譯包熱更新，擴充功能本體不變）

### 新增（Claude Code 2.1.229／2.1.231 兩個新功能，繁簡各 27 條）
- 💬 **側邊提問面板**：標題、輸入框 placeholder／aria-label、清除與送出按鈕、`回答中…`、`已取消。`、`無法取得回答：`，以及空狀態與無回答時的兩句提示（`Ask a quick side question below…`、`Claude didn't return an answer…`，兩者是變數參照字串）。
- 🗂️ **對話階段分組**：`新群組`／`重新命名群組`／`刪除群組`／`從群組移除`、`以此對話階段建立群組`、切換與恢復對話階段，以及三條樣板字串 `以 ${n} 個對話階段建立群組`、`移至 "${群組名}"`、分組標題的 `展開／收合 ${群組名}`。
- 📋 順帶補上對話階段列表既有的漏網之魚：`正在載入對話階段…`、`尚無對話階段`（`children:"文字"` 不在掃描器的屬性清單內）。

### 修正（3 條規則在此版本已對不上）
- 🔁 **用量說明多了 the**：`% of your usage came from plugin "` → `… from the plugin "`，MCP server 同樣加了 `the`。新增對應新寫法的規則，**舊規則保留**給尚未更新的使用者。
- 📨 **意見回饋改寫成樣板字串**：`Couldn't send feedback: no active session` 變成 `` `Couldn't send feedback: ${錯誤訊息}` ``。改用正規表達式規則涵蓋，另補 `Thank you for your report!` 的兩種形式（含／不含 Feedback ID）。

### 備註
- 掃描回報 8 條，實際補了 27 條——三元運算子內的字面值（`label:x?"A":"B"`）、`children:"文字"` 與樣板字串都不在掃描器的三階段涵蓋範圍內，這次是逐一比對兩個新元件的原始碼補齊的。
- `展開／收合` 規則刻意限制捕獲內容不得含括號（`[^{}()]*`），只命中分組標題的 `${e.name}`，不誤傷摺疊列的 `` `Collapse ${T_e(e)}` ``（該處可見文字仍是英文，翻了 aria-label 反而不一致）。
- 僅 `translations/*.json` 變動（583 → **610 條**，繁簡相同），版本推進到 2.2.2 走線上熱更新；擴充功能本體仍為 2.2.0，**不必重裝 VSIX**。

## [2.2.1] - 2026-08-08（翻譯包熱更新，擴充功能本體不變）

### 修正（Claude Code 2.1.226 漏翻，繁簡各 4 條）
- 🚦 **權限模式「不詢問」**：`Don't ask` 與其說明 `Claude will deny actions that need approval instead of asking`。同一份選單的 `Manual`／`Edit automatically` 早已翻譯，只有這個模式是新加的。
- 👁️ **設定選單「專注檢視」**：`Focus view` 與其說明 `Show only your prompts and Claude's responses`。
- 📎 兩條 `description` 是掃描器看不到的盲點——`description` 只納入「變數參照」掃描（字面值會被 Monaco 的色彩說明洪水淹沒），因此畫面上跟著標籤一起是英文，掃描卻只回報 2 條。修正時一併補上。

### 備註
- 僅 `translations/*.json` 變動（579 → **583 條**，繁簡相同），版本推進到 2.2.1 走線上熱更新；擴充功能本體仍為 2.2.0，**不必重裝 VSIX**。

## [2.2.0] - 2026-07-30

### 新增
- ☁️ **翻譯包線上熱更新**：擴充功能會定期（最短間隔 6 小時）向 GitHub 取得最新的 `translations/*.json`，**Claude 改版造成的漏翻修正不必重裝 VSIX 就會生效**。
  - 下載的翻譯包存在 `globalStorage`（不會因擴充功能更新而消失）；`Translator` 在載入時比較「內建版」與「線上快取版」，**取較新者**。版本相同再比 `updatedAt`，因此同一版本內補幾條漏翻也推得動。
  - 套用前先驗證：JSON 可解析、`locale` 相符、規則陣列非空、每條規則欄位齊全且正規表達式可編譯。**任一項不過就整包不採用、自動回退內建版**，避免一次壞掉的更新讓整個介面翻不出來。另有 4 MB 大小上限與 15 秒逾時。
  - 寫入採「先寫暫存再改名」，中途失敗不會留下半個檔案。
  - 來源預設 `raw.githubusercontent.com`，連不上時自動改用 **jsDelivr** 鏡像；也可用 `claudeCodeZh.translationSourceUrls` 自訂。
  - 更新成功後會自動重新套用翻譯並提示重新載入視窗。
- 🆕 **擴充功能新版提醒**：讀取 GitHub Releases，發現新版時提示「下載並安裝／開啟 Release 頁面／略過此版本」。選擇安裝會下載 `.vsix` 並直接安裝，失敗則自動退回開啟 Release 頁面手動處理。「略過此版本」會被記住，不再重複打擾。
- ⬆️ **新增指令**：「檢查更新（翻譯包／擴充功能）」與「還原為內建翻譯包」（清除線上快取的逃生門），兩者皆已加入狀態列快速選單。
- ⚙️ **新增設定**：`autoUpdateTranslations`（預設開）、`checkExtensionUpdate`（預設開）、`translationSourceUrls`（預設用內建來源）。
- ℹ️ 狀態說明新增「翻譯包來源：線上更新／擴充功能內建」一行。

### 改進
- 🤖 **發佈流程自動化**：`.github/workflows/release.yml` 推 `v*` 標籤即自動驗證、打包、建立 Release 並上傳 `.vsix`；也支援手動觸發重跑某個標籤。
  - 新增 `scripts/verify-release.js` 發佈前檢查：標籤與 `package.json`／翻譯包版本一致性、翻譯包 JSON 合法性、每條規則欄位與正規表達式可編譯、繁簡條數一致、規則不重複、原始碼可編譯、無裸 NUL 位元組、CHANGELOG 有對應段落。任一項不過即中止發佈。本機可隨時 `npm run verify`，`npm run build` 也會先跑一次。
  - 新增 `scripts/release-notes.js`：自動從 CHANGELOG 擷取該版段落組成 Release 說明，不必手寫。
  - 翻譯包版本允許「跑在擴充功能前面」（供熱更新使用），只擋比擴充功能舊的情況。

### 備註
- 熱更新自 **2.2.0 起**生效——舊版沒有這段程式碼，仍需手動更新一次到 2.2.0 以後才能享受到。
- 本次翻譯規則內容未變動，仍為 **579 條**（繁簡各），版本號隨擴充功能推進至 2.2.0。

## [2.1.5] - 2026-07-29

### 新增（掃描器補上兩個盲點）
- 🔭 **樣板字串掃描**：新增第三階段掃描，涵蓋 `` `… ${變數} …` `` 這類文案。前兩階段只認 `prop:"字面值"` 與變數參照，樣板字串一律看不見——2.1.220 的「訊息被標記」對話框整段改寫成樣板字串後，畫面明明是英文，掃描卻回報 0 漏翻，即是此盲點所致。
  - 判斷「是文案而非程式碼」用兩層條件：**形態**（不含程式碼字元、以大寫或佔位符開頭、四個以上英文單字、佔位符內不得再包字串）與**位置**（前後 3000 字元內需有足夠中文）。後者利用「掃描對象是已套用翻譯的內容」這點：Claude 自家 UI 翻完後中文密集，內嵌的 Monaco 編輯器區段幾乎沒有中文，藉此擋掉 `Tree element not found`、`Semantic token…` 等內部訊息。
  - 另濾除 `throw new Error(...)`／`console.warn(...)` 等診斷訊息，並保留 `TPL_IGNORE` 供少數已知誤判除名。
  - 回歸驗證：以修正前的 v2.1.3 規則掃 2.1.220，新掃描器可抓出全部 3 條 safeguards 漏翻（舊掃描器只抓到 1 條）。
- ⚠️ **失效規則偵測**：掃描時一併比對每條規則是否還對得上原始英文。刻意保留給舊版的規則本來就對不上（2.1.220 有 43 條），全部列出只是雜訊，因此**只回報「上次還對得上、這次忽然對不上」的規則**——這幾乎等於 Claude 改寫了那段英文。基準線存在 globalState，首次掃描僅建立不提示。
  - 以 2.1.216 → 2.1.220 模擬：43 條失效規則中精準篩出 **2 條**新失效（即 safety measures／This model's safeguards 兩條被改寫者），無雜訊。

### 修正（新掃描器找出的漏翻，繁簡各 15 條）
- 💳 **Fable 5 用量點數**：`Fable 5 requires usage credits — buy at …`、`… you have ${…} in credits.`、`… Your other models remain included in your plan.`
- ⚠️ **操作失敗訊息**：`Failed to add marketplace/fork conversation/rewind code/set model: ${…}`（原本只有帶固定原因的版本有翻譯，帶例外訊息的樣板版本漏翻）。
- 📝 **對話階段命名驗證**：補齊 2.1.4「已知未涵蓋」列出的整組訊息——`Name is required`、`Name must be ${n} characters or fewer`、`Only letters, numbers, dots, hyphens, and underscores`、`Name cannot be "." or ".." or contain ".."`、`Name cannot end with "." or ".lock"`（後兩條在原始碼中為單引號字串，規則已保留其引號形式）。
- 🧰 **其他**：`Continue in Terminal to configure ${…}?`、`Open ${工作樹} in new window`，以及 2.1.216 版的長版 safeguards 文案（`The safeguards are intentionally broad right now…`），讓 2.1.216 在新掃描器下同樣為 0 漏翻。
- 內建翻譯由 564 增至 **579 條**（繁簡各）。以新掃描器對 **2.1.216／2.1.220 × 繁體／簡體** 四種組合實測，皆為 **0 漏翻**且翻譯後的 `webview/index.js` 均通過 JS 語法檢查。

### 備註
- 上一版所稱「2.1.220 全檔掃描 0 漏翻」是以當時的掃描器為準；本版掃描器補上樣板字串後又找出 15 條，已於本版一併補齊。2.1.4 的「已知未涵蓋」一節至此全數處理完畢。

## [2.1.4] - 2026-07-29

### 修正（補上 2.1.220 漏翻）
- 🛡️ **安全防護切換設定**：Claude 2.1.220 把說明文案的 `safety measures` 改寫為 `safeguards`（`When safeguards flag a message, automatically switch to a different model to keep chatting…`），舊規則對不上而漏翻，本版補上新字串（舊字串規則保留，2.1.216 以前的版本仍可翻譯）。
- 🚩 **訊息被標記對話框**：同一功能的對話框內文在 2.1.220 全面改成 template literal（`` `${e}'s safeguards flagged this message…` ``），模型名稱由變數帶入，原本的字面值規則 `This model's safeguards flagged this message…` 已不存在於新版，導致整段對話框顯示英文。新增三條規則補齊：
  - 一般情形：「${模型} 的安全防護機制標記了這則訊息。這偶爾也會發生在安全、正常的對話中。」
  - 資安／生物領域（新文案 `Our intentionally broad safeguards allow us to deliver more capabilities faster…`）：「…我們刻意把防護範圍設得較廣，好讓我們更快帶來更多功能，但有時也會誤標正當的程式開發、資訊安全與生物學工作。」
  - 結尾句 `You can continue with a different model.` →「你可以改用其他模型繼續對話。」
  - 這兩條 template literal 規則以正規表達式比對，變數名（minify 產生的 `e`）以擷取群組保留，Claude 之後改名也不會失效。
- ⏪ **程式碼回溯結果**：補上 `Code rewind completed, but ${n} file(s) were skipped: …` →「程式碼回溯已完成，但有 ${n} 個檔案被略過：…」／「代码回溯已完成，但有 ${n} 个文件被跳过：…」（原本只有相鄰的 `Code rewind successful` 有翻譯）。
- 內建翻譯由 559 增至 **564 條**（繁簡各）；套用後對 2.1.220 全檔掃描為 **0 漏翻**（繁簡皆是），翻譯後的 `webview/index.js` 亦通過 JS 語法檢查。

### 已知未涵蓋
- 對話階段命名的驗證訊息（`Name is required`、`Name must be ${n} characters or fewer`、`Only letters, numbers, dots, hyphens, and underscores`）目前尚未翻譯，需另做一輪整組補譯；此類字串不在掃描器涵蓋的屬性樣式內，故未被偵測。

## [2.1.3] - 2026-07-12

### 修正（補上 2.1.207 漏翻）
- 🈺 **自動模式標籤**：Claude 把模式標籤由 `"Auto mode"` 縮短成 `"Auto"`，舊規則對不上而漏翻。新增精準規則 `label:"Auto"` → 「自動模式」／「自动模式」（僅比對此唯一處，不動到同名的 enum 反查值 `e[e.Auto=…]="Auto"`）。
- 🔌 **遠端控制設定**：補上 `Enable Remote Control for all sessions` →「為所有對話階段啟用遠端控制」與其說明 `Connect new sessions to claude.ai/code…`（此二字串被 minify 提取成變數 `label:dN`／`description:Cbe`，本版掃描器已能偵測，見下）。
- 內建翻譯由 556 增至 **559 條**（繁簡各）；套用後對 2.1.207 全檔掃描為 **0 漏翻**。

### 新增
- 📋 **檢視未翻譯清單**：新增指令與選單項，直接開啟上次掃描結果，**不必重新掃描**即可看清單（本工作階段尚未掃描過時才會自動掃一次）。

### 改進
- 🔭 **掃描器補抓「變數參照」字串**：Claude 新版把較長的介面字串經 minify 提取成模組變數（如 `var dN="Enable Remote Control for all sessions"`），再以 `label:dN`／`description:Cbe` 參照，導致舊掃描（只認 `prop:"字面值"`）漏抓。改為兩階段：先建「變數→字串」對照表，再掃 `prop:變數名` 還原字串。
  - 例：2.1.207 舊掃描只找到 `Auto`；新掃描另補抓 `Enable Remote Control for all sessions` 及其說明 `Connect new sessions to claude.ai/code…`。
  - `description:` 僅用於「變數參照」階段並加「多字自然語言片語」過濾，**不重蹈 2.1.1 提到的 Monaco `description:"…"` 洗版問題**；在已完整翻譯的 2.1.201 上實測仍為 0 誤判。

## [2.1.2] - 2026-07-05

### 新增／修正（補上 2.1.x 新增的動態字串）
- 📊 **用量洞察面板**：補齊 9 條洞察標題（`… of your usage was at >150k context`、`… came from sessions active for 8+ hours`、`… from subagent-heavy sessions`、`… while 4+ sessions ran in parallel`、`… hit a >100k-token cache miss`，以及 agents／skills／plugins／mcp_servers 分組標題）與副標「these are independent characteristics of your usage, not a breakdown」。
- 🚦 **用量上限文案**：`You've used …% of your …`、`You've hit your …`、`Approaching …`、上限標籤（session／weekly／weekly Opus／weekly Sonnet／Fable 5／usage credit limit）、重置時間（`resets in 1h` → 「1 小時後重置」等）。
- 🗜️ **上下文壓縮**：`Click to compact now.` → 「點擊立即壓縮。」。
- 🎙️ **語音輸入**：`Tap or hold to record`、`Stop recording`、`Voice dictation`、`Dictation error:`、`Microphone access denied（— enable in …）`。
- 🧰 **工具列**：`Edit` 工具標題（比照現有 Read／Write）；Edit 差異摘要 `Added N lines / Removed N lines / Modified` → 「新增 N 行／移除 N 行／已修改」；`Manual` 編輯模式描述等。
- 🧩 **其他**：`Show more/less`、`Thought for 12s` → 「已思考 12 秒」、`Disconnect Remote Control`。
- 內建翻譯由 509 增至 **556 條**（繁簡各）。

### 備註
- 這些多為含變數的 template literal，規則已對「數字／變數（`${…}`）保留、僅替換靜態英文片段」逐條在實際 `webview/index.js` 上驗證，確保不破壞版面與變數。

## [2.1.1] - 2026-07-04

### 修正
- 🈺 `Manual`（編輯模式標籤）改譯為「**手動模式**」／「**手动模式**」，與「規劃模式／自動模式」等並列一致。
- 🐞 補上 **自動模式**（Auto mode）漏翻的描述：「Claude will approve actions that pass a safety check and pause for anything risky」→ 繁「Claude 會核准通過安全檢查的操作，遇到有風險的操作則暫停。」／簡「Claude 会批准通过安全检查的操作，遇到有风险的操作则暂停。」。內建翻譯 508 → **509 條**（繁簡各）。

### 備註
- 掃描未翻譯字串刻意不涵蓋 `description:` 屬性：該屬性有近百條 Monaco 編輯器內部字（CSS class、編輯器指令描述），只有極少數屬於 Claude UI，全掃會嚴重洗版。Claude 目前的模式描述已全數翻譯。

## [2.1.0] - 2026-07-04

### 新增
- 🧭 **一鍵定位未翻譯字串**：新增「跳到未翻譯字串」指令與選單項；掃描到漏翻後可直接開啟 `webview/index.js` 並選取該字串所在位置（QuickPick 可搜尋、顯示出現次數），方便查看上下文與新增規則。
- 🆕 **翻譯包更新自動生效**：翻譯檔加入 `version` 與 `updatedAt`，本擴充以「語言＋版本＋日期＋條數」計算簽章；啟動時若簽章有變（例如更新了內建翻譯），會自動強制重新套用，讓新翻譯立即生效。狀態說明新增「翻譯包版本」一行。
- 🈺 補上 **`Manual`**（編輯模式標籤）翻譯：繁「手動」／簡「手动」。內建翻譯由 507 增至 **508 條**（繁簡各）。

### 變更
- 🏷️ 發行者（publisher）由 `laiyueji` 改為 `LaiYueJi`。
- 🖼️ 更換圖標：改為代表繁／簡雙語的對角雙色設計（左上「繁」、右下「简」），取代舊的單一「繁」字圖標。

## [2.0.0] - 2026-07-04

### 重大變更
- 🌏 **升級為繁體／簡體雙語語言包**：在既有繁體中文（台灣）之外，新增一整套**簡體中文（中國大陸）**翻譯，採大陸常用術語（插件、文件夹、会话、扩展思考、加载、默认、扩展、卸载…），逐條人工校對，同為 507 條。
- 🏷️ **更名與識別碼調整**：套件名由 `claude-code-zhtw` 改為 `claude-code-zh`；設定與指令命名空間由 `claudeCodeZhTw.*` 改為 `claudeCodeZh.*`（**舊設定需重新設定一次**）。

### 新增
- 🧭 **語言自動偵測 / 手動切換**：新增 `claudeCodeZh.language` 設定（`auto` / `zh-TW` / `zh-CN`），預設 `auto` 依 VS Code 顯示語言自動選擇；新增「🔀 切換語言」指令與選單項，切換後自動以新語言重新套用。
- 🖥️ **介面隨語言切換**：本擴充自身的狀態列、快速選單、通知、輸出訊息、狀態說明皆會依所選語言顯示繁體或簡體。
- 🔤 內建翻譯改採依語言載入（`translations/zh-TW.json`、`translations/zh-CN.json`），並依語言偵測「是否已套用」，可在繁簡之間乾淨切換、不殘留。

### 其他
- 🔍 漏翻自動偵測沿用並改為語言感知：掃描結果會標示目前語言。
- 繁簡共用同一份原始英文備份（`.bak`），切換語言一律從英文重新翻譯。

## [1.1.0] - 2026-07-03

### 新增
- 🔍 **漏翻自動偵測**：新增「掃描未翻譯字串」指令；Claude Code 更新版本後會自動掃描並提示尚未翻譯的介面字串（結果輸出至「Claude Code 繁化」輸出頻道）。
- 🖼️ 新增擴充功能圖標。
- 針對 **2.1.198** 補上 46 條漏翻字串，包含：訊息被標記時切換模型／安全機制提示、用量點數（usage credits）系列說明、工作樹對話階段、子代理成本提示、/compact・/clear 提示、Notebook 儲存格、意見回饋說明等。

### 修正
- 🐞 **修正「還原官方原版」後，重新啟動仍被自動套回繁化**的問題：還原後會記住選擇，不再自動套用，直到再次手動套用。
- ✍️ **全面校對為正式、專業的台灣用語**：
  - `Never mind` 由「算了吧算了吧」改為「先不要」。
  - `Let's write something worth deploying.` 改為語氣中性的「來寫出值得部署上線的程式吧。」。
  - 統一詞彙：回滾→**回溯**、數據→**資料**、當前→**目前**、批准→**核准**、調用→**呼叫**、擴展思考→**延伸思考**、未找到→**找不到**、智能體→**代理**。
- 🏷️ 移除名稱中的「[非官方]」字樣與說明中的簡轉繁工具相關描述。

### 其他
- 內建翻譯規則由 461 條增至 **507 條**。

## [1.0.0] - 2026-07-03

### 新增
- 🌏 首個版本：繁體中文（台灣）介面翻譯，共 **461 條**內建規則。
- 🧭 狀態列快速指令選單：點擊「繁化」按鈕彈出常用動作，含「開啟指令面板（`Ctrl+Shift+P`）」。
- ♻️ 冪等套用：一律以原始英文 `.bak` 為基底翻譯，重複套用不疊加。
- 🔄 啟動自動套用、Claude Code 更新後自動重新繁化。
- ℹ️ 狀態列提示與「檢視繁化狀態」指令（顯示版本、翻譯條數、檔案位置）。
- 🧩 支援 `preTranslationRules` / `postTranslationRules` 自訂規則。

### 翻譯範圍
- 以人工方式將 zstings 簡體漢化包的字串重新翻譯為台灣用語，並補上以下 2.1.x 新增字串：
  - 重新命名／刪除對話階段、技能 (Skills)、子代理 (Subagents)、自訂 Agent、記憶檔案
  - 回滾至…、工作樹 (worktree)、分支切換、檢查點 (checkpoint)
  - 意見回饋對話框、行內編輯 (Inline Edit)、思考投入度、快速模式
  - 遠端控制、瀏覽器連線、用量點數 (usage credits)、Fable 5 模型切換訊息 等
