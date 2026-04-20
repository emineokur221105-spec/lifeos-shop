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

### Phase 0：基礎設施（進行中）
- [x] 建立本機資料夾 `C:/Users/makeo/Desktop/LifeOS-Shop-統一版/`
- [x] git init + 設定 user.name/email
- [x] 建立 `REFACTOR_PROGRESS.md`（這份）
- [ ] 建立 `SETUP_GUIDE.md` 雛形
- [ ] 建立 GitHub repo `lifeos-shop`
- [ ] 首次 commit + push
- [ ] 啟用 GitHub Pages
- [ ] 驗證 Pages 網址可開

### Phase 1：核心架構（待開始）
- [ ] Raymond 開「主 Firebase」project（Claude 寫教學）
- [ ] 建 `core/` 資料夾
  - [ ] `main-firebase-config.js`（主 Firebase 連線設定）
  - [ ] `tenant-loader.js`（讀 `?t=xxx` 查租戶 Firebase 設定）
  - [ ] `security.js`（統一防盜模組）
  - [ ] `common.js`（共用工具：showToast、parseTime 等）
- [ ] 新 `index.html`（簡潔入口，檢查 `?t=` 和 `?admin=`）
- [ ] Admin 後台 `admin.html`
  - [ ] 登入檢查（`?admin=0308`）
  - [ ] 租戶清單 CRUD
  - [ ] 每個租戶的 Firebase config 編輯表單
  - [ ] 預設參數編輯表單

### Phase 2：模組移植（待開始）
- [ ] `shop.html`（最大、最核心）
  - [ ] 改寫成 v11 modular
  - [ ] 接上 tenant-loader
  - [ ] 7 個 shop_data JS 檔逐一改寫
- [ ] `office.html`（團隊分紅）
- [ ] `weekly.html`（週結業績）
- [ ] `roster.html`（人員雲端管理）
- [ ] 原本的 `settings.html` 整併進 admin 後台

### Phase 3：驗收（待開始）
- [ ] Raymond 實際操作確認 UI 一模一樣
- [ ] 修 bug
- [ ] 寫「新增租客 SOP」

---

## 📝 當前進度

**Phase 0 進行中**
最後更新：2026-04-20 08:24 Asia/Taipei

**已完成：**
- 本機資料夾建立
- git init 完成（分支：main）
- git 身份設定：Raymond / x38446@gmail.com
- `.gitignore`、`README.md`、`REFACTOR_PROGRESS.md` 建立

**下一步：**
1. 寫 `SETUP_GUIDE.md` 雛形
2. `gh repo create lifeos-shop --public --source=. --push`
3. 啟用 GitHub Pages
4. 驗證網址並回報 Raymond

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

---

## ⚠️ 注意事項（下次 Claude 看到請遵守）

1. **Raymond token 有限**，改檔要一個一個慢慢來，每做完一步立刻 commit + 更新這份進度
2. **舊版在** `C:/Users/makeo/Desktop/週結版本 原版/`，筆記在 `C:/Users/makeo/Desktop/claude週結/ARCHITECTURE.md`，需要對照功能時讀那份
3. **UI 要一模一樣**，不要擅自改樣式、改操作流程
4. **Admin 入口 `?admin=0308`** 不能從 index 連過去，只有 Raymond 知道
5. **教學文件 `SETUP_GUIDE.md`** 用白話文，Raymond 是非工程師
