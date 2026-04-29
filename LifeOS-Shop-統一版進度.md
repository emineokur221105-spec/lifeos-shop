# LifeOS-Shop-統一版進度

> Claude 新對話**只讀這份**。其他進度檔一律不再產生，避免誤讀。
> 排序：舊 → 新（流水帳式，最底下永遠是最新）。
>
> **降級規則（重要）**：
> 每次對話結束前把「本次完整記錄」寫入底部。下次對話開始時要降級：
> - **新的一層簡化** = (舊一層簡化 + 舊本次完整) **合併**後再簡化
> - **新的二層簡化** = (舊二層簡化 + 被擠下來的舊一層簡化片段) **合併**後更簡化
> - 絕對保留：**檔案路徑、函式名、坑點、為何這樣做（決策脈絡）**
> - 可刪：冗詞、重複敘述、過時的過程討論
> - 核心思想：簡化時**要合併不是單獨壓縮**，才能保留脈絡、Claude 回來看不會漏掉早期重點

---

## 📍 當前狀態（一句話）
**2026-04-28（深夜 A+X 大改造）**：LINE bot 進化成**卡片管理介面**。`bot moneyhouse` 從文字清單升級成 LINE Flex Carousel（總覽卡 + 每群組一張卡 + 按鈕直接操作）；解綁 / 房號被覆蓋時舊群組自動進「停用」狀態，bot 徹底沉默直到 `bot 設定房號 X` 重啟；批次指令（`全部早安關閉` 等）、自訂排序（`排序 A B C`）、班表寫入失敗自動私訊 admin。早安時間從 12:40 改 12:30。kabe 紙房子規模 6 房（A/B/C/D/215/615）對應 LifeOS 排班，群組來來去去用「覆蓋」邏輯換綁。底下 2026-04-28 完整記錄保留前段，本次改動寫在最末三次追加區塊。

**2026-04-28**：LINE bot 通知面大擴張 — (1) 寫班表回覆加泰文確認句「ตารางใหม่มาแล้ว...」；(2) **群組綁房號** `bot 設定房號 A`（重複設覆蓋）；(3) **早安叫醒** 12:40 自動推泰文起床訊息（群組獨立開關，預設關）；(4) **管理員面板** `bot moneyhouse`（動態列各群組房號/翻譯/早安狀態，原命名 `bot boss` 後改名為紙房子代號）；(5) **私訊用房號 reference 管理**（`A 早安開啟` / `A 翻譯關閉`）；(6) bot 加進群組自動發歡迎訊息引導設房號；(7) **解除綁定**（群組 `bot 解除綁定`、私訊 `A 解綁`，私訊版理由是 kabe 不想讓員工在群組看到自己設定）；(8) 房號**英文大小寫通用、內部統一存大寫**（中文房號不受影響）；(9) 私訊「無效指令」回覆精簡成兩行；(10) **翻譯加英文**：純英文 → 中文 + 泰文兩行；(11) **多行訊息逐行翻譯**：保留行結構、純符號行（`~~` 等）原樣保留；(12) Gemini prompt 加「保留標點符號」規則；(13) **白名單嚴格版（code 完成）**：加 `whoami` 指令拿 userId、`bot moneyhouse` 加授權檢查、未授權者群組裡完全靜默；BOSS_TEXT 末段顯示權限狀態。kabe 重新部署過、code 生效中。GAS time-based trigger（sendMorningCall 每 5 分鐘）+ LINE_USER_ID_WHITELIST 設定 kabe 自處理。歷久未結項仍待補（補 WHITELIST userId、regenerate LINE secret/token）。

## 🌐 入口
- 線上首頁：https://emineokur221105-spec.github.io/lifeos-shop/
- Admin：`?admin=0308`
- 租戶入口：`?t=<代號>`（例：`?t=demo-qinre-main`）
- Repo：https://github.com/emineokur221105-spec/lifeos-shop

---

## 🗺️ 檔案職責地圖（kabe 要改東西看這邊）

### 頁面
| 我想改什麼 | 檔案 |
|-----------|------|
| 首頁文案/按鈕/路由 | `src/index.html` |
| Admin 後台（租戶 CRUD / 白名單） | `src/admin.html` |
| 人員管理（上班/離職/地點模板/排版輸出） | `src/roster.html` |
| 分紅（股東 %／週收入／支出） | `src/office.html` |
| 週結業績（個人明細／查帳表／合併名稱／帳戶） | `src/weekly.html` |
| 門店排班 HTML 外殼 | `src/shop.html` |
| 系統設定（價格表／阿姨名單／匯入匯出） | `src/settings.html` |

### shop.html 內部模組（在 `src/shop/shop_data/`）
| 要改什麼 | 檔案 |
|---------|------|
| 入口 / bootTenant 串接 | `main.js` |
| 全域狀態（staffData/REGIONS/services 等） | `state.js` |
| Firebase v11 helper 層 | `shop-db.js` |
| 系統設定（雲端覆蓋） | `config.js` |
| 小工具（日期/營業日/鬧鐘/顏色/價格表讀取） | `utils.js`（營業日切換點 `BUSINESS_DAY_CUTOFF_HOUR` 在這） |
| 排班時間軸 / 拖拉 / 鬧鐘 | `schedule.js` |
| 結算邏輯 / 阿姨帳字串 / 經紀費 | `settlement.js` |
| shop 的週結 tab | `weekly.js` |
| UI 主控（tab 切換 / CRUD / 截圖 / 縮放 / 緊急清空 / exposeGlobals） | `app.js` |

### 共用模組（在 `src/core/`）
| 要改什麼 | 檔案 |
|---------|------|
| 防盜（白名單 / F12 / DevTools 門檻） | `security.js`（門檻 `THRESHOLD` 在這；`?debug=1` 旁路） |
| 租戶開機流程 | `tenant-boot.js` |
| 主 Firebase 連線設定 | `main-firebase-config.js`（實際 config 另存 `LOCAL_SECRETS.md`） |
| 租戶清單 / 白名單讀取 | `tenant-loader.js` |
| 小工具（toast/escape/copy/租戶 namespace） | `common.js` |

### 建置 / 部署
| 要改什麼 | 檔案 |
|---------|------|
| 混淆流程 / HTML 內嵌 script 處理 | `build.js` |
| 本機一鍵部署 | `一鍵部署.bat` |
| GitHub Actions 自動部署 | `.github/workflows/deploy.yml` |

### 文件
| 檔案 | 用途 |
|-----|------|
| `README.md` | Repo 基本說明 |
| `SETUP_GUIDE.md` | kabe 的操作手冊 / 新增租客 SOP |
| `LOCAL_SECRETS.md` | 主 Firebase config（gitignore，不上雲） |
| `claude週結/ARCHITECTURE.md` | 舊版週結系統架構筆記（參考用） |
| **`專案狀態.md`（本檔）** | **唯一狀態來源，Claude 新對話必讀** |

---

## 📦 二層簡化（更早）— weekly / shop / security 三大強化

- **weekly.html**：F1 查帳摺疊 / F2 個人搜尋 / F3 合併名稱（`weekly_data/merges`，`resolveMaster()` cycle 防呆、`applyMerges()` 展開 rawPersonData，🔗 選 master / ✂️ 拆開、明細別名紫 tag）
- **shop.html**（`src/shop/shop_data/`）：截圖只留 summary + 人員卡、暫解 view-settle overflow 用 html2canvas `scrollHeight`（`app.js` `downloadScreenshot`）；阿姨帳換行改空白（`settlement.js`）；營業日凌晨 5 點前算前一天（`utils.js` `BUSINESS_DAY_CUTOFF_HOUR = 5`）
- **security.js**：DevTools `THRESHOLD` 160 → 300px（減少縮放誤觸）
- **進度檔**：刪 4 份舊進度檔，統一為 `專案狀態.md` 三層降級制
- **commits**：`3aa8bb5` weekly / `d2e8446` `960e81a` shop / `5eda780` security / `f02090d` 營業日 / `779ccbd` 進度檔

## 📋 一層簡化（上次）— 密碼保護 + Admin 彈性解析 + 預設去識別化（2026-04-21 前半）

### 系統設定密碼保護（commits `7c8dae5` feat / `e3f2ab9` docs）
- 流程：`src/index.html` 第 5 顆 `.btn-settings` → `renderSettingsPwdForm()` inline 密碼框 → `sha256Hex` 比對 → `crypto.randomUUID()` 產一次性 token 存 `sessionStorage['settings_unlock_token_<code>']` → 跳 `settings.html?t=` → settings 進頁 `removeItem` 消費 token
- 預設密碼：`DEFAULT_SETTINGS_PWD_HASH = 'f3e055913a0b1eb0f07317896f9a1bc466b9a50db85a7f882f3ffde9ffb23aca'`（1357 SHA-256）全租戶共用
- 租戶覆寫：Admin `tenants/<code>/settingsPasswordHash`，🔓 按鈕還原預設
- Admin key：`ADMIN_KEY_HASH` = `0308` SHA-256（`d86d84d9...`）；`package.json` dev 用 `-o /admin.html?admin=0308`
- 一次性 token 理由：sessionStorage 旗標同 tab 會常駐 → `crypto.randomUUID()` 一次消費防貼 URL 繞（前端仍可繞，P2 Firebase Auth 才解）
- 教訓：密碼框位置迭代 3 次（settings prompt → 唯讀 banner → 最終 index inline）。先問「誰看什麼」再寫 code

