// 主程式與互動邏輯（多日獨立存檔 + 智慧沿用版）
import { state, SYSTEM_PASSWORD } from './state.js';
import {
  parseTime, showToast, requestNotificationPermission,
  getTodayDateStr, safeDateKey,
} from './utils.js';
import { dbVal, dbOn, dbSet, dbUpdate, dbRemove, dbRef } from './shop-db.js';
import { onValue } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';
import {
  renderScheduleAll, renderTracksOnly, updateTimeLineAndClock,
  initScheduleDragHandlers, quickPaste, initRowResize,
} from './schedule.js';
import {
  renderSettlementTable, pushDailySummary, copyDailyReport, copyAuntText,
  copySingleSettlementToExcel, copyFullSettlementToExcel, calculateSettlement,
} from './settlement.js';
import {
  loadWeeklyData, switchWeeklyRegion, switchWeekRange,
  toggleDay, toggleAllDays, deleteSelectedDays,
  addExpenseGroup, removeExpenseGroup, updateExpenseGroup,
  addExpenseItem, removeExpenseItem, updateExpense,
  copyWeeklyReport,
} from './weekly.js';
import { SYSTEM_CONFIG, loadSystemConfig } from './config.js';

let currentDbUnsubscribe = null;
let tempModalAttendance = true;

function formatZeroPadDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.replace(/-/g, '/').split('/');
  if (parts.length === 2) return parts[0].padStart(2, '0') + '/' + parts[1].padStart(2, '0');
  return dateStr;
}

function getOffsetDateStr(baseDateStr, offset) {
  const parts = baseDateStr.split('/');
  const d = new Date(new Date().getFullYear(), parseInt(parts[0]) - 1, parseInt(parts[1]));
  d.setDate(d.getDate() + offset);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return (m < 10 ? '0' + m : m) + '/' + (day < 10 ? '0' + day : day);
}

function setSync(color) {
  const el = document.getElementById('syncStatus');
  if (el) el.style.background = color;
}

export async function initSchedule() {
  setSync('orange');

  // 動態加入「一鍵銷毀」按鈕
  const navButtons = document.querySelector('.nav-buttons');
  if (navButtons && !document.getElementById('emergencyWipeBtn')) {
    const wipeBtn = document.createElement('button');
    wipeBtn.id = 'emergencyWipeBtn';
    wipeBtn.className = 'tab-btn';
    wipeBtn.style.backgroundColor = '#c0392b';
    wipeBtn.style.color = 'white';
    wipeBtn.style.marginLeft = '10px';
    wipeBtn.innerText = '💣 銷毀';
    wipeBtn.title = '一鍵清除所有資料';
    wipeBtn.onclick = emergencyWipe;
    navButtons.appendChild(wipeBtn);
  }

  await loadSystemConfig();
  cleanupOldData();

  try {
    const val = (await dbVal('shop_v8_global_settings')) || {};
    state.REGIONS = val.regions || [];
    state.roomConfig = val.roomConfig || {};
    state.services = val.services || [];
    state.regionPrefixes = val.regionPrefixes || {};

    const openEl = document.getElementById('openHour');
    const closeEl = document.getElementById('closeHour');
    if (openEl && val.openHour) openEl.value = val.openHour;
    if (closeEl && val.closeHour) closeEl.value = val.closeHour;
    renderRegionTabs();
    renderServices();

    const initialDate = localStorage.getItem('lastActiveDate') || getTodayDateStr();
    await switchDate(initialDate);

    // 全域設定變化時同步
    onValue(dbRef('shop_v8_global_settings'), snap => {
      const updatedVal = snap.val() || {};
      state.REGIONS = updatedVal.regions || [];
      state.roomConfig = updatedVal.roomConfig || {};
      state.services = updatedVal.services || [];
      state.regionPrefixes = updatedVal.regionPrefixes || {};

      const activeEl = document.activeElement;
      const isTyping = activeEl && activeEl.tagName === 'INPUT';
      const openH = document.getElementById('openHour');
      const closeH = document.getElementById('closeHour');
      if (updatedVal.openHour && !isTyping && activeEl && activeEl.id !== 'openHour' && openH) openH.value = updatedVal.openHour;
      if (updatedVal.closeHour && !isTyping && activeEl && activeEl.id !== 'closeHour' && closeH) closeH.value = updatedVal.closeHour;
      renderRegionTabs();
      renderServices();
    });

    setInterval(updateTimeLineAndClock, 1000);

    const rightContent = document.getElementById('rightContent');
    const leftContent = document.getElementById('leftContent');
    const rulerContainer = document.getElementById('rulerContainer');
    if (rightContent && leftContent && rulerContainer) {
      rightContent.addEventListener('scroll', () => {
        leftContent.scrollTop = rightContent.scrollTop;
        rulerContainer.scrollLeft = rightContent.scrollLeft;
      });
    }
    document.body.addEventListener('click', () => requestNotificationPermission(), { once: true });

    initScheduleDragHandlers();
  } catch (e) {
    console.error('初始化失敗:', e);
    setSync('red');
  }
}

export function emergencyWipe() {
  const pwd = prompt('⚠️ 警告：此動作將會一鍵銷毀所有排班與帳務資料！\n\n如果確定要銷毀，請輸入密碼以確認：');
  if (pwd === null) return;
  if (pwd === SYSTEM_PASSWORD) {
    dbRemove('shop_v8_daily_schedules');
    dbRemove('shop_v8_daily_summaries');
    dbRemove('shop_v8_weekly_state_v4');
    showToast('🗑️ 所有敏感資料已成功銷毀！');
    setTimeout(() => location.reload(), 1000);
  } else {
    alert('❌ 密碼錯誤！無法執行銷毀動作。');
  }
}

function cleanupOldData() {
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  dbVal('shop_v8_daily_schedules').then(data => {
    data = data || {};
    for (const key in data) {
      let ts = data[key].timestamp;
      if (!ts) {
        const parts = key.split('-');
        if (parts.length === 2) {
          const d = new Date(new Date().getFullYear(), parseInt(parts[0]) - 1, parseInt(parts[1]));
          if (d.getTime() > Date.now() + 86400000) d.setFullYear(d.getFullYear() - 1);
          ts = d.getTime();
        } else { ts = Date.now(); }
      }
      if (ts < cutoff) dbRemove(`shop_v8_daily_schedules/${key}`);
    }
  });
  dbVal('shop_v8_daily_summaries').then(data => {
    data = data || {};
    for (const key in data) {
      const ts = data[key].timestamp;
      if (ts && ts < cutoff) dbRemove(`shop_v8_daily_summaries/${key}`);
    }
  });
}

