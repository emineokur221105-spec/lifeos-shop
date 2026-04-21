// 租戶載入器
// 從主 Firebase 讀：(1) hostname 白名單 hash，(2) 指定租戶的 Firebase config + 預設參數
// 再用租戶 config 初始化第二個 Firebase app，回傳該租戶的 db
//
// 主 Firebase 資料結構：
//   /whitelist           → { "<sha256-hash>": true, ... }
//   /tenants/<代號>      → { name, firebaseConfig, defaults }

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import { mainDb } from './main-firebase-config.js';

export async function loadWhitelist() {
  const snap = await get(ref(mainDb, 'whitelist'));
  const data = snap.val() || {};
  return Object.keys(data).filter(k => data[k]);
}

export async function loadTenant(code) {
  if (!code) throw new Error('未指定租戶代號（?t=）');
  const snap = await get(ref(mainDb, 'tenants/' + code));
  const tenant = snap.val();
  if (!tenant) throw new Error('找不到租戶：' + code);
  if (!tenant.firebaseConfig) throw new Error('租戶未設定 Firebase config：' + code);

  const tenantApp = initializeApp(tenant.firebaseConfig, 'tenant-' + code);
  const tenantDb = getDatabase(tenantApp);

  return {
    code: code,
    name: tenant.name || code,
    firebaseConfig: tenant.firebaseConfig,
    defaults: tenant.defaults || {},
    tenantApp: tenantApp,
    tenantDb: tenantDb
  };
}

export async function listTenants() {
  const snap = await get(ref(mainDb, 'tenants'));
  const data = snap.val() || {};
  return Object.keys(data).map(code => ({
    code: code,
    name: data[code].name || code
  }));
}