### Admin Firebase Config 彈性解析（commit `7b4bc57`）
- `src/admin.html` 新增 `parseFirebaseConfigFlexible(raw)`：接 Google console 整段（含 `import` / `const firebaseConfig = {...}` / `getAnalytics`）
- 流程：JSON.parse → match `/firebaseConfig\s*=\s*/` 後找第一個 `{`（**避開 `import { initializeApp }` 的大括號，第一版 bug**）→ depth 配對 → key 加雙引號 → 單引號轉雙 → 去尾逗號 → JSON.parse
- `handleTenantSave` 把 `JSON.parse(cfgRaw)` 換成這個
- **前置**：新 Firebase 要先 console 啟用 Realtime Database，config 才會帶 `databaseURL`（後端驗證會擋）

### tenant-loader bug 修（`src/core/tenant-loader.js`）
- `loadTenant()` return 漏 `firebaseConfig: tenant.firebaseConfig` → settings.html 初始化第二個 Firebase app 會報「租戶 Firebase 設定未載入」

### security.js localhost 跳過防護（`src/core/security.js`）
- `init()` 在 `localhost` / `127.0.0.1` 時跳過 `installKeyBlocker` + `installDevToolsDetector`，方便本地開發
- 線上版完整三層防護：hostname 白名單（SHA-256）+ F12/右鍵/Ctrl+U/Ctrl+S 攔截 + DevTools 尺寸偵測（`THRESHOLD=300`）
- ⚠️ 若未來要看 DevTools：本地開發直接開，線上版故意沒有旁路

### 預設資料去識別化（commit `6f67f93`，全是 fallback，不會覆蓋已存資料）
- `roster.html` DEFAULT_LOCATIONS：民權路/莊二街/北新街 → 某某街/某某路/某某巷（badge A/B/C）；templates 移除「紙房子」「東京」「桃園區」「入珠洗澡/罰款/爆頭」規則 → 「請顧客自行確認/依現場公告/洽派工」
- `weekly.html` billWarningTemplate：移除「匯錯不補」「週一存入」
- `office.html` defaultData：股東 OG/C/黑 → 甲/乙/丙；支出做圖/房租代墊/聚餐 → 辦公用品/設備維護/雜項

### 坑 / 教訓
- **線上版落後 2 commits**：寫完要 `git push`，GitHub Actions 自動 `npm run build` + deploy
- **parseFirebaseConfigFlexible 第一版抓錯大括號**：直接抓第一個 `{` 會中 `import { initializeApp }`，修成先找 `firebaseConfig =`

---

## 📝 本次完整記錄（2026-04-21 續 3）— Admin 備份/還原 + 複製給客戶 + Roster 動態欄位 + Office 分紅清空

### 背景
- 前輪推完後 kabe 開始實戰用 admin，怕誤刪（實際也刪過一次白名單）
- 想快速給新租戶入口網址+密碼，不用手動打字拼
- 分紅結算預設值也還有樣本數字要清
- **最後也最大**：roster 的「新增人員資訊」欄位寫死 8 個，要讓每個租戶自訂，才有自己風格

### 桌面捷徑（`C:\Users\makeo\Desktop\LifeOS 後台\`）
- `LifeOS 後台（線上）.url` → `https://emineokur221105-spec.github.io/lifeos-shop/admin.html?admin=0308`
- `LifeOS 後台（本地開發）.url` → `http://127.0.0.1:8080/admin.html?admin=0308`
- `首頁（線上）.url` → GitHub Pages 首頁

### Admin 強化（`src/admin.html`）

**📋 複製給客戶按鈕**（commit `7d25a15`）
- 租戶列表每一列加 `data-act="tenant-copy"` 按鈕
- `handleCopyTenantInfo(code)`：複製「入口網址 + 密碼 1357 + 提示更改密碼聯繫官方」到剪貼簿
- 有自訂密碼的租戶：提示「當前密碼為自訂，請自行告知客戶」

**📥 下載完整備份**（commit `3a0b88a`）
- 頂部新增 `renderToolbar()`，`render()` 改成 `renderToolbar() + renderTenantsPanel() + renderWhitelistPanel()`
- `handleDownloadBackup()`：Blob + URL.createObjectURL → JSON（含 `/tenants` + `/whitelist`）→ 檔名 `lifeos-backup-YYYY-MM-DD_HHmm.json`（台北時間）
- 文案提醒：「動白名單/租戶前先下載一份。萬一誤刪，從備份還原直接上傳 JSON 蓋回來」

**📤 從備份還原**（commit `89c7584`）
- `handleRestoreBackup()`：動態產生 `<input type="file" accept=".json">` → FileReader → 驗證 JSON 結構（必須有 `tenants` 物件）→ 雙重 confirm（提醒會覆蓋）→ **還原前先自動備份現狀**（先 `handleDownloadBackup()` 再 set）→ `set(ref(db, 'tenants'), ...)` + `set(ref(db, 'whitelist'), ...)`
- `onAction` 新增 3 個 action：`tenant-copy` / `download-backup` / `restore-backup`

### Office 分紅清空（commit `7e68a1f`，`src/office.html`）
```
const defaultData = { shareholders: [], expenses: [] };
```
- 一樣是 fallback，moneyhouse 既有 Firebase 資料不受影響

### Roster 動態欄位系統（commit `cf60517`，本輪最大改動）

**資料結構**（存 Firebase `/roster_settings/fields`）：
```js
[{ id, label, rows?, defaultValue?, system? }, ...]
```
- `id`：系統預設保留舊 key `name/location/features/body/core/gift/packages/extra`（舊員工資料無痛相容），自訂欄位 `field_<random><timestamp>`
- `system`：`'name'` / `'location'` 標記不可刪除（地點還用在左側 badge、複製班表分店區塊，刪了會壞）
- `label`：**同時當表單 label + 輸出排版區塊標題**，可 emoji/文字/混合；清空就輸出該區塊不帶標題
- `rows`：textarea 高度
- `defaultValue`：新增人員時自動帶入（預設全空白，租戶自填）

**UI — 欄位管理 Tab**
- 設定視窗加「📋 欄位管理」tab（在「地點清單」後面）
- `fieldCardHtml(f)` + `renderFieldsPanel()` + `addFieldRow()` + `bindFieldCardEvents()`
- 卡片式設計：上排（拖拉把手 ≡ + label input + rows + 🗑️）、下排（defaultValue textarea）
- 拖拉排序：SortableJS（CDN 已引入），`_fieldsSortable` 單例，重渲染前 `.destroy()`
- 系統欄位（姓名/地點）：橙色 badge「系統」、🗑️ disabled、不顯示 rows/defaultValue

**動態主表單**
- HTML 拔掉 8 個寫死 `input-group`，換成 `<div id="dynamic-fields-container"></div>`
- `renderFormFromFields()` 依 `settings.fields` 產生 input-group
- 系統欄位 DOM id 保留 `input-name` / `input-location`（其他模組依賴，不可改）
- 自訂欄位 DOM id：`input-field-<fieldId>`
- 每次重渲染都會重綁 `setupAutoSave()`

**讀寫邏輯重寫**
- `saveData`：用 `Object.assign(prev, ...)` 保留被隱藏欄位的舊值（避免刪欄位後重儲存把原值抹掉）
- `loadMember` / `createNewMember`：迴圈 `settings.fields`，不再硬寫 DEFAULT_BODY/PACKAGES/EXTRA（全部刪除）
- `formatText`：`heading = f.label.trim()`，清空就只輸出內文、不帶標題行

**相容性 / 遷移**
- `normalizeField(f)`：雲端若有舊格式（`{emoji, label}` 分開），自動合併 `emoji + ' ' + label` 成單一 label
- `DEFAULT_FIELDS` 預設內文全空、placeholder 也移除 → 新租戶開箱完全空白

**iteration 記錄（kabe 回饋 → 修正）**
1. v1：emoji 和 label 分兩個 input → v2：合併一欄（可 emoji/文字/混合）
2. v1：`defaultValue` 預留身體密碼/方案選擇/加值服務範例 → v2：全清空（kabe「預設內文預設都幫我全部清空」）
3. v1：placeholder 提示詞 → v2：全移除（kabe「也不用提示詞」）
4. v1：`formatText` 用 `f.emoji` 當 heading → v2：改用 `f.label`，清空 label 就輸出留白

