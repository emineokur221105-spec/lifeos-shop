# 週結版本 原版 — 架構筆記

> 本檔案採「逐檔累積」方式維護。每次 Claude 讀到新檔案，就在這裡補一段筆記。
> 未讀過的檔案留在下方「待讀清單」，避免重複消耗 token。

**專案路徑：** `C:/Users/makeo/Desktop/週結版本 原版/`
**總大小：** 約 332 KB / 18 檔案
**技術棧：** 純前端 HTML/CSS/JS，Firebase Realtime Database (worktools-f53e5)，PWA

---

## 整體架構

`index.html` 是進入點，4 個按鈕連到 4 個**各自獨立的 App**（共用同一個 Firebase 資料庫，但幾乎沒共用程式碼）：
```
index.html
  ├─→ shop.html    (門店排班+日結+周結)  ← 唯一有外部 JS 檔的（shop/shop_data/*）
  ├─→ office.html  (分紅結算)             ← 所有 JS 內嵌在 HTML
  ├─→ weekly.html  (週結業績對帳)         ← 所有 JS 內嵌在 HTML
  └─→ roster.html  (服務資訊排版生成)    ← 所有 JS 內嵌在 HTML
```
`settings.html` 是隱藏的設定頁（index.html 沒連過去，要手動輸入網址才能進）。

## 🚨 一體化的主要痛點（Raymond 想解決的）

| 問題 | 現況 | 影響 |
|------|------|------|
| **Firebase 版本不統一** | shop/weekly/settings 用 v8.10.1 (compat API)；office/roster 用 v11.0.2 (modular ES Module) | 兩套語法混用，難維護 |
| **Firebase config 重複 4 次** | shop 在 `config.js`；其他三頁直接硬編碼在各自 HTML | 改連線要改 4 個地方 |
| **CSS 各自為政** | shop 用 `shop/shop_data/style.css`；其他三頁每個都有自己一大段 `<style>` | 樣式不一致、沒有共用 |
| **導航列不統一** | 每頁各自實作「🏠 首頁」按鈕，風格不一致 | 使用者體驗不連貫 |
| **manifest 重複** | `manifest.json` 和 `manifest.js` 內容相同，實際只用 `.json`，`.js` 可刪 | 冗余檔案 |

## Firebase 資料結構（完整，全部已讀完）

| 節點 | 內容 | 讀者 | 寫者 |
|---|---|---|---|
| `system_config` | 密碼、價格、工數、阿姨名單、分紅預設 | shop (`config.js`) | settings.html |
| `shop_v8_global_settings` | `regions`, `roomConfig`, `services`, `regionPrefixes`, `openHour`, `closeHour` | app.js initSchedule + 監聽 | app.js saveScheduleData |
| `shop_v8_daily_schedules/{MM-DD}` | `{staffData, isLocked, date, timestamp}` 每日排班主資料 | app.js switchDate + 監聽 | app.js saveScheduleData |
| `shop_v8_daily_summaries/{MM-DD}` | `{revenue, aunt, agentTotal, agentMap, works, profit, regionData, timestamp}` 日結摘要 | weekly.js loadWeeklyData | settlement.js pushDailySummary |
| `shop_v8_weekly_expenses/{safeKey}` | `{expenseGroups}` 每週支出（safeKey = `04-14-04-20`） | weekly.js loadExpensesForActiveWeek | weekly.js saveWeeklyState |
| `shop_v8_weekly_state_v4` | 疑似殘留節點，只出現在 emergencyWipe | - | ? |
| `office_settlement_v8_dark` | `{income, dateRange, expenses[], shareholders[]}` | office.html | office.html |
| `weekly_data/weeks/{ISO週}/sales` | 業績貼文原文 | weekly.html | weekly.html |
| `weekly_data/weeks/{ISO週}/status/{名字}` | 入帳勾選 true/false | weekly.html | weekly.html |
| `weekly_data/accounts` | 銀行帳戶清單（全域共用） | weekly.html | weekly.html |
| `weekly_data/config` | `{warning, range}` | weekly.html | weekly.html |
| `roster/{pushId}` | `{name, location, features, body, core, gift, packages, extra, status, sortIndex}` | roster.html | roster.html |

**⚠️ 兩套「周結」系統並存：**
- `shop.html` 內的周結 tab（weekly.js）→ 讀 `shop_v8_*` 節點，算門店收益
- 獨立的 `weekly.html` → 讀 `weekly_data/*` 節點，做業績對帳與銀行匯款罐頭訊息
- 兩邊資料不相通。Raymond 將來若要整併需決策合併策略

## 已讀檔案筆記

### `shop.html` （已讀，29 KB，門店模組骨架）

用 tab 切換 3 個視圖：排班 / 日結 / 周結。

**外部依賴（CDN）：**
- Firebase v8.10.1 (compat API) — `firebase-app.js` + `firebase-database.js`
- html2canvas 1.4.1（截圖用）

**引用本地資源：**
- `manifest.json`（✅ 確認 `manifest.js` 是冗余）
- `shop/shop_data/style.css`
- 依序載入：`config.js` → `security.js` → `utils.js` → `schedule.js` → `settlement.js` → `app.js` → `weekly.js`
- 頁面載入時註冊 `sw.js`

**主要 UI 元素（DOM 結構）：**
- `#view-schedule` / `#view-settle` / `#view-weekly` 三個視圖容器
- 4 個 Modal：`#editModal`（編輯班表）、`#timeModal`（記錄服務時間）、`#staffParamsModal`（個別員工參數）、`#roomConfigModal`（房間配置）
- `#leftPanel`（人員名單）+ `#colResizer`（拖曳分隔線）+ `#trackContainer`（時間軌道）
- `#toast`（共用提示）

**關鍵按鈕 onclick 函式（該函式的實作在 JS 檔裡）：**
- 排班：`changeDay`, `goToToday`, `promptForDate`, `openRoomConfigModal`, `clearAllSchedules`, `applyZoom`, `toggleTopBar`, `switchTab`
- 日結：`toggleSettleLock`, `downloadScreenshot`, `copyFullSettlementToExcel`, `copyDailyReport`, `copyAuntText`, `addServiceRow`
- 周結：`deleteSelectedDays`, `addExpenseGroup`, `copyWeeklyReport`
- Modal：`closeEditModal`, `saveModalData`, `resetFromModal`, `toggleModalAttendance`, `fillCurrentTime`, `clearManualTime`, `saveManualTime`, `closeTimeModal`, `closeParamsModal`, `saveStaffParams`, `addNewParamRow`, `addNewRegion`, `deleteCurrentRegion`, `updateRegionPrefix`, `addNewRoomToConfig`, `applyRoomTemplate`, `closeRoomConfigModal`, `renderRoomConfigUI`
- 其他：`saveScheduleData`, `renderScheduleAll`

**UI 特色：**
- 右上角縮放下拉選單（100%/80%/60%/40%）
- 即時時鐘 `#topClock`
- 日期導航 ◀ ▶ + 「今天」按鈕
- 日結鎖定 🔓/🔒 按鈕

### `office.html` （已讀，25 KB，分紅結算 · 深色主題）

**完全獨立的頁面**，所有 JS 都在 `<script type="module">` 內嵌。

**依賴（CDN）：**
- Tailwind CSS
- Google Fonts：Inter、Noto Sans TC、Roboto Mono
- html2canvas 1.4.1
- Firebase **v11.0.2 modular SDK**（`initializeApp`, `getDatabase`, `ref`, `set`, `onValue` from ES Module）

**資料結構（Firebase 節點 `office_settlement_v8_dark`）：**
```js
{
  income: 0,
  dateRange: '',
  expenses: [{ type: 'team'|'company', name, amount, paidBy }],
  shareholders: [{ name, percent }]
}
```

**預設股東：** OG 67%、C 28%、黑 5%
**預設支出：** 做圖軟體月費 450、公司房租代墊 26233、團隊聚餐 1200

**核心邏輯：**
- `calculate()` — 淨利 = 總收入 − 團隊支出總額（**公司代墊不扣**）
- `renderShareholderCards()` — 每個股東顯示：分紅 + 團隊墊付 + 公司代墊 + 實領總額
- `checkPercent()` — 檢查持股加總是否 100%
- `downloadReport()` — 用 html2canvas 截圖存成 JPG
- 500ms debounce 後存雲端，`isLocalUpdate` flag 避免自己存的觸發自己的 onValue

### `weekly.html` （已讀，49 KB，業績對帳 / 罐頭訊息生成器）

**完全獨立的頁面**，所有 JS 都在 `<script>` 內嵌。

**依賴（CDN）：**
- Firebase **v8.10.1 compat**（`firebase-app.js` + `firebase-database.js` + `firebase-auth.js`）
- 使用匿名認證 (`auth.signInAnonymously()`)

**資料節點：**
- `weekly_data/weeks/{ISO週}/sales` — 業績貼文原文
- `weekly_data/weeks/{ISO週}/status/{名字}` — 入帳勾選（true/false）
- `weekly_data/accounts` — 全域銀行帳戶清單（所有週共用）
- `weekly_data/config` — `{warning, range}` 罐頭訊息警語與日期區間

