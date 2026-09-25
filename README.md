# 🌏 Claude Code for VS Code 繁體／簡體中文語言包

> 把 VS Code 裡 Claude Code 的英文介面換成中文。**繁體中文**與**簡體中文**各一套完整翻譯，自動跟隨系統語言，也可以隨時手動切換。

Claude Code 的側邊欄、對話框、按鈕、通知原本全是英文。安裝這個擴充功能後，它們都會變成中文——不是機器轉換的簡繁互換，而是兩套分開處理、各自照該語系用語習慣的版本：

- **繁體中文**：例如「外掛程式」「資料夾」「對話階段」「延伸思考」。
- **簡體中文**：例如「插件」「文件夹」「会话」「扩展思考」。

目前共 **1474 條**翻譯規則（繁簡各一套），涵蓋設定、權限、勾點、沙箱、記憶、外掛程式、用量統計等所有對話框。

## 🚀 安裝

先確定已安裝官方的 **Claude Code for VS Code** 擴充功能，然後選一種方式：

**從市集安裝（推薦）**

在 VS Code 的 `擴充功能` 面板搜尋 **Claude Code 中文**，或直接開 [市集頁面](https://marketplace.visualstudio.com/items?itemName=LaiYueJi.claude-code-zh) 按安裝。這種方式之後由 VS Code 自動更新。

**手動安裝 VSIX**

到 [Releases](https://github.com/LaiYueJi/claude-code-zh/releases/latest) 下載 `.vsix` → `擴充功能` 面板 → 右上角 `⋯` → **從 VSIX 安裝…**。

裝好後依提示 **重新載入視窗**，中文介面就出現了。之後不用再管它：VS Code 啟動時會自動套用，Claude Code 更新後也會自動重新翻譯。

## 💡 日常使用

VS Code 右下角狀態列會有一顆 **🌏 中文化** 按鈕，點它就會跳出選單。最常用的三件事：

| 想做什麼 | 怎麼做 |
| --- | --- |
| 介面變回英文了 | 點 Claude 側邊欄或分頁標題列的 **🌏** 按鈕，立刻重新套用並就地重載 |
| 切換繁體 / 簡體 | 狀態列選單 → **🔀 切換語言**，或改設定 `claudeCodeZh.language` |
| 想用回英文原版 | 狀態列選單 → **⏪ 還原官方原版** |

## ❓ 常見問題

**Q：重開 VS Code 之後，對話還在，介面卻變回英文了？**
A：Claude 的視窗在 VS Code 還原時會比本擴充功能早一步載入，所以來不及套用。點一下 **🌏** 按鈕即可；想完全自動，把設定 `claudeCodeZh.autoReloadClaudeUi` 打開，之後就會直接就地重載，不再詢問。

**Q：Claude Code 更新後會不會又變英文？**
A：不會。本擴充功能偵測到 Claude Code 版本變動時會自動重新套用。

**Q：語言包自己怎麼更新？**
A：從市集安裝的話，VS Code 會自動更新，不必理它。手動裝 VSIX 的話，會在有新版時提醒你，可以直接按「下載並安裝」。另外翻譯檔還有獨立的線上熱更新，兩種安裝方式都一樣有效。

**Q：Claude 改版後出現沒翻到的英文怎麼辦？**
A：翻譯包支援線上熱更新——每隔 6 小時會向 GitHub 取一次最新翻譯檔，**補完的漏翻不必重裝 VSIX 就會自動生效**。想立刻拿到就點狀態列選單的 **⬆️ 檢查更新**。急著自己補也行，見下方「自訂翻譯」。

**Q：會不會把 Claude Code 弄壞？**
A：套用前會先把原始英文檔備份成 `index.js.bak`，所有翻譯都是以這份備份為基底重做，不會愈疊愈亂；任何時候按 **⏪ 還原官方原版** 都能完整復原。按過還原之後，本擴充功能會記住這個選擇，不會在下次啟動時又自動套回去。

**Q：我裝過其他漢化包，可以一起用嗎？**
A：不行，兩者會互相覆蓋。請先停用或解除安裝另一個，並移除它在設定裡留下的翻譯規則。

**Q：繁體和簡體可以隨時互換嗎？**
A：可以。兩種語言共用同一份英文備份，切換時一律從英文重新翻譯，不會出現半繁半簡的殘留。

## ⚙️ 設定項

| 設定 | 預設 | 說明 |
| --- | --- | --- |
| `claudeCodeZh.language` | `auto` | 介面語言：`auto`（跟隨系統）／`zh-TW`（繁體中文）／`zh-CN`（簡體中文） |
| `claudeCodeZh.autoApplyOnStartup` | `true` | 啟動時自動套用 |
| `claudeCodeZh.autoApplyOnUpdate` | `true` | Claude Code 更新時自動重新套用 |
| `claudeCodeZh.autoReloadClaudeUi` | `false` | 套用後直接就地重載介面，不再詢問 |
| `claudeCodeZh.showStatusBar` | `true` | 顯示狀態列快速選單按鈕 |
| `claudeCodeZh.createBackup` | `true` | 套用前建立 `.bak` 備份 |
| `claudeCodeZh.showNotifications` | `true` | 顯示操作完成通知 |
| `claudeCodeZh.autoUpdateTranslations` | `true` | 自動線上更新翻譯包 |
| `claudeCodeZh.checkExtensionUpdate` | `true` | 檢查擴充功能是否有新版本 |
| `claudeCodeZh.translationSourceUrls` | `[]` | 翻譯包線上來源，留空用內建（raw → jsDelivr） |
| `claudeCodeZh.claudeCodeExtensionId` | `Anthropic.claude-code` | Claude Code 擴充功能 ID |
| `claudeCodeZh.preTranslationRules` | `[]` | 前置自訂翻譯規則（最優先） |
| `claudeCodeZh.postTranslationRules` | `[]` | 後置自訂翻譯規則（可覆蓋內建） |

### 自訂翻譯

想改某個詞，或想搶先補上還沒翻到的字串，加一條規則就行：

```jsonc
"claudeCodeZh.postTranslationRules": [
  { "original": "\"Skills\"", "chinese": "\"技能\"" }
]
```

`original` 要連引號一起寫，因為比對的是原始檔中的字串字面值。也支援正規表達式（加 `"regex": true`）。

## 🌏 狀態列選單完整項目

| 項目 | 說明 |
| --- | --- |
| 🌏 套用中文化 | 將介面翻譯成目前語言（繁體或簡體） |
| ♻️ 重新套用翻譯 | 先還原再重新套用（更新後或異常時使用） |
| 🈶 重載 Claude 介面 | 重新套用並就地重載介面，不必重新載入整個視窗 |
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

## 🧱 運作原理

本擴充功能會直接改寫已安裝的 Claude Code 擴充功能中的 `webview/index.js`，把裡面的英文字串替換成中文：

```
webview/index.js.bak（原始英文，基底）
        │  前置規則 → 內建規則（依語言：zh-TW.json / zh-CN.json，各 1474 條）→ 後置規則
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

下載的翻譯包會先驗證（JSON 格式、locale、每條規則與正規表達式），不合格就整包不採用並回退內建版；主來源連不上時自動改用 jsDelivr 鏡像。所以補完漏翻只要更新 GitHub 上的 `translations/*.json`，使用者端最慢 6 小時內就會自動拿到。

<details>
<summary>維護用功能（給想自己補翻譯的人）</summary>

Claude Code 幾乎每天改版，介面字串也跟著變。本擴充功能內建了幾項工具，用來盯住這件事：

- **漏翻自動偵測**：Claude Code 更新後自動掃描，找出仍是英文的介面字串。掃描涵蓋介面屬性值的四種寫法——字面值（`label:"…"`）、樣板字串（`` title:`…${變數}…` ``）、三元運算子（`label:x?"A":"B"`）與陣列元素（`children:[圖示,"文字"]`）——另涵蓋被 minify 提取成變數的字串（`label:dN`）與介面函式的引數（`showNotification(…)`）。
- **只醒目回報新增的**：介面字串數以千計，一次列出全部只會洗掉重點。掃描結果會把「上次沒有、這次才出現」的另立區塊排在最前面。
- **失效規則偵測**：Claude 改寫英文原文時，舊規則會靜靜失效——畫面變回英文，漏翻掃描卻未必看得出來。本擴充功能只在「上次還對得上、這次忽然對不上」時提示，精準指出被改寫的字串。
- **刻意不翻清單**：鍵碼表（`Alt`／`Ctrl`）、SQL 關鍵字、工具識別字（`class{name="Grep"}`）、品牌與指令這些判讀過確定不該翻的字串，列在翻譯包的 `scanIgnore` 中，掃描時排除。
- **一鍵定位字串**：掃描到漏翻字串後，可點「跳到字串…」直接開啟 `webview/index.js` 並選取該字串所在位置。

翻譯規則只會動「顯示用」的字串。程式拿來比較的值（例如工具識別字、狀態代碼、Monaco 編輯器的關鍵字表）一律保持英文，每次發版前都會跑一套行為不變式檢查，確認這些值沒有被誤翻。

</details>

## 📄 授權

MIT License。