async function switchDate(newDateStr) {
  if (currentDbUnsubscribe) {
    try { currentDbUnsubscribe(); } catch (e) {}
    currentDbUnsubscribe = null;
  }
  const formattedDate = formatZeroPadDate(newDateStr);
  state.currentActiveDate = formattedDate;

  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const setTx  = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
  setVal('dateInput', formattedDate);
  setTx('navDateDisplay', formattedDate);
  setVal('settleDateInput', formattedDate);
  setTx('settleDateDisplay', formattedDate);

  localStorage.setItem('lastActiveDate', formattedDate);
  const sd = safeDateKey(formattedDate);
  state.currentDbPath = 'shop_v8_daily_schedules/' + sd;
  setSync('orange');

  const val = await dbVal(state.currentDbPath);
  let isEmpty = false;
  if (!val || !val.staffData) {
    isEmpty = true;
  } else {
    const arr = Array.isArray(val.staffData) ? val.staffData : Object.values(val.staffData);
    if (arr.length === 0) isEmpty = true;
  }

  if (isEmpty) {
    const prevDateStr = getOffsetDateStr(formattedDate, -1);
    const prevVal = await dbVal('shop_v8_daily_schedules/' + safeDateKey(prevDateStr));
    let newStaffData = [];
    const prevArr = (prevVal && prevVal.staffData)
      ? (Array.isArray(prevVal.staffData) ? prevVal.staffData : Object.values(prevVal.staffData))
      : [];
    if (prevArr.length > 0) {
      newStaffData = prevArr.map(s => ({ ...s, content: '', taskStatuses: {}, overrides: {}, manualExpense: 0 }));
    } else if (state.staffData && state.staffData.length > 0) {
      newStaffData = state.staffData.map(s => ({ ...s, content: '', taskStatuses: {}, overrides: {}, manualExpense: 0 }));
    } else {
      newStaffData = generateEmptyStaffFromConfig();
    }
    if (newStaffData.length === 0) newStaffData = generateEmptyStaffFromConfig();
    await dbSet(state.currentDbPath, { date: formattedDate, isLocked: false, staffData: newStaffData, timestamp: Date.now() });
  }

  currentDbUnsubscribe = onValue(dbRef(state.currentDbPath), snapshot => {
    const data = snapshot.val() || {};
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true');
    let rawStaffData = data.staffData || [];
    if (!Array.isArray(rawStaffData) && typeof rawStaffData === 'object') rawStaffData = Object.values(rawStaffData);
    state.isLocked = data.isLocked || false;
    state.staffData = rawStaffData.map(s => ({
      ...s,
      taskStatuses: s.taskStatuses || {},
      overrides: s.overrides || {},
      customConfig: s.customConfig || { enabled: false, comm: {}, cost: {}, work: {} },
      region: s.region || (state.REGIONS.length > 0 ? state.REGIONS[0] : '未分類'),
      attendance: s.attendance !== false,
    }));
    if (!isTyping) {
      renderScheduleAll();
      if (document.getElementById('view-settle').classList.contains('active')) renderSettlementTable();
    } else {
      requestAnimationFrame(renderTracksOnly);
    }
    updateLockUI();
    setSync('#2ecc71');
  });
}

function generateEmptyStaffFromConfig() {
  const newStaff = [];
  let idCounter = Date.now();
  state.REGIONS.forEach(region => {
    const rooms = state.roomConfig[region] || [];
    rooms.forEach(roomName => {
      newStaff.push({
        id: idCounter++,
        name: '',
        roomName,
        content: '',
        height: null,
        taskStatuses: {},
        overrides: {},
        customConfig: { enabled: false },
        region,
        attendance: true,
      });
    });
  });
  return newStaff;
}

function saveScheduleData() {
  setSync('red');
  const openHour = parseInt(document.getElementById('openHour').value) || 12;
  const closeHour = parseInt(document.getElementById('closeHour').value) || 26;
  dbUpdate('shop_v8_global_settings', {
    regions: state.REGIONS,
    roomConfig: state.roomConfig,
    services: state.services,
    openHour,
    closeHour,
    regionPrefixes: state.regionPrefixes,
  });

  state.staffData.sort((a, b) => {
    let indexA = state.REGIONS.indexOf(a.region);
    let indexB = state.REGIONS.indexOf(b.region);
    if (indexA === -1) indexA = 999;
    if (indexB === -1) indexB = 999;
    if (indexA !== indexB) return indexA - indexB;
    const rooms = state.roomConfig[a.region] || [];
    let roomIdxA = rooms.indexOf(a.roomName);
    let roomIdxB = rooms.indexOf(b.roomName);
    if (roomIdxA === -1) roomIdxA = 999;
    if (roomIdxB === -1) roomIdxB = 999;
    if (roomIdxA !== roomIdxB) return roomIdxA - roomIdxB;
    return a.id - b.id;
  });

  const dailyDataToSave = {
    staffData: state.staffData,
    isLocked: state.isLocked,
    date: state.currentActiveDate,
    timestamp: Date.now(),
  };
  dbUpdate(state.currentDbPath, dailyDataToSave)
    .then(() => setSync('#2ecc71'))
    .catch(err => {
      console.error('Firebase Save Error:', err);
      setSync('#f1c40f');
    });
}

function changeDay(offset) {
  if (!state.currentActiveDate) return;
  switchDate(getOffsetDateStr(state.currentActiveDate, offset));
}
function goToToday() { switchDate(getTodayDateStr()); }
function promptForDate() {
  const input = prompt('請輸入要跳轉的日期 (格式 MM/DD，例如 03/20)：', state.currentActiveDate);
  if (input) syncDate(input);
}
function syncDate(newDate) {
  if (!newDate) return;
  const formatted = formatZeroPadDate(newDate);
  if (formatted && /^\d{2}\/\d{2}$/.test(formatted)) switchDate(formatted);
  else alert('格式錯誤，請輸入 MM/DD (例: 03/20)');
}

