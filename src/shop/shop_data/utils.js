// 純工具函式，與舊版 utils.js 行為對齊
import { state } from './state.js';

// 把 "13:20" / "13.20" / "1320" / "1" 等字串解析成從「今日起點」算起的分鐘數。
// 小於 11 的小時數自動 +24，讓跨半夜時間可以直接比大小。
export function parseTime(timeStr) {
  if (!timeStr) return null;
  timeStr = String(timeStr).replace('.', ':');
  const parts = timeStr.split(':');
  let h = 0, m = 0;
  if (parts.length === 2) {
    h = parseInt(parts[0]);
    m = parseInt(parts[1]);
  } else if (timeStr.length === 4) {
    h = parseInt(timeStr.substring(0, 2));
    m = parseInt(timeStr.substring(2, 4));
  } else {
    h = parseInt(timeStr);
  }
  if (isNaN(h)) return null;
  if (h < 11) h += 24;
  return h * 60 + m;
}

export function formatTime(minutes) {
  let h = Math.floor(minutes / 60);
  let m = minutes % 60;
  if (h > 24) h -= 24;
  return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
}

export function formatDuration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return (h > 0 ? h + 'h' : '') + (m > 0 ? m + 'm' : '');
}

export function getTaskHash(rawText, startMinutes) {
  const safeText = String(rawText).replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
  return `T${startMinutes}_${safeText}`;
}

export function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg;
  t.className = 'show';
  setTimeout(() => { t.className = t.className.replace('show', ''); }, 3000);
}

export function getRegionColor(regionName) {
  const idx = state.REGIONS.indexOf(regionName);
  if (idx === -1) return '#95a5a6';
  const REGION_COLORS = [
    '#3498db', '#9b59b6', '#e67e22', '#1abc9c',
    '#e74c3c', '#34495e', '#f39c12', '#2ecc71',
  ];
  return REGION_COLORS[idx % REGION_COLORS.length];
}

// === 鬧鐘音效 ===
const ALARM_URL = 'https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg';
let _alarmAudio = null;
function getAlarm() {
  if (!_alarmAudio) {
    try { _alarmAudio = new Audio(ALARM_URL); }
    catch (e) { console.warn('無法建立 Audio', e); }
  }
  return _alarmAudio;
}

export function playLoudAlarm() {
  const audio = getAlarm();
  if (!audio) return;
  audio.currentTime = 0;
  const p = audio.play();
  if (p !== undefined) {
    p.then(() => {
      setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
      }, 4000);
    }).catch(err => console.warn('音效播放失敗:', err));
  }
}

export function sendSystemNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body, requireInteraction: true }); }
    catch (e) { console.warn('通知失敗', e); }
  }
}

export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') { showToast('✅ 已開啟通知權限'); playLoudAlarm(); }
    });
  } else {
    const audio = getAlarm();
    if (audio) {
      audio.play().then(() => setTimeout(() => audio.pause(), 100)).catch(() => {});
    }
  }
}

// 從 DOM 抓出目前的底薪/底價/工數表
export function getGlobalPricingTables() {
  const getGlobalVal = (id) => {
    const el = document.getElementById(id);
    return el ? (parseInt(el.value) || 0) : 0;
  };
  const W = state.WORK_UNIT_TABLE || {};
  const globalCommTable = {
    '40-1':  getGlobalVal('base_40_1'),
    '60-1':  getGlobalVal('base_60_1'),
    '60-2':  getGlobalVal('base_60_2'),
    '120-3': getGlobalVal('base_120_3'),
    '240-3': getGlobalVal('base_240_3'),
  };
  const globalCostTable = {
    '40-1':  getGlobalVal('cost_40_1'),
    '60-1':  getGlobalVal('cost_60_1'),
    '60-2':  getGlobalVal('cost_60_2'),
    '120-3': getGlobalVal('cost_120_3'),
    '240-3': getGlobalVal('cost_240_3'),
  };
  const globalWorkTable = {
    '40-1':  W[40]  || 1,
    '60-1':  W[60]  || 1,
    '60-2':  W[60]  || 1,
    '120-3': W[120] || 2,
    '240-3': W[240] || 3,
  };
  return { globalCommTable, globalCostTable, globalWorkTable };
}

// 取得今天 MM/DD 字串（與舊版 getTodayDateStr 同義）
export function getTodayDateStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}`;
}

export function safeDateKey(dateStr) {
  return (dateStr || '').replace(/\//g, '-');
}
