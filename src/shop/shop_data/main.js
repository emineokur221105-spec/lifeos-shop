// 門店管理入口點（v11 modular ES module）
// 流程：驗租戶 → 注入 db → 暴露 onclick handlers → initSchedule() → 還原縮放
import { bootTenant } from '../../core/tenant-boot.js';
import { setDb } from './shop-db.js';
import { initSchedule, exposeGlobals } from './app.js';

try {
  const tenant = await bootTenant();
  window.TENANT_NAME = tenant.name;
  window.TENANT_CODE = tenant.code;
  setDb(tenant.tenantDb);
  document.title = `${tenant.name} - 門店管理`;

  // 首頁按鈕帶回該租客入口（?t=<code>）
  const homeLink = document.getElementById('homeLink');
  if (homeLink && tenant.code) {
    homeLink.href = './?t=' + encodeURIComponent(tenant.code);
  }

  // 先暴露 onclick handlers，因 initSchedule 期間會產生含 onclick 的 DOM
  exposeGlobals();
  await initSchedule();

  // 還原上次的縮放設定
  const savedZoom = localStorage.getItem('appZoomLevel') || '1';
  const zoomSelect = document.getElementById('uiZoomSelect');
  if (zoomSelect) zoomSelect.value = savedZoom;
  if (typeof window.applyZoom === 'function') window.applyZoom(savedZoom);
} catch (e) {
  console.error('[shop] 租戶開機失敗:', e);
  document.body.innerHTML = `<div style="padding:40px;text-align:center;color:#c0392b;font-family:sans-serif;">
    <h2>⚠️ 無法載入門店資料</h2>
    <p>${e.message || e}</p>
    <p><a href="./" style="color:#3498db;">返回首頁</a></p>
  </div>`;
}
