# 更新紀錄

本檔案記錄「Claude Code for VS Code 繁體／簡體中文語言包」的版本變更。

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
