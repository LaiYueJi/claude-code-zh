# 🌏 Claude Code for VS Code 繁體／簡體中文語言包

> Claude Code for VS Code 擴充功能的中文化工具，**繁體中文（台灣）** 與 **簡體中文（中國大陸）** 雙語，可自動偵測系統語言或手動切換。

本擴充功能會將 Claude Code 的 webview 介面（`webview/index.js`）中的英文文字，替換為中文。兩套語言各自採用道地用語，逐條人工校對：

- **繁體中文（台灣）**：台灣正式、專業的軟體用語（例如「外掛程式」「資料夾」「對話階段」「延伸思考」）。
- **簡體中文（中国大陆）**：大陆常用的软件术语（例如「插件」「文件夹」「会话」「扩展思考」）。

## ✨ 功能特色

- 🌏 **雙語內建**：繁體中文（台灣）與簡體中文（中國大陸）各一套完整翻譯，各 796 條。
- 🧭 **自動偵測 / 手動切換**：預設「跟隨系統」依 VS Code 顯示語言自動選擇；也可在選單或設定中手動指定繁體或簡體。
- 🖥️ **介面隨語言切換**：連本擴充自身的狀態列、選單、通知都會依所選語言顯示繁體或簡體。
- 🧭 **狀態列快速指令選單**：點擊狀態列按鈕即彈出快速選單，含「切換語言」「開啟指令面板（`Ctrl+Shift+P`）」等常用動作。
- ♻️ **冪等套用**：一律以原始英文備份（`.bak`）為基底翻譯，重複套用或切換語言都不會疊加、不會殘留舊翻譯。
- 🔄 **自動維護**：VS Code 啟動時自動套用；偵測到 Claude Code 更新時自動重新套用。
- ☁️ **翻譯包線上熱更新**：定期向 GitHub 取得最新的 `translations/*.json`，**Claude 改版造成的漏翻修正不必重裝 VSIX 就會生效**。內建版與線上版取較新者；下載的翻譯包會先驗證（JSON、locale、每條規則與正規表達式），不合格就整包不採用並回退內建版。主來源連不上時自動改用 jsDelivr 鏡像。
- 🆕 **擴充功能新版提醒**：發現 GitHub 有新版時可直接「下載並安裝」，或開啟 Release 頁面手動處理、略過此版本。
- 🔁 **翻譯包更新自動生效**：翻譯檔帶版本與日期（`updatedAt`），啟動時比對簽章，翻譯包一有更新就自動重新套用，無需手動操作。
- 🧩 **可自訂**：支援 `preTranslationRules` / `postTranslationRules`，自行新增或覆蓋任何翻譯。
- 🔍 **漏翻自動偵測**：Claude Code 更新版本後，會自動掃描並提示尚未翻譯的介面字串；也可隨時手動「掃描未翻譯字串」。掃描涵蓋介面屬性值的四種寫法——字面值（`label:"…"`）、樣板字串（`` title:`…${變數}…` ``）、三元運算子（`label:x?"A":"B"`）與陣列元素（`children:[圖示,"文字"]`）——另涵蓋被 minify 提取成變數的字串（`label:dN`）與介面函式的引數（`showNotification(…)`）。
- 🆕 **只醒目回報新增的**：介面字串數以千計，一次列出全部只會洗掉重點。掃描結果會把「上次沒有、這次才出現」的另立區塊排在最前面，基準線存在 globalState，首次掃描僅建立不提示。
- 🚫 **刻意不翻清單**：鍵碼表（`Alt`／`Ctrl`）、SQL 關鍵字、工具識別字（`class{name="Grep"}`）、品牌與指令這些判讀過確定不該翻的字串，列在翻譯包的 `scanIgnore` 中，掃描時排除、只在結尾附一行數量。清單隨翻譯包熱更新，增減不必重發 VSIX。
- ⚠️ **失效規則偵測**：Claude 改寫英文原文時，舊規則會靜靜失效——畫面變回英文，漏翻掃描卻未必看得出來。本擴充會記錄每次掃描的比對結果，只在「上次還對得上、這次忽然對不上」時提示，精準指出被改寫的字串。
- 📋 **檢視未翻譯清單**：不必重新掃描，直接開啟上次掃描結果的清單。
- 🧭 **一鍵定位字串**：掃描到漏翻字串後，可點「跳到字串…」直接開啟 `webview/index.js` 並選取該字串所在位置，方便查看與新增規則。

## 🚀 使用方式

