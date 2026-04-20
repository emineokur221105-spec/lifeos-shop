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

### Phase 1：核心架構（進行中）
- [x] Raymond 開「主 Firebase」project：`lifeos-shop-main`（config 存 LOCAL_SECRETS.md）
- [ ] 建 `core/` 資料夾
  - [x] `main-firebase-config.js`（主 Firebase 連線設定）2026-04-20
  - [x] `tenant-loader.js`（讀 `?t=xxx` 查租戶 Firebase 設定）2026-04-20
  - [x] `security.js`（統一防盜模組）2026-04-20
  - [ ] `common.js`（共用工具：showToast、parseTime 等）
- [x] 新 `index.html`（路由骨架：`?t=`/`?admin=` 分流，串 security + tenant-loader）2026-04-20
- [x] Admin 後台 `admin.html` 2026-04-20
  - [x] 登入檢查（`?admin=0308`）
  - [x] 租戶清單 CRUD（新增/編輯/刪除，JSON 貼 Firebase config）
  - [x] 白名單管理（輸入 hostname → 算 SHA-256 → 存 `{ label }`）
  - [x] Toast 提示 + 二次確認刪除

### Phase 2：模組移植（進行中）
- [x] `src/core/tenant-boot.js`：頁面共用開機（驗白名單 + 載租戶）2026-04-20
- [x] `roster.html`（人員雲端管理）2026-04-20
  - [x] 搬檔到 `src/roster.html`，原 UI / 邏輯 598 行完全保留
  - [x] 只改 Firebase 初始化段（原 hardcoded v10.7.1 → 改用 bootTenant + tenantDb）
  - [x] title 改顯示租戶名
- [x] `office.html`（團隊分紅）2026-04-20
  - 搬到 `src/office.html`，原 504 行 UI / 邏輯完全保留
  - Firebase v11.0.2 → v11.0.1 統一版本，改用 bootTenant + tenantDb
  - index.html 的 office 按鈕解鎖
- [ ] `weekly.html`（週結業績）
- [ ] `shop.html`（最大、最核心）
  - [ ] 改寫成 v11 modular
  - [ ] 接上 tenant-loader
  - [ ] 7 個 shop_data JS 檔逐一改寫
- [ ] 原本的 `settings.html` 整併進 admin 後台
- [x] 改寫 `index.html` 成租戶功能選單（深色版保留舊版 4 按鈕漸層色，roster 可點、shop/office/weekly 顯示「移植中」disabled）2026-04-20

### Phase 3：驗收（待開始）
- [ ] Raymond 實際操作確認 UI 一模一樣
- [ ] 修 bug
- [ ] 寫「新增租客 SOP」

---

## 📝 當前進度

**Phase 1 進行中**
最後更新：2026-04-20 Asia/Taipei

**剛完成（2026-04-20）：**
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
- 已完成：tenant-boot.js + roster.html（熱身）
- 測試方式：`https://emineokur221105-spec.github.io/lifeos-shop/roster.html?t=demo-qinre-main`
  - 沒 ?t= 會自動跳回首頁
  - 有 ?t= 但租戶不存在會報錯（由 tenant-loader 丟）

**下一步：**
1. 搬 `weekly.html`（v8 compat → v11 modular，獨立頁的業績對帳）
2. 搬 `shop.html`（最硬，7 個 JS 檔）
3. `settings.html` 整併進 admin
4. `common.js` 等 shop.html 移植時依需求補

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