**核心功能：**
1. **ISO 週次導航**（`getISOWeekString`, `getWeekDateRange`）
2. **業績解析** `parseAndCalculate`：
   - 每行抓「日期 + 名字+金額」的 token
   - 日期格式：`M/D` 或 `YYYY-MM-DD`
   - token 正則：`/([^\d\s]+)\s*(-?[\d\.]+)/g`（名字不含數字，後接數字）
   - **金額最後 ×100**（`Math.round(p.total * 100)`）
3. **銀行自動偵測** `detectBankName`：
   - 代號對照：822=中信、013=國泰世華、812=台新、808=玉山、012=富邦、700=郵局、004=台灣、008=華南、807=永豐
   - 關鍵字：「中信」「國泰」「世華」「台新」「玉山」「富邦」「郵局」也能辨識
4. **帳號格式化**：純數字後每 4 位加 `-`（`.replace(/(.{4})/g, '$1-')`）
5. **罐頭對帳單文字**：`{名字} ({日期區間}) 總金額：{×100金額}\n{銀行} {帳號}\n\n{警語}`

**UI 特色：**
- 查帳總表（勾選已入帳會變灰色 `.is-paid`）
- 個人卡片（狀態顏色：`header-pending` 橘 / `header-missing` 紅 / `header-paid` 灰）
- 全域展開/收起明細
- 銀行帳戶管理 Modal（新增/編輯/刪除）

### `roster.html` （已讀，33 KB，服務資訊排版生成器）

**完全獨立的頁面**，所有 JS 都在 `<script type="module">` 內嵌。

**依賴（CDN）：**
- Firebase **v11.0.2 modular SDK**
- SortableJS 1.15.0（拖曳排序）

**資料節點：** `roster/{pushId}` — 每個人一筆記錄
```js
{
  name, location, features, body, core, gift, packages, extra,
  status: 'active' | 'archived',
  sortIndex: number
}
```

**三個分店：** 民權路【民】、莊二街【莊】、北新街【北】

**核心功能：**
1. **自動儲存**：輸入後 1 秒自動存雲端（`autoSaveTimer`）
2. **在職/離職切換**：`switchView('active'|'archived')`
3. **拖曳排序**（SortableJS）：存 `sortIndex`。注意：搜尋模式下、離職區下**不儲存排序**
4. **複製詳細版** `copySelectedMembers`：產生「紙房子定點」格式的公告
5. **複製精簡版** `copyShortSchedule`：只有姓名清單
6. **文案模板**（頁尾警語）— 存 localStorage `myFooter`
7. **手機版側邊欄**：寬度 < 768px 時變抽屜

**預設文案：** `DEFAULT_BODY`、`DEFAULT_PACKAGES`、`DEFAULT_EXTRA`、`DEFAULT_FOOTER_TEMPLATE` 都在原始碼裡

### `settings.html` （已讀，38 KB，系統設定頁）

**首頁沒連過去**，要手動輸入 URL。

**依賴：** Firebase v8.10.1 compat

**7 個摺疊卡片：**
1. **Firebase 連線** — 存 `localStorage.custom_firebase_config`（不上雲端）
2. **系統安全** — 銷毀密碼、預設經紀費率
3. **價格方案表** — 可新增/刪除列
4. **工數對照表** — 進階 fallback
5. **阿姨帳規則** — 加給金額、除數、名單（Tags UI）
6. **排班顯示** — pxPerMin、開/關門時間
7. **分紅結算預設** — 股東 + 支出

**資料流：** 寫入 Firebase `system_config`，shop.html (透過 config.js) 會載入並覆蓋預設值。office.html 目前**沒讀** `system_config`（shareholders/expenses 直接用 `office_settlement_v8_dark` 節點），雖然這裡有設定介面但可能沒真的生效。

**匯出/匯入 JSON** 備份功能，檔名：`系統設定備份_YYYY-MM-DD.json`

### `index.html` （已讀，2 KB，入口頁）

純粹的選單頁。內嵌 CSS，4 個按鈕連到四大模組：
- 🏢 門店排班 → `shop.html`（藍色漸層 `btn-shop`）
- 💰 分紅結算 → `office.html`（綠色漸層 `btn-office`）
- 📊 週結業績 → `weekly.html`（橘色漸層 `btn-weekly`）
- 📋 服務資訊排版 → `roster.html`（紫色漸層 `btn-roster`）

**沒有連到 settings.html**——設定頁要手動輸入網址。要維護入口外觀、加新按鈕都改這裡。

### `shop/shop_data/config.js` （已讀，5.9 KB，shop 模組核心設定）

**比 `修改說明.txt` 講的結構更進階了。** 現在架構是：

- 定義 `SYSTEM_CONFIG` 物件當預設值
- 頁面啟動時呼叫 `loadSystemConfig()`，從 Firebase `system_config` 節點讀取設定**覆蓋**預設值
- 再呼叫 `applySystemConfig()` 同步到全域變數 + DOM 的 hidden inputs

**SYSTEM_CONFIG 內含：**
| 欄位 | 預設值 | 說明 |
|------|-------|------|
| `systemPassword` | `"8888"` | 系統密碼 |
| `defaultAgentRate` | 300 | 預設經紀人抽成 |
| `pxPerMin` | 2 | 排班格子：每分鐘像素數 |
| `defaultOpenHour` / `defaultCloseHour` | 12 / 26 | 預設營業時間（26 = 隔日凌晨 2 點） |
| `pricingTable` | 5 組價目 | 40/60/60/120/240 分鐘的佣金/成本/工數 |
| `workUnitTable` | `{40:1, 50:1, 60:1, 120:2, 200:3, 240:3}` | 時長→工數對照 |
| `auntExtraNames` | `["顏同", "有菜", "澄澄", "姚貴", "曼達", "阿鳴", "鳴"]` | 阿姨加給名單 |
| `auntExtraAmount` | 100 | 阿姨加給金額 |
| `auntDivisor` | 100 | 阿姨拆帳除數 |

**Firebase 設定（`DEFAULT_FIREBASE_CONFIG`）：**
- `projectId: "worktools-f53e5"`
- `databaseURL: "https://worktools-f53e5-default-rtdb.firebaseio.com"`
- 可被 `localStorage.custom_firebase_config` 覆蓋（支援自訂連線）

**全域變數（本檔宣告，值在別處填）：**
- `REGIONS = []` ← 舊說明講在這檔，**實際只宣告空陣列**，實際資料從別處來（推測從 Firebase 或某個初始化函式）
- `roomConfig = {}` — 房間設定
- `regionPrefixes = {}` — 地區代號
- `staffData = []` — 員工資料
- `services = []` — 服務項目

**狀態變數：**
- `isLocked` — 日結鎖定
- `showWorkingOnly` — 只顯示上班人員開關
- `currentEditingStaffId` / `currentTaskElement` / `currentTaskInfo` / `currentParamsStaffId` — UI 編輯狀態

### `manifest.json` 與 `manifest.js` （已讀，都 386 B，**內容完全相同**）

兩個檔案一模一樣的 PWA manifest：
```json
{
  "name": "門店管理系統",
  "start_url": "./shop.html",
  "display": "standalone",
  "background_color": "#2c3e50",
  "theme_color": "#2c3e50"
}
```
✅ **確認冗余**：shop.html 和 weekly.html 都是 `<link rel="manifest" href="manifest.json">`，`manifest.js` 沒人用，可刪。

### `sw.js` （已讀，553 B，Service Worker）

**網路優先、不做快取**的策略。註解說是為了避免舊版程式碼衝突。每次打開都讀伺服器最新程式碼。

- `install`: `skipWaiting()` 強制立即啟用新 SW
- `activate`: `clients.claim()` 接管所有頁面
- `fetch`: 什麼都不做，直接走網路

**維護意義**：改完程式碼不用怕使用者快取到舊版，重新整理就是最新。只有 shop.html 有註冊這個 SW（weekly.html 沒有）。

### `shop/shop_data/修改說明.txt` （已讀，注意：Raymond 說這是舊版本的說明）

---

## 已讀檔案筆記

### `index.html` （已讀，2 KB，入口頁）

純粹的選單頁。內嵌 CSS，4 個按鈕連到四大模組：
- 🏢 門店排班 → `shop.html`（藍色漸層 `btn-shop`）
- 💰 分紅結算 → `office.html`（綠色漸層 `btn-office`）
- 📊 週結業績 → `weekly.html`（橘色漸層 `btn-weekly`）
- 📋 服務資訊排版 → `roster.html`（紫色漸層 `btn-roster`）

**沒有連到 settings.html**——設定頁要從某個子頁進。要維護入口外觀、加新按鈕都改這裡。

### `shop/shop_data/config.js` （已讀，5.9 KB，shop 模組核心設定）

**比 `修改說明.txt` 講的結構更進階了。** 現在架構是：

