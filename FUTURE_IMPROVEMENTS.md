# 未來增強清單

> 哲學：**先求有，再求好。**
> 這份檔案記錄目前為了快速完工所做的妥協，以及之後可以升級的方向。
> 每項標 P1 / P2 / P3 表示優先度。

---

## 🔒 安全與混淆

- **[x] ~~[P1] HTML 內嵌 `<script>` 混淆~~** ✅ 2026-04-20
  - 根因：`weekly.html` 第 12 行有 HTML 註解寫了「從 `<script type="module">` 內 import」這段字，regex `<script\b([^>]*)>([\s\S]*?)<\/script>` 把註解裡假的 script tag 當真，body lazy-match 抓到後面大段 HTML（含 CSS），terser 報 `Unexpected token: name (import)`
  - 原本還以為是 module scope / Sortable 全域查找問題，其實是 build fail 導致 dist 不完整（非 weekly 的檔案複製到 dist 時也被影響），讓 roster 線上載入失敗
  - 修法：`minifyHtmlInlineScripts` 開頭先 `html.replace(/<!--[\s\S]*?-->/g, '')` 清註解再掃 regex
  - 預設改成開著，緊急關閉仍可 `MINIFY_HTML_INLINE=0 node build.js`
  - 全部 6 個 HTML 混淆成功，關鍵屬性名（TENANT_FIREBASE_CONFIG、tenant-ready、system_config 等）都保留
  - 縮減效果：settings.html 縮 34%
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

- **[x] ~~[P1] shop.html 內部 Firebase v8 compat → v11 modular~~** ✅ 2026-04-20 夜
  - 改法：`src/shop/firebase-compat.js` 在 v11 modular SDK 上包一層 v8 風格殼（`.ref/.once/.on/.set/.update/.push/.remove/.child/.off`），shop_data/*.js 程式碼主體完全不動。
  - 副產物：順手抓到 `build.js` 隱性 bug——terser 會把 `module` 鍵寫進 compress/mangle，淺拷貝 `...TERSER_BASE` 讓 module 檔污染後面的 classic 檔（`utils.js` 被壓成 72 bytes、`config.js` 剩 149 bytes）。修成每次都重建子物件。這個 bug 很可能就是之前 shop 空白/按鈕失效的主因。
  - 線上 payload 少了 ~100KB（8.10.1 compat SDK 整包拿掉）
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

- **[x] ~~[P1] `settings.html` 整併進 admin~~** ✅ 2026-04-20（採方案 C：settings.html 保留為隱藏頁 + admin 清單每行加「⚙️ 設定」按鈕開新分頁。拔掉 Firebase 連線卡片因為 admin 已管 config）
- **[P2] 租戶層設定 vs 系統層設定分開**
  - 系統層（白名單、租戶清單）→ 主 Firebase
  - 租戶層（價格、工數、員工）→ 各自的租戶 Firebase
  - 目前 settings 寫入租戶 Firebase 的 `system_config`，對應後要釐清

## 🗂 localStorage 跨租戶污染

- **[P2] localStorage key 加租戶 namespace**
  - 多個設定目前都存 `localStorage`，例如：
    - `roster.html` 的 `myFooter`（自訂頁尾警語）
    - `shop/app.js` 的 `appZoomLevel`（UI 縮放）
  - 同一瀏覽器開不同租戶會互相覆蓋
  - 修法：key 加租戶前綴（例：`t:<code>:myFooter`），或寫 `storage.js` 小工具讀取當前租戶 code 包裝
  - 對單租戶單一老闆影響不大，開始分租給同行時要修

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