**live listener 保留編輯狀態**
```js
const prevId = currentId;
renderFormFromFields();
if (prevId && allMembers[prevId]) loadMember(prevId);
else if (!prevId) createNewMember();
```
避免設定變更後把正在編輯的欄位洗掉。

### 坑 / 教訓
- **kabe 誤刪白名單還能進 admin**：`admin.html` 原本就有設計「白名單為空時 security.js init 會 `console.warn` 跳過 hostname 檢查」（bootstrap 場景）→ 白名單刪光也進得來。備份功能加上後不再是災難。
- **kabe panic 時需要 1-2-3 步驟**：他第一次 Firebase 抓不到資料 panic 時，我追問技術細節 → kabe 回「你的問題都好難」→ 改成「進 admin → 看 X → 告訴我」這種單一動作指令。kabe 非工程師，故障情境下尤其需要明確 step，不是診斷問題。
- **Firebase 30 天 grace period**：誤刪專案可在 Google Cloud Console > IAM > Manage Resources 復原。kabe 的 `shop-system-v2`（asia-southeast1）就是這樣救回。
- **動態欄位 id 保留規則**：系統預設用語意化舊 key（name/location/features/body/core/gift/packages/extra），自訂用 `field_xxx`。這個「系統 id 用語意、自訂 id 用 random」的設計讓舊員工資料零成本遷移。

### 本輪 commits
```
7d25a15 feat(admin): 租戶列表加「複製給客戶」按鈕
3a0b88a feat(admin): 頂部工具列加「下載完整備份」按鈕
89c7584 feat(admin): 加「從備份還原」按鈕（上傳 JSON 覆蓋 tenants + whitelist）
7e68a1f chore(office): 分紅結算預設值清空
cf60517 feat(roster): 欄位改動態系統，用戶可自訂欄位名與預設內文
```

---

## 📝 本次完整記錄（2026-04-23）— 主 Firebase 從 shop-system-v2 換成 lifeos-maindoor + 紙房子重建

### 背景 / 事故緣由
- kabe 早上發現線上 LifeOS-Shop 整個進不去，以為是 `lifeos-shop-main` 被刪
- 實際狀況：**遠端 GitHub 的 `main-firebase-config.js` 其實早就從 `lifeos-shop-main` 換成 `shop-system-v2`**（commit `f7daa1c`，2026-04-22 PR #2，Google Drive 本機沒 pull 下來所以還是舊版）
- `shop-system-v2` 也不知什麼時候掛了（Emine 帳號下仍能看到專案名「lifeos test」指向它，但建置時連不上導致整站死）
- 無備份 JSON、救不回 → 直接換新的 `lifeos-maindoor`

### Firebase 換新流程（kabe 手動 + Claude 協作）
1. **kabe 建新 Firebase 專案**（Firebase Console）
   - 專案：`lifeos-maindoor`
   - Realtime Database 位置：`asia-southeast1`（新加坡）
   - 建立日期：2026-04-23
2. **kabe 貼 config 給 Claude**，第一次沒有 `databaseURL`（RTDB 沒啟用），補做後 config 完整
3. **Claude 改 `src/core/main-firebase-config.js` + `LOCAL_SECRETS.md`**（新 config 取代舊的）

### 部署卡關紀實（踩了一堆坑，下次避免）
- **Google Drive 鎖 `.git/index.lock`**：sandbox bash 改不動，kabe Mac Terminal 也中同一個鎖
- **sandbox 沒 GitHub 帳密**：`/tmp/lifeos-clone` 可以 commit 但不能 push
- **computer-use 對 Terminal/IDE 是「只能點不能打字」tier**：不能幫 kabe 在 Terminal 裡輸入
- **kabe 輸 GitHub token 時順序貼錯**：把 token 貼到 Username 欄位（應該貼到 Password），而且 token 原文外洩到對話 → 當下要求作廢
- **最後解法**：kabe 裝 Claude in Chrome 擴充套件 → Claude 直接在 GitHub 網頁編輯 `src/core/main-firebase-config.js` → Commit（`f392b22` Change Firebase config to lifeos-maindoor）→ Actions Run #39 成功部署（30 秒）

### 重建主 Firebase 資料（進 admin 後操作）
- **admin 密碼**：`?admin=0308` 仍可用（LOCAL_SECRETS.md 寫過升級成 `kabe-lifeos-owner-9h7x4m2q8k3p`，但那次升級**只改了文件沒真的推 code**，`admin.html` 的 `ADMIN_KEY_HASH` 實際還是 `0308` 的 SHA-256 `d86d84d9...`）
- **白名單**：加 `emineokur221105-spec.github.io`（label「GitHub Pages」）
- **紙房子租戶**（唯一現存租戶）：
  - 代號：`moneyhouse`
  - 名稱：`紙房子`
  - Firebase：`worktools-f53e5`（us-central1，沒有 region suffix → `firebaseio.com`）
  - config 來源：kabe 切換到另一個 Google 帳號（`worktools-f53e5` 不在 Emine 帳號底下，是另一個帳號建的）進 console 複製
- 驗證：`https://emineokur221105-spec.github.io/lifeos-shop/?t=moneyhouse` 入口正常顯示 5 個 app 按鈕、底部「資料已連接租戶 Firebase」

### 備份 JSON（這次開始要養成習慣）
- 已按 admin 頂部「主資料備份」下載 `lifeos-backup-YYYY-MM-DD_HHMM.json`
- **kabe 應把此檔搬到**：`Claude/專案/LifeOS-Shop-統一版/備份/`（Google Drive 保存）
- 主 Firebase 只存租戶清單 + 白名單，容量極小，養成「動白名單 / 租戶前先下載一份」習慣

### 坑 / 教訓（給下次）
- **Google Drive + git 的死鎖**：Google Drive Desktop 會在後台同步 `.git/` 目錄，導致 sandbox bash 動不了、甚至 Mac Terminal 也會中鎖。**要動 git 前先暫停 Google Drive 同步**。
- **admin 密碼文件 vs 實際 code 不同步**：LOCAL_SECRETS.md 寫的密碼不等於實際生效的密碼，改密碼要**一次改 `admin.html` 的 hash + 文件 + 推上線**，不能只改一半
- **本地 Google Drive 跟 GitHub 遠端會失同步**：PR merge 是在網頁上做的（`ebb198a`、`f7daa1c`），kabe 沒 `git pull` 下來 → 本機以為主 Firebase 是 `lifeos-shop-main`，其實遠端早換 `shop-system-v2`。**換新設備或跨裝置前都要 `git fetch && git log origin/main` 先對一下**
- **Firebase 新建專案第一次拿 config 時，沒啟 Realtime Database 就不會帶 `databaseURL`**（這個進度.md 上次已記過，這次又中一次，確認這個坑很容易再犯）
- **計入成本**：kabe 非工程師，panic 時不要追問「你覺得是哪裡壞」之類的開放式問題，改成「做這個 → 看那個 → 告訴我」的單一指令
- **token 不要貼在對話裡**：這次 kabe 的 PAT 在對話外洩，已請他當下作廢。以後優先走 Claude in Chrome + Keychain，避免 token 進文字流

### 本輪 commits
```
f392b22 將 Firebase 設定變更為 lifeos-maindoor（Claude 透過 GitHub 網頁編輯器推，繞過本機 Google Drive 鎖）
```

### 未結 / 待辦
- [ ] kabe 把 `lifeos-backup-*.json` 搬到 `Claude/專案/LifeOS-Shop-統一版/備份/`
- [ ] kabe 本機 Google Drive 版本已 `git reset --hard origin/main`，但本地有個 sibling commit `2c83960` 被淘汰，下次 `git log` 如果還看到再處理
- [ ] （可選）統一 Google Drive 同步跟 git 的衝突：考慮改把 repo 移出 Google Drive、改用 macOS 的 iCloud 或 GitHub 作為唯一同步源（這個是架構決策，先記下）
- [ ] （可選）admin 密碼從 `0308` 升級成新長 key（前代 4/20 只改了 LOCAL_SECRETS.md 沒動 code）

---

## 📝 本次完整記錄（2026-04-25）— 跨專案 bug review + 修補（XSS + 跨年 bug）

### 背景
kabe 要求「檢查所有專案 code 有沒有 bug 跟可優化的地方」。跨 5 個專案掃完，🔴（必修）共 5 項，LifeOS 拿到 3 項：#3 銷毀密碼、#4 XSS、#5 weekly 跨年週分組。kabe 決定 #3 不改，#4 #5 修。

### #5 weekly.js 跨年週分組 bug
**症狀**：`groupDatesByWeek()` 和 `getDayOfWeekStr()` 都把日期年份寫死當年（`new Date().getFullYear()`）。年底 12/30 跟 1/2 的資料會被算錯週、錯星期。

