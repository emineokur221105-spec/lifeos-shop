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
**2026-04-25**：跨專案 bug review，LifeOS 拿到 3 項 🔴；修完 #4 XSS（9 檔 38 點 escapeHtml）+ #5 weekly 跨年 bug（抽 `inferYear()` helper）；#3 銷毀密碼升級 kabe 決定不改。**未跑 build 驗證**（Bash 工具當機）。

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
- [ ] kabe 跑 `node build.js` 驗證 → 沒錯誤就 commit + push
- [ ] （可選）onclick 內 user input 改 `data-*` + `addEventListener`，徹底修 JS injection 殘留
- [ ] （可選）clipboard 寫 HTML 也加 escape

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