function toggleSettleLock() {
  state.isLocked = !state.isLocked;
  saveScheduleData();
  updateLockUI();
  if (document.getElementById('view-settle').classList.contains('active')) renderSettlementTable();
  if (document.getElementById('view-schedule').classList.contains('active')) renderScheduleAll();
  if (state.isLocked) {
    pushDailySummary();
    showToast('🔒 帳單已鎖定，並已同步至周結報表！');
  } else {
    showToast('🔓 帳單已解鎖，可以修改了！(尚未同步)');
  }
}

function updateLockUI() {
  const btn = document.getElementById('lockSettleBtn');
  const settleDateInput = document.getElementById('settleDateInput');
  if (!btn) return;
  if (state.isLocked) {
    btn.innerHTML = '🔒 已鎖定 (點擊解鎖)';
    btn.style.background = '#e74c3c';
    if (settleDateInput) settleDateInput.disabled = true;
  } else {
    btn.innerHTML = '🔓 開放編輯中 (點擊鎖定)';
    btn.style.background = '#2ecc71';
    if (settleDateInput) settleDateInput.disabled = false;
  }
  document.querySelectorAll('.config-panel input').forEach(inp => {
    inp.disabled = state.isLocked;
    inp.style.background = state.isLocked ? '#f4f6f9' : '#fff';
  });
  const resetBtn = document.querySelector('.action-btn-reset');
  if (resetBtn) {
    resetBtn.disabled = state.isLocked;
    resetBtn.style.opacity = state.isLocked ? '0.5' : '1';
    resetBtn.style.cursor = state.isLocked ? 'not-allowed' : 'pointer';
  }
  ['openHour', 'closeHour'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = state.isLocked;
      el.style.background = state.isLocked ? '#f4f6f9' : '#fff';
    }
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + tabId).classList.add('active');
  const btns = document.querySelectorAll('.tab-btn');
  if (tabId === 'schedule') btns[0].classList.add('active');
  else if (tabId === 'settle') btns[1].classList.add('active');
  else if (tabId === 'weekly') btns[2].classList.add('active');
  renderRegionTabs();
  if (tabId === 'schedule') setTimeout(() => { renderScheduleAll(); updateTimeLineAndClock(); }, 50);
  if (tabId === 'settle') setTimeout(renderSettlementTable, 50);
  if (tabId === 'weekly') setTimeout(loadWeeklyData, 50);
}

function renderRegionTabs() {
  const scheduleContainer = document.getElementById('scheduleRegionTabs');
  const settleContainer = document.getElementById('settleRegionTabs');
  const weeklyContainer = document.getElementById('weeklyRegionTabs');

  if (!Array.isArray(state.currentRegion)) state.currentRegion = [state.currentRegion];

  let html = `<button class="region-btn ${state.currentRegion.includes('All') ? 'active' : ''}" onclick="switchRegion('All')">全部顯示</button>`;
  html += `<button class="region-btn" onclick="toggleWorkingOnly()" style="margin-left: 10px; border: 1px solid #27ae60; color: ${state.showWorkingOnly ? 'white' : '#27ae60'}; background: ${state.showWorkingOnly ? '#27ae60' : 'white'};">${state.showWorkingOnly ? '取消篩選' : '僅顯示上班'}</button>`;

  let weeklyHtml = `<button class="region-btn ${state.currentWeeklyRegions.includes('All') ? 'active' : ''}" onclick="switchWeeklyRegion('All')">全部顯示</button>`;

  state.REGIONS.forEach(r => {
    html += `<button class="region-btn ${state.currentRegion.includes(r) ? 'active' : ''}" onclick="switchRegion('${r}')">${r}</button>`;
    weeklyHtml += `<button class="region-btn ${state.currentWeeklyRegions.includes(r) ? 'active' : ''}" onclick="switchWeeklyRegion('${r}')">${r}</button>`;
  });

  if (scheduleContainer) scheduleContainer.innerHTML = html;
  if (settleContainer) settleContainer.innerHTML = html;
  if (weeklyContainer) weeklyContainer.innerHTML = weeklyHtml;
}

function switchRegion(region) {
  if (!Array.isArray(state.currentRegion)) state.currentRegion = [state.currentRegion];
  if (region === 'All') {
    state.currentRegion = ['All'];
  } else {
    if (state.currentRegion.includes('All')) {
      state.currentRegion = [region];
    } else {
      if (state.currentRegion.includes(region)) {
        state.currentRegion = state.currentRegion.filter(r => r !== region);
      } else {
        state.currentRegion.push(region);
      }
    }
    if (state.currentRegion.length === 0) state.currentRegion = ['All'];
  }
  renderRegionTabs();
  const isScheduleActive = document.getElementById('view-schedule').classList.contains('active');
  if (isScheduleActive) renderScheduleAll();
  else renderSettlementTable();
}

function toggleWorkingOnly() {
  state.showWorkingOnly = !state.showWorkingOnly;
  renderRegionTabs();
  if (document.getElementById('view-schedule').classList.contains('active')) renderScheduleAll();
  else if (document.getElementById('view-settle').classList.contains('active')) renderSettlementTable();
}

function updateRegionPrefix(value) {
  const region = document.getElementById('roomConfigRegionSelect').value;
  if (!region) return;
  state.regionPrefixes[region] = value;
  saveScheduleData();
  showToast(`✅ ${region} 複製前標已更新！`);
}

function updateStaffName(id, newName) {
  state.staffData = state.staffData.map(s => s.id === id ? { ...s, name: newName } : s);
  saveScheduleData();
}
function updateStaffRegion(id, newRegion) {
  state.staffData = state.staffData.map(s => s.id === id ? { ...s, region: newRegion } : s);
  saveScheduleData();
  renderScheduleAll();
}

