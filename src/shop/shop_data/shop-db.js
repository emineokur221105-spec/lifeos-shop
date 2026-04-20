// v11 modular Firebase Database 輕量包裝
// 用 setDb(tenant.tenantDb) 注入 db 後，其餘模組用 dbXxx(path, ...) 操作
import {
  ref,
  get,
  set,
  update,
  push,
  remove,
  onValue,
  off,
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';

let _db = null;

export function setDb(db) {
  _db = db;
}

export function rawDb() {
  if (!_db) throw new Error('shop-db: db 尚未注入，請先 setDb()');
  return _db;
}

export function dbRef(path) {
  return ref(rawDb(), path);
}

export function dbGet(path) {
  return get(dbRef(path));
}

export async function dbVal(path) {
  const snap = await dbGet(path);
  return snap.val();
}

export function dbSet(path, value) {
  return set(dbRef(path), value);
}

export function dbUpdate(path, value) {
  return update(dbRef(path), value);
}

// 回傳新 child key（對應舊版 .push().key）
export function dbPushKey(path) {
  const r = push(dbRef(path));
  return r.key;
}

export function dbRemove(path) {
  return remove(dbRef(path));
}

// 訂閱 value 變化，回傳 unsubscribe 函式
export function dbOn(path, callback) {
  const r = dbRef(path);
  return onValue(r, callback);
}

export function dbOff(path) {
  off(dbRef(path));
}

export { ref, get, set, update, push, remove, onValue, off };
