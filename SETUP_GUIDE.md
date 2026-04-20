# LifeOS-Shop 設定與新增租客 SOP

> 這份是給 Raymond 的操作手冊，全程白話文，不用懂程式。
> 遇到不會做的步驟，直接截圖問 Claude 就好。

---

## 整體架構（一分鐘看懂）

想像一下飯店：
- **主 Firebase = 飯店櫃台**（只存所有房客的「房號」跟「鑰匙編號」）
- **租戶 Firebase = 每間房**（每個客戶自己獨立的空間，資料互不干擾）

你（Raymond）只做兩件事：
1. 開一次「主 Firebase」（全系統共用，已完成 ✅）
2. 之後每新增一個客戶，就**重複 Step 2 的 SOP**

---

## Step 1：開「主 Firebase」（只做一次，已完成 ✅）

> 如果 `LOCAL_SECRETS.md` 裡已經有主 Firebase config，這步跳過。
> 下次只有「換主 Firebase」或「全系統重建」才需要重做。

1. 打開 https://console.firebase.google.com/
2. 點「**Add project**」建專案，名字 `lifeos-shop-main`
3. Google Analytics 關掉（不需要）
4. 左邊選單 **Build → Realtime Database** → **Create Database**
   - 位置選 `asia-southeast1`（新加坡，離台灣最近）
   - 規則先選 **Start in test mode**
5. 拿 `firebaseConfig`：
   - 左上角齒輪「**Project Settings**」
   - 下滑到 **Your apps** → 點 `</>` 新增 Web app
   - 命名 `lifeos-shop-admin`，**不要勾** Firebase Hosting
   - 畫面跳出 `firebaseConfig = {...}`，**整段**複製
6. 把整段 config 貼進 `LOCAL_SECRETS.md`（這檔不會上 GitHub，放心）
7. 把同一段 config 寫進 `src/core/main-firebase-config.js`（Claude 已做）

---

## Step 2：新增一個新租客 SOP（每個新客戶跑一次）⭐

**開戶流程分 5 小步，全程大概 10 分鐘。照順序做不要跳。**

### 2-1. 幫客戶開他自己的 Firebase project

1. 進 https://console.firebase.google.com/
2. **Add project** → 取名例如 `lifeos-shop-<客戶代號>`（例：`lifeos-shop-abc-store`）
3. Analytics 關掉
4. **Build → Realtime Database → Create Database**
   - 位置 `asia-southeast1`
   - 規則 **Start in test mode**
5. 齒輪圖 → Project Settings → Your apps → `</>` 新增 Web app
   - 名稱隨便，**不要勾** Hosting
   - 複製跳出來的整段 `firebaseConfig = {...}`
   - ⚠️ 只要花括號 `{...}` 裡面那一包物件，不要 `const firebaseConfig =` 那行

複製到的東西應該長這樣：
```json
{
  "apiKey": "AIza...",
  "authDomain": "xxx.firebaseapp.com",
  "databaseURL": "https://xxx-default-rtdb.asia-southeast1.firebasedatabase.app",
  "projectId": "xxx",
  "storageBucket": "xxx.appspot.com",
  "messagingSenderId": "...",
  "appId": "1:..."
}
```

⚠️ Firebase 給你的原始碼用單引號或沒引號，要貼進系統前**把所有鍵名都加雙引號、值也用雙引號**（JSON 格式）。不確定就直接貼給 Claude 幫你轉。

---

### 2-2. 進 Admin 後台加這個租客

1. 瀏覽器打開 `https://emineokur221105-spec.github.io/lifeos-shop/?admin=0308`
2. 進到 Admin 頁，看到「🏢 租戶清單」卡片
3. 右上角點「**➕ 新增租戶**」
4. 填四個欄位：
   - **代號***：英文字母 / 數字 / 底線 / 減號，例：`abc-store`
     - 這會變成網址 `?t=abc-store`
     - **建好後不能改**，所以想清楚再填
   - **名稱**：顯示用，可以中文，例：`ABC 按摩店`
   - **Firebase Config (JSON) ***：貼 2-1 拿到的那包 JSON
   - **預設參數 (JSON)**：可以先留空 `{}`，之後在 settings 頁改
5. 按「**儲存**」
6. 儲存成功會回到清單，看到新租戶那一行

---

### 2-3. 加這個租客會用的網址到白名單

