// LifeOS-Shop 共用小工具
// 輕量零依賴；各頁面要用再 import，不強迫重構現有實作
//
// 用法：
//   import { showToast, escapeHtml, formatNumber, debounce } from './core/common.js';
//   showToast('已儲存', 'ok');

// ========== Toast ==========
// 自動創 DOM（如果頁面沒有 #lifeos-toast），自動淡入淡出消失
// kind: 'ok' | 'err' | 'info'（預設）| 'warn'
let _toastEl = null;
let _toastTimer = null;

function ensureToastEl() {
  if (_toastEl && document.body.contains(_toastEl)) return _toastEl;
  _toastEl = document.getElementById('lifeos-toast');
  if (_toastEl) return _toastEl;

  _toastEl = document.createElement('div');
  _toastEl.id = 'lifeos-toast';
  _toastEl.style.cssText =
    'position:fixed;left:50%;bottom:48px;transform:translateX(-50%) translateY(12px);' +
    'background:#2d3436;color:#fff;padding:12px 22px;border-radius:50px;' +
    'font-size:14px;line-height:1.4;font-family:-apple-system,"Noto Sans TC",sans-serif;' +
    'box-shadow:0 4px 14px rgba(0,0,0,.35);z-index:99999;' +
    'opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;' +
    'max-width:80vw;text-align:center;white-space:pre-wrap;';
  document.body.appendChild(_toastEl);
  return _toastEl;
}

export function showToast(msg, kind = 'info', duration = 2400) {
  const el = ensureToastEl();
  el.textContent = msg;
  const palette = {
    ok:   { bg: '#1e8449', fg: '#fff' },
    err:  { bg: '#c0392b', fg: '#fff' },
    warn: { bg: '#d35400', fg: '#fff' },
    info: { bg: '#2d3436', fg: '#fff' }
  };
  const p = palette[kind] || palette.info;
  el.style.background = p.bg;
  el.style.color = p.fg;
  el.style.opacity = '1';
  el.style.transform = 'translateX(-50%) translateY(0)';

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(12px)';
  }, duration);
}

// ========== HTML escape ==========
export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ========== 數字格式化 ==========
export function formatNumber(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0';
  return x.toLocaleString('en-US');
}

export function formatCurrency(n, symbol = '$') {
  return symbol + formatNumber(n);
}

// ========== 日期 ==========
// pad(5) → '05'
function pad(n) { return String(n).padStart(2, '0'); }

// formatDate(new Date(), 'YYYY-MM-DD HH:mm') → '2026-04-20 14:30'
// 支援 token: YYYY MM DD HH mm ss
export function formatDate(d, fmt = 'YYYY-MM-DD') {
  const date = (d instanceof Date) ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  return fmt
    .replace(/YYYY/g, date.getFullYear())
    .replace(/MM/g, pad(date.getMonth() + 1))
    .replace(/DD/g, pad(date.getDate()))
    .replace(/HH/g, pad(date.getHours()))
    .replace(/mm/g, pad(date.getMinutes()))
    .replace(/ss/g, pad(date.getSeconds()));
}

// ISO 週字串（跟 <input type="week"> 格式一致：'2026-W17'）
export function getISOWeekString(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-W' + pad(weekNo);
}

// ========== debounce ==========
// 連續觸發只跑最後一次；常用於輸入框自動儲存
export function debounce(fn, wait = 400) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

// ========== 剪貼簿複製 ==========
// 用原生 navigator.clipboard 優先，失敗 fallback 到 textarea + execCommand
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fallback */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) {}
  ta.remove();
  return ok;
}

// ========== 當前租戶 ==========
// 各頁面透過 bootTenant 已經把 window.__lifeos_tenant 塞好，這裡提供一致的存取
export function getCurrentTenant() {
  return (typeof window !== 'undefined' && window.__lifeos_tenant) || null;
}

// 取得當前 URL 的 ?t= 代號（沒有回空字串）
export function getTenantCode() {
  try {
    return new URLSearchParams(location.search).get('t') || '';
  } catch (e) {
    return '';
  }
}

// 租戶專屬的 localStorage 前綴 key（避免多租戶共用瀏覽器時互相覆蓋）
// 例：lsKey('myFooter') → 't:qinre-main:myFooter'
export function lsKey(name) {
  const code = getTenantCode();
  return code ? `t:${code}:${name}` : `t:_:${name}`;
}
