// === firebase-compat.js : v8 compat API 外殼，內部走 v11 modular SDK ===
// 目的：shop_data/*.js 程式碼量大（2000+ 行）、寫法全是 db.ref('foo').once('value')...
//      與其全檔重寫，不如在 v11 modular SDK 上包一層 v8 風格的薄殼，程式碼主體不動。
// 用法：
//      import { initShopDb } from './firebase-compat.js';
//      const db = initShopDb(tenantFirebaseConfig);
//      // 之後 db.ref('path').once('value').then(snap => snap.val()) 都照 v8 寫法

import {
  ref as mRef,
  get as mGet,
  set as mSet,
  update as mUpdate,
  remove as mRemove,
  push as mPush,
  onValue as mOnValue,
  off as mOff
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';

function makeSnap(modularSnap) {
  return {
    val: () => modularSnap.val(),
    exists: () => modularSnap.exists(),
    key: modularSnap.key,
    // forEach 讓呼叫端可以用 snap.forEach(child => child.val()) 取得子節點
    forEach: (cb) => {
      let stop = false;
      modularSnap.forEach((child) => {
        if (stop) return true;
        const childWrap = makeSnap(child);
        const ret = cb(childWrap);
        if (ret === true) stop = true;
        return stop;
      });
    }
  };
}

function makeRef(database, path) {
  const modRef = mRef(database, path);
  const listeners = []; // [{ eventType, unsubscribe }]

  const wrapper = {
    _modRef: modRef,
    _path: path,

    // 一次性讀取：db.ref(x).once('value').then(snap => ...)
    once(eventType = 'value') {
      if (eventType !== 'value') {
        console.warn('[firebase-compat] once() 只支援 value 事件，收到:', eventType);
      }
      return mGet(modRef).then(snap => makeSnap(snap));
    },

    // 即時監聽：db.ref(x).on('value', snap => ...)
    on(eventType, callback) {
      if (eventType !== 'value') {
        console.warn('[firebase-compat] on() 只支援 value 事件，收到:', eventType);
        return callback;
      }
      const unsub = mOnValue(modRef, (snap) => callback(makeSnap(snap)));
      listeners.push({ eventType, unsub });
      return callback; // v8 回傳 callback 以便之後 off(cb) 使用
    },

    // 取消全部監聽
    off(eventType, callback) {
      // v8 的 off() 可以不帶參數（關全部）、帶事件、或帶事件+callback
      // 我們簡化：一律關閉本 ref 掛過的所有監聽
      while (listeners.length) {
        const { unsub } = listeners.pop();
        try { unsub(); } catch (e) {}
      }
      try { mOff(modRef); } catch (e) {}
    },

    // 寫入整包
    set(value) {
      return mSet(modRef, value);
    },

    // 部分更新（可傳物件或路徑->值的 map）
    update(values) {
      return mUpdate(modRef, values);
    },

    // 刪除節點
    remove() {
      return mRemove(modRef);
    },

    // push 產生新 key，並立刻寫入資料
    push(value) {
      const newModRef = mPush(modRef, value);
      // v8 push 回傳是 ThenableReference，有 .key 屬性且可 await
      const pushWrapper = makeRef(database, newModRef.key ? `${path}/${newModRef.key}` : path);
      pushWrapper.key = newModRef.key;
      // push() 回傳物件可直接當 promise 使用
      pushWrapper.then = (fn, efn) => newModRef.then ? newModRef.then(fn, efn) : Promise.resolve(newModRef).then(fn, efn);
      return pushWrapper;
    },

    // 取子節點
    child(subPath) {
      const joined = path.endsWith('/') ? (path + subPath) : (path + '/' + subPath);
      return makeRef(database, joined);
    }
  };

  return wrapper;
}

/**
 * 拿 bootTenant() 已初始化好的 v11 modular Database 物件，包成 v8 風格 db。
 * 不要在這裡再 initializeApp，避免一個 databaseURL 建兩個 app 導致 Firebase 警告。
 * @param {import('firebase/database').Database} modularDatabase
 * @returns {{ref: (path:string)=>object}}
 */
export function wrapShopDb(modularDatabase) {
  if (!modularDatabase) {
    throw new Error('❌ wrapShopDb: modularDatabase 為空');
  }
  return {
    ref(path) { return makeRef(modularDatabase, path); },
    _raw: { database: modularDatabase }
  };
}
