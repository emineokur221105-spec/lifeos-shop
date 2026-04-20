# 重構進度紀錄

> 這份檔案是 Claude 的進度紀錄本。每次 Raymond 開新對話時，Claude 第一件事是讀這份。
> 原則：**做完一小步就立刻更新**，避免 token 中斷後忘記做到哪裡。

---

## 🎯 最終目標

把舊版 `Desktop/週結版本 原版/` 完全重構成統一版，結果：
1. 多租戶（每個門店一個 Firebase，清單由前端管）
2. Firebase v11 modular SDK 全面統一
3. 防盜機制一致（無漏洞）
4. Admin 後台入口：`?admin=0308`
5. UI/操作體驗跟舊版**一模一樣**
6. 附教學文件（Raymond 非工程師）
7. 未來可租給同行

---

## 📋 Phase 清單

### Phase 0：基礎設施（完成）
- [x] 建立本機資料夾 `C:/Users/makeo/Desktop/LifeOS-Shop-統一版/`
- [x] git init + 設定 user.name/email
- [x] 建立 `REFACTOR_PROGRESS.md`（這份）
- [x] 建立 `SETUP_GUIDE.md` 雛形
- [x] 建立 GitHub repo `lifeos-shop`
- [x] 首次 commit + push
- [x] 啟用 GitHub Pages
- [x] repo 網址：https://github.com/emineokur221105-spec/lifeos-shop
- [x] Pages 網址：https://emineokur221105-spec.github.io/lifeos-shop/

### Phase 0.5：安全與混淆基礎（完成）
- [x] `.github/workflows/deploy.yml` 建好且驗證成功
- [x] `package.json`（terser ^5.36.0）
- [x] `build.js` 自製混淆流程（跳過 firebase SDK 和 html2canvas）
- [x] `src/` 放原始碼、`dist/` 是混淆後（gitignore）
- [x] `一鍵部署.bat` Raymond 雙擊用
- [x] `LOCAL_SECRETS.md` gitignore 存主 Firebase config
- [x] 驗證 Pipeline 通過：線上 boot.js 確實被混淆 ✅
- [x] **HTML 內嵌 `<script>` 也進混淆流程** 2026-04-20
  - 原本只有獨立 `.js` 被 terser 壓縮，所有頁面的內嵌 JS 是明碼
  - 新增 `minifyHtmlInlineScripts()`：正則找 `<script>...</script>`，跳過有 `src=` 的外部引用，內嵌 body 進 terser
  - 自動偵測 `type="module"` → 用 module 模式（支援 top-level await）
  - 獨立 `.js` 也升級：偵測 `import/export` 決定 module 模式，`ecma: 2022`
  - 同步建立 `FUTURE_IMPROVEMENTS.md`（P1/P2/P3 分級），記錄未來還要做什麼
  - 哲學：**先求有，再求好**
- [x] **內嵌混淆預設開啟**（修正註解內假 script 造成 regex 誤判）2026-04-20
  - 之前暫時關閉是因為 weekly.html 註解內出現 `<script type="module">` 字串，被 regex 當真 script 抓取，導致整個 build 污染 roster 等檔
  - 修法：`minifyHtmlInlineScripts` 開頭先 strip HTML 註解
  - 預設 `MINIFY_HTML_INLINE=true`（緊急可設 `=0` 關閉）
  - 6 個 HTML（admin/index/office/roster/settings/shop/weekly）全部混淆通過，關鍵屬性名保留

### Phase 1：核心架構（完成）
- [x] Raymond 開「主 Firebase」project：`lifeos-shop-main`（config 存 LOCAL_SECRETS.md）
- [ ] 建 `core/` 資料夾
  - [x] `main-firebase-config.js`（主 Firebase 連線設定）2026-04-20
  - [x] `tenant-loader.js`（讀 `?t=xxx` 查租戶 Firebase 設定）2026-04-20
  - [x] `security.js`（統一防盜模組）2026-04-20
  - [x] `common.js`（showToast / escapeHtml / formatDate / debounce / copyText / lsKey 租戶 namespace）2026-04-20
- [x] 新 `index.html`（路由骨架：`?t=`/`?admin=` 分流，串 security + tenant-loader）2026-04-20
- [x] Admin 後台 `admin.html` 2026-04-20
  - [x] 登入檢查（`?admin=0308`）
  - [x] 租戶清單 CRUD（新增/編輯/刪除，JSON 貼 Firebase config）
  - [x] 白名單管理（輸入 hostname → 算 SHA-256 → 存 `{ label }`）
  - [x] Toast 提示 + 二次確認刪除