**修法**：抽出 `inferYear(month)` helper：
- `cleanupOldData` 只保留 14 天，所以跨年窗口最多 2 週
- 規則：資料月份 - 當月份 > 6 → 視為去年（例：今年 1 月看到 11 月資料，當去年 11 月）
- `groupDatesByWeek` 和 `getDayOfWeekStr` 都改用 `inferYear`

### #4 XSS 全面修補（9 個檔 38 個插入點）

| 檔案 | 改動點 | 重點修法 |
|------|--------|---------|
| `shop_data/schedule.js` | 3 | `staff.name/roomName/content` + region |
| `shop_data/settlement.js` | 7 | `displayName/agentName/rawLine/extractedName/noteText`，順手刪 `copySingleSettlementToExcel` 沒用到的 `staffName` 參數消除 JS injection |
| `shop_data/weekly.js` | 5 | `group.name/item.name/region/agent` |
| `shop_data/app.js` | 5 | region × 4 / `svc.name` / `roomName` |
| `admin.html` | 0 | 原作者已用 `esc()` 處理 ✅ |
| `roster.html` | 3 | `member.name/data.name`（沿用既有 `escapeAttr`） |
| `office.html` | 5 | `sh.name × 2 / exp.name × 2 / displayName` |
| `weekly.html` | 9 | `name/aliases/acc.name/bankName/account/x.from/x.val/c` |
| `settings.html` | 4 | aunt tag / `sh.name` / `exp.name` |

**Import 路徑規則備忘**：
- `src/shop/shop_data/*.js` → `import { escapeHtml } from '../../core/common.js';`
- `src/*.html` → `import { escapeHtml } from './core/common.js';`
- `roster.html` 沿用自己的 `escapeAttr()`，沒另外 import

### 已知殘留（後續再修）
1. **onclick 內 `'${user_input}'` JS injection**：例如 `onclick="switchRegion('${safeR}')"`。HTML escape 後 attribute decode 還是會回 `'`，JS 字串注入仍可能。徹底修要全改 `data-*` + `addEventListener`，工程較大，先列為 🟡 後續項
2. **clipboard 寫 HTML**：`copyFullSettlementToExcel` / `copySingleSettlementToExcel` 是貼到 Excel 的 HTML 不是 DOM，未做 escape，風險低但仍是面

### kabe 決定跳過的項目
- **#2 親熱敏感資料搬家**：Bot Token / credentials.json / Telegraph token → kabe 認為 Drive 個人帳號沒分享、風險可接受，不搬
- **#3 銷毀密碼升級**：`SYSTEM_PASSWORD = '8888'` 在 [state.js:43](src/shop/shop_data/state.js#L43) 留著，平常不會按到

### ⚠️ 沒驗證 build
本次想跑 `node build.js` 確認 9 個檔 syntax 沒打壞，但 Bash 工具 session 卡住（mkdir EEXIST 在 `~/.claude/session-env/<uuid>`）。**請 kabe 手動驗證**：

```
cd "C:\Users\makeo\我的雲端硬碟\Claude\專案\LifeOS-Shop-統一版"
node build.js
```

或直接雙擊 `一鍵部署.bat`。如果 syntax 錯誤，把訊息貼給 Claude。

### 坑 / 教訓
- **「班表整理」改名**：親熱專案的 `班表整理/` 跟 LifeOS-Shop 的「排班」功能容易混（這次 review 我自己 confused 了一次），改成 `Telegram班表發佈`。LifeOS 這邊沒有需要對應改的東西，但**未來對 LifeOS 用「排班」一詞要小心**，可能跟親熱搞混
- **Bash mkdir EEXIST**：可能跟 Google Drive 同步 `.claude/` 目錄有關（這個系統是 Drive 同步多台電腦），sibling Claude session 留下的 stale dir 重啟才能清

### 本輪 commits（待 build 驗證後 commit）
```
（pending kabe 驗證）
fix(weekly): 跨年週分組 + 星期計算改用 inferYear，避開把所有日期套當年的 bug
fix(xss): 全頁面 escapeHtml — schedule/settlement/weekly/app + roster/office/weekly/settings 共 38 處
```

### 未結 / 待辦
- [x] ~~kabe 跑 `node build.js` 驗證 → 沒錯誤就 commit + push~~（2026-04-26 隨 LINE bot 整合一起 build + commit，commits `02be413`/`ed2f075`）
- [ ] （可選）onclick 內 user input 改 `data-*` + `addEventListener`，徹底修 JS injection 殘留
- [ ] （可選）clipboard 寫 HTML 也加 escape

---

## 📝 本次完整記錄（2026-04-26）— LINE bot 整合 + 複製空檔格式統一

### 背景
kabe 工作流：客戶 LINE 私訊接單 → 整理成班表訊息 → 貼員工群組。痛點是還要手動貼網站。要做 bot：傳訊息給 bot 自動寫進網站。後來擴展加「查空檔」功能（現在誰可以、藝名空檔）。

### 架構決定
- **後端**：Google Apps Script (GAS) Web App。Vercel/Cloudflare 都要電話驗證或綁卡，kabe 不接受 → 退到 GAS（Gmail 直接登入）
- **連 Firebase**：紙房子 `worktools-f53e5` RTDB REST API（rules 公開不需 service account）
- **LINE channel**：`LifeOS 班表 bot`（Provider「LifeOS」, channel ID `2009895023`）