1. 到 [**Releases**](https://github.com/LaiYueJi/claude-code-zh/releases/latest) 下載最新 `.vsix`，於 `擴充功能` 面板 → 右上角 `⋯` → `從 VSIX 安裝…` 安裝。
2. 安裝後會在啟動時自動套用（預設語言＝跟隨系統）；或點狀態列右下角的 **🌏 中文化** 按鈕 → **套用中文化**。
3. 依提示 **重新載入視窗** 即可生效。

### 切換 / 指定語言

- 狀態列選單 →「🔀 切換語言（繁體／簡體）」，可選 **跟隨系統 / 繁體中文（台灣） / 簡體中文（中國大陸）**。
- 或到設定 `claudeCodeZh.language` 直接指定。切換後會自動重新套用並提示重新載入。

### 狀態列快速選單

點擊狀態列的 **🌏 中文化** 按鈕，會彈出：

| 項目 | 說明 |
| --- | --- |
| 🌏 套用中文化 | 將介面翻譯成目前語言（繁體或簡體） |
| ♻️ 重新套用翻譯 | 先還原再重新套用（更新後或異常時使用） |
| ⏪ 還原官方原版 | 回復未翻譯的英文原版 |
| 🔀 切換語言（繁體／簡體） | 在繁體、簡體、跟隨系統之間切換 |
| 🔍 掃描未翻譯字串 | 找出目前版本尚未翻譯的介面字串 |
| 📋 檢視未翻譯清單 | 顯示上次掃描的未翻譯清單（不重新掃描） |
| 🧭 跳到未翻譯字串… | 在 `index.js` 中定位並開啟某個未翻譯字串 |
| ⬆️ 檢查更新 | 向 GitHub 取得最新翻譯包，並檢查擴充功能新版本 |
| 📦 還原為內建翻譯包 | 清除線上更新的快取，改用擴充功能內建版本 |
| 🔎 開啟指令面板… | 等同 `Ctrl+Shift+P`，快速執行所有指令 |
| ⚙️ 開啟設定 | 調整語言、自動套用、通知、自訂規則 |
| ℹ️ 檢視狀態／說明 | 語言、版本、翻譯條數、檔案位置 |
| 🔄 重新載入視窗 | 讓翻譯立即生效 |

## ⚙️ 設定項

| 設定 | 預設 | 說明 |
| --- | --- | --- |
| `claudeCodeZh.language` | `auto` | 介面語言：`auto`（跟隨系統）／`zh-TW`（繁體台灣）／`zh-CN`（簡體中國大陸） |
| `claudeCodeZh.autoApplyOnStartup` | `true` | 啟動時自動套用 |
| `claudeCodeZh.autoApplyOnUpdate` | `true` | Claude Code 更新時自動重新套用 |
| `claudeCodeZh.showStatusBar` | `true` | 顯示狀態列快速選單按鈕 |
| `claudeCodeZh.createBackup` | `true` | 套用前建立 `.bak` 備份 |
| `claudeCodeZh.showNotifications` | `true` | 顯示操作完成通知 |
| `claudeCodeZh.claudeCodeExtensionId` | `Anthropic.claude-code` | Claude Code 擴充功能 ID |
| `claudeCodeZh.autoUpdateTranslations` | `true` | 自動線上更新翻譯包（不必重裝 VSIX） |
| `claudeCodeZh.checkExtensionUpdate` | `true` | 檢查擴充功能是否有新版本 |
| `claudeCodeZh.translationSourceUrls` | `[]` | 翻譯包線上來源，留空用內建（raw → jsDelivr） |
| `claudeCodeZh.preTranslationRules` | `[]` | 前置自訂翻譯規則（最優先） |
| `claudeCodeZh.postTranslationRules` | `[]` | 後置自訂翻譯規則（可覆蓋內建） |

### 自訂翻譯範例

```jsonc
"claudeCodeZh.postTranslationRules": [
  { "original": "\"Skills\"", "chinese": "\"技能\"" }
]
```

## ⚠️ 注意事項

- 本工具會**直接修改**已安裝的 Claude Code 擴充功能檔案；Claude Code 每次更新後需重新套用（本擴充功能會自動處理，並提示新版可能的漏翻字串）。
- 繁體與簡體共用同一個 `index.js.bak`（皆為原始英文備份），可安全來回切換語言。
- 若你原本安裝了其他 Claude Code 漢化／繁化包，請**先停用或解除安裝**，並移除其對應的 `preTranslationRules`，以免多者互相覆蓋。
- 按「⏪ 還原官方原版」後，本擴充功能會記住此選擇，**不會**在下次啟動或更新時又自動套回；要恢復請再按「套用中文化」。

## 🧱 運作原理

```
webview/index.js.bak（原始英文，基底）
        │  前置規則 → 內建規則（依語言：zh-TW.json / zh-CN.json，各 796 條）→ 後置規則
        ▼
webview/index.js（繁體或簡體中文）
```

內建規則有兩個來源，載入時取**較新**者（先比 `version`，同版再比 `updatedAt`）：

```
translations/*.json（隨 VSIX 打包）
                              ↘
                                取較新者 → 套用
                              ↗
globalStorage/translations/*.json（線上更新下載，通過驗證才採用）
```

所以作者補完漏翻後只要更新 GitHub 上的 `translations/*.json`，使用者端最慢 6 小時內就會自動拿到，不必等新的 VSIX。

- 語言以 `claudeCodeZh.language` 決定；`auto` 時依 VS Code 顯示語言（`zh-tw`/`zh-hant`→繁體，`zh-cn`/`zh-hans`→簡體，其餘回退繁體）。
- 切換語言時一律從英文備份重新翻譯，因此不會有「半繁半簡」的殘留。

## 📄 授權

MIT License。