// === Edit modal ===
function openEditModal(staffId) {
  if (state.isLocked) return;
  const staff = state.staffData.find(s => s.id === staffId);
  if (!staff) return;
  state.currentEditingStaffId = staffId;
  const titleEl = document.querySelector('#editModal .modal-title');
  if (titleEl) titleEl.innerText = staff.name || staff.roomName || '未命名';
  tempModalAttendance = staff.attendance !== false;
  updateModalAttendanceUI();
  document.getElementById('modalTextarea').value = staff.content || '';
  document.getElementById('editModal').classList.add('active');
  document.getElementById('modalTextarea').focus();
}
function toggleModalAttendance() {
  tempModalAttendance = !tempModalAttendance;
  updateModalAttendanceUI();
}
function updateModalAttendanceUI() {
  const btn = document.getElementById('modalAttendanceBtn');
  if (!btn) return;
  if (tempModalAttendance) { btn.className = 'btn-attendance working'; btn.innerText = '🟢 上班'; }
  else { btn.className = 'btn-attendance leave'; btn.innerText = '🔴 請假'; }
}
function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
  state.currentEditingStaffId = null;
}
function saveModalData() {
  if (!state.currentEditingStaffId) return;
  const newContent = document.getElementById('modalTextarea').value;
  state.staffData = state.staffData.map(s => {
    if (s.id === state.currentEditingStaffId) {
      return { ...s, content: newContent, overrides: {}, attendance: tempModalAttendance };
    }
    return s;
  });
  saveScheduleData();
  renderScheduleAll();
  if (document.getElementById('view-settle').classList.contains('active')) renderSettlementTable();
  closeEditModal();
}