- 定義 `SYSTEM_CONFIG` 物件當預設值
- 頁面啟動時呼叫 `loadSystemConfig()`，從 Firebase `system_config` 節點讀取設定**覆蓋**預設值
- 再呼叫 `applySystemConfig()` 同步到全域變數 + DOM 的 hidden inputs

**SYSTEM_CONFIG 內含：**
| 欄位 | 預設值 | 說明 |
|------|-------|------|
| `systemPassword` | `"8888"` | 系統密碼 |
| `defaultAgentRate` | 300 | 預設經紀人抽成 |
| `pxPerMin` | 2 | 排班格子：每分鐘像素數 |
| `defaultOpenHour` / `defaultCloseHour` | 12 / 26 | 預設營業時間（26 = 隔日凌晨 2 點） |
| `pricingTable` | 5 組價目 | 40/60/60/120/240 分鐘的佣金/成本/工數 |
| `workUnitTable` | `{40:1, 50:1, 60:1, 120:2, 200:3, 240:3}` | 時長→工數對照 |
| `auntExtraNames` | `["顏同", "有菜", "澄澄", "姚貴", "曼達", "阿鳴", "鳴"]` | 阿姨加給名單 |
| `auntExtraAmount` | 100 | 阿姨加給金額 |
| `auntDivisor` | 100 | 阿姨拆帳除數 |

**Firebase 設定（`DEFAULT_FIREBASE_CONFIG`）：**
- `projectId: "worktools-f53e5"`
- `databaseURL: "https://worktools-f53e5-default-rtdb.firebaseio.com"`
- 可被 `localStorage.custom_firebase_config` 覆蓋（支援自訂連線）

**全域變數（本檔宣告，值在別處填）：**
- `REGIONS = []` ← 舊說明講在這檔，**實際只宣告空陣列**，實際資料從別處來（推測從 Firebase 或某個初始化函式）
- `roomConfig = {}` — 房間設定
- `regionPrefixes = {}` — 地區代號
- `staffData = []` — 員工資料
- `services = []` — 服務項目

**狀態變數：**
- `isLocked` — 日結鎖定
- `showWorkingOnly` — 只顯示上班人員開關
- `currentEditingStaffId` / `currentTaskElement` / `currentTaskInfo` / `currentParamsStaffId` — UI 編輯狀態

### `manifest.json` 與 `manifest.js` （已讀，都 386 B，**內容完全相同**）

兩個檔案一模一樣的 PWA manifest：
```json
{
  "name": "門店管理系統",
  "start_url": "./shop.html",  // 從 PWA 啟動直接進 shop 頁
  "display": "standalone",
  "background_color": "#2c3e50",
  "theme_color": "#2c3e50"
}
```
⚠️ **冗余**：兩個檔案內容一致，有一個可能沒被引用。之後讀 HTML 時確認哪個是實際載入的，另一個可刪。

### `sw.js` （已讀，553 B，Service Worker）

**網路優先、不做快取**的策略。註解說是為了避免舊版程式碼衝突。每次打開都讀伺服器最新程式碼。

- `install`: `skipWaiting()` 強制立即啟用新 SW
- `activate`: `clients.claim()` 接管所有頁面
- `fetch`: 什麼都不做，直接走網路

**維護意義**：改完程式碼不用怕使用者快取到舊版，重新整理就是最新。

### `shop/shop_data/app.js` （已讀，48 KB，主程式 · 黏合所有模組）

**最大的檔案。** 負責初始化、狀態管理、Firebase 讀寫、Modal 互動、大多數 onclick 函式的定義。

**檔案頂部寫死常數：**
- `SYSTEM_PASSWORD = "8888"` — 銷毀按鈕密碼（⚠️ 和 config.js 的 `systemPassword` 重複，用途不同：這個寫死在 app.js 開頭）
- `BASE_PARAM_KEYS = ["40-1", "60-1", "60-2", "120-3", "240-3"]` — 基準算錢組合，不可刪除

**全域狀態（本檔讀寫）：**
- `currentActiveDate` — 當前日期 `"MM/DD"`
- `currentDbRef` — 當日 Firebase ref
- `currentEditingStaffId`, `currentTaskElement`, `currentTaskInfo`, `currentParamsStaffId` — Modal 編輯狀態
- `tempModalAttendance` — Modal 內上班/請假的暫存
- `isServicePanelExpanded` — 服務面板摺疊（localStorage 記住）
- `staffData`, `isLocked`, `REGIONS`, `roomConfig`, `services`, `regionPrefixes`, `WORK_UNIT_TABLE` — 由其他檔宣告，這裡大量讀寫

**Firebase 節點（完整清單）：**
| 節點 | 用途 | 讀/寫者 |
|---|---|---|
| `shop_v8_global_settings` | 全域設定（regions, roomConfig, services, regionPrefixes, openHour, closeHour） | app.js initSchedule 讀+監聽、saveScheduleData 寫 |
| `shop_v8_daily_schedules/{MM-DD}` | 每日排班（staffData, isLocked, date, timestamp） | switchDate 讀+監聽、saveScheduleData 寫 |
| `shop_v8_daily_summaries/{MM-DD}` | 每日結算（revenue, aunt, agentMap, regionData, ...） | settlement.js pushDailySummary 寫、weekly.js loadWeeklyData 讀 |
| `shop_v8_weekly_expenses/{safeKey}` | 週支出（expenseGroups） | weekly.js saveWeeklyState 寫/讀 |
| `shop_v8_weekly_state_v4` | **疑似殘留節點**，emergencyWipe 會刪但沒看到誰寫入 | - |

**生命週期：**

#### `initSchedule()` — 入口
1. 動態插入 `#emergencyWipeBtn` 紅色銷毀按鈕到 `.nav-buttons`
2. `cleanupOldData()` — 清 **14 天前**的 `shop_v8_daily_schedules` 和 `shop_v8_daily_summaries`
3. 一次讀 `shop_v8_global_settings` → 填入 REGIONS / roomConfig / services / regionPrefixes / openHour / closeHour
4. 讀 `localStorage.lastActiveDate` 或 `getTodayDateStr()` → `switchDate`
5. `db.ref('shop_v8_global_settings').on('value', ...)` — 監聽設定頁的變更，即時同步（**會小心避開使用者正在 typing 的欄位**）
6. `setInterval(updateTimeLineAndClock, 1000)` — 每秒更新時鐘
7. 首次 body 點擊 → `requestNotificationPermission()`

#### `getTodayDateStr()`
**關鍵跨夜邏輯：** `if (d.getHours() < 11) d.setDate(d.getDate() - 1)` — 凌晨 0~10 點顯示「昨天」（因為營業時間跨到凌晨，深夜結算還算當日）。

#### `switchDate(newDateStr)` — 切換日期（含智慧沿用）
1. 關舊 listener `currentDbRef.off()`
2. 更新所有日期 input/display
3. localStorage.setItem `lastActiveDate`
4. 讀 `shop_v8_daily_schedules/{safeDate}`
5. **若當日沒資料（智慧沿用順序）：**
   1. 讀**昨日**資料 → 複製 staffData，清空 `content/taskStatuses/overrides/manualExpense`
   2. 昨日也沒 → 用當前記憶體的 `staffData` 複製
   3. 還是沒 → `generateEmptyStaffFromConfig()`（從 REGIONS × roomConfig 產空人）
6. `set()` 寫入初始化資料
7. 註冊 `on('value', ...)` 監聽：
   - 遇到 `isTyping`（input/textarea/contenteditable focus 中）**只重繪 tracks 不重繪整體**，避免打斷輸入
   - 正常情況會 `renderScheduleAll()` + 如果在日結頁也 `renderSettlementTable()`
   - staffData 每筆補預設值：`taskStatuses`, `overrides`, `customConfig = {enabled:false,comm:{},cost:{},work:{}}`, `region`, `attendance`

#### `saveScheduleData()` — 存檔（核心）
1. `db.ref('shop_v8_global_settings').update({...})` — 同步全域
2. **排序 staffData**：先 region（按 REGIONS 順序，查不到 = 999）→ 再 room（按 roomConfig[region] 順序）→ 最後 id
3. `db.ref('shop_v8_daily_schedules/{safeDate}').update({ staffData, isLocked, date, timestamp })`
4. 同步燈：紅（開始寫）→ 綠（成功）/ 黃（錯誤）

**日期導航：**
- `changeDay(offset)` — ±1 天
- `goToToday()` — 跳今日
- `promptForDate()` / `syncDate(str)` — 驗證 `MM/DD` 格式

**鎖定機制：**
- `toggleSettleLock()` — **鎖定時自動 `pushDailySummary()`** 把日結同步到 `shop_v8_daily_summaries`（周結頁才能讀到）
- `updateLockUI()` — 鎖定時所有 input disabled、日結日期 input 也鎖、config-panel 內所有 input 鎖、按鈕變紅/綠

**Tab 切換 `switchTab(tabId)`：** 
- `tabId` ∈ `schedule/settle/weekly`
- 切到 weekly 會 `loadWeeklyData()`（第一次才載入）
- 切換後延遲 50ms 再重繪（等 CSS transition）