**白名單機制 = 只有「被授權的網址」才能打開系統。** 防止有人猜到你的網址亂用。

1. 在 Admin 頁面下滑到「🔒 Hostname 白名單」卡片
2. 如果你用 GitHub Pages 的網址，主網址是：
   ```
   emineokur221105-spec.github.io
   ```
3. 在「新增網域」欄位填：`emineokur221105-spec.github.io`
4. 「標籤」填 `GitHub Pages 主站` （方便自己記）
5. 按「**加入白名單**」

> 💡 這個白名單只要加一次，**同個 GitHub Pages 網址下所有租客共用**。之後新增租客不用再加。
>
> 只有當客戶要用他自己的網域（例如 `abc-store.com`）時，才需要再加一筆。

---

### 2-4. 到 settings 頁設定這個租客的參數

1. 回「🏢 租戶清單」，找到剛新增的那行
2. 最右邊有「**⚙️ 設定**」按鈕，按下去會**開新分頁**
3. 新分頁是這個租客的 `settings.html`，這裡改：
   - **價格表** / **工數表**（日結算用）
   - **阿姨名單**（加給用）
   - **股東 + 分紅比例**
   - **系統密碼**（租客進 settings 頁要輸入的密碼）
   - **支出項目**（公司房租、軟體月費等）
4. 填完按「儲存」，資料會存到這個租客自己的 Firebase（不影響其他租客）

---

### 2-5. 把網址交給客戶

把這個網址貼給客戶：

```
https://emineokur221105-spec.github.io/lifeos-shop/?t=<代號>
```

例：`https://emineokur221105-spec.github.io/lifeos-shop/?t=abc-store`

客戶打開這個網址就能用。他會看到四個功能按鈕：
- 🏢 門店排班
- 💰 分紅結算
- 📊 週結業績
- 📋 服務資訊排版

**客戶看不到 Admin 後台，也看不到其他租客的資料。**

---

## Step 3：保管 Admin 網址

把這個網址加到瀏覽器書籤（或手機備忘錄）：
```
https://emineokur221105-spec.github.io/lifeos-shop/?admin=0308
```

**⚠️ 不要傳給別人、不要發群組、不要公開筆記、不要截圖上傳**

---

## 🧰 常見任務

### 要改某個租客的參數？
Admin 後台 → 找到那行 → 點「⚙️ 設定」→ 修改 → 儲存

### 要看某個租客的資料？
Admin 後台 → 找到那行 → 點「⚙️ 設定」→ 可以看到他目前的設定
（他的每日營收、人員資料看不到，那些在該租客自己的 Firebase）

### 要砍掉一個租客？
1. Admin 後台 → 那行點「**刪除**」
2. 這只是從清單移除，該租客網址會失效，但他 Firebase 資料還在
3. 要徹底清乾淨 → 去 https://console.firebase.google.com/ 找那個 project → Settings → Delete project

### 要暫停一個網域的存取？
Admin 後台 → 白名單那一區 → 刪掉那筆 hostname → 該網域就被擋出系統

### 我的 Firebase 會爆流量嗎？
Firebase Realtime Database 免費額度：
- 儲存 1GB / 傳輸 10GB 每月
- 一個門店一年用不到 100MB，非常夠

---

## 💸 要租給同行時

1. 客戶給你他想用的**網域**（例：`shop.foo.com`）
2. 幫他用上面 SOP 建租戶
3. 在 GitHub Pages 設定 custom domain（Claude 協助）
4. 白名單加 `shop.foo.com`
5. 把 `https://shop.foo.com/?t=<代號>` 給他

---

## 出問題怎麼辦

1. 先看 `REFACTOR_PROGRESS.md` 確認系統到哪個階段
2. 截圖錯誤畫面 + 貼當下的網址 → 發給 Claude
3. 進 Admin 後台看清單跟白名單有沒有少東西
4. 瀏覽器按 F12（如果 DevTools 偵測擋住就從 localhost 進）看 console 有沒有紅字

---

## 本機操作

### 要本地跑起來看
把 `src/` 當靜態資料夾服務：
```
cd src
python -m http.server 8080
```
打開 http://localhost:8080/?t=<代號>（localhost 會跳過白名單檢查）

### 要推版到線上
雙擊 `一鍵部署.bat`（會自動 build + commit + push）
