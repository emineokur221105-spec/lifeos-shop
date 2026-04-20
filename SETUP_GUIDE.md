# LifeOS-Shop 設定教學

> 這份是給 Raymond 的操作手冊，全程白話文，不用懂程式。
> 遇到不會做的步驟，直接截圖問 Claude 就好。

---

## 整體架構（一分鐘看懂）

想像一下飯店：
- **主 Firebase = 飯店櫃台**（存所有房客的名字跟鑰匙號碼）
- **租戶 Firebase = 每間房**（每個客戶有自己獨立的空間，互不干擾）

你（Raymond）只需要：
1. 開一次「主 Firebase」（全系統共用）
2. 每新增一個租客，幫他開一個新的 Firebase project，把網址貼到 Admin 後台
3. 把租客的網址 `https://<系統網址>/?t=<租客代號>` 給對方

---

## Step 1：開「主 Firebase」（全系統只做這一次）

> 進度標記：完成後在 `REFACTOR_PROGRESS.md` 把「Raymond 開主 Firebase」打勾

1. 打開 https://console.firebase.google.com/
2. 點「**Add project**」
3. 名字填：`lifeos-shop-main`（隨便取都行，自己記得就好）
4. Google Analytics 可以關掉（不需要）
5. 建好後，左邊選單找 **Build → Realtime Database**
6. 點「**Create Database**」
   - 位置選 `asia-southeast1`（新加坡，離台灣最近）
   - 規則先選「**Start in test mode**」（之後 Claude 會幫你改成正式規則）
7. 建好後，在 Database 頁面**最上方會有一個網址**，長這樣：
   ```
   https://lifeos-shop-main-xxxxx.asia-southeast1.firebasedatabase.app/
   ```
   👉 **把這個網址複製起來，傳給 Claude**

8. 接下來拿 API Key：
   - 左上角「**Project Settings**」（齒輪圖示）
   - 往下滑到「**Your apps**」
   - 點 `</>` 那個圖示（Web app）
   - 取個名字，例如 `lifeos-shop-admin`
   - **不要勾** Firebase Hosting
   - 點 Register App
   - 畫面會跑出一段程式碼，裡面有：
     ```js
     const firebaseConfig = {
       apiKey: "...",
       authDomain: "...",
       databaseURL: "...",
       projectId: "...",
       storageBucket: "...",
       messagingSenderId: "...",
       appId: "..."
     };
     ```
   👉 **整段 `firebaseConfig = {...}` 複製起來貼給 Claude**

---

## Step 2：新增一個租客（每次新客戶都做一次）

> 📍 **入口位置**：瀏覽器打開 `https://<你的系統網址>/?admin=0308`
> 這個網址不會出現在 index 頁面任何地方，只有你知道。

### 在 Admin 後台操作

1. 進入 `?admin=0308` 後，會出現密碼欄（之後加）
2. 點「**新增租客**」
3. 填：
   - **租客代號**（英文，會變成網址的 `?t=xxx`，例如 `shop-a`）
   - **顯示名稱**（中文，例如「A 店」）
   - **Firebase config**（從 Firebase console 複製那整段 `{...}`）
4. 設定預設參數：
   - 費率參數（40/1 次、60/1 次、60/2 次、120/3 次、240/3 次）
   - 授權網址白名單
   - 系統密碼
5. 按儲存

### 幫租客開他自己的 Firebase

**每個租客都需要一個獨立 Firebase**（避免資料混在一起）：
1. 重複上面 Step 1 的 1~7，但名字改成 `lifeos-shop-<租客代號>`
2. API Key 那段 `firebaseConfig` 複製
3. 貼進 Admin 後台的「Firebase config」欄位

### 把網址交給租客

```
https://<你的系統網址>/?t=<租客代號>
```

租客打開這個網址就能用。他看不到其他租客的資料，也看不到 Admin 後台。

---

## Step 3：給自己存一份 Admin 網址

把這個網址加到書籤（或存手機備忘錄）：
```
https://<你的系統網址>/?admin=0308
```

**⚠️ 不要傳給別人、不要發到群組、不要寫在公開筆記**

---

## 常見問題

### Q：租客改了參數我能看到嗎？
A：每個租戶獨立 Firebase，他自己改他的，互不影響。你只能從 Admin 後台改「預設參數」（給新租客用的）。

### Q：想砍掉一個租客怎麼做？
A：Admin 後台「刪除租客」→ 他的網址就失效了。他的 Firebase 還會在，要完全刪除要去 Firebase console 砍那個 project。

### Q：我的 Firebase 用量會爆嗎？
A：Firebase Realtime Database 免費額度：1GB 儲存、10GB/月傳輸。一個門店一年用不到 100MB，很夠。

### Q：網址可以改成自己的網域嗎？
A：可以，GitHub Pages 支援 custom domain，之後跟 Claude 說再設定。

---

## 出問題怎麼辦

1. 先看 `REFACTOR_PROGRESS.md` 確認系統到哪個階段
2. 截圖錯誤畫面 + 貼網址給 Claude
3. Admin 後台有「系統狀態」頁，可以看當前連線狀況
