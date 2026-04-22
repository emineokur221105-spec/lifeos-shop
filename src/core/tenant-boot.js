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

const WHITELIST_CACHE_KEY = 'lifeos_whitelist_cache';

// 手機弱網時 Firebase get() 可能永遠 pending（沒預設 timeout）→ 畫面卡在「驗證授權中...」
// 加 15 秒硬上限，逾時丟可讀錯誤，交給 index.html 的 catch 顯示重整按鈕
function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label + '（網路逾時，請檢查網路後重新整理）')), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

async function loadWhitelistWithCache() {
  try {
    const whitelist = await withTimeout(loadWhitelist(), 15000, '讀取白名單逾時');
    try { localStorage.setItem(WHITELIST_CACHE_KEY, JSON.stringify(whitelist)); } catch {}
    return { whitelist, fromCache: false };
  } catch (err) {
    try {
      const cached = localStorage.getItem(WHITELIST_CACHE_KEY);
      if (cached) {
        console.warn('[LifeOS] 白名單讀取失敗，使用本機快取版本');
        return { whitelist: JSON.parse(cached), fromCache: true };
      }
    } catch {}
    // 首次使用且無網路時，略過白名單檢查（同空白名單行為）
    console.warn('[LifeOS] 白名單讀取失敗且無快取，略過 hostname 檢查');
    return { whitelist: [], fromCache: false };
  }
}

export async function bootTenant(onStatus) {
  const params = new URLSearchParams(location.search);
  const code = params.get('t');
  if (!code) {
    location.replace('./');
    throw new Error('missing tenant code, redirecting');
  }

  onStatus && onStatus('驗證授權中...');
  const { whitelist } = await loadWhitelistWithCache();
  if (whitelist.length > 0) {
    await window.LifeOSSecurity.init({ allowedHashes: whitelist });
  } else {
    console.warn('[LifeOS] 白名單為空，略過 hostname 檢查（首次設定用）');
  }

  onStatus && onStatus('載入租戶資料...');
  const tenant = await withTimeout(loadTenant(code), 15000, '載入租戶逾時');
  window.__lifeos_tenant = tenant;
  return tenant;
}