**區域切換 `renderRegionTabs()` + `switchRegion()`：**
- 三個 tab 共用：`#scheduleRegionTabs`, `#settleRegionTabs`, `#weeklyRegionTabs`
- weekly 用自己的 `switchWeeklyRegion`（在 weekly.js）
- 防呆：`currentRegion` 若不是陣列就包成陣列（從舊版單選相容）
- 多選邏輯同 weekly 的規則

**`toggleWorkingOnly()`** — 切換「僅顯示上班」過濾器（影響排班和日結）。

**Modal 四組：**

**1. editModal（編輯班表內容）：**
- `openEditModal(staffId)` — 鎖定時禁止開。載入 content + 上班狀態
- `toggleModalAttendance()` + `updateModalAttendanceUI()` — 🟢上班/🔴請假按鈕
- `saveModalData()` — **存入時 `overrides: {}`**（換班表覆蓋過就清空 override）
- `closeEditModal()`
- `resetFromModal()` — 徹底重置當日版（清 name/content/agentName/agentRate=300/customConfig/overrides/manualExpense=0）

**2. timeModal（記錄上下工時間）：**
- `openTimeModal(element, staffId, taskId, content, scheduledStart, scheduledEnd, lineIndex)` — **會臨時 call `calculateSettlement`** 顯示該筆的抽出姓名、revenue、當前 aunt_disp（⚠️ 這裡有重複的算錢參數讀取邏輯，和 utils.js 的 `getGlobalPricingTables` 邏輯重複）
- `fillCurrentTime('in'/'out')` — 塞入當前時間 `HH:MM`
- `saveManualTime()` — 驗證格式 `/^\d{2}:\d{2}$/`，寫入 `taskStatuses[taskId].inTime/outTime`，**同時 override 該 lineIndex 的 aunt_disp**
- `clearManualTime()` — 清空該 task 的 inTime/outTime

**3. staffParamsModal（個人參數）：**
- `openStaffParamsModal(staffId)` — 列出 BASE_PARAM_KEYS + customConfig 已有 keys，三欄 input（佣/成/工）
- `addNewParamRow()` — prompt 輸入 `50/2` 格式，新增自訂組合
- `saveStaffParams()` — 收集所有 `.param-row-item` 的 `data-key` 和三個值，寫入 `staff.customConfig = {enabled, comm, cost, work}`
- `closeParamsModal()`

**4. roomConfigModal（房間配置）：**
- `openRoomConfigModal()` — 載入 regionPrefixes 的前標
- `renderRoomConfigUI()` — 顯示該區所有房間列表
- `addNewRoomToConfig()` / `removeRoomFromConfig(region, index)`
- `applyRoomTemplate()` — **同步配置到今日班表**：移除不在 roomConfig 的房間、補上缺的房間
- `addNewRegion()` / `deleteCurrentRegion()` — ⚠️ 刪區會同步把今日 staffData 中該區的資料全部移除
- `updateRegionPrefix(value)` — 更新該區的複製前標

**服務項目：**
- `renderServices()`, `addServiceRow()`, `updateService(index, field, value)`, `removeService(index)`
- `toggleServicePanel()` / `initServicePanel()` — 摺疊（localStorage 記住 `servicePanelExpanded`）

**單人欄位更新：**
- `updateStaffName`, `updateStaffRegion` — 觸發 saveScheduleData
- `updateStaffSettlement(staffId, field, value)` — 更新 agentName/agentRate/manualExpense 等
- `saveOverride(staffId, lineIndex, field, element)` — **日結視圖儲存格 onblur 觸發**，存 override[lineIndex][field] + 加上 `.manual-text` class
- `resetStaffSettings(staffId)` — 重置 customConfig/agentName/agentRate/manualExpense/overrides

#### `copySingleAvailability(staffId)` — 複製空檔文字（導流用）
**這個是羅老闆日常用的重點功能。**

1. 解析班表每筆 task，`end = start + duration + 10`（10 分鐘緩衝）
2. 排序後**合併相近任務**：`nextTask.start - currentTask.end < 40` 視為連續
3. 過濾掉已過去（end <= nowMins）
4. 前標：`regionPrefixes[staff.region]`（在房間配置頁設定）
5. 輸出格式：
   ```
   [前標][名字] 現走 13.00有客 14.05可約 15.30有客 16.35可約
   ```
   - 沒任務 + 班表空 → `現走`
   - 沒任務 + 班表非空 → `(班表原文)`
   - 下一筆還很久（≥40 分） → 先放「現走」
   - 正在服務中（nowMins 在 task 範圍內）→ `目前有客 HH.MM可約`
6. 時間格式用 `HH.MM`（點而非冒號，Threads 不會被截斷）

#### `emergencyWipe()` — 密碼銷毀
- `prompt()` 輸入 `SYSTEM_PASSWORD`（8888）
- 錯誤 → alert
- 正確 → `remove()` 三個節點：`shop_v8_daily_schedules`、`shop_v8_daily_summaries`、`shop_v8_weekly_state_v4`
- **不會刪** `shop_v8_weekly_expenses` 和 `shop_v8_global_settings`
- 1 秒後 `location.reload()`

**其他：**
- `clearAllSchedules()` — 清空今日所有人班表內容（不刪人員結構）
- `cleanupOldData()` — 自動刪 14 天前資料
- `toggleTopBar()` — 排班頂部資訊列收合 + 延遲重繪 tracks
- `applyZoom(scaleValue)` — CSS zoom 全頁縮放，localStorage `appZoomLevel` 記住
- `DOMContentLoaded` 時自動套用上次的 zoom

**維護重點：**
- **加新 Firebase 節點** → 同時更新 `cleanupOldData` 和 `emergencyWipe`
- **改跨夜邏輯** → `getTodayDateStr` 的 `< 11` 這個數字
- **改資料沿用規則** → `switchDate` 的 isEmpty 分支（目前：昨日→當前記憶→空）
- **改資料過期天數** → `cleanupOldData` 的 `14 * 24 * 60 * 60 * 1000`
- **經紀費率預設** → `resetStaffSettings`、`resetFromModal`、`settlement.js buildCardHeaderHTML` 都寫死 300（要改要一起改）
- **⚠️ `openTimeModal` 內重複了算錢參數表**（和 utils.js 的 `getGlobalPricingTables` 邏輯相同）— 未來可以抽出共用
- **`SYSTEM_PASSWORD = "8888"`** 寫死在 app.js 檔頭，不在 config.js。和 `config.js` 的 `systemPassword` 是兩個不同的密碼（雖然值都是 8888，修改時兩個都要改）
- **Typing 偵測避免打斷輸入**：修 `on('value')` callback 時別忘了 `isTyping` 判斷

### `shop/shop_data/settlement.js` （已讀，33 KB，日結視圖 · 最複雜的算錢核心）

**整個系統的錢都從這裡算出來。** 錯一點錢就不對。

**相依：** `utils.js`（`parseTime`, `formatTime`, `getGlobalPricingTables`, `showToast`）、`config.js`（`WORK_UNIT_TABLE`, `AUNT_EXTRA_NAMES`, `REGIONS`）、`app.js`（`staffData`, `currentActiveDate`, `currentRegion`, `isLocked`, `services`, `db`, `renderRegionTabs`, `updateStaffSettlement`, `openStaffParamsModal`, `resetStaffSettings`, `saveOverride`）。

**全域狀態：** `currentDailySummaryData`（最新一次算完的當日全域摘要，用於 `pushDailySummary`）。

**核心函式：**

#### `calculateSettlement(staff, commTable, costTable, workTable, services)`

逐行解析單人的 `staff.content`，算出每筆服務的錢。

**算錢正規式（核心）：**
```js
/(\d+)(?:\([\d\s+-]*\))?[/-](\d+)[/-](\d+)/
```
對應班表格式：`{分鐘}/{收費}/{房數}`，分鐘後可帶 `(補充)`。例：
- `60/2000/1` → 60 分鐘 2000 元 1 房
- `60(-30)/2000/1` → 含 -30 分鐘備註
- `120-3000-3` → 也支援 `-` 分隔

**查表規則：**
- key = `"{duration}-{count}"`（例如 `"60-1"`, `"120-3"`）
- `base_comm = commTable[key]`（佣金）
- `base_cost = costTable[key]`（成本）
- `work = workTable[key]` 或 fallback `WORK_UNIT_TABLE[duration]`

**服務加錢：**
- 遍歷 `services`（全域陣列），如果 rawLine 包含 `svc.name` 就把 `svc.price` 加進 `extra_money`（大小寫不敏感）。

**計算公式：**
```js
total_miss = base_comm + extra_money           // 「失」欄位（小姐拿）
aunt_inc  = revenue - base_cost - extra_money  // 阿姨應得
if (realName in AUNT_EXTRA_NAMES) aunt_inc += 100
aunt_disp = Math.floor(aunt_inc / 100)         // 阿姨顯示值（點數）
balance = revenue - total_miss
```

