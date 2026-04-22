// 租戶頁面共用開機流程
// 用法：
//   import { bootTenant } from './core/tenant-boot.js';
//   const tenant = await bootTenant();          // 沒 ?t= 會自動跳首頁
//   const db = tenant.tenantDb;
//
// 會做：(1) 讀主 Firebase 白名單 → 跑 security.init 驗 hostname + 裝鍵盤攔截
//       (2) 照 ?t=<代號> 載該租戶 → 回傳 { code, name, defaults, tenantApp, tenantDb }

import { loadWhitelist, loadTenant } from './tenant-loader.js';
import './security.js'; // side-effect：註冊 window.LifeOSSecurity

export async function bootTenant(onStatus) {
  const params = new URLSearchParams(location.search);
  const code = params.get('t');
  if (!code) {
    location.replace('./');
    throw new Error('missing tenant code, redirecting');
  }

  onStatus && onStatus('驗證授權中...');
  const whitelist = await loadWhitelist();
  if (whitelist.length > 0) {
    await window.LifeOSSecurity.init({ allowedHashes: whitelist });
  } else {
    console.warn('[LifeOS] 白名單為空，略過 hostname 檢查（首次設定用）');
  }

  onStatus && onStatus('載入租戶資料...');
  const tenant = await loadTenant(code);
  window.__lifeos_tenant = tenant;
  return tenant;
}