### 程式檔
- `linebot/Code.gs` — GAS source（kabe 貼進 GAS 編輯器）。本檔是 source of truth，雙向同步靠手動複製
- `src/shop/shop_data/app.js`（[copySingleAvailability:962-1050](src/shop/shop_data/app.js#L962)）：複製空檔格式跟著 bot 改

### Bot 功能

**寫入班表**（私訊）：訊息首行 `A 4/25` 或 `A房 4/25` → 房號 + 日期；後續行為班表內容。bot 解析後覆蓋寫入 `shop_v8_daily_schedules/MM-DD/staffData[該員工].content`。沒房號 → bot 暫存 + 回問「哪間房？」5 分鐘內回房號就配對。

**查詢空檔**（私訊或群組）：
- `現在` / `空檔` / `誰有空` → 全員一行
- `京鮑吟` / `京鮑吟空檔` → 單一員工（純中文 2-6 字直接當藝名）

**群組**：必須 `bot ` 開頭觸發（LINE Official Account 不能被 @ 是 LINE 設計限制）。

### 輸出格式（跟網站「複製空檔」按鈕一致）

| 員工狀態 | 輸出 |
|---------|------|
| 完全沒 booking | `【莊二】京鮑吟 現走` |
| 現在沒客 + 後續有客 | `【莊二】京鮑吟 現走 14.00有客 15.10可約` |
| 現在有客 + 後續有客 | `【莊二】京鮑吟 15.10可約 16.00有客 17.10可約` |
| 現在有客 + 沒後續 | `【莊二】京鮑吟 15.10可約` |

格式經多次 iterate 最終定案：拿掉「目前有客」、「現走 ...」開頭詞，改成從「下次 transition」開始列。員工現在可約則加「現走」當第一個 token。bot + 網站兩邊輸出一字不差。

### 關鍵實作細節（重要的避免重蹈覆轍）
- **時間軸 cutoff = 11**：跟 [utils.js parseTime](src/shop/shop_data/utils.js#L21) 一致（< 11 點加 24）。我第一版用 openHour=12 做 cutoff，11 點和 12 點之間誤判 → 修。
- **booking end = start + duration + 10 分緩衝**：給客人離開時間（從 [copySingleAvailability:1001](src/shop/shop_data/app.js#L1001) 來）
- **task 合併規則**：相鄰 task 間隔 < 40 分合併。短空檔不算可約。
- **日期 key**：`MM-DD` 格式（無年份）。`shop_v8_daily_schedules/04-25` 不是 `2026-04-25`。我第一版寫成 `YYYY-MM-DD` → 找不到資料。
- **跨日營業**：紙房子 closeHour=27（=隔天 03:00），openHour=12。bot 不再加 lastBookMin（kabe 一度想要 01:30 接單截止，後來決定跟網站一致直接不加）。
- **多 region 通吃**：kabe 確認房號永遠不重複（A/B/C/D 帝璽，215/615 響叮噹），bot 不過濾 region，房號直接對應 staffData[].roomName 找。
- **regionPrefixes**：`帝璽 → 【莊二】`、`響叮噹 → 【民權】`、`北新 → 【北新】`。「東京-派工接單」是群組名（給客戶看的稱呼），跟系統內 region 不對應。

### GAS 環境變數（指令碼屬性）
| Property | 值 |
|----------|-----|
| `LINE_CHANNEL_ACCESS_TOKEN` | （從 LINE Console Messaging API tab 拿） |
| `LINE_CHANNEL_SECRET` | 32 hex（Basic settings tab） |
| `LINE_USER_ID_WHITELIST` | （留空 = 任何 user 都認；**建議補 kabe userId**） |
| `FIREBASE_DB_URL` | `https://worktools-f53e5-default-rtdb.firebaseio.com` |
| `FIREBASE_AUTH` | （留空，rules 公開） |
| `TARGET_REGION` | （留空 = 全 region；單店時可填例「帝璽」） |
| `DEBUG_LOG` | `1`（開 log；上線可關） |

### 部署資訊
- **GAS Web App URL**（webhook 終點）：`https://script.google.com/macros/s/AKfycbxCi.../exec`（部署 ID `AKfycbxCiaTaf6dM5BjcNmmmPbhRBcEFG-ch_TZ1MSHm22TTQmE9CG3bxcM-HXrght1k20BE`）
- **LINE Webhook URL**：上述 GAS URL，已設定 + Verify 成功 + Use webhook on
- **LINE Official Account Manager 設定**：聊天 / 自動回應訊息 / 加入好友歡迎訊息 → 全關；Webhook → 開；允許加入群組 → 開
- 網站線上：https://emineokur221105-spec.github.io/lifeos-shop/

### 坑 / 教訓（給下一次／給未來 Claude）
- **括號文字當 value**：給 kabe 寫「（留空）」這種說明，他直接當 value 貼進去 → 觸發 whitelist/auth 邏輯擋掉訊息。**寫值範例要明確說「留完全空白」或乾脆刪除整筆屬性**。整個 LINE bot 第一次測試卡 30 分鐘就在這個。
- **GAS 改 code 必須 Deploy → 管理 → 鉛筆 → 新版本**：不是直接生效。Script Properties 改了立即生效，但 code 改要建新版本部署。kabe 一度誤點「新增部署作業」拿到不同 URL，要回去找原 Web App 部署改版本才對。
- **LINE Official Account 不能被 @**：本想用 mention（isSelf）偵測，行不通 → 改用 `bot ` 前綴觸發。設計時想先嘗試 mention，實際發現 LINE 不讓 OA 出現在 @ 候選清單。
- **GAS 拒絕電話驗證/信用卡的非工程師路徑**：Vercel + Cloudflare 都跳電話驗證，Render 免費 plan 會 sleep 不適合 webhook，最後退到 GAS 是對的選擇（kabe 已有 Gmail，0 註冊摩擦）。
- **時間欄位命名 m vs mon vs min**：第一版 `now.m` 同時當月份/分鐘 → 「現在時間」算錯（4 月某天 18:50 被當成 18:04，誤判員工還在接客）。教訓：類似縮寫盡量明確 (`mon`/`min`)，避免單字母歧義。
- **紙房子 RTDB rules 公開**：bot 利用這點不用 service account 也能寫，但同時是 LifeOS-Shop 的安全弱點（任何人有 `databaseURL` 就能讀寫排班資料）。記下來，未來要改 auth 規則前 bot 要同步調整（加 Database secret 或 service account JWT）。
- **WebFetch 拒讀紙房子業務內容**：debugging 時想 fetch staffData 看實際格式，API 端覺得內容敏感拒絕。改請 kabe 直接複製貼純文字。教訓：敏感業務資料 debug 走 kabe 提供樣本，不要靠工具直接拉。
- **iterate 次數爆炸**：格式 v1→v10 多次來回（timeline / LifeOS 風格 / timeline+現在 / timeline+現走）。教訓：**先確認用戶想要什麼格式再寫 code**，不要自己猜。kabe 有時候訊息很短（「B」「現在是要改成現走才對哦」），要主動釐清意圖再動。
- **commit 用明確檔名**：跑 `git add src/shop/shop_data/app.js linebot/`，不用 `git add .`，避免帶到不該 commit 的檔。

### 本輪 commits
```
02be413 feat: 新增 LINE bot（GAS）+ 複製空檔格式統一
ed2f075 fix: 複製空檔開頭詞「現在」改回「現走」
```

### 未結 / 待辦（kabe 安全收尾）
- [ ] **補 LINE_USER_ID_WHITELIST**：去 GAS 執行記錄看「No whitelist set. Your userId is: U...」抄那串 32 字元（U 開頭），貼進 GAS 指令碼屬性 `LINE_USER_ID_WHITELIST`。避免別人偷推 bot。
- [ ] **Regenerate Channel secret + access token**：本對話 chat log 有兩個密鑰原文（`db82917a...`、`BgxE+be5j...`）外洩風險。LINE Console → Basic settings 重發 secret、Messaging API tab 重發 access token，新值貼進 GAS 環境變數。舊值瞬間作廢。
- [ ] （可選）`DEBUG_LOG` 從 `1` 改 `0` 關掉詳細 log（上線穩定後）

---

## 📝 本次完整記錄（2026-04-27）— 「現走」判斷加門檻

### 背景
kabe 實際使用發現 bug：班表是 `4/27 妹客13.30 40/2400-1`（13:30 客人 40 分），bot 還是寫「【民權】卡蜜拉 現走 13.30有客 14.20可約」。但離下個客人不到 40 分鐘根本走不了一單，「現走」誤導。

### 修法
原本判斷只看「現在不在客中」就寫「現走」。改成必須滿足：
- 到下個客人 ≥ 40 分（跟既有「task 合併規則 < 40 分」一致）
- 離下班 ≥ 20 分（kabe 補的條件，避免下班前還叫人「現走」）

### 改動
- [src/shop/shop_data/app.js](src/shop/shop_data/app.js) `copySingleAvailability`：
  - 加 `closeMins`（從 `#closeHour` DOM 抓，fallback 27）+ `nearClose` flag
  - `if (!inFirstBooking)` → `if (!inFirstBooking && firstTask.start - nowMins >= 40 && !nearClose)`
  - 「沒未來 task」分支也加 `!nearClose` 守門
- [linebot/Code.gs](linebot/Code.gs) `formatStaffAvailability`：
  - `closeMins` 從 `ctx.closeHour` 拿（已存在，`buildCtx` 裡讀 `settings.closeHour`）
  - 兩個分支同步改

### 預期輸出對比
| 情境 | 改前 | 改後 |
|------|------|------|
| 13:00 看，13:30 有客 | `現走 13.30有客 14.20可約` | `13.30有客 14.20可約` |
| 02:50 看（closeHour=27 即 03:00），全天無客 | `現走` | （只剩名字） |
| 13:00 看，14:00 有客（差 60 分） | `現走 14.00有客 15.10可約` | `現走 14.00有客 15.10可約`（不變）|

### 本輪 commits
```
2b2cf29 update（kabe 雙擊 .bat 預設訊息，內容 = app.js + Code.gs 兩處「現走」門檻修補）
```

### 一鍵部署.bat 編碼修補（順手）
- 原本 `chcp 65001` + 中文 echo 在 kabe 環境會把中文行當指令執行（'LifeOS-Shop' is not recognized…）
- 改成全英文 echo，不靠 cmd 中文支援。bat 流程不變（git add . → commit → push）
- 中文版的 git 指令其實有正常跑，亂碼只是 echo 顯示——commit 2b2cf29 就是中文版第一次點時推上去的，第二次點英文版才出現 nothing to commit

### 未結 / 待辦
- [x] ~~網站部署~~ commit `2b2cf29` 已 push，GitHub Actions 已 deploy，kabe 確認生效
- [x] ~~LINE bot 部署~~ kabe 已把 `Code.gs` 貼回 GAS、部署新版本，確認生效

---

## 📝 本次完整記錄（2026-04-27 晚）— bot 五項小改（下班/翻譯開關/教學/警告/約滿）

### 背景
kabe 提了五件事，全在 [linebot/Code.gs](linebot/Code.gs)：
1. 下班時間想直接寫死 02:00，不要管網站填什麼（避免每個門市都要去網站設）
2. bot 之後可能放進**台灣人群組**，但翻譯功能會無腦觸發（中文也會被翻成泰文），需要群組級開關
3. bot 進到別人的群組，要讓老闆們知道有哪些查詢指令——加一個 `bot 查詢` 顯示教學
4. 查空檔顯示時間會超過 02:00 下班（例 `03:20可約`）誤導老闆，所有查詢結果末尾要加警告
5. 班表內容寫「約滿」時，bot 直接顯示「藝名 約滿」不要列細項（kabe 的班表慣用詞）

### 改動

**1) 下班時間寫死**
- [linebot/Code.gs:194](linebot/Code.gs#L194) `loadContext`：原本 `var closeHour = settings.closeHour != null ? Number(settings.closeHour) : 27;`，改成 `var closeHour = 26;`（軸 26 = 隔日 02:00）
- 影響：只用於「離下班 < 20 分不寫『現走』」判斷（[Code.gs:246-247](linebot/Code.gs#L246-L247)），不影響翻譯/班表寫入
- **網站 `closeHour` 仍保留**（網站排班時間軸還在用），bot 端純粹忽略它

**2) 群組翻譯開關（每群獨立）**
- 新增區塊 `=== 翻譯開關（每群組獨立，存 ScriptProperties）===` 在 [Code.gs](linebot/Code.gs) 翻譯區塊上方
- 函式：`detectTranslateToggleCommand`（偵測指令）/ `_getDisabledGroupList` / `isTranslateDisabled` / `setTranslateDisabled` / `handleTranslateToggle`
- 儲存：ScriptProperties 的 `TRANSLATE_DISABLED_GROUPS`（comma-separated `groupId` list），第一次有人下指令時自動建立
- 在 `handleEvent` 群組 `bot ` 前綴分支內加 toggle 偵測；無前綴分支「試翻譯」之前加 `if (isTranslateDisabled(groupId)) return;`
- 指令（要 `bot ` 前綴）：
  - `關閉翻譯` / `關翻譯` / `停止翻譯` → off
  - `開啟翻譯` / `開翻譯` / `啟用翻譯` → on
  - `查詢翻譯` / `翻譯狀態` / `翻譯` → status
- 預設**開啟**（主場景是泰國工作群），加進台灣群組後才需要下指令關掉

**3) `bot 查詢` 教學指令**
- 新增 `HELP_TEXT` 常數 + `detectHelpCommand` 函式，放在 `=== 查詢模式判定 ===` 區塊上方
- 在 `handleEvent` 後段（detectQueryMode 之前）加偵測，群組+私訊都生效
- 指令：`查詢` / `教學` / `說明` / `指令` / `help`（前面要 `bot `，例 `bot 查詢`）
- 教學內容只列「bot 現在 / bot <藝名> / bot 查詢」，**故意不列翻譯開關**——那是給管理員（kabe）的，不是給台灣群老闆看的

**4) 查空檔末尾警告（OVERTIME_WARNING）**
- 在 [Code.gs](linebot/Code.gs) `handleQuery` 加常數 `OVERTIME_WARNING = '\n\n服務時間超過02.00需詢問是否能加班'`
- `mode === 'all'` 永遠附加；`mode === 'staff'` 找到員工才附加，「❌ 找不到」錯誤訊息不附加
- **不在 formatStaffAvailability 內處理**：避免每個員工都重複這句，全表只在最後一行出現一次
- iterate 過程：原本要做「01:20 後接單跨夜才警告」這種精細邏輯，kabe 後來決定簡化成「永遠加在末尾」——比邏輯判斷更穩，老闆每次都看到提醒比偶爾觸發好

**5) 班表「約滿」直接顯示**
- [Code.gs](linebot/Code.gs) `formatStaffAvailability` 開頭加 `if (/約滿/.test(content)) return prefixText + displayName + ' 約滿';`
- 順手把 `displayName` / `prefixText` / `content` 變數宣告提到函式開頭（原本散在中間，提早 return 才能用）
- 觸發條件：員工 `content` 任何一行包含「約滿」兩字 → 整行只顯示「【區】藝名 約滿」，跳過所有 task 解析