**名字抽取：**
- 先試 `^(\D+)`（開頭連續非數字）
- 再試 `^([^\d\s]+)`（開頭連續非數字非空格）當 realName
- `realName.includes(':')` 要排除（避免抓到時間字串的 `:`）

**Override 機制（使用者手動修改儲存格）：**
- `staff.overrides[lineIndex] = { revenue?, total_miss?, aunt_disp?, work?, note? }`
- 每個欄位 override 後會在回傳物件加 `isXXXOverridden: true` 標記（UI 顯示紫色）
- `finalBalance` 永遠是 `finalRevenue - finalTotalMiss`（不直接 override balance）

**錯誤處理：**
- 正規式沒 match 到 → `isError: true`，所有金額歸零，UI 紅底 + ⚠️

**日期分隔：**
- 日期行（`/^[\d./-]+\s*(?:\([^)]+\))?$/` 且長度 < 15）會插入 `isDateHeader: true` 的 row
- 只算 `activeBlockDate === currentActiveDate` 的行

#### `renderSettlementTable()`
Debounce 150ms 的對外入口（和排班一樣的防抖模式）。

#### `executeRenderSettlementTable()`
- 呼叫 `renderRegionTabs()`（定義在 app.js）
- `getGlobalPricingTables()` 拿全域參數
- 遍歷 `staffData`，對每人：
  - 不上班且班表為空 → 跳過
  - 有 `staff.customConfig.enabled` → 用個人參數覆寫全域（⚙️ 按鈕變紅 + 紅光效果）
  - 呼叫 `calculateSettlement` 算錢
  - 算經紀費：`totalWorks * agentRate`（`staff.agentRate` 預設 300）
  - 建立 `.staff-card-settle` div，`id="settle-card-{staffId}"`
  - 寫入 `card.dataset`: region, agentName, agentRate, totalWorks, staffName, roomName
  - 不在當前 region 的卡片 `display: none`（**不是不建立**，後面可能切換顯示）
- 最後呼叫 `updateTotalsFromDOM()` 算總計

#### `updateTotalsFromDOM()`
**從 DOM 讀回儲存格**再算總和（因為 contenteditable 會讓使用者改數字）。

**讀取路徑：**
```js
card.querySelectorAll('tbody tr:not(.footer-total)').forEach(row => {
  row.querySelector('.col-rev / .col-miss / .col-aunt / .col-work')
});
```

**阿姨文字串（給 LINE 複製用）：**
```
名字點數 名字點數 名字點數
```
只累積 `aunt > 0` 且卡片可見的人。

**最終結餘：**
```js
final_bal = card_total_bal + manualExpense  // manualExpense 可能是負數（雜支）
```
顯示在黑底黃字那格 `.final-balance`。

**經紀費彙總：**
- 三份總計：`globalData`（全部）、`currentViewData`（只可見的）、`regionData[region]`（各區分開）
- **智能防呆**：`agentName` 空白時自動改成 `未填-{房號}-{姓名}` 當 key，避免混在一起
- 只有 `card_total_work > 0` 才計入（不印 $0 的人）

**頁面數字更新：**
- `#total_revenue`（總收）← `currentViewData.rev`
- `#total_aunt`（阿姨總帳）
- `#agent_fee_total_display`（經紀總）
- `#total_net_profit`（淨利）
- `#total_works_summary`（總工數）
- `#agent_fee_summary`（各經紀人明細 HTML）
- `#aunt_text_display`（阿姨文字串，加上日期）

**最後存 `currentDailySummaryData`**：
```js
{
  dateName, revenue, aunt, agentTotal, agentMap, works, profit,
  regionData: { [region]: { revenue, aunt, agentTotal, works, profit, agentMap } },
  timestamp
}
```
⚠️ 注意：這裡的 `revenue` 存的是 `globalData.rev`（全部），不是只計算可見區域。

#### `pushDailySummary()`
把 `currentDailySummaryData` 寫入 `db.ref('shop_v8_daily_summaries/{safeDateKey}')`。
- `safeDateKey = dateName.replace(/\//g, '-').replace(/[.#$[\]]/g, '_')`（Firebase key 限制）

#### 複製功能

**`copyDailyReport()` — LINE 報表（純文字）：**
```
04/20 (民權+莊二)
總收 XXX
---------------------
阿姨 XXX
經紀 XXX
---------------------
小明 1500
小花 2000
===============
盈餘 XXX
```
只含可見卡片。區域全選時不顯示 `(民權+莊二)`。

**`copyAuntText()` — 阿姨文字串：** 複製 `#aunt_text_display` 內容。

**`copySingleSettlementToExcel(staffId)` — 單人 4 欄 Excel：**
- 只含 cells[1]~cells[4]（名稱/阿姨/收/小姐）
- 14pt 粗體，名字藍色 `#0000FF`，手動修改紫色 `#800080`
- 用 `ClipboardItem({ "text/html", "text/plain" })` 寫入（Safari 相容 fallback 用 execCommand）

**`copyFullSettlementToExcel()` — 完整對位 Excel：**
- 每人 5 欄（名字/阿姨/收/小姐/經紀名+費用）
- 固定 13 行工作列（不足補空格、第 13 行特殊：工數＋雜支）
- 接著總計列（阿姨總 / 總收 / 總miss / 最終結餘）
- 隔 1 空行
- 9 行摘要：共收、阿姨帳、[各經紀人]、本日盈餘
- 經紀人明細用正規式 `/([^\n:]+):\s*[\$]?([\d,]+)/g` 從 `#agent_fee_summary` 抓回

#### UI 結構（三大 HTML 生成函式）

**`buildCardHeaderHTML(p)`：** 黃色 header
- 房號 badge + 姓名 + 📊 複製Excel 按鈕 + 地區 select
- ⚙️ 個人參數（customConfig 啟用時變紅）、🔄 重設、經紀人 input、費率 input、費用顯示
- 8 欄 table head: 班表 / 名稱 / 阿姨 / 收 / 小姐 / 結餘 / 工數 / 備註

**`buildCardRowHTML(p)`：** 單筆資料列
- 8 格：班表原文 / 抽出的名字 / aunt_disp / revenue / total_miss / balance / work / note
- 每個可編輯儲存格 `onblur="saveOverride(...)"`
- 手動改過的格子加 `.manual-text` class（紫色）
- 錯誤列紅底 + ⚠️

**`buildCardFooterHTML(p)`：** 卡片底部三列
- `.footer-total` — 總計（會由 `updateTotalsFromDOM` 填值）
- 雜支/飯錢列 — `.input-expense` 數字 input（`manualExpense`）
- 修正後結餘 — 黑底黃字 `.final-balance`

**維護重點：**
- **改算錢公式、加新價格組合** → `calculateSettlement` 的正規式和 `commTable/costTable/workTable` key 格式（要同步 `getGlobalPricingTables` 在 utils.js 的 keys）
- **改阿姨加給邏輯** → 搜 `AUNT_EXTRA_NAMES` 和 `aunt_inc += 100`
- **改 LINE 報表格式** → `copyDailyReport`
- **改 Excel 欄位/格式** → `copyFullSettlementToExcel` / `copySingleSettlementToExcel`
- **改寫入雲端的資料格式** → `updateTotalsFromDOM` 結尾的 `currentDailySummaryData`（會影響 weekly.js 讀取！）
- **Override 存回雲端的路徑** → 靠 app.js 的 `saveOverride` 實作
- **加總時** 一定要走 `updateTotalsFromDOM`（讀 DOM 而不是重算），否則 contenteditable 修改不會反映
- **防呆邏輯改動要小心**：未填經紀人的 fallback key 會影響報表彙總

### `shop/shop_data/weekly.js` （已讀，18 KB，shop 模組的「周結」tab 邏輯）

⚠️ **不是** `weekly.html`（那是獨立的業績對帳頁）。這是 shop.html 第三個 tab 的邏輯。

**相依：** `db`（Firebase 實例，在 app.js 建立）、`REGIONS`（config.js）、`renderSettlementTable`（settlement.js，非必要）。

**Firebase 節點（終於找到）：**
- 讀 `shop_v8_daily_summaries/{MM-DD}` — 日結算結果（由 settlement.js 寫入）
- 讀/寫 `shop_v8_weekly_expenses/{safeKey}` — **每週獨立**的支出清單（`safeKey = activeWeekRange.replace(/\//g, '-').replace(/\s/g, '')`）

**日結資料結構（從這裡推斷）：**
```js
{
  dateName: "04/20",
  revenue: 0, aunt: 0, agentTotal: 0, works: 0, profit: 0,
  agentMap: { [經紀名]: 費用 },  // 各經紀人抽成
  regionData: {
    [地區名]: { revenue, aunt, agentTotal, works, profit, agentMap }
  }
}
```
→ 每日結算會分開存「整體」與「各地區」兩份總額。

**週支出資料結構：**
```js
{
  expenseGroups: [
    { id, name: "人員名", items: [ { name: "項目", amount: 數字 } ] }
  ]
}
```