// === Time modal ===
function openTimeModal(element, staffId, taskId, content, scheduledStart, scheduledEnd, lineIndex) {
  state.currentTaskElement = element;
  state.currentTaskInfo = { staffId, taskId, lineIndex };
  document.getElementById('scheduledTime').innerText = `${scheduledStart} - ${scheduledEnd}`;
  document.getElementById('inTimeInput').value = element.dataset.inTime || '';
  document.getElementById('outTimeInput').value = element.dataset.outTime || '';

  const staff = state.staffData.find(s => s.id === staffId);
  let currentAuntDisp = 0;
  let extractedName = '--';
  let revenue = 0;
  let rawContent = content;

  if (staff && lineIndex !== undefined) {
    const getGlobalVal = (id) => {
      const el = document.getElementById(id);
      return el ? (parseInt(el.value) || 0) : 0;
    };
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
    const W = state.WORK_UNIT_TABLE;
    const globalWorkTable = {
      '40-1':  W[40]  || 0,
      '60-1':  W[60]  || 0,
      '60-2':  W[60]  || 0,
      '120-3': W[120] || 0,
      '240-3': W[240] || 0,
    };
    let activeCommTable = globalCommTable;
    let activeCostTable = globalCostTable;
    let activeWorkTable = globalWorkTable;
    if (staff.customConfig && staff.customConfig.enabled) {
      activeCommTable = { ...globalCommTable, ...staff.customConfig.comm };
      activeCostTable = { ...globalCostTable, ...staff.customConfig.cost };
      activeWorkTable = { ...globalWorkTable, ...(staff.customConfig.work || {}) };
    }
    const { results } = calculateSettlement(staff, activeCommTable, activeCostTable, activeWorkTable, state.services);
    const rowResult = results.find(r => r.index === lineIndex);
    if (rowResult) {
      currentAuntDisp = rowResult.aunt_disp;
      extractedName = rowResult.extractedName || '--';
      revenue = rowResult.revenue || 0;
      rawContent = rowResult.rawLine || content;
    }
  }
  document.getElementById('modalRawContent').innerText = rawContent;
  document.getElementById('modalExtractedName').innerText = extractedName;
  document.getElementById('modalRevenue').innerText = revenue;
  document.getElementById('auntModalInput').value = currentAuntDisp;
  document.getElementById('timeModal').classList.add('active');
}
function closeTimeModal() {
  document.getElementById('timeModal').classList.remove('active');
  state.currentTaskElement = null;
  state.currentTaskInfo = null;
}
function fillCurrentTime(type) {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const t = `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
  document.getElementById(type === 'in' ? 'inTimeInput' : 'outTimeInput').value = t;
}
function saveManualTime() {
  if (!state.currentTaskElement || !state.currentTaskInfo) return;
  const { staffId, taskId, lineIndex } = state.currentTaskInfo;
  const newInTime = document.getElementById('inTimeInput').value.trim();
  const newOutTime = document.getElementById('outTimeInput').value.trim();
  const timeRegex = /^\d{2}:\d{2}$/;
  if ((newInTime && !timeRegex.test(newInTime)) || (newOutTime && !timeRegex.test(newOutTime))) {
    alert('格式錯誤 HH:MM');
    return;
  }
  const newAuntVal = parseInt(document.getElementById('auntModalInput').value) || 0;
  state.staffData = state.staffData.map(staff => {
    if (staff.id === staffId) {
      const updatedTaskStatus = {};
      if (newInTime) updatedTaskStatus.inTime = newInTime;
      if (newOutTime) updatedTaskStatus.outTime = newOutTime;
      const currentOverrides = staff.overrides ? { ...staff.overrides } : {};
      if (lineIndex !== undefined) {
        if (!currentOverrides[lineIndex]) currentOverrides[lineIndex] = {};
        currentOverrides[lineIndex].aunt_disp = newAuntVal;
      }
      return {
        ...staff,
        taskStatuses: { ...(staff.taskStatuses || {}), [taskId]: updatedTaskStatus },
        overrides: currentOverrides,
      };
    }
    return staff;
  });
  saveScheduleData();
  if (newInTime) state.currentTaskElement.dataset.inTime = newInTime;
  else delete state.currentTaskElement.dataset.inTime;
  if (newOutTime) state.currentTaskElement.dataset.outTime = newOutTime;
  else delete state.currentTaskElement.dataset.outTime;
  if (document.getElementById('view-settle').classList.contains('active')) renderSettlementTable();
  closeTimeModal();
}
function clearManualTime() {
  if (!state.currentTaskElement || !state.currentTaskInfo) return;
  const { staffId, taskId } = state.currentTaskInfo;
  state.staffData = state.staffData.map(staff => {
    if (staff.id === staffId) {
      const updatedTaskStatuses = { ...(staff.taskStatuses || {}) };
      delete updatedTaskStatuses[taskId];
      return { ...staff, taskStatuses: updatedTaskStatuses };
    }
    return staff;
  });
  saveScheduleData();
  delete state.currentTaskElement.dataset.inTime;
  delete state.currentTaskElement.dataset.outTime;
  document.getElementById('inTimeInput').value = '';
  document.getElementById('outTimeInput').value = '';
  closeTimeModal();
}

// === Services ===
let isServicePanelExpanded = localStorage.getItem('servicePanelExpanded') !== 'false';
function initServicePanel() {
  const container = document.getElementById('service_container');
  const icon = document.getElementById('serviceToggleIcon');
  if (!container) return;
  if (isServicePanelExpanded) {
    container.style.display = 'flex';
    if (icon) icon.innerText = '▼';
  } else {
    container.style.display = 'none';
    if (icon) icon.innerText = '▶';
  }
}
function toggleServicePanel() {
  isServicePanelExpanded = !isServicePanelExpanded;
  localStorage.setItem('servicePanelExpanded', isServicePanelExpanded);
  initServicePanel();
}
function renderServices() {
  const container = document.getElementById('service_container');
  if (!container) return;
  container.innerHTML = '';
  state.services.forEach((svc, index) => {
    const div = document.createElement('div');
    div.className = 'service-row';
    div.innerHTML = `<input type="text" value="${svc.name}" onchange="updateService(${index}, 'name', this.value)" ${state.isLocked ? 'disabled' : ''}><span>+</span><input type="number" value="${svc.price}" oninput="updateService(${index}, 'price', this.value)" step="100" ${state.isLocked ? 'disabled' : ''}><button class="btn-circle btn-red" style="width:18px; height:18px; font-size:12px; ${state.isLocked ? 'display:none;' : ''}" onclick="removeService(${index})">×</button>`;
    container.appendChild(div);
  });
  initServicePanel();
  const addSvcBtn = document.getElementById('addServiceRowBtn');
  if (addSvcBtn) addSvcBtn.style.display = state.isLocked ? 'none' : 'inline-flex';
}
function updateService(index, field, value) {
  let finalValue = value;
  if (field === 'price') {
    const parsed = parseInt(value);
    finalValue = isNaN(parsed) ? state.services[index].price : parsed;
    if (value === '') finalValue = 0;
  }
  state.services = state.services.map((svc, i) => i === index ? { ...svc, [field]: finalValue } : svc);
  renderServices();
  renderSettlementTable();
  saveScheduleData();
}
function addServiceRow() {
  state.services.push({ name: '新項目', price: 0 });
  renderServices();
  renderSettlementTable();
  saveScheduleData();
}
function removeService(index) {
  state.services = state.services.filter((_, i) => i !== index);
  renderServices();
  renderSettlementTable();
  saveScheduleData();
}

// === Settlement edits ===
const BASE_PARAM_KEYS = ['40-1', '60-1', '60-2', '120-3', '240-3'];

function updateStaffSettlement(staffId, field, value) {
  state.staffData = state.staffData.map(s => {
    if (s.id === staffId) {
      let val = value;
      if (field === 'agentRate' || field === 'manualExpense') val = parseInt(value) || 0;
      return { ...s, [field]: val };
    }
    return s;
  });
  saveScheduleData();
  renderSettlementTable();
}

function saveOverride(staffId, lineIndex, field, element) {
  const value = element.innerText;
  let finalVal;
  if (field === 'note') {
    finalVal = value;
  } else {
    finalVal = parseInt(value.replace(/[^\d-]/g, '')) || 0;
    element.innerText = finalVal;
    element.classList.add('manual-text');
  }
  state.staffData = state.staffData.map(s => {
    if (s.id === staffId) {
      const currentOverrides = s.overrides || {};
      if (!currentOverrides[lineIndex]) currentOverrides[lineIndex] = {};
      currentOverrides[lineIndex][field] = finalVal;
      return { ...s, overrides: currentOverrides };
    }
    return s;
  });
  saveScheduleData();
  if (field !== 'note') setTimeout(renderSettlementTable, 50);
}

// === Params modal ===
function openStaffParamsModal(staffId) {
  const staff = state.staffData.find(s => s.id === staffId);
  if (!staff) return;
  state.currentParamsStaffId = staffId;
  document.getElementById('staffParamsTitle').innerText = `正在設定: ${staff.name || staff.roomName || '未命名'}`;
  const custom = staff.customConfig || { enabled: false, comm: {}, cost: {}, work: {} };
  const toggle = document.getElementById('useCustomParamsToggle');
  const inputsDiv = document.getElementById('paramsInputs');
  toggle.checked = custom.enabled;
  inputsDiv.style.opacity = custom.enabled ? '1' : '0.5';
  inputsDiv.style.pointerEvents = custom.enabled ? 'auto' : 'none';
  toggle.onchange = (e) => {
    inputsDiv.style.opacity = e.target.checked ? '1' : '0.5';
    inputsDiv.style.pointerEvents = e.target.checked ? 'auto' : 'none';
  };
  const listContainer = document.getElementById('dynamicParamsList');
  listContainer.innerHTML = '';
  const keysToShow = new Set([...BASE_PARAM_KEYS]);
  if (custom.comm) Object.keys(custom.comm).forEach(k => keysToShow.add(k));
  const sortedKeys = Array.from(keysToShow).sort((a, b) => parseInt(a) - parseInt(b));
  let htmlBuffer = '';
  sortedKeys.forEach(key => {
    const elComm = document.getElementById(`base_${key.replace('-', '_')}`);
    const elCost = document.getElementById(`cost_${key.replace('-', '_')}`);
    const defaultComm = elComm ? (parseInt(elComm.value) || 0) : 0;
    const defaultCost = elCost ? (parseInt(elCost.value) || 0) : 0;
    const defaultWork = state.WORK_UNIT_TABLE[parseInt(key.split('-')[0])] || 0;
    const commVal = (custom.comm && custom.comm[key] !== undefined) ? custom.comm[key] : defaultComm;
    const costVal = (custom.cost && custom.cost[key] !== undefined) ? custom.cost[key] : defaultCost;
    const workVal = (custom.work && custom.work[key] !== undefined) ? custom.work[key] : defaultWork;
    const isBase = BASE_PARAM_KEYS.includes(key);
    htmlBuffer += `<div class="param-row-item" data-key="${key}" style="display: flex; justify-content: space-between; align-items: center; gap: 5px; padding: 6px 0; border-bottom: 1px dashed #eee;"><div style="width: 20%; font-weight: bold; text-align: center; color: #7f8c8d; font-size: 14px;">${key.replace('-', '/')}</div><div style="width: 25%;"><input type="number" class="p-comm" value="${commVal}" style="width: 100%; padding: 4px; border: 1px solid #e0e0e0; border-radius: 4px; text-align: center; font-weight: bold; color: #2ecc71; font-size: 14px;"></div><div style="width: 25%;"><input type="number" class="p-cost" value="${costVal}" style="width: 100%; padding: 4px; border: 1px solid #e0e0e0; border-radius: 4px; text-align: center; font-weight: bold; color: #e74c3c; font-size: 14px;"></div><div style="width: 15%;"><input type="number" class="p-work" value="${workVal}" style="width: 100%; padding: 4px; border: 1px solid #e0e0e0; border-radius: 4px; text-align: center; font-weight: bold; color: #d35400; font-size: 14px;"></div><div style="width: 15%; text-align: center;">${!isBase ? `<button onclick="this.closest('.param-row-item').remove()" style="background:transparent; border:none; color:#e74c3c; font-size:18px; cursor:pointer; font-weight:bold;">×</button>` : `<span style="color:#bdc3c7; font-size:12px;">預設</span>`}</div></div>`;
  });
  listContainer.innerHTML = htmlBuffer;
  document.getElementById('staffParamsModal').classList.add('active');
}

function addNewParamRow() {
  const inputStr = prompt("請輸入新增的參數項目\n(格式為：分鐘/次數，例如 50/2 或 90/2)");
  if (!inputStr) return;
  const match = inputStr.match(/^(\d+)[\/-](\d+)$/);
  if (!match) { alert("⚠️ 格式錯誤！請輸入如 '50/2' 的格式。"); return; }
  const key = `${match[1]}-${match[2]}`;
  if (document.querySelector(`.param-row-item[data-key="${key}"]`)) {
    alert('⚠️ 此項目已經存在列表中！');
    return;
  }
  const listContainer = document.getElementById('dynamicParamsList');
  const rowHtml = `<div class="param-row-item" data-key="${key}" style="display: flex; justify-content: space-between; align-items: center; gap: 5px; padding: 6px 0; border-bottom: 1px dashed #eee;"><div style="width: 20%; font-weight: bold; text-align: center; color: #3498db; font-size: 14px;">${key.replace('-', '/')}</div><div style="width: 25%;"><input type="number" class="p-comm" value="0" style="width: 100%; padding: 4px; border: 1px solid #3498db; border-radius: 4px; text-align: center; font-weight: bold; color: #2ecc71; font-size: 14px;"></div><div style="width: 25%;"><input type="number" class="p-cost" value="0" style="width: 100%; padding: 4px; border: 1px solid #3498db; border-radius: 4px; text-align: center; font-weight: bold; color: #e74c3c; font-size: 14px;"></div><div style="width: 15%;"><input type="number" class="p-work" value="0" style="width: 100%; padding: 4px; border: 1px solid #3498db; border-radius: 4px; text-align: center; font-weight: bold; color: #d35400; font-size: 14px;"></div><div style="width: 15%; text-align: center;"><button onclick="this.closest('.param-row-item').remove()" style="background:transparent; border:none; color:#e74c3c; font-size:18px; cursor:pointer; font-weight:bold;">×</button></div></div>`;
  listContainer.insertAdjacentHTML('beforeend', rowHtml);
  listContainer.scrollTop = listContainer.scrollHeight;
}

function closeParamsModal() {
  document.getElementById('staffParamsModal').classList.remove('active');
  state.currentParamsStaffId = null;
}

function saveStaffParams() {
  if (!state.currentParamsStaffId) return;
  const enabled = document.getElementById('useCustomParamsToggle').checked;
  const comm = {}, cost = {}, work = {};
  document.querySelectorAll('.param-row-item').forEach(row => {
    const key = row.dataset.key;
    comm[key] = parseInt(row.querySelector('.p-comm').value) || 0;
    cost[key] = parseInt(row.querySelector('.p-cost').value) || 0;
    work[key] = parseInt(row.querySelector('.p-work').value) || 0;
  });
  state.staffData = state.staffData.map(s => {
    if (s.id === state.currentParamsStaffId) return { ...s, customConfig: { enabled, comm, cost, work } };
    return s;
  });
  saveScheduleData();
  renderSettlementTable();
  closeParamsModal();
}

function clearAllSchedules() {
  if (!confirm('確定要清空這一天所有人的「班表內容」嗎？\n(不會影響別天的資料)')) return;
  state.staffData = state.staffData.map(s => ({ ...s, content: '', taskStatuses: {}, overrides: {} }));
  saveScheduleData();
  renderScheduleAll();
  if (document.getElementById('view-settle').classList.contains('active')) renderSettlementTable();
  showToast('✅ 已清空本日班表');
}

function resetStaffSettings(staffId) {
  if (!confirm('確定要初始化此人的所有設定嗎？\n(包含經紀費率、獨立參數、雜支都會恢復預設)')) return;
  state.staffData = state.staffData.map(staff => {
    if (staff.id === staffId) {
      return {
        ...staff,
        customConfig: { enabled: false, comm: {}, cost: {}, work: {} },
        agentName: '',
        agentRate: 300,
        manualExpense: 0,
        overrides: {},
      };
    }
    return staff;
  });
  saveScheduleData();
  renderSettlementTable();
  showToast('✅ 已還原設定');
}

// === Region / Room config ===
function addNewRegion() {
  const input = document.getElementById('newRegionInput');
  const newRegion = input.value.trim();
  if (!newRegion) { alert('請輸入區域名稱！'); return; }
  if (state.REGIONS.includes(newRegion)) { alert('⚠️ 此區域已經存在了！'); return; }
  state.REGIONS.push(newRegion);
  state.roomConfig[newRegion] = [];
  input.value = '';
  saveScheduleData();
  renderRegionTabs();
  const select = document.getElementById('roomConfigRegionSelect');
  select.innerHTML = state.REGIONS.map(r => `<option value="${r}">${r}</option>`).join('');
  select.value = newRegion;
  renderRoomConfigUI();
  showToast(`✅ 已新增大區域：${newRegion}`);
}

function deleteCurrentRegion() {
  const region = document.getElementById('roomConfigRegionSelect').value;
  if (!region) return;
  if (!confirm(`確定要刪除大區域「${region}」嗎？\n這會同時刪除該區【所有的房間設定】，並且把今天排班表上該區的房間一併移除！`)) return;

  state.REGIONS = state.REGIONS.filter(r => r !== region);
  delete state.roomConfig[region];
  state.staffData = state.staffData.filter(s => s.region !== region);
  saveScheduleData();
  renderRegionTabs();
  openRoomConfigModal();

  if (document.getElementById('view-schedule').classList.contains('active')) {
    renderScheduleAll();
  } else if (document.getElementById('view-settle').classList.contains('active')) {
    renderSettlementTable();
  }
  showToast(`🗑️ 已刪除區域：${region}`);
}

function openRoomConfigModal() {
  const select = document.getElementById('roomConfigRegionSelect');
  if (state.REGIONS.length === 0) {
    select.innerHTML = '<option value="">(空)</option>';
  } else {
    select.innerHTML = state.REGIONS.map(r => `<option value="${r}">${r}</option>`).join('');
    if (!state.currentRegion.includes('All') && state.currentRegion.length > 0 && state.REGIONS.includes(state.currentRegion[0])) {
      select.value = state.currentRegion[0];
    }
  }
  renderRoomConfigUI();
  document.getElementById('roomConfigModal').classList.add('active');
}

function closeRoomConfigModal() {
  document.getElementById('roomConfigModal').classList.remove('active');
}

function renderRoomConfigUI() {
  const region = document.getElementById('roomConfigRegionSelect').value;
  const listContainer = document.getElementById('roomConfigList');
  const prefixInput = document.getElementById('regionPrefixInput');
  if (prefixInput) prefixInput.value = state.regionPrefixes[region] || '';

  if (!region || state.REGIONS.length === 0) {
    listContainer.innerHTML = '<div style="color:#aaa; text-align:center; padding:10px;">請先在上方【+ 新增區域】</div>';
    return;
  }
  if (!state.roomConfig[region]) state.roomConfig[region] = [];
  const rooms = state.roomConfig[region];
  if (rooms.length === 0) {
    listContainer.innerHTML = '<div style="color:#aaa; text-align:center; padding:10px;">尚未設定房間，請在下方新增。</div>';
    return;
  }
  listContainer.innerHTML = rooms.map((roomName, index) =>
    `<div style="display:flex; justify-content:space-between; align-items:center; background:#f4f6f9; padding:8px 12px; border-radius:6px; border:1px solid #ddd; margin-bottom:5px;"><span style="font-weight:bold; color:#2c3e50;">${roomName}</span><button onclick="removeRoomFromConfig('${region}', ${index})" style="background:transparent; border:none; color:#e74c3c; font-size:18px; cursor:pointer; font-weight:bold;">×</button></div>`
  ).join('');
}

function addNewRoomToConfig() {
  const region = document.getElementById('roomConfigRegionSelect').value;
  if (!region || state.REGIONS.length === 0) { alert('請先選擇或新增大區域！'); return; }
  const input = document.getElementById('newRoomInput');
  const newRoomName = input.value.trim();
  if (!newRoomName) return;
  if (!state.roomConfig[region]) state.roomConfig[region] = [];
  state.roomConfig[region].push(newRoomName);
  input.value = '';
  saveScheduleData();
  renderRoomConfigUI();
}

function removeRoomFromConfig(region, index) {
  if (!confirm('確定要刪除這個房間嗎？')) return;
  state.roomConfig[region].splice(index, 1);
  saveScheduleData();
  renderRoomConfigUI();
}

function applyRoomTemplate() {
  const region = document.getElementById('roomConfigRegionSelect').value;
  if (!region) return;
  const rooms = state.roomConfig[region] || [];
  if (rooms.length === 0) { alert(`⚠️ ${region} 目前沒有設定任何房間！`); return; }
  if (!confirm(`確定要同步「${region}」的配置到【今日班表】嗎？\n(系統會自動補上新房間，並移除設定裡已經刪掉的空房間)`)) return;

  state.staffData = state.staffData.filter(s => {
    if (s.region !== region) return true;
    return rooms.includes(s.roomName);
  });
  const existingRooms = state.staffData.filter(s => s.region === region).map(s => s.roomName);
  rooms.forEach((roomName, index) => {
    if (!existingRooms.includes(roomName)) {
      state.staffData.push({
        id: Date.now() + index,
        name: '',
        roomName,
        content: '',
        height: null,
        taskStatuses: {},
        overrides: {},
        customConfig: { enabled: false },
        region,
        attendance: true,
      });
    }
  });
  saveScheduleData();
  renderScheduleAll();
  closeRoomConfigModal();
  showToast(`✅ 已同步 ${region} 配置！`);
}

// === Copy availability ===
function copySingleAvailability(staffId) {
  const now = new Date();
  let h = now.getHours();
  const m = now.getMinutes();
  if (h < 11) h += 24;
  const nowMins = h * 60 + m;
  const formatTimeDot = (mins) => {
    let hh = Math.floor(mins / 60);
    const mm = mins % 60;
    if (hh >= 24) hh -= 24;
    return (hh < 10 ? '0' + hh : hh) + '.' + (mm < 10 ? '0' + mm : mm);
  };

  const staff = state.staffData.find(s => s.id === staffId);
  if (!staff) return;
  const contentLines = (staff.content || '').split('\n');
  const tasks = [];
  let activeBlockDate = state.currentActiveDate;

  contentLines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;
    const isDateLine = /^[\d./-]+\s*(?:\([^)]+\))?$/.test(trimmedLine) && trimmedLine.length < 15;
    if (isDateLine) {
      const mMatch = trimmedLine.match(/(\d{1,2})[\/\-\.](\d{1,2})/);
      if (mMatch) activeBlockDate = mMatch[1].padStart(2, '0') + '/' + mMatch[2].padStart(2, '0');
      return;
    }
    if (activeBlockDate !== state.currentActiveDate) return;

    const match = trimmedLine.match(/([\d.:]+)\s*(\d+.*)/) || trimmedLine.match(/(\D+)\s*([\d.:]+)\s*(\d+.*)/);
    if (!match) return;
    let timeStr, detailStr;
    if (match.length === 3) { timeStr = match[1]; detailStr = match[2]; }
    else { timeStr = match[2]; detailStr = match[3]; }
    let duration = 60;
    const numMatch = detailStr.match(/^(\d+)/);
    if (numMatch) duration = parseInt(numMatch[1]);
    const start = parseTime(timeStr);
    if (start !== null) tasks.push({ start, end: start + duration + 10 });
  });

  tasks.sort((a, b) => a.start - b.start);
  const hasValidTasks = tasks.length > 0;
  const mergedTasks = [];
  if (hasValidTasks) {
    let currentTask = tasks[0];
    for (let i = 1; i < tasks.length; i++) {
      const nextTask = tasks[i];
      if (nextTask.start - currentTask.end < 40) {
        currentTask.end = Math.max(currentTask.end, nextTask.end);
      } else {
        mergedTasks.push(currentTask);
        currentTask = nextTask;
      }
    }
    mergedTasks.push(currentTask);
  }

  const futureTasks = mergedTasks.filter(t => t.end > nowMins);
  const displayName = staff.name || '未填寫';
  const prefixText = state.regionPrefixes[staff.region] ? state.regionPrefixes[staff.region] : '';
  const parts = [prefixText + displayName];

  if (futureTasks.length === 0) {
    if (!hasValidTasks) {
      if ((staff.content || '').trim() === '') parts.push('現走');
      else parts.push(`(${(staff.content || '').trim().replace(/\n/g, ' ')})`);
    } else { parts.push('現走'); }
  } else {
    const firstTask = futureTasks[0];
    if (firstTask.start - nowMins >= 40) parts.push('現走');
    futureTasks.forEach((t, i) => {
      const startStr = formatTimeDot(t.start);
      const endStr = formatTimeDot(t.end);
      if (nowMins >= t.start && nowMins < t.end && i === 0) parts.push('目前有客');
      else parts.push(`${startStr}有客`);
      parts.push(`${endStr}可約`);
    });
  }
  const textToCopy = parts.join(' ');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(textToCopy)
      .then(() => showToast('📋 已複製空檔！'))
      .catch(() => alert('複製失敗，請手動複製:\n\n' + textToCopy));
  } else {
    alert('瀏覽器不支援自動複製，請手動複製:\n\n' + textToCopy);
  }
}

function toggleTopBar() {
  const topBar = document.querySelector('.schedule-top-bar');
  const toggleBtn = document.getElementById('toggleTopBarBtn');
  if (!topBar) return;
  topBar.classList.toggle('collapsed');
  if (toggleBtn) toggleBtn.innerText = topBar.classList.contains('collapsed') ? '🔽' : '🔼';
  setTimeout(() => {
    if (document.getElementById('view-schedule').classList.contains('active')) {
      renderTracksOnly();
    }
  }, 300);
}

function applyZoom(scaleValue) {
  const views = document.querySelectorAll('.view-container');
  views.forEach(view => { view.style.zoom = scaleValue; });
  localStorage.setItem('appZoomLevel', scaleValue);
  if (document.getElementById('view-schedule').classList.contains('active')) {
    setTimeout(renderTracksOnly, 100);
  }
}

function resetFromModal() {
  if (!state.currentEditingStaffId) return;
  if (!confirm('確定要徹底重置這個房間的「今日」設定嗎？\n(名字、班表、獨立參數與經紀都會恢復預設，不影響過往紀錄，視窗將關閉)')) return;
  state.staffData = state.staffData.map(s => {
    if (s.id === state.currentEditingStaffId) {
      return {
        ...s,
        name: '',
        content: '',
        taskStatuses: {},
        overrides: {},
        manualExpense: 0,
        agentName: '',
        agentRate: 300,
        customConfig: { enabled: false, comm: {}, cost: {}, work: {} },
      };
    }
    return s;
  });
  saveScheduleData();
  renderScheduleAll();
  if (document.getElementById('view-settle').classList.contains('active')) renderSettlementTable();
  closeEditModal();
  showToast('🔄 當日房間資訊已徹底重置');
}

// 截圖下載（保留舊功能）
function downloadScreenshot() {
  if (typeof html2canvas !== 'function') { alert('html2canvas 尚未載入'); return; }
  const target = document.getElementById('view-settle');
  if (!target) return;
  showToast('⏳ 截圖處理中...');
  html2canvas(target, { backgroundColor: '#ffffff', scale: 2 }).then(canvas => {
    const link = document.createElement('a');
    link.download = `日結_${state.currentActiveDate.replace(/\//g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('✅ 截圖已下載');
  }).catch(err => {
    console.error(err);
    showToast('❌ 截圖失敗');
  });
}