### Phase 2：模組移植（完成）
- [x] `src/core/tenant-boot.js`：頁面共用開機（驗白名單 + 載租戶）2026-04-20
- [x] `roster.html`（人員雲端管理）2026-04-20
  - [x] 搬檔到 `src/roster.html`，原 UI / 邏輯 598 行完全保留
  - [x] 只改 Firebase 初始化段（原 hardcoded v10.7.1 → 改用 bootTenant + tenantDb）
  - [x] title 改顯示租戶名
- [x] `office.html`（團隊分紅）2026-04-20
  - 搬到 `src/office.html`，原 504 行 UI / 邏輯完全保留
  - Firebase v11.0.2 → v11.0.1 統一版本，改用 bootTenant + tenantDb
  - index.html 的 office 按鈕解鎖
- [x] `weekly.html`（週結業績）2026-04-20
  - 搬到 `src/weekly.html`，原 838 行 UI / 邏輯完全保留
  - Firebase v8 compat → v11 modular（刪 3 個 CDN `<script src>`）
  - 所有 `db.ref().on/set/off` 轉 `onValue/set`，`.off()` → unsubscribe 模式（`currentSalesRef` → `currentSalesUnsub`）
  - `auth.signInAnonymously()` → `signInAnonymously(auth)`
  - `function changeWeek` → `window.changeWeek = function`（module 作用域下 onclick 要走 window）
  - index.html 的 weekly 按鈕解鎖
