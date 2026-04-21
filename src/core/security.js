// LifeOS-Shop 統一防盜模組
// 三層防禦：hostname 白名單（SHA-256）+ F12 快捷鍵攔截 + DevTools 尺寸偵測
// 注意：不用 debugger 陷阱（避免誤傷 Raymond 本人除錯）

(function (global) {
  'use strict';

  async function sha256(text) {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function blockPage(reason) {
    document.documentElement.innerHTML =
      '<div style="font-family:-apple-system,sans-serif;background:#1a1a1a;' +
      'color:#eee;display:flex;align-items:center;justify-content:center;' +
      'height:100vh;margin:0;text-align:center;">' +
      '<div><h1 style="color:#e74c3c;">⚠ 存取被拒</h1>' +
      '<p>' + reason + '</p></div></div>';
    try { window.stop(); } catch (e) {}
    throw new Error('LifeOS security block: ' + reason);
  }

  // 第一層：hostname 白名單比對
  // allowedHashes = 從主 Firebase 讀到的 SHA-256 陣列
  async function checkHostname(allowedHashes) {
    const host = location.hostname.toLowerCase();
    // localhost / 127.0.0.1 開發時放行
    if (host === 'localhost' || host === '127.0.0.1' || host === '') return true;
    if (!Array.isArray(allowedHashes) || allowedHashes.length === 0) {
      blockPage('尚未設定授權網域');
    }
    const myHash = await sha256(host);
    if (!allowedHashes.includes(myHash)) {
      blockPage('此網域未獲授權：' + host);
    }
    return true;
  }

  // 第二層：F12 / 右鍵 / 常見快捷鍵攔截
  function installKeyBlocker() {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', e => {
      const k = (e.key || '').toLowerCase();
      if (e.key === 'F12') return e.preventDefault();
      if (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k)) return e.preventDefault();
      if (e.ctrlKey && k === 'u') return e.preventDefault();
      if (e.ctrlKey && k === 's') return e.preventDefault();
    });
  }

  // 第三層：DevTools 尺寸偵測
  // 原理：DevTools 打開時 outerWidth - innerWidth 會變大
  function installDevToolsDetector(onDetected) {
    const THRESHOLD = 300;
    let triggered = false;
    setInterval(() => {
      const widthGap = window.outerWidth - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;
      if (!triggered && (widthGap > THRESHOLD || heightGap > THRESHOLD)) {
        triggered = true;
        onDetected();
      }
    }, 1000);
  }

  async function init(options) {
    options = options || {};
    const hashes = options.allowedHashes || [];
    await checkHostname(hashes);

    // 本地開發環境（localhost / 127.0.0.1）跳過 F12 攔截與 DevTools 偵測，方便 Raymond 除錯
    const host = location.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '') return;

    installKeyBlocker();
    installDevToolsDetector(() => blockPage('偵測到開發者工具'));
  }

  global.LifeOSSecurity = {
    init: init,
    sha256: sha256,
    blockPage: blockPage
  };
})(window);