// === 把所有要給 HTML inline onclick 用的函式暴露到 window ===
export function exposeGlobals() {
  const g = {
    // schedule
    renderScheduleAll, renderTracksOnly, renderSettlementTable,
    quickPaste, initRowResize,
    // app core
    switchTab, switchRegion, toggleWorkingOnly, updateRegionPrefix,
    renderRegionTabs, saveScheduleData,
    changeDay, goToToday, promptForDate, syncDate,
    updateStaffName, updateStaffRegion,
    clearAllSchedules, emergencyWipe,
    toggleTopBar, applyZoom, resetFromModal,
    // edit modal
    openEditModal, closeEditModal, saveModalData, toggleModalAttendance,
    // time modal
    openTimeModal, closeTimeModal, saveManualTime, clearManualTime, fillCurrentTime,
    // services
    toggleServicePanel, renderServices, updateService, addServiceRow, removeService,
    // settlement
    toggleSettleLock, updateStaffSettlement, saveOverride,
    openStaffParamsModal, addNewParamRow, closeParamsModal, saveStaffParams,
    resetStaffSettings,
    pushDailySummary, copyDailyReport, copyAuntText,
    copySingleSettlementToExcel, copyFullSettlementToExcel,
    downloadScreenshot,
    // room config
    addNewRegion, deleteCurrentRegion,
    openRoomConfigModal, closeRoomConfigModal, renderRoomConfigUI,
    addNewRoomToConfig, removeRoomFromConfig, applyRoomTemplate,
    copySingleAvailability,
    // weekly
    loadWeeklyData, switchWeeklyRegion, switchWeekRange,
    toggleDay, toggleAllDays, deleteSelectedDays,
    addExpenseGroup, removeExpenseGroup, updateExpenseGroup,
    addExpenseItem, removeExpenseItem, updateExpense,
    copyWeeklyReport,
  };
  Object.assign(window, g);
}
