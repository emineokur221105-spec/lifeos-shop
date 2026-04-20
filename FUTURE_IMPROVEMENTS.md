# 未來增強清單

> 哲學：**先求有，再求好。**
> 這份檔案記錄目前為了快速完工所做的妥協，以及之後可以升級的方向。
> 每項標 P1 / P2 / P3 表示優先度。

---

## 🔒 安全與混淆

- **[P1] HTML 內嵌 `<script>` 混淆** ← 2026-04-20 已補
  - 原本只有獨立 `.js` 會混淆，所有頁面的內嵌 JS 是明碼
  - 已擴充 `build.js` 處理 inline script
- **[P2] Admin 密碼升級**
  - 目前 `?admin=0308` 是明碼 URL 參數，任何人看到網址就知道
  - 未來改：登入頁 + Firebase Auth（Email/Password 或 Google 登入）+ 真正的權限檢查
- **[P2] DevTools 尺寸偵測不夠精準**
  - 現在用 `outerWidth - innerWidth > 160` 偵測，DevTools 停靠在側邊才準，上下停靠或 undocked 偵測不到
  - 未來改：多種偵測並用（performance timing、console.log hook 等）
- **[P3] Firebase API Key 保護**
  - 目前 apiKey 儲存在主 Firebase（租戶 config）和 LOCAL_SECRETS.md
  - 雖然前端 Firebase apiKey 本來就會曝光（Firebase 設計如此），但可以加強 Firebase Security Rules 避免資料被亂寫

## 🏗 架構重構（shop.html 方案 C 後半）

- **[P1] shop.html 內部 Firebase v8 compat → v11 modular**
  - 目前方案 C：shop.html 保留 v8 compat（整頁當外掛模組搬過來，只換 Firebase config 來源）
  - 兩套 SDK 並存，使用者要下載 ~100KB 額外 JS
  - 未來逐個改：config.js / schedule.js / settlement.js / app.js / utils.js / weekly.js（7 個檔）
  - 驗收標準：每改一個檔，shop 所有功能測過一輪
- **[P2] 兩套週結系統整併**
  - 舊版架構就遺留的：`shop.html` 內 weekly tab（用 `shop_v8_*` 節點）vs 獨立 `weekly.html`（用 `weekly_data/*` 節點）
  - 兩邊資料不相通
  - 需要商業決策：哪邊是主？哪邊要廢？或是做資料同步？
- **[P2] `shop_v8_weekly_state_v4` 殘留節點**
  - 出現在 shop app.js 的 `emergencyWipe` 但沒人寫入
  - 確認是遺留後刪除

## 🎨 UI 統一

- **[P2] 統一 CSS**
  - 每個頁面各自內嵌一大段 `<style>`，樣式不一致
  - 未來抽成 `src/core/common.css`，各頁面共用
- **[P2] 統一導航列**
  - 舊版每頁都有自己實作的「🏠 首頁」按鈕，風格不一致
  - 未來抽成共用元件
- **[P3] 共用 UI 元件**
  - Toast、Modal、確認對話框等到處重複實作
  - 統一成 `src/core/ui.js`

## 🔧 設定與整併

- **[P1] `settings.html` 整併進 admin**
  - 原系統 7 張設定卡片（價格 / 工數 / 阿姨 / 排班顯示 / 分紅 / Firebase / 系統安全）
  - 放進 admin 的新分頁，或每個租戶自己的「租戶設定」
- **[P2] 租戶層設定 vs 系統層設定分開**
  - 系統層（白名單、租戶清單）→ 主 Firebase
  - 租戶層（價格、工數、員工）→ 各自的租戶 Firebase
  - 目前 settings 寫入租戶 Firebase 的 `system_config`，對應後要釐清

## 📱 使用體驗

- **[P3] PWA 強化**
  - 目前只有 shop.html 有 `manifest.json` 和 Service Worker
  - 其他頁面也加上，讓每個模組都能「加到主畫面」
  - 考慮 offline 快取策略（現在 sw.js 是網路優先、不快取）
- **[P3] 手機版 RWD**
  - roster / weekly 有做抽屜式側邊欄
  - shop / office 還沒測手機體驗
- **[P3] 暗色主題切換**
  - office / admin 是深色、shop / weekly / roster 是淺色
  - 未來給使用者選

## 🌐 部署與維運

- **[P2] 支援自訂網域**
  - 目前只綁 GitHub Pages `*.github.io`
  - 未來要租給同行時，每個客戶可以有自訂網域（白名單要加）
- **[P2] Staging / Production 分離**
  - 目前直接改 main 就上線，沒有測試環境
  - 未來開 `dev` branch + Cloudflare Pages preview
- **[P3] 錯誤監控**
  - 目前錯誤只在瀏覽器 console
  - 未來接 Sentry 或自架錯誤蒐集

## 📊 資料生命週期

- **[P3] 自動清除天數可設定**
  - 現在寫死 14 天（shop 的 `cleanupOldData`）
  - 未來放進 admin 設定
- **[P3] 資料備份與匯出**
  - settings 有匯入/匯出 JSON 功能
  - 未來做排程備份（每週自動匯出一次到 Google Drive）

---

## 記錄規則

- 每次做完一項 P1 → 打勾並加完成日期
- 每次因為時間 / 風險而妥協 → 立刻加進來，寫清楚「為什麼先這樣做」
- 這份不是 TODO，是**知識保存**：讓未來的 Claude 或工程師接手時看得懂「哪裡是欠債」