**全域變數：**
- `rawWeeklyData` — 快取所有日結（整個 `shop_v8_daily_summaries` 節點）
- `expenseGroups` — **會隨週次切換重新載入**（不是全域單一份）
- `currentWeeklyRegions` — 多選陣列，`["All"]` 或 `["民權", "莊二"]`
- `weekRangesMap` — `{ "04/14 - 04/20": ["04/14", "04/15", ...], ... }`
- `weekRangeKeys` — 排序後的 key 陣列
- `activeWeekRange` — 當前選中的週
- `selectedDates` — 當前勾選的日期

**核心函式：**

- `loadWeeklyData()` — 初始入口。從 Firebase 撈全部日結 → 分週 → 預設選最後一週 → 渲染。
- `loadExpensesForActiveWeek()` — 切換週時呼叫，讀該週獨立支出。
- `groupDatesByWeek(dates)` — 按**週一為首日**分組：
  ```js
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  ```
  `day === 0`（週日）特別處理，回推 6 天到上週一；其他正常減 `day-1`。
- `getDayOfWeekStr(dateStr)` — 給日期回傳「一/二/三」單字。
- `calculateAndRenderSummaries()` — 加總核心：
  - 遍歷 `selectedDates`，從 `rawWeeklyData` 取資料
  - `isAll` 決定讀整體還是 `regionData[r]`
  - 多區域多選會**逐區累加**（`currentWeeklyRegions.forEach`）
  - 五大總額：收入、阿姨、經紀、工數、日利潤
  - 各經紀人費用用 map 累加
  - 最後呼叫 `updateFinalProfit(dailyProfit - totalExpense)`

**多區域切換邏輯 `switchWeeklyRegion`：**
- 點 "All" → 重設成 `['All']`
- 點其他且當前是 `['All']` → 切成只選該區
- 點其他且已在陣列 → 移除（取消該區）
- 點其他且不在陣列 → 加入（多選）
- 清空時 fallback 回 `['All']`

**UI 結構：**
1. 區域多選 tabs（`#weeklyRegionTabs`）
2. 週次選擇按鈕（`#weekly_days_container` 內，水平捲動）
3. 該週每日勾選膠囊
4. 五張 summary card（收入 / 阿姨 / 工數 / 日利潤 / 經紀總額）+ breakdown 明細
5. 支出編輯區（`#weekly_expenses_container`）— 人員卡片內多個項目
6. 支出總計 + 最終盈餘
7. 複製報表按鈕

**onclick 對外函式（掛在 window）：**
- `switchWeeklyRegion`, `switchWeekRange`, `toggleAllDays`, `toggleDay`, `deleteSelectedDays`
- `addExpenseGroup`, `removeExpenseGroup`, `updateExpenseGroup`
- `addExpenseItem`, `removeExpenseItem`, `updateExpense`
- `copyWeeklyReport`

**刪除紀錄 `deleteSelectedDays()`（危險操作）：**
- 只 confirm 一次
- 對每個日期 `db.ref('shop_v8_daily_summaries/{MM-DD}').remove()`
- 結束後 `location.reload()` 強制重整

**複製報表格式：**
```
📅 周結報表 [04/14 - 04/20]
區域: 民權+莊二
總收: X
阿姨: X
經紀: $X
支出: $X
--------------------
💰 最終盈餘: $X
```

**內嵌 CSS（動態 append 到 `<head>`）：**
- `.week-range-btn` / `.day-check-label` / `.expense-card` / `.expense-header` / `.breakdown-row` 等 weekly 專屬樣式
- **沒放在 `style.css`**，檔案載入時 inject 進 DOM

**維護重點：**
- 改週起始日（目前週一）→ `groupDatesByWeek` 的 `day === 0 ? -6 : 1`
- 改報表格式 → `copyWeeklyReport`
- 動支出存到雲端哪裡 → `saveWeeklyState` 裡的 `safeKey`
- 新增地區 → 只要 `REGIONS` 有就自動吃（前提 `regionData` 也要有對應）
- 注意：`location.reload()` 在 `deleteSelectedDays` 會清所有 UI 狀態

### `shop/shop_data/schedule.js` （已讀，22 KB，排班視圖渲染與互動）

**相依：** `utils.js`（`parseTime`, `formatTime`, `formatDuration`, `getTaskHash`, `getRegionColor`, `showToast`, `playLoudAlarm`, `sendSystemNotification`）、`config.js`（`REGIONS`, `PX_PER_MIN`, `WORK_UNIT_TABLE`）、`app.js`（`staffData`, `currentActiveDate`, `currentRegion`, `showWorkingOnly`, `saveScheduleData`, `openEditModal`, `openTimeModal`, `updateStaffName`, `updateStaffRegion`, `copySingleAvailability`, `getTodayDateStr`, `renderSettlementTable`）。

**核心函式分層：**

**渲染層：**
- `renderScheduleAll()` — **對外主入口**，debounce 150ms 後呼叫 `executeRenderScheduleAll()`。避免連續寫入觸發重繪風暴。
- `executeRenderScheduleAll()` — 先 `renderSidebar()` 再 `requestAnimationFrame(renderTracksOnly)`。
- `renderSidebar()` — 渲染左邊人員卡片列。會依 `currentRegion` / `showWorkingOnly` 過濾。每張卡片左緣有 5px 區域色標。
- `renderTracksOnly()` — 渲染右邊時間軌道。計算總寬度 `(closeH*60 - openH*60) * PX_PER_MIN`，每小時畫一條虛線。
- `renderSingleTrack()` — 解析單人班表文字，產出工作塊+空檔塊+衝突塊。
- `createBlock()` — 建立單個 `.block` DOM 元素。`free` 塊會套區域色的 20% 透明底色（`regionColor + "33"`）。

**班表文字解析邏輯（重要）：**
```
班表格式範例：
04/20 (一)          ← 日期分隔行
13:00 60 小明       ← 時間 時長 備註
14:30 120 大華
04/21 (二)          ← 下個日期
10:00 60 阿強
```
- 日期行判斷：`/^[\d./-]+\s*(?:\([^)]+\))?$/` 且長度 < 15
- 日期格式抽取：`/(\d{1,2})[\/\-\.](\d{1,2})/` → 補零成 `"MM/DD"`
- 任務行兩種格式，兩個正規式依序 match：
  - `/([\d.:]+)\s*(\d+.*)/` — 時間 + 時長開頭
  - `/(\D+)\s*([\d.:]+)\s*(\d+.*)/` — 名字 + 時間 + 時長
- 時長：第一個 `^(\d+)` 數字，預設 60。
- **只渲染 `currentActiveDate` 符合的任務**。

**衝突偵測（O(n²)）：**
```js
tasks.sort((a, b) => a.start - b.start);
for (i ...) for (j = i+1 ...) if (tasks[i].end > tasks[j].start) 兩個都 conflict = true
```
排序後雙迴圈比對，遇到不重疊就 break 減少判斷。

**空檔生成：**
任務之間 gap ≥ 10 分鐘才會畫空檔塊。收工後到 closeH 的空檔也會畫。

**即時功能：**
- `updateTimeLineAndClock()` — 更新紅色當前時間線 + `#topClock`。每秒呼叫。
  - 時鐘顯示：`h ∈ [0, 11)` 自動 +24（凌晨顯示成 25:XX）
  - 紅線只在當日且當前時間在營業範圍內顯示
- `checkScheduleAlerts(currentMinutes)` — 三階段提醒：前 5 分鐘、開始、結束。
  - 用 `alertedTasks = new Set<string>()` 記錄已提醒過的 `{date}-{staffId}-{start}-{end}_{PRE|START|END}`
  - 整組（警報聲 + 系統通知 + toast）同時觸發

**拖曳調整：**
- **欄寬**（整個左面板）：`#colResizer` → `startColResize/moveColResize/endColResize`，範圍 120~500px，**不存雲端**（重整後重置）。
- **列高**（單人卡片）：`.row-resizer` → `initRowResize/moveRowResize/endRowResize`，最小 60px，**存入 `staff.height` 並觸發 `saveScheduleData()`**。
- 同時 bind mouse + touch 事件。全域 flag `isColDragging` / `isRowDragging`。

**剪貼簿貼上 `quickPaste(staffId)`：**
1. 先試 `navigator.clipboard.readText()`。
2. 失敗（Safari / 權限未給）改用 `prompt()` 手動貼。
3. 會先 confirm 覆蓋提示。
4. 成功後清空 `overrides: {}`（暗示有 override 機制，在 app.js）。
5. 若目前在日結頁，順便 `renderSettlementTable()`。

**HTML 樣板函式（Raymond 自己加的邏輯/版面分離）：**
- `buildStaffCardHTML(p)` — 人員卡 HTML（header + schedule-text-display + 貼上按鈕 + row-resizer）
- `buildRulerMarkHTML`、`buildGridLineHTML`、`buildTrackContainerHTML`、`buildFreeBlockLabelHTML`