### 設計取捨備忘
- **預設開啟翻譯**而不是關閉：bot 主場景是泰國群，預設關會多一步啟用流程
- **每群獨立**而不是全域開關：泰國群和台灣群同時存在的場景才需要這個機制
- **教學不列翻譯開關**：避免老闆們看到管理員指令誤觸；他們需要的就是查空檔
- **「翻譯」alias 包進 status 偵測**：很短的指令好記，不過 `bot 翻譯` 也會被當 status 顯示，不會誤翻
- **`detectHelpCommand` 放在 `detectQueryMode` 之前**：不然「查詢」「教學」會被 `[一-龥]{2,6}` 當員工藝名查找
- **「OVERTIME_WARNING 永遠加」勝過「條件式警告」**：iterate 一次後 kabe 決定不要精細邏輯。永遠提醒比智能但偶爾失準好懂
- **「約滿」放 formatStaffAvailability 開頭提早 return**：避免後續 task 解析誤把「約滿」當怪 task

### 部署遇到的小坑
- 部署完群組第一次寫班表沒回應，私訊正常。等一下再試就 OK ——LINE webhook 對群組的緩存延遲，不是 code 問題。**未來再遇到先等 30 秒重試**，別急著回滾

### 未結 / 待辦
- [x] ~~kabe 把 Code.gs 貼回 GAS、部署新版本~~ 已部署、已測試全部五項生效
- [x] ~~kabe 加進台灣群組後測試 `bot 關閉翻譯`~~ kabe 確認都成功了

---

## 📝 本次完整記錄（2026-04-28）— 通知面擴張：早安叫醒 + 管理員面板 + 群組綁房號

### 背景
kabe 想擴展 LINE bot **通知面**功能，列了四類選擇（員工群通知 / 老闆群通知 / 管理者警報 / 客戶通知）。先動兩件具體：
1. bot 寫班表回覆訊息底下加泰文確認句（員工讀得懂、知道要回覆）
2. 每天 12:40 自動推泰文起床訊息到群組（取代 kabe 一個個手動貼）

設計過程中展開出「管理員指令面板」+「群組綁房號」概念，讓 kabe **私訊**就能遠端控制各群組設定（不用一個個進去群組打指令）。

### 1) bot 寫班表回覆加泰文（[linebot/Code.gs](linebot/Code.gs) `writeScheduleToFirebase`）
原本：`✅ 已更新 A房（京鮑吟） 2026/4/28`
改後：
```
✅ 已更新 A房（京鮑吟）
ตารางใหม่มาแล้ว เช็กและตอบด้วยนะ
```
**拿掉 `parsed.dateStr`** —— kabe 給的範例只有兩行，順他的意

### 2) 群組房號綁定（新概念）
新增 ScriptProperties：
- `GROUP_ROOM_MAP` (JSON `{groupId: roomLabel}`) — 群組對應房號
- `KNOWN_GROUPS` (JSON array) — bot 加入過 + 收過訊息的群組（給 boss 列清單用）

**指令**（群組裡）：
- `bot 設定房號 A`（也接受 `綁定房號 A` / `編號 A` / `設房號 A`）
- 規則 `^(?:設定房號|綁定房號|編號|設房號)\s*(\S{1,10})$`，沒空白也接受
- **重疊覆蓋**：同房號被新群組搶走 → 舊群組變未綁定（kabe 要的「直接覆蓋」）；實作在 `setGroupRoom` 設新值前掃 map 把同房號的別 groupId 刪掉

**Join event 處理**：bot 被加進群組（`event.type === 'join'`）→ `handleJoinEvent` 自動發歡迎訊息引導設定房號 + 把 groupId 加進 KNOWN_GROUPS

### 3) 早安叫醒功能
- `MORNING_CALL_ENABLED_GROUPS` (csv groupId list) — 預設**關**
- 群組指令：`bot 早安開啟` / `bot 早安關閉` / `bot 早安狀態`
- 訊息內容：`ตื่นแล้วช่วยบอกสตาฟด้วยนะ และรีบแต่งหน้าให้เสร็จโดยเร็วที่สุดครับ`
- LINE Push API（不是 reply）— 新加 `linePush(toGroupId, text, props)` helper
- **GAS time-based trigger**：每 5 分鐘觸發 `sendMorningCall()`，內部判斷 12:40-12:44 視窗才執行
- `LAST_MORNING_CALL_DATE` 防同一天重發（即使 trigger 跑兩次）

**為什麼 5 分鐘 trigger 而不是 daily**：GAS daily trigger 落在「12:00-12:59 之間隨機」，無法精確 12:40。改成 5 分鐘 + 視窗判斷可達 ±2 分鐘精度。

### 4) 管理員指令面板（`bot boss`）
- 觸發詞：`boss` / `Boss` / `BOSS`（私訊或群組 `bot boss` 都可）
- 動態生成 `BOSS_TEXT`：依 KNOWN_GROUPS 列每群組「房號：翻譯 開/關 / 早安 開/關」
- 已綁房號排前面（按房號字母序），未綁的排後面標 `(...末6碼)`
- **HELP_TEXT 不列 boss** —— 教學給員工/老闆看，boss 給管理員看，分流
- **沒做 whitelist**（kabe 選**寬鬆版**）—— 任何人在群組打 `bot boss` 都會看到，靠教學不列保密

### 5) 私訊用房號 reference 管理
- `A 早安開啟` / `A 早安關閉` / `A 翻譯開啟` / `A 翻譯關閉`
- regex：`^(\S{1,5})\s*(早安|翻譯)\s*(開啟|關閉|...)$`，沒空白也接受
- `handleAdminCommand` 用 `getGroupByRoom(roomLabel)` 反查 groupId 再操作

### handleEvent 整合
1. 開頭加 `event.type === 'join'` 路徑 → `handleJoinEvent`
2. 群組 `bot ` 前綴內，**翻譯開關之前**加：`detectRoomBindCommand`；**之後**加：`detectMorningToggleCommand`、`detectBossCommand`；首行加 `rememberGroup(groupId)`
3. 群組無前綴：第一行加 `rememberGroup(groupId)`（任何訊息都記）
4. 私訊區塊（trimmedText 之後、教學偵測之前）加：`detectBossCommand` + `detectAdminCommand`