- [x] `shop.html`（最大、最核心）2026-04-20
  - [x] ~~方案 C：保留 v8 compat~~ → 深夜已改 full rewrite（見下方「深夜」區塊），shop_data/*.js 已全面 v11 modular
  - [x] head 保留 Firebase v8 compat SDK（8.10.1）+ html2canvas
  - [x] 頂部加 `<script type="module">`：跑 bootTenant（驗白名單 + 載租戶 config）→ 塞 `window.TENANT_FIREBASE_CONFIG` → 動態按序載入 6 個 shop_data JS
  - [x] `shop/shop_data/config.js` 改：刪 DEFAULT_FIREBASE_CONFIG + localStorage fallback，改讀 `window.TENANT_FIREBASE_CONFIG`（沒有就報錯）
  - [x] 刪舊版 `shop/shop_data/security.js`（統一版用 `core/security.js`，避免雙重防盜衝突）
  - [x] 底部舊的 `<script src>` 串刪掉（已被 module loader 取代）
  - [x] title 動態顯示租戶名
  - [x] 錯誤處理：租戶載入失敗顯示提示 + 返回首頁連結
  - [x] 搬 `manifest.json` 和 `sw.js` 到 src/
  - [x] index.html shop 按鈕解鎖
- [x] `settings.html`（採方案 C：隱藏頁 + admin 清單入口）2026-04-20
  - [x] 複製舊版 settings.html 到 src/
  - [x] head 加 module 開機腳本（bootTenant → 塞 TENANT_FIREBASE_CONFIG → 發 `tenant-ready` 事件）
  - [x] 刪第 1 張「Firebase 連線設定」卡片（多租戶後由 admin 管 config，不在這裡改）
  - [x] JS 拔掉：`DEFAULT_FIREBASE` / `getFirebaseConfig` / `loadFirebaseForm` / `saveFirebaseConfig` / `resetFirebaseConfig` / localStorage 機制
  - [x] `initFirebase()` 改讀 `window.TENANT_FIREBASE_CONFIG`；啟動改成等 `tenant-ready` 事件
  - [x] 匯出/匯入：移除 firebaseConfig 欄位；檔名加租戶代號；版號升到 2.0
  - [x] top-bar 加租戶標籤、首頁連結帶 `?t=`
  - [x] `admin.html` 租戶清單每行加「⚙️ 設定」按鈕（`<a target="_blank">` 開 `settings.html?t=<代號>`），動作欄寬度 130px → 220px
- [x] 改寫 `index.html` 成租戶功能選單（深色版保留舊版 4 按鈕漸層色，roster 可點、shop/office/weekly 顯示「移植中」disabled）2026-04-20

### Phase 3：驗收（進行中）
- [x] **Claude 自我健檢（2026-04-20）**：掃 core 4 檔 + 7 個 HTML + shop_data/*.js，找到 2 個 bug，已修
  - `roster.html:586` 把 `window.onload = () => {...}` 改直接呼叫（module + await bootTenant 會錯過 load 事件）
  - `shop/shop_data/app.js:482` 的 `DOMContentLoaded` 改用 readyState 判斷（shop.html 動態載入此檔時 DOMContentLoaded 可能早觸發）
  - 追加 FUTURE_IMPROVEMENTS：localStorage 跨租戶污染（P2）
- [ ] Raymond 實際操作確認 UI 一模一樣
- [ ] 修 bug（如有）
- [ ] 寫「新增租客 SOP」

---

## 📝 當前進度

**Phase 3 進行中（v11 統一 + admin 密碼升級 都做完了，等 kabe 實際驗收）**
最後更新：2026-04-20 深夜 4 Asia/Taipei

**剛完成（2026-04-20 深夜 4）：office.html 週次化（方案 B）**
- **移除下載報表按鈕** + `window.downloadReport` + html2canvas CDN（不再需要截圖功能）
- **自由文字日期** → **週選擇器**（`<input type="week">` + 前後箭頭，樣式配合深色主題）
  - helpers `getISOWeekString` / `getWeekDateRange` 從 weekly.html 對齊過來
- **資料模型改為「混合模式」**：
  - 舊：`office_settlement_v8_dark/{shareholders, expenses, income, dateRange}`（單一節點）
  - 新：`office_settlement_v8_dark/{shareholders, expenses, weeks: {<W>: {income, lastUpdated}}}`
  - **股東配比、支出清單** → 全域共用（每週一樣）
  - **收入** → 分週存（每週不同）
- **一次性資料遷移**：`onValue` 讀到舊結構（有 root.income 但沒有 weeks）自動搬到當週 weeks/<W>/income，只跑一次
- **寫入改用 `update` + 分層路徑**：一次 `update` 同時寫股東/支出（全域）+ `weeks/<W>/income`，不會覆蓋其他週
- **順手修原 code bug**：收入 input 原本只 oninput calculate 沒 saveData，導致輸入不會存；加上 `window.saveData()`
- **重置語意調整**：從「清空全部」改「只把本週收入歸零」（避免誤殺其他週資料）
- 2 個 commit 分開：移除下載報表（獨立） / 週選擇器+資料模型（相依一起）
- kabe 選方案 B：股東/支出全域，收入分週 → 切週只要改金額最輕鬆

**最新狀態（以 git log 為準）：**
- `12e9554` admin 入口改 SHA-256 驗證 + index 完全移除 admin 痕跡 ← **最新**
- `e6a2a1c` shop_data 整組升 v11 modular（full rewrite，已 push 線上）
- `005ded9` / `5b53b37` 前一輪的 v8 compat shim 版 + build.js terser 污染修復
- kabe 已測線上網址能動（2026-04-20 晚）

**剛完成（2026-04-20 深夜 3）：roster.html 三大加強（kabe 驗收中臨時插隊）**
- **F1 永久刪除**：離職名單每行加 🗑️ 深紅按鈕，二次確認 → `remove()` 徹底移除
  （在職看不到刪除鈕，防誤刪；離職 = 垃圾桶、永久刪除 = 倒垃圾）
- **F3 UI 加強**：
  - `#output-area` 一鏡到底（auto-resize 依內容撐開，不再有內部捲軸）
  - 預覽字級 4 段（小/中/大/特大），存 lsKey
  - 整頁縮放 select 50%~100%（body.style.zoom），存 lsKey
  - 右下浮動 ⬆ 回頂按鈕，main-content 捲過 300px 才顯示
- **F2 多租戶化**（最大）：把 for 陳老闆公司寫死的東西全拉出來可編輯
  - 地點清單 CRUD（原寫死民權路/莊二街/北新街）
  - 詳細版 + 精簡版模板 12 個欄位全可編輯（header/sectionHead/sep/footer 等）
  - 變數支援：`{date} {label} {short} {badge} {count}`
  - 存在租戶 Firebase `/roster_settings`，舊 localStorage.myFooter 自動遷移
  - 設定 modal 改 3 tab：📍 地點 / 📋 詳細版 / 📋 精簡版
  - 有員工使用中的地點不能刪；員工的地點被刪則歸「其他」組
- 3 個 commit（bb273aa / 2c2b3fa / 9a74bde）分開，萬一出事可單獨 rollback

**剛完成（2026-04-20 深夜 2）：index.html 加入口 UX**
- 沒 `?t=` 時：若 `localStorage.lifeos_last_tenant` 有值 → 自動 `location.replace('?t=<saved>')`
- 沒記住：顯示輸入框（預填上次代號，沒有就空的），按「進入」redirect
- 成功 bootTenant 才寫 localStorage（避免壞代號被記住、害下次一直重跳錯誤頁）
- 載入失敗時顯示錯誤 + 「🔄 換別的租戶」按鈕 → 清 localStorage + 跳 `?pick` 強制輸入框
- `?pick` 參數可繞過自動跳轉，正常切租戶用
- kabe 驗收流程中期需求：不想每次手動打網址
- 驗證待 deploy 上線後測

**剛完成（2026-04-20 深夜）：admin 密碼升級**
- 舊 `?admin=0308` 廢除（太好猜），改長隨機字串
- 原始碼只存 SHA-256 hash，輸入時算 hash 比對
- `index.html` 完全移除 admin 分支：不 redirect、無 `ADMIN_KEY_HASH`、不提 `?admin=` 字樣。搜 index 原始碼看不出有後台入口
- `admin.html` 自己驗證，要直接輸入正確網址才能進
- 新 admin URL 存 `LOCAL_SECRETS.md`（gitignore）
- 對應 FUTURE_IMPROVEMENTS `[P2] Admin 密碼升級` 可劃掉

**之前完成（2026-04-20）：**
- `src/admin.html`：Admin 後台
  - 登入檢查 `?admin=0308`
  - 租戶區塊：列表（代號 / 名稱 / projectId）、新增、編輯、刪除、JSON 驗證（必填 projectId + databaseURL）
  - 白名單區塊：輸入網域 + 標籤 → 算 SHA-256 → 存 `/whitelist/<hash>: { label }`；列表顯示標籤 + hash
  - 白名單空時暫時略過 hostname 檢查（方便首次設定），設定完刷新即啟用
  - Toast 提示、二次確認刪除
- `src/index.html`：從測試殼改寫成正式入口路由（ES module）
  - `?admin=0308` → redirect 到 `admin.html`
  - `?t=<代號>` → 動態 import security + tenant-loader → loadWhitelist → security.init → loadTenant → 顯示「租戶已載入」（Phase 2 完成後改 redirect 到 shop.html）
  - 無參數 → 顯示首頁提示
- 刪除 `src/boot.js`（pipeline 測試殼，邏輯已整合進 index.html）

**之前完成：**
- `src/core/security.js`：三層防禦（SHA-256 白名單 + F12 攔截 + DevTools 偵測）
- `src/core/main-firebase-config.js`：v11 modular，export `mainApp` / `mainDb`
- `src/core/tenant-loader.js`：export `loadWhitelist()` / `loadTenant(code)` / `listTenants()`

**主 Firebase 資料結構（已確定）：**
```
/whitelist/<sha256-hash>: true
/tenants/<代號>/
  ├── name
  ├── firebaseConfig (object)
  └── defaults (object)
```

**Phase 2 進行中（2026-04-20）：**
- 已完成：tenant-boot.js + roster.html + office.html + weekly.html + **shop.html（方案 C）**
- shop.html 測試方式：`https://emineokur221105-spec.github.io/lifeos-shop/shop.html?t=demo-qinre-main`
  - 沒 ?t= 會跳回首頁；有 ?t= 但租戶不存在會顯示錯誤頁
  - 載入順序：bootTenant → `window.TENANT_FIREBASE_CONFIG` → v8 compat init → config/utils/schedule/settlement/app/weekly 依序載入

**剛完成（2026-04-20 晚）：收尾三件事**
- `src/core/common.js`：showToast / escapeHtml / formatDate / getISOWeekString / debounce / copyText / getCurrentTenant / lsKey
  - 輕量零依賴，各頁要用再 import，不強迫重構現有 inline toast 實作
  - `lsKey()` 提供租戶 namespace 封裝，之後要改 localStorage 就用這個避免跨租戶覆蓋
- `SETUP_GUIDE.md` 大改寫：補上完整「新增租客 SOP」，5 小步（開 Firebase → admin 加租戶 → 白名單 → settings 設參數 → 交網址）
- `現況與未來.txt` 更新成最新狀態（shop/settings 已完成、加上驗收清單）

**下一步：**
1. **kabe 實際驗收**：依 `現況與未來.txt` 二、驗收清單 點一輪
2. 有 bug 回報 → Claude 修完再驗一次
3. 驗收通過 → 開始接客戶（參考 SETUP_GUIDE.md Step 2）
4. 未來升級（非緊急）：shop_data/*.js 逐檔改 v11 modular（FUTURE_IMPROVEMENTS P1）

**settings.html 測試方式：**
- 正常入口：admin 後台租戶清單 → 點「⚙️ 設定」→ 新分頁打開 `settings.html?t=<代號>`
- 直接網址：`https://.../settings.html?t=<代號>` 也可以
- 沒 ?t= 會跳回首頁；租戶不存在會顯示錯誤頁

---

## 🔧 2026-04-20 深夜：shop_data/*.js 整組升 v11 modular（方案乙 full rewrite）

**前情**：白天 v8 compat shim 版雖救了 DCE 問題，但仍混用兩套 SDK，且 `firebase-compat.js` 的 `.on()` 模擬有邊角 bug。kabe 直接下指示「改玩（完）一起測」、「一次到位」，授權 full rewrite。

**這回做了什麼**：
1. **新增 `shop_data/state.js`**：single source of truth，把原本散在各檔的 script-global 變數（REGIONS / roomConfig / staffData / services / currentActiveDate / expenseGroups …）集中到一個 `state` 物件 export 出去。
2. **新增 `shop_data/shop-db.js`**：v11 modular helper 層。export `setDb` / `dbRef` / `dbGet` / `dbVal` / `dbSet` / `dbUpdate` / `dbPushKey` / `dbRemove` / `dbOn`（回傳 unsubscribe） / `dbOff`，並 re-export 原生 `ref/get/set/update/push/remove/onValue/off`。
3. **新增 `shop_data/config.js`**：`SYSTEM_CONFIG` 預設 + `loadSystemConfig()` 從 `system_config` 路徑讀雲端覆蓋、`applySystemConfig()` 同步到 DOM + `state`。
4. **重寫 `shop_data/utils.js`**：對齊舊版函數簽名（`parseTime` 跨半夜 +24 / `formatDuration` / `getTaskHash(rawText, startMinutes)` / `showToast(msg)` className toggle / `getRegionColor` 8 色盤 / `playLoudAlarm` 4 秒自動停 / `getGlobalPricingTables` / `getTodayDateStr` / `safeDateKey`）。
5. **重寫 `shop_data/schedule.js`**：`renderSidebar` / `renderTracksOnly` / `updateTimeLineAndClock` / `renderScheduleAll`（150ms debounce） / `initRowResize` / `initScheduleDragHandlers` / `quickPaste`；5 分鐘 / 開始 / 結束鬧鐘提醒保留。
6. **重寫 `shop_data/settlement.js`**：卡片 HTML 改由 helper 組；staff.customConfig override / 阿姨加名 +100 / 經紀費計算全保留；`pushDailySummary` 寫 `shop_v8_daily_summaries/<safeDate>`；`copyDailyReport` / `copyAuntText` / `copySingleSettlementToExcel` / `copyFullSettlementToExcel`。
7. **重寫 `shop_data/weekly.js`**：CSS `injectWeeklyCss()` 一次性注入；週支出群組存 `shop_v8_weekly_expenses/<safeKey>`（`safeKey = rangeStr.replace('/','-').replace(' ','')`）。
8. **重寫 `shop_data/app.js`（~1155 行）**：`initSchedule()` + `emergencyWipe()` + `exposeGlobals()`，UI 行為（tab 切換、modal、zoom、regional 過濾、staff/room/service CRUD、copy-to-clipboard、截圖、緊急清空）全收斂在此。`exposeGlobals()` 一次把 ~50 個 onclick handler `Object.assign` 到 `window`（module scope 不自動掛 global，必須手動暴露）。
9. **新增 `shop_data/main.js`**：入口點。`bootTenant()` → `setDb(tenant.tenantDb)` → `exposeGlobals()` → `await initSchedule()` → 還原 `localStorage.appZoomLevel` 縮放。
10. **`src/shop.html` 大瘦身**：移除 `firebase-compat.js` import、移除動態 `loadScript` 6 檔 loop，全部換成單行 `<script type="module" src="./shop/shop_data/main.js"></script>`。刪除底部的 `shop_data/*.js 已由頂部 module 動態載入` 註解。
11. **刪除 `src/shop/firebase-compat.js`**（不再需要）。

**build 驗證**：`node build.js` 通過，7 個 shop_data 模組都以 `(module)` 模式壓縮，沒跨檔污染。本機 server（8080）serve `shop.html` / `main.js` / `app.js` 皆 200。

**下一步**：kabe 瀏覽器實測 `http://localhost:8080/shop.html?t=demo-qinre-main` 驗 UI 一模一樣 → 驗過再 commit + push。

---

## 🔧 2026-04-20 夜：shop 升 v11 + build.js 隱性 bug

**現象**：使用者反映 `shop.html` 進入排班 tab「完全空白、按鈕失效」。

**根因（兩個）**：
1. **shop.html 還在用 v8 compat SDK**（`firebasejs/8.10.1/firebase-app.js`），與主系統 v11 modular 並存，雖然 namespace 不同但是多餘 SDK 100KB+。
2. **build.js 淺拷貝 TERSER_BASE 讓 terser 跨檔污染**（真正的 bug）：
   - terser 會把 `module: true` 這個鍵**寫回** `compress` 與 `mangle` 子物件。
   - `...TERSER_BASE` 只淺拷貝外層，內部 `compress / mangle` 物件跨檔共享。
   - 一旦有 module 檔先被壓（例：`core/common.js`、`shop/firebase-compat.js`），後面的 classic 檔（`shop_data/*.js`）都被當 module 處理，頂層未使用 `const` 全被 DCE。
   - 實測：`utils.js` 從 4.2KB 被壓成 72 bytes，`config.js` 剩 149 bytes（只剩 throw 那行）。
   - 後果：線上版 shop_data 一半的程式碼根本不存在，所以 UI 是空的、按鈕沒功能。

**修正**：
1. 新增 `src/shop/firebase-compat.js`：v11 modular SDK 外面包一層 v8 風格 API（`db.ref(path).once/.on/.set/.update/.push/.remove/.child`），讓 shop_data/*.js 程式碼主體不動。
2. `src/shop.html`：移除 8.10.1 compat CDN，開機 module 改 import `initShopDb()`，結果掛到 `window.__shopDb`。
3. `src/shop/shop_data/config.js`：初始化區塊改 `const db = window.__shopDb`。
4. `build.js`：`minifyJsCode` 每次都重建 `compress / mangle / format` 子物件（深拷貝），避免 terser 跨檔 mutate。
5. 驗證：dist 所有 shop_data/*.js 回到正常大小（app.js 31.5KB、utils.js 2.5KB 等）。

---

## 🧠 關鍵決策紀錄

| 決策 | 內容 | 日期 |
|------|------|------|
| repo 名稱 | `lifeos-shop` | 2026-04-20 |
| 本機路徑 | `C:/Users/makeo/Desktop/LifeOS-Shop-統一版/` | 2026-04-20 |
| 租戶識別 | `?t=<代號>` | 2026-04-20 |
| Admin 入口 | `?admin=0308` | 2026-04-20 |
| 主分支 | `main` | 2026-04-20 |
| GitHub 帳號 | `emineokur221105-spec` | 2026-04-20 |
| 雙層 Firebase | 主 Firebase 存租戶清單；每個租戶自己的 Firebase 存營運資料 | 2026-04-20 |
| 混淆方式 | GitHub Actions 自動跑 terser，push 後雲端壓縮部署 | 2026-04-20 |
| 白名單儲存 | SHA-256 hash 存主 Firebase，前端啟動時比對 | 2026-04-20 |
| F12 防護 | 擋快捷鍵 + DevTools 偵測（不用 debugger 陷阱避免誤傷 Raymond） | 2026-04-20 |
| 可混淆 vs 不可混淆 | 自家 JS 全混淆；Firebase SDK / html2canvas 等第三方不混淆 | 2026-04-20 |

---

## ⚠️ 注意事項（下次 Claude 看到請遵守）

1. **Raymond token 有限**，改檔要一個一個慢慢來，每做完一步立刻 commit + 更新這份進度
2. **舊版在** `C:/Users/makeo/Desktop/週結版本 原版/`，筆記在 `C:/Users/makeo/Desktop/claude週結/ARCHITECTURE.md`，需要對照功能時讀那份
3. **UI 要一模一樣**，不要擅自改樣式、改操作流程
4. **Admin 入口 `?admin=0308`** 不能從 index 連過去，只有 Raymond 知道
5. **教學文件 `SETUP_GUIDE.md`** 用白話文，Raymond 是非工程師