**onclick 連接到 app.js 的函式（會在排班卡片/時段塊點擊時觸發）：**
- `updateStaffName`, `updateStaffRegion` — 卡片上的 input/select
- `openEditModal` — 點擊 `.schedule-text-display` 編輯班表
- `openTimeModal` — 點擊工作時段塊記錄上下工
- `copySingleAvailability` — 點擊房號/📋 複製空檔
- `initRowResize` — 列高拖曳

**維護重點：**
- 改班表格式判斷（例如想支援新日期格式）→ 改 `isDateLine` 正規式 + `parseTime`。
- 改任務解析 → 改 `renderSingleTrack` 和 `checkScheduleAlerts` 裡的兩個 match 正規式（**兩處都要同步改**）。
- 改提醒時機 → 改 `checkScheduleAlerts` 裡的 `preStartMins = startMins - 5`。
- 改空檔最小間隔 → `renderSingleTrack` 裡的 `gap >= 10`。

### `shop/shop_data/style.css` （已讀，19 KB，shop 模組樣式表）

**全站樣式唯一檔案**（office/weekly/roster 各自有內嵌 `<style>`，不共用這份）。

**CSS 變數（`:root`）：**
- `--primary-dark: #2c3e50` — 主深色（navbar、排班 top-bar）
- `--accent-green: #27ae60` — 綠色強調
- `--accent-blue: #3498db` — 藍色強調
- `--bg-light: #f4f6f9` — 淺背景
- `--safe-top: env(safe-area-inset-top)` — iOS 瀏海避讓
- `--in-out-color: #2ecc71` — 上/下工時間標記色
- `--conflict-color: #e74c3c` — 時段衝突紅
- `--manual-highlight: #8e44ad` — 手動標記紫

**版面骨架：**
- `body` — flex column, `height: 100vh`, `overflow: hidden`（全頁不滾，內部各區自己捲）
- `.nav-bar`（44px 深色）→ `.view-container.active`（flex: 1）
- `.schedule-top-bar.collapsed` — 排班頂部資訊列收合動畫
- `.main-wrapper` — 排班主體：`.left-panel`（人員名單 190px）＋ `.col-resizer`（10px 拖曳桿）＋ `.right-panel`（時間軌道）
- `.row-resizer` — 每列人員卡片底部的拖曳桿（調整列高）

**排班時間塊（核心互動）：**
- `.block.type-work` — 藍色工作塊
- `.block.type-free` — 綠虛線空檔塊（高度 24px 固定居中）
- `.block.type-conflict` — 紅色衝突塊
- `.block[data-in-time]:not([data-out-time])` — 已上工未下工：綠光暈外發光
- `.block[data-in-time][data-out-time]` — 完整上下工：綠邊框
- `::before` / `::after` — `data-in-time` 左半綠底、`data-out-time` 右半綠底（進度條效果）
- `.current-time-line` — 2px 紅色垂直線，z-index 40

**日結視圖：**
- `.summary-area` — CSS Grid，手機 2 欄 / 桌面 5 欄（768px 斷點）
- `#total_net_profit_card` — 藍底藍字突顯總淨利
- `.text-green/.text-red/.text-blue` — 金額配色
- `td[contenteditable="true"]` — 可編輯儲存格（淡黃底）
- `.service-list > .service-row` — 加值服務的膠囊 Tag 樣式

**Modal：**
- `.modal-overlay.active` — 顯示遮罩
- `.modal-content` — 最大 400px，`max-height: 90vh`
- `#timeModal` — 記錄上下工時間專用樣式
- `.btn-circle` + `.btn-green/.btn-red/.btn-blue` — 小圓按鈕

**周結視圖：**
- `.expense-grid` — Grid 4 欄（桌面）/ 2 欄（≤1024px）/ 1 欄（≤600px）

**Toast：**
- `#toast` + `#toast.show` — 由 `utils.js` 的 `showToast()` 控制

**地區分頁：**
- `.region-tabs` — 水平捲動容器
- `.region-btn.active` — 藍底白字

**手機版 RWD（`@media (max-width: 600px)`）：**
- nav-bar 變兩排（標題一排 + 功能按鈕一排）
- `.tab-btn, #emergencyWipeBtn { flex: 1 }` — 按鈕平分寬度（Raymond 特別註記「真正的完美等比縮放」）
- `.left-panel` 縮到 100px
- 字體、Modal、Block 統統放大

**維護重點：**
- 動色系就改 `:root` 變數。
- 新增手機版調整記得加進 `@media (max-width: 600px)` 區塊（底部）。
- `display: none` / `flex` 切換用 `.active` class 慣例（`.view-container`、`.modal-overlay`）。

### `shop/shop_data/security.js` （已讀，2.5 KB，網址白名單授權檢查）

**IIFE 立即執行**，在 shop.html 載入順序的第二個（`config.js` 之後）。防盜用途。

**白名單（authorizedDomains）：**
- `emineokur221105-spec.github.io` — Raymond 的主網址（GitHub Pages）
- `localhost`
- `127.0.0.1`

**比對邏輯：** `currentHostname === domain` 或 `endsWith("." + domain)`（允許子網域）。

**未通過時的反應：**
1. 用 `document.documentElement.innerHTML = ...` 清空整頁，顯示紅底「🚫 系統授權失效」畫面，秀出當前 hostname。
2. `window.stop()` 中止載入。
3. `throw new Error("Unauthorized Access Detected")` 中斷腳本。

**通過時的額外防護：**
- 禁用右鍵選單（`contextmenu` preventDefault）
- 禁用 F12（keyCode 123）
- 禁用 Ctrl+Shift+I、Ctrl+Shift+J、Ctrl+U（開發者工具、查看原始碼）

**維護重點：**
- 要換網址、加新 staging 網域，改 `authorizedDomains` 陣列即可。
- 這個防護只是「勸退等級」，懂的人 disable JavaScript 就繞過。
- **只有 shop.html 引用這個檔案**，其他頁面沒有授權檢查。

### `shop/shop_data/utils.js` （已讀，4.3 KB，共用工具函式庫）

**無相依**，被其他所有 shop JS 檔引用。全域函式（沒用 module，掛在 window）。

**時間相關：**
- `parseTime(str)` — 解析 `"13:30"` / `"1330"` / `"13.30"` 回傳「從 0 點起算的分鐘數」。**重要跨夜邏輯：時數 < 11 自動 +24**，因為營業 12:00~26:00（隔日 2:00），所以 "02:00" 實際代表第 26 小時。
- `formatTime(mins)` — 分鐘數 → `"HH:MM"`，>24 自動減 24 顯示。
- `formatDuration(mins)` — 分鐘數 → `"1h30m"` 顯示格式（小時或分鐘為 0 時省略）。

**任務識別：**
- `getTaskHash(rawText, startMinutes)` — 產生 `T{分鐘}_{前15字母數字}` 當任務 ID，用於去除非英數字元避免 DOM ID 問題。

**UI 提示：**
- `showToast(msg)` — 抓 `#toast` 元素，加 `.show` class 3 秒後移除。
- `getRegionColor(regionName)` — 查 `REGIONS` 陣列 index，循環套用 8 色調色盤（藍紫橘青紅灰黃綠）。查不到回 `#95a5a6`（灰）。

**通知與音效：**
- `ALARM_URL` — Google 音效庫的 `bugle_tune.ogg`（軍號聲）。
- `playLoudAlarm()` — 播警報 4 秒後自動停。
- `sendSystemNotification(title, body)` — 需先授權，`requireInteraction: true`（通知不會自動消失）。
- `requestNotificationPermission()` — 申請授權並播一次短音解鎖 iOS 音效限制。

**算錢參數橋接（核心）：**
- `getGlobalPricingTables()` — **從 DOM hidden input 讀算錢參數**回傳三張表。Key 格式 `"{分鐘}-{房間數}"`：`40-1`、`60-1`、`60-2`、`120-3`、`240-3`。
  - `globalCommTable` — 佣金（讀 `base_40_1` 等 input）
  - `globalCostTable` — 成本（讀 `cost_40_1` 等 input）
  - `globalWorkTable` — 工數（從 `WORK_UNIT_TABLE` 全域物件讀，fallback 1/1/1/2/3）

**維護重點：**
- 動時間相關邏輯一定要考慮 `parseTime` 的 +24 規則，否則早上時段會算錯。
- 算錢參數的 DOM input ID 是 `base_XX_X` / `cost_XX_X`，散在 shop.html 某處（應該是 hidden inputs），要配合看。

### `shop/shop_data/修改說明.txt` （已讀，注意：Raymond 說這是舊版本的說明）

這是 Raymond 當年寫給自己的門店模組維護指南，只涵蓋 `shop.html` + `shop/shop_data/` 這一塊，**沒提到** office / weekly / roster / settings 等其他頁面。

根據此說明，shop 模組的檔案分工如下（**待與實際代碼比對確認，可能已過時**）：