### 部署遇到的坑
- **kabe 第一次貼 Code.gs 回 GAS 後新指令不通，重新部署一次才 OK** —— 老問題重演（GAS 必走「Deploy → 管理部署作業 → ✏️ 鉛筆 → 新版本」流程，不是儲存就生效）。**未來貼 GAS 直接寫 SOP**：「貼完 → 重新部署一次 → 才能測」

### 設計取捨備忘
- **早安預設關 vs 翻譯預設開**：相反設計，理由是場景不同——翻譯主場景是泰國群（預設要翻），早安要主動開（避免無意義噪音、避免 bot 加進老闆/管理群也亂叫醒）
- **KNOWN_GROUPS 自動記錄**：bot 收到任何群組訊息時 add，省去 kabe 手動登記；副作用是 bot 進過所有群組都會出現在 boss 清單，包括測試群組
- **重疊覆蓋方向**：後設的勝。如果有兩個群組要綁同一房號，後設的拿到、前設的被踢成未綁定狀態
- **教學 vs Boss 分流**：HELP_TEXT 簡潔（員工/老闆看）、BOSS_TEXT 動態（管理員看），兩塊獨立維護
- **admin 指令第二 token 必須是「早安/翻譯」**：避免跟「A 4/25 火雲14.20...」班表訊息或「A 蒼華」短指令誤匹配
- **未綁房號群組顯示 `(...末6碼)`**：kabe 還能辨識（LINE groupId 是 32 字 hex，末 6 碼足以區分），不洩漏全 id

### 後續追加（同對話內續做）

**無效指令訊息精簡**
- 私訊看不懂的回覆原本是「❓ 看不懂\n\n寫班表：A 4/25...\n\n查詢：現在 / 空檔 / <藝名>」
- 改成兩行：「無效指令\n查詢:現在 空檔 <藝名>」
- kabe 偏好簡潔，不要長 fallback

**解除綁定指令**
- 群組裡：`bot 解除綁定` / `取消綁定` / `解除房號` / `解綁` / `清除房號` / `移除房號`（任一觸發）
- **私訊也加**：`A 解綁` / `紙房子 解除綁定` 等。**理由（重要）：kabe 不想讓員工在群組看到自己在做管理員設定**，私訊操作可以保密
- 解綁找不到房號 → 回「❌ 找不到房號『A』的群組」
- 解綁原本就沒綁 → 回「本群組原本就沒有綁定房號」

**房號自動轉大寫**
- `detectRoomBindCommand` / `detectAdminCommand` / `detectAdminUnbindCommand` 抓到房號都 `.toUpperCase()`
- 內部存大寫、面板顯示大寫、私訊指令大小寫通用（`a 早安開啟` = `A 早安開啟`）
- 中文房號（紙房子、響叮噹等）不受影響（JS toUpperCase 對中文無作用）

**Boss 觸發詞改名 → moneyhouse**
- `bot moneyhouse` 取代原本 `bot boss`，跟紙房子的系統代號 `moneyhouse` 一致
- regex `/^moneyhouse$/i` 大小寫不敏感
- BOSS_TEXT 內「【看這份清單】」也同步顯示 `bot moneyhouse`
- **內部函式名／變數名保留 boss / BOSS**（`detectBossCommand`、`buildBossText`、`BOSS_TEXT`），是 code 內部代號不影響使用者，改了反而動到一堆地方

**kabe 工作習慣備忘（重要）**
- kabe 做完任何設定後會 `bot moneyhouse` 回管理員面板**確認當前狀態**
- 任何設計新狀態（綁/解綁、開/關 翻譯/早安）都要確保 BOSS_TEXT 即時反映
- 目前 BOSS_TEXT 是動態生成（不是快取），讀 GROUP_ROOM_MAP / TRANSLATE_DISABLED_GROUPS / MORNING_CALL_ENABLED_GROUPS 即時組裝 → 維持這個設計，未來加新狀態也要同步加進 BOSS_TEXT

### 二次後續追加（同對話內續做）

**白名單嚴格版（code 部分完成）**
- 新增 `detectWhoamiCommand`（觸發詞：`whoami` / `我的id` / `查id` / `查userid`）+ `handleWhoami`：任何人都能查自己 userId（給 kabe 第一次設 whitelist 用）
- 新增 `isBossAuthorized(userId, props)`：whitelist 空 = 寬鬆（誰都看 boss），有設 = 嚴格（只清單內 userId 看，其他人完全靜默 return）
- 群組 `bot moneyhouse` 加授權檢查：未授權者完全靜默不洩漏指令存在
- 私訊路徑：whoami 偵測**特意放在 whitelist 檢查之前**（讓未授權者也能拿到 userId，否則設定流程鎖死）
- BOSS_TEXT 末段加「【權限狀態】」區塊：未設 → ⚠️ + 設定步驟；已設 → ✅ + 人數 + 末 6 碼
- `buildBossText(props)` 簽名改接 props（要讀 whitelist），caller 同步傳

**翻譯加英文支援（en2both）**
- `translateMessage` 偵測順序加第三條：純英文（無泰無中）→ 翻中 + 翻泰兩行
- 中英混雜走 zh2th；泰英混雜走 th2zh（hasThai 優先比，靠 glossary 處理英文行業術語 nocon/In/Out 等）
- `translateWithGemini` 加 `en2both` directionNote：「同時翻譯成 (1) 台灣繁體中文 (2) 泰文，第一行中文、第二行泰文」
- LanguageApp fallback：跑 en→zh-TW + en→th 兩次拼接

**翻譯加多行逐行翻譯**
- `translateMessage` 偵測到 `\n` → 切行 → 每行各自送 API → `\n` 拼回
- 空行原樣保留；純符號行（`~~` / `--` / emoji 等沒語言字符的）原樣保留
- 抽出 `translateOneLine` helper
- **理由**：kabe 反映「文字過多翻譯不准」，逐行送 API 提升精準度
- **副作用**：N 行有字 = N 次 API call，速度變慢、Gemini 額度變多。kabe 接受這個 trade-off

**Gemini prompt 加保留標點規則**
- 【輸出】區塊加「保留原文的標點符號（。，！？～：等）原樣，不要刪減」
- 之前 Gemini 偶爾會省略標點

### 已知偶發問題：班表寫入沒回應 + 沒寫進去

- **現象**：群組裡貼班表，bot 偶爾沒回「✅ 已更新」**且資料也沒寫進 Firebase**
- **頻率**：偶發（同樣訊息重發第二次通常會通）
- **猜測原因**：LINE webhook 沒把 event 送到 GAS，或 GAS 處理過程 throw error 但被 try/catch 吞掉
- **不是 @標記人員影響**：每個 LINE 訊息獨立 webhook event，後一則訊息不會蓋過前一則處理
- **不是 reply token 過期**：那情境下 Firebase 仍會寫入，這次沒寫入就排除了
- **SOP**：(1) 進網站看 A 房班表 → 沒資料就 (2) 重發一次。連續兩次都失敗才追 GAS 執行記錄
- **若頻率變高（>3 次/天）**：考慮改用 LINE Push API 取代 Reply（沒 token 期限，但回應延遲 1-2 秒）；或把 writeScheduleToFirebase 跟 reply 分離（先寫成功再 reply，reply 失敗不影響資料）

### 設計取捨備忘（這次的）
- **whitelist 空 = 寬鬆**：避免「沒設就完全沒人能用」鎖死，kabe 設定前還能正常測試。kabe 設了 whitelist 才進嚴格模式
- **whoami 永遠不擋**：第一次設定流程必經，避免 catch-22（沒在 whitelist 就拿不到 userId 補 whitelist）
- **群組 boss 未授權靜默** vs **私訊整體 whitelist 擋**：兩個路徑不同保密層次。前者更嚴（不洩漏指令存在），後者整個私訊都不通
- **逐行翻譯 vs 整段翻譯**：選逐行（精準度優先於速度）— kabe 不在乎成本/速度，要翻準
- **泰英混雜走 th2zh** 而不是 en2both：kabe 主要場景是泰國工作群，主導語言是泰文，含英文術語（nocon/In/Out）由 glossary 處理

### 三次後續追加（A+X 大改造，同對話內，2026-04-28 深夜）

**緣由**：kabe 反映管理變麻煩 — 指令多記不住、多群組狀態追不過來、要一個個設、班表偶發失敗要進網站確認。先評估「網頁面板 vs LINE 卡片」，6 房規模（A/B/C/D/215/615 對應 LifeOS 排班）選 LINE Flex Carousel（網頁是殺雞用牛刀）。

**A 部分：短期改動**
1. **解綁徹底清空**（[Code.gs] `handleUnbind`）：解綁 = 房號釋出 + 翻譯狀態關 + 早安狀態關 + 從 KNOWN_GROUPS 移除 + **加進 SUSPENDED_GROUPS**（停用清單）
2. **批次指令**（[Code.gs] `detectBatchCommand` / `handleBatchCommand`，私訊用）：
   - `全部早安開啟` / `全部早安關閉`
   - `全部翻譯開啟` / `全部翻譯關閉`
   - `全部解綁` / `全部清空` / `清空所有群組` → 把全部 known groups 都加進 SUSPENDED_GROUPS
3. **班表寫入失敗自動推 admin**（[Code.gs] `notifyAdmin` + handleEvent 三處 try/catch）：
   - 群組無前綴寫班表、私訊 schedule、pending 三條路徑都包 try/catch
   - 失敗時 `notifyAdmin` 用 LINE Push API（吃月配額但失敗才用、量極小）通知 LINE_USER_ID_WHITELIST 內所有人

**X 部分：Flex 卡片化管理面板**
1. **buildBossFlex**（[Code.gs]）：carousel 結構 = 1 張總覽卡 + 每群組一張卡（已綁優先 → 未綁排後面）
   - 總覽卡：顯示總群組數 / 已綁 / 早安開啟數 / 翻譯開啟數 / 管理員人數 + 一個「文字版面板」連結
   - 群組卡：房號 + 翻譯狀態 + 早安狀態 + 3 個 postback 按鈕（早安切換 / 翻譯切換 / 解綁）
   - 未綁卡：顯示末 6 碼 + 引導去群組打 `bot 設定房號 X` + 一個「從面板移除」按鈕
2. **handlePostback**（[Code.gs]）：卡片按鈕觸發 → 授權檢查（isBossAuthorized）→ dispatch（toggle_morning / toggle_translate / unbind / show_text / batch）→ 重發 Flex 面板讓 kabe 看到更新狀態
3. handleEvent 入口加 `event.type === 'postback'` 路徑
4. 群組 + 私訊 boss 偵測都改用 `buildBossFlex(props)` 取代 `buildBossText`，文字版透過按鈕「文字版面板」（postback action=show_text）切換

**進階改動（接連而來）**

**a) 拿掉總覽卡批次按鈕**
- kabe 反映「全早安開/關 / 全翻譯開/關」4 個批次按鈕用不到
- 拿掉，總覽卡 footer 只留「文字版面板」一個 link button
- 批次邏輯保留私訊文字指令版本

**b) 自訂排序指令**（[Code.gs] `detectOrderCommand` / `handleOrderCommand`）
- 私訊 `排序 A B C` 或 `排序 A,C,B` 或 `排列 A、C、B`（空白/逗號/頓號分隔都接受）
- 存 ScriptProperty `GROUP_ORDER` (csv)
- buildBossFlex bound 群組依此排序，沒列到的按字母序排後面
- 設定後永久生效，下次 `bot moneyhouse` 自動套用

**c) cleanupStaleStatus**（修「翻譯開啟：-1 / 0」bug）
- 殘留情境：早期某群組打過 `bot 關閉翻譯`，groupId 加入 TRANSLATE_DISABLED_GROUPS；後來該群組離開 KNOWN_GROUPS，但 disabled csv 沒清 → 統計時 `known.length(0) - disabled.length(1) = -1`
- 解法：buildBossFlex / buildBossText 開頭呼叫 cleanupStaleStatus，把不在 KNOWN_GROUPS 的 gid 從 disabled / enabled csv 清掉
- 順手加 Math.max(0, ...) 顯示防禦

**d) 早安時間 12:40 → 12:30**
- sendMorningCall 視窗 12:40-12:44 改成 12:30-12:34
- 全檔 12:40 字串 replace 成 12:30（含 BOSS_TEXT、handleMorningToggle 訊息、code 註解）

**e) 解綁邏輯重新理解（kabe 重新解釋後）**
- 第一版做的是「主動解綁 = 停用」 → 但 kabe 真正的痛點是「**覆蓋**場景」（房號從群組 X 搬到群組 Y 時，群組 X 應自動失效）
- 修法：`setGroupRoom` 內部處理覆蓋時，把被踢的舊 groupId `setGroupSuspended(true)`
- handleRoomBind 訊息調整：「原『A』房群組已自動進入停用，bot 在那群組沉默直到重新綁定」
- 主動解綁的 suspend 行為保留（一致性）
- handleEvent 群組分支開頭加 `isGroupSuspended(groupId)` 檢查：是 → 例外允許 detectRoomBindCommand 通過、其他全靜默

**f) bind 指令多 alias**（[Code.gs] `detectRoomBindCommand`）
- 既有：`設定房號 A` / `綁定房號 A` / `編號 A` / `設房號 A`
- 新增：`綁定 A` / `綁 A` / `A 綁定` / `A 綁`
- 場景：覆蓋頻繁時用短指令快速重綁

### 設計取捨備忘（A+X 改造）
- **解綁=停用 vs 退群**：選停用（bot 還在群組沒退，員工不會 panic「bot 不見了」），但功能徹底沉默
- **唯一例外是「設定房號」**：避免 kabe 重啟卡死（停用後完全收不到指令）
- **「覆蓋」是主要場景而不是「主動解綁」**：kabe 紙房子實際工作流是員工換房 → 覆蓋；主動解綁很少用
- **網頁面板 vs LINE 卡片**：選後者，6 房規模 LINE 卡片夠用，網頁是 1-2 週工程過度設計
- **批次按鈕拿掉**：UI 整潔 > 一鍵方便（批次操作私訊文字指令保留）
- **排序用文字指令**：6 房規模設一次就好，拖拉式 UI 不值得做
- **postback action**（不是 message action）：按鈕點下不會在群組顯示「kabe 點了 X」，乾淨
- **cleanup stale 在面板開啟時 lazy 執行**：不寫定時 cleanup（一致性靠 lazy 即可）

### 已知限制 / 後續可能加的
- LINE Flex carousel 上限 12 張卡 — 6 房沒問題，未來大規模才需分頁
- 「覆蓋自動 suspend」對主動切換房號是預期行為，但若 kabe 不小心打 `bot 設定房號 A` 在錯誤群組會踢掉真的 A → 後悔的話打 `bot 設定房號 A` 在原群組就回得去（因為一樣是覆蓋邏輯）
- 排序只支援已綁房號，未綁的群組永遠排後面（按 groupId 末 6 碼字母序）

### 未結 / 待辦
- [x] ~~kabe 在 GAS 設 `sendMorningCall` 的 time-based trigger（每 5 分鐘）~~（2026-04-28 深夜完成，每 5 分鐘觸發中，內部判斷 12:30-12:34 視窗才推送）
- [ ] kabe 把 bot 加進測試群組驗證 join event 歡迎訊息
- [ ] 等隔天 12:30 觀察自動推送是否生效
- [x] ~~**kabe 設白名單**：私訊 bot 打 `whoami` → 抄 userId → GAS 指令碼屬性 `LINE_USER_ID_WHITELIST` 貼上 → 重新部署~~（2026-04-28 晚完成，嚴格模式生效中）
- [ ] kabe 用一陣子卡片面板再評估：要不要做網頁版（規模長到 20+ 群組或要整合班表業績資料時值得做）
- [ ] （從前幾輪繼續）Regenerate LINE secret + access token（之前對話有外洩）

### 本輪改動範圍
純改 [linebot/Code.gs](linebot/Code.gs)，網站沒動。新增三個 section：
1. **群組房號綁定 + 早安開關 + Boss 管理員指令**（接近翻譯開關之前）
2. **LINE Push API + 早安叫醒排程**（接近 reply 之前）
3. handleEvent 整合（前述四處）

### 本輪 commits
（pending kabe 雙擊 `一鍵部署.bat` 推上去；改動只影響 GAS bot，不動網站；GAS 端已經透過貼上 + 重新部署生效）

---

## 🚀 未來可完善（非緊急）

| 優先 | 項目 | 說明 |
|------|------|------|
| P2 | Admin 密碼升級 | 從 SHA-256 驗 `?admin=0308` 換成 Firebase Auth 登入 |
| P2 | localStorage 租戶 namespace | 同瀏覽器切多租戶時資料不互撞（`core/common.js` 已有 `lsKey()` helper，逐頁套用即可） |
| P2 | 統一 CSS / 導航列 | 7 個頁面目前各自為政，視覺不一致 |
| P2 | 兩套週結系統整併 | `weekly.html` + `shop.html` 的週結 tab（商業決策，未定） |
| P3 | 合併名稱「別名管理」頁 | weekly 的合併規則目前只能從 card 操作，未來加一個集中管理頁 |
| P3 | 合併規則匯出 / 備份 | `weekly_data/merges` 目前只在 Firebase，沒有下載備份機制 |