| 檔案 | 職責 | 何時會改 |
|------|------|---------|
| `config.js` | 設定檔 — Firebase 金鑰、服務項目價格、地區選單 (REGIONS)、工數對照表 (WORK_UNIT_TABLE)、阿姨加給名單 (AUNT_EXTRA_NAMES) | **最常改**，加服務、改價格、改地區都在這 |
| `settlement.js` | 日結算 — 所有算錢公式、拆帳邏輯、日結總表 LINE 報表格式 | 算錢不對、改報表格式時改 |
| `schedule.js` | 排班表 — 時間軸與格子的繪製、拖曳調整 | 格子位置歪、紅線不準時改 |
| `style.css` | 樣式 — 顏色、字體、邊框、手機 RWD | 純外觀調整 |
| `app.js` | 主程式 — 按鈕點擊事件、Modal 開關、Firebase 讀寫、分頁切換 | 按鈕沒反應、存檔頻率、切分頁邏輯 |
| `utils.js` | 工具箱 — 時間格式轉換、Toast 提示 | 幾乎不用動 |
| `shop.html` | 骨架 — 引用上述所有檔案 | 只有加新檔案或改 title 才動 |

**關鍵關鍵字（之後 grep 用）：**
- `copyDailyReport` — 日結報表複製函式（在 settlement.js）
- `calculateSettlement` — 算錢主函式（在 settlement.js）
- `REGIONS` — 地區常數（在 config.js）
- `WORK_UNIT_TABLE` — 工數對照（在 config.js）
- `AUNT_EXTRA_NAMES` — 阿姨加給名單（在 config.js）

---

## 待讀清單（依建議順序）

優先讀「骨架 + 設定」，再讀「商業邏輯」，最後讀「UI 細節」。

### 高優先（掌握整體架構）
- [x] ~~`index.html`~~ ✅
- [x] ~~`shop/shop_data/config.js`~~ ✅
- [x] ~~`manifest.json` + `manifest.js` + `sw.js`~~ ✅

### 中優先（各頁面職責）
- [x] ~~`shop.html`~~ ✅
- [x] ~~`office.html`~~ ✅
- [x] ~~`weekly.html`~~ ✅
- [x] ~~`roster.html`~~ ✅
- [x] ~~`settings.html`~~ ✅

### 低優先（實作細節，用到再讀）
- [x] ~~`shop/shop_data/app.js`~~ ✅ 48 KB
- [x] ~~`shop/shop_data/settlement.js`~~ ✅ 33 KB
- [x] ~~`shop/shop_data/schedule.js`~~ ✅ 22 KB
- [x] ~~`shop/shop_data/weekly.js`~~ ✅ 18 KB
- [x] ~~`shop/shop_data/style.css`~~ ✅ 19 KB
- [x] ~~`shop/shop_data/utils.js`~~ ✅ 4.3 KB
- [x] ~~`shop/shop_data/security.js`~~ ✅ 2.5 KB

**全部 18 個檔案皆已讀完並完整筆記。**

---

## Raymond 的長期目標

把這堆分頁整併成**一體式架構**。目前每頁各自獨立、資料散落，想慢慢改成統一。
維護時請留意：哪些是可以共用的邏輯（例如 Firebase 連線、共用 utils）、哪些重複代碼值得抽出。

---

## 🗂 快速索引（找不到時用這個）

### 遇到需求 → 改哪個檔

| 需求 | 主戰場 | 附帶要改 |
|---|---|---|
| 改錢（佣金/成本/工數/加給） | `settlement.js` `calculateSettlement` | 可能動 `config.js` 預設值 + `settings.html` 介面 |
| 改阿姨加給名單 | `settings.html` 阿姨帳規則卡片 → 寫入 `system_config` | 影響 `config.js` `AUNT_EXTRA_NAMES` |
| 改價格方案組合（加 50/2 等） | `app.js` `BASE_PARAM_KEYS` + `utils.js` `getGlobalPricingTables` | DOM hidden input IDs |
| 改排班格子/時間軸 | `schedule.js` `renderTracksOnly` / `createBlock` | `style.css` `.block` / `.track-row` |
| 改日結報表文字格式 | `settlement.js` `copyDailyReport` | - |
| 改日結 Excel 複製格式 | `settlement.js` `copyFullSettlementToExcel` | - |
| 改周結加總邏輯 | `weekly.js` `calculateAndRenderSummaries` | - |
| 改空檔複製文字（導流用） | `app.js` `copySingleAvailability` | 前標設定在 `regionPrefixes`（房間配置 Modal） |
| 改提醒時機（前幾分鐘警報） | `schedule.js` `checkScheduleAlerts` `preStartMins` | - |
| 改跨夜判斷（營業時間） | `utils.js` `parseTime` + `app.js` `getTodayDateStr` 的 `< 11` | - |
| 加新地區 | app 內按鈕 `addNewRegion`（即時） | - |
| 加新頁面/模組 | 新建 html + `index.html` 加按鈕 + `security.js` 白名單可能要看 | - |
| 改授權網址 | `security.js` `authorizedDomains` | - |
| 改密碼 | `app.js` `SYSTEM_PASSWORD` + `config.js` `systemPassword`（兩個獨立） | - |

### 核心資料流

```
[settings.html]
    ├─ localStorage.custom_firebase_config → Firebase 連線覆寫
    └─ db.ref('system_config').set({ password, pricing, work_unit, aunt, schedule, shareholders, expenses })
          │
          ▼
[shop.html + config.js loadSystemConfig()]
    └─ applySystemConfig() 覆寫 SYSTEM_CONFIG 預設值 + DOM hidden inputs

[app.js initSchedule()]
    ├─ db.ref('shop_v8_global_settings').once() → REGIONS/roomConfig/services/regionPrefixes/openHour/closeHour
    └─ switchDate(today) → db.ref('shop_v8_daily_schedules/{MM-DD}').on('value')
          │
          ▼
    使用者編輯（排班/日結/服務項目/個人參數/override 儲存格 ...）
          │
          ▼
    saveScheduleData() → db.ref('shop_v8_daily_schedules/{MM-DD}').update()
          │
          ▼
    toggleSettleLock() → pushDailySummary() → db.ref('shop_v8_daily_summaries/{MM-DD}').set(currentDailySummaryData)
          │
          ▼
[shop.html 周結 tab / weekly.js loadWeeklyData()]
    ├─ db.ref('shop_v8_daily_summaries').once() → 所有日結
    ├─ groupDatesByWeek() → 按週一為首日分組
    └─ 切換週次 → db.ref('shop_v8_weekly_expenses/{safeKey}').once() → 該週支出

[weekly.html（獨立頁）]
    ├─ db.ref('weekly_data/weeks/{ISO週}/sales') — 業績貼文原文
    ├─ db.ref('weekly_data/weeks/{ISO週}/status/{名字}') — 入帳勾選
    ├─ db.ref('weekly_data/accounts') — 銀行帳戶清單
    └─ db.ref('weekly_data/config') — 警語與日期區間
    ⚠️ 與 shop 的 shop_v8_weekly_* 節點是兩套系統，不相通

[office.html（獨立頁）]
    └─ db.ref('office_settlement_v8_dark') — { income, dateRange, expenses[], shareholders[] }

[roster.html（獨立頁）]
    └─ db.ref('roster/{pushId}') — { name, location, features, body, core, gift, packages, extra, status, sortIndex }
```

### 共用 JS 檔的載入順序（shop.html）

```
config.js → security.js → utils.js → schedule.js → settlement.js → app.js → weekly.js
```
改動時注意相依：後面的可以用前面的函式，反之不行。但實際上所有檔案的函式都掛 `window`，互相呼叫得到。

### 已知技術債 / 潛在陷阱

1. **Firebase SDK 兩套版本共存**（v8 compat vs v11 modular），分頁整合時要統一
2. **Firebase config 硬編碼在四個檔案**（shop 透過 config.js；office/weekly/roster 直接寫在 HTML）
3. **`openTimeModal` 重複實作了算錢參數表**，和 `utils.js` 的 `getGlobalPricingTables` 邏輯重複
4. **`SYSTEM_PASSWORD` 硬編碼在 `app.js` 開頭**，`config.js.systemPassword` 又是另一個（通常值一樣但來源不同）
5. **`manifest.js` 冗余**，和 `manifest.json` 一樣沒人用
6. **`shop_v8_weekly_state_v4` 節點**出現在 `emergencyWipe` 但沒看到有誰寫入（可能是舊版遺留）
7. **`weekly.html` 和 shop 周結 tab 資料結構不相通**（一個用 `weekly_data/*`，另一個用 `shop_v8_*`），整合時要抉擇合併策略
8. **`REGIONS` 變數在 `config.js` 宣告為 `[]`**，實際值從 `shop_v8_global_settings` 讀進來填入
9. **14 天自動清除**（`cleanupOldData`）要記得，但只清 `shop_v8_daily_schedules` 和 `shop_v8_daily_summaries`
10. **`isLocked` 鎖定才會 push 日結到周結頁**，忘記鎖就看不到當日資料

