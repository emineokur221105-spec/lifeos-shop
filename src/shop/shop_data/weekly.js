// 周結與報表邏輯（週次獨立支出版）
import { state } from './state.js';
import { dbVal, dbUpdate, dbRemove } from './shop-db.js';
import { escapeHtml } from '../../core/common.js';

// 注入周結專屬 CSS（只注入一次）
let cssInjected = false;
function injectWeeklyCss() {
  if (cssInjected) return;
  cssInjected = true;
  const weeklyStyle = document.createElement('style');
  weeklyStyle.innerHTML = `
    .week-range-btn { padding: 8px 16px; border-radius: 20px; border: 2px solid #3498db; background: white; color: #3498db; font-size: 14px; font-weight: bold; cursor: pointer; transition: 0.2s; white-space: nowrap; }
    .week-range-btn.active { background: #3498db; color: white; box-shadow: 0 4px 8px rgba(52,152,219,0.3); }
    .day-check-label { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 16px; border: 2px solid #bdc3c7; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; color: #7f8c8d; background: white; transition: 0.2s; user-select: none; min-width: 110px; }
    .day-check-label input { display: none; }
    .day-check-label.checked { background: #e1f5fe; color: #007bff; border-color: #007bff; }
    .day-check-label.checked::before { content: '✔'; font-size: 14px; }
    .breakdown-row { display: flex; justify-content: space-between; font-size: 12px; color: #7f8c8d; padding: 3px 0; border-bottom: 1px dashed #eee; }
    .breakdown-row:last-child { border-bottom: none; }
    .expense-card { background: #fffcf5; border: 1px solid #f8c471; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
    .expense-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #fad7a1; padding-bottom: 8px; margin-bottom: 5px; color: #c0392b; font-weight: bold; }
    .expense-item-row { display: flex; gap: 5px; align-items: center; margin-bottom: 5px; }
    .expense-item-row input { border: 1px solid #ccc; border-radius: 4px; padding: 6px; font-size: 14px; }
    .add-expense-item-btn { width: 100%; border: 1px dashed #3498db; background: transparent; color: #3498db; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold; margin-top: 5px; }
    .region-btn.multi-active { background: #3498db; color: white; border-color: #2980b9; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  `;
  document.head.appendChild(weeklyStyle);
}

export async function loadWeeklyData() {
  injectWeeklyCss();
  try {
    state.rawWeeklyData = (await dbVal('shop_v8_daily_summaries')) || {};

    let availableDates = Object.keys(state.rawWeeklyData)
      .map(k => state.rawWeeklyData[k].dateName)
      .filter(Boolean);
    availableDates = [...new Set(availableDates)].sort();

    groupDatesByWeek(availableDates);

    if (!state.activeWeekRange || !state.weekRangeKeys.includes(state.activeWeekRange)) {
      state.activeWeekRange = state.weekRangeKeys.length > 0
        ? state.weekRangeKeys[state.weekRangeKeys.length - 1]
        : '';
      if (state.activeWeekRange) state.selectedDates = [...state.weekRangesMap[state.activeWeekRange]];
    }

    renderWeeklyRegionTabs();
    renderWeekRangesAndDays();
    calculateAndRenderSummaries();
    loadExpensesForActiveWeek();
  } catch (e) {
    console.error('周結初始化失敗:', e);
  }
}

async function loadExpensesForActiveWeek() {
  if (!state.activeWeekRange) return;
  const safeKey = state.activeWeekRange.replace(/\//g, '-').replace(/\s/g, '');
  const val = await dbVal('shop_v8_weekly_expenses/' + safeKey);
  state.expenseGroups = val ? (val.expenseGroups || []) : [];
  renderExpenses();
}

// 從 state.rawWeeklyData 對應 dateStr 的 timestamp 取年份。
// 找不到 timestamp（早期資料）才退回月份猜測：資料月份比當月大超過 6 視為去年。
function inferYear(month, dateStr) {
  if (dateStr && state.rawWeeklyData) {
    for (const k in state.rawWeeklyData) {
      const entry = state.rawWeeklyData[k];
      if (entry && entry.dateName === dateStr && entry.timestamp) {
        return new Date(entry.timestamp).getFullYear();
      }
    }
  }
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return (month - currentMonth > 6) ? currentYear - 1 : currentYear;
}

function groupDatesByWeek(dates) {
  state.weekRangesMap = {};
  state.weekRangeKeys = [];
  dates.forEach(dateStr => {
    const parts = dateStr.split('/');
    if (parts.length !== 2) return;
    const month = parseInt(parts[0]);
    const d = new Date(inferYear(month, dateStr), month - 1, parseInt(parts[1]));
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const formatD = (dt) => {
      const m = dt.getMonth() + 1;
      const day = dt.getDate();
      return (m < 10 ? '0' + m : m) + '/' + (day < 10 ? '0' + day : day);
    };
    const rangeStr = `${formatD(monday)} - ${formatD(sunday)}`;
    if (!state.weekRangesMap[rangeStr]) {
      state.weekRangesMap[rangeStr] = [];
      state.weekRangeKeys.push(rangeStr);
    }
    state.weekRangesMap[rangeStr].push(dateStr);
  });
  state.weekRangeKeys.sort();
}

function getDayOfWeekStr(dateStr) {
  const month = parseInt(dateStr.split('/')[0]);
  const d = new Date(
    inferYear(month, dateStr),
    month - 1,
    parseInt(dateStr.split('/')[1]),
  );
  return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
}

export function renderWeeklyRegionTabs() {
  const container = document.getElementById('weeklyRegionTabs');
  if (!container) return;
  let html = `<button class="region-btn ${state.currentWeeklyRegions.includes('All') ? 'active' : ''}" onclick="switchWeeklyRegion('All')">全部顯示</button>`;
  state.REGIONS.forEach(r => {
    const isActive = state.currentWeeklyRegions.includes(r);
    const safeR = escapeHtml(r);
    html += `<button class="region-btn ${isActive ? 'multi-active' : ''}" onclick="switchWeeklyRegion('${safeR}')">${safeR}</button>`;
  });
  container.innerHTML = html;
}

export function switchWeeklyRegion(region) {
  if (region === 'All') {
    state.currentWeeklyRegions = ['All'];
  } else {
    if (state.currentWeeklyRegions.includes('All')) {
      state.currentWeeklyRegions = [region];
    } else {
      if (state.currentWeeklyRegions.includes(region)) {
        state.currentWeeklyRegions = state.currentWeeklyRegions.filter(r => r !== region);
      } else {
        state.currentWeeklyRegions.push(region);
      }
    }
    if (state.currentWeeklyRegions.length === 0) state.currentWeeklyRegions = ['All'];
  }
  renderWeeklyRegionTabs();
  calculateAndRenderSummaries();
}

function renderWeekRangesAndDays() {
  const container = document.getElementById('weekly_days_container');
  if (!container) return;

  const rangeButtons = state.weekRangeKeys.map(key => `
    <button class="week-range-btn ${key === state.activeWeekRange ? 'active' : ''}" onclick="switchWeekRange('${key}')">${key}</button>
  `).join('');

  const dayCheckboxes = (state.weekRangesMap[state.activeWeekRange] || []).map(dateStr => `
    <label class="day-check-label ${state.selectedDates.includes(dateStr) ? 'checked' : ''}">
      <input type="checkbox" ${state.selectedDates.includes(dateStr) ? 'checked' : ''} onchange="toggleDay('${dateStr}', this.checked)">
      ${dateStr} (${getDayOfWeekStr(dateStr)})
    </label>
  `).join('');

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 15px;">
      <div>
        <div style="font-size: 15px; font-weight: bold; color: #34495e; margin-bottom: 10px;">📁 1. 選擇週次區間</div>
        <div style="display:flex; gap:12px; overflow-x:auto; padding-bottom:5px;">${rangeButtons || '無紀錄'}</div>
      </div>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 12px; border: 1px solid #e9ecef;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="font-size: 15px; font-weight: bold; color: #2980b9;">✅ 2. 勾選每日明細 <span style="font-size:13px; color:#7f8c8d;">(${state.activeWeekRange})</span></div>
          <div style="display:flex; gap:10px;">
            <button onclick="toggleAllDays()" style="background:#f39c12; color:white; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:bold;">🔄 全選/取消</button>
            <button onclick="deleteSelectedDays()" style="background:#e74c3c; color:white; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:bold;">🗑️ 刪除紀錄</button>
          </div>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:10px;">${dayCheckboxes || '無資料'}</div>
      </div>
    </div>
  `;
}

export function switchWeekRange(rangeKey) {
  state.activeWeekRange = rangeKey;
  state.selectedDates = [...(state.weekRangesMap[rangeKey] || [])];
  renderWeekRangesAndDays();
  calculateAndRenderSummaries();
  loadExpensesForActiveWeek();
}

export function toggleAllDays() {
  const daysInView = state.weekRangesMap[state.activeWeekRange] || [];
  if (daysInView.every(d => state.selectedDates.includes(d))) {
    state.selectedDates = state.selectedDates.filter(d => !daysInView.includes(d));
  } else {
    daysInView.forEach(d => {
      if (!state.selectedDates.includes(d)) state.selectedDates.push(d);
    });
  }
  renderWeekRangesAndDays();
  calculateAndRenderSummaries();
}

export function toggleDay(dateStr, isChecked) {
  if (isChecked) {
    if (!state.selectedDates.includes(dateStr)) state.selectedDates.push(dateStr);
  } else {
    state.selectedDates = state.selectedDates.filter(d => d !== dateStr);
  }
  renderWeekRangesAndDays();
  calculateAndRenderSummaries();
}

export async function deleteSelectedDays() {
  if (state.selectedDates.length === 0) return alert('請先勾選日期');
  if (!confirm(`確定要刪除這 ${state.selectedDates.length} 天的結算紀錄嗎？`)) return;
  for (const dateStr of state.selectedDates) {
    await dbRemove('shop_v8_daily_summaries/' + dateStr.replace(/\//g, '-'));
  }
  location.reload();
}

function calculateAndRenderSummaries() {
  const totals = { rev: 0, aunt: 0, agent: 0, works: 0, dailyProfit: 0 };
  const breakdowns = { rev: [], aunt: [], agentMap: {}, works: [], dailyProfit: [] };

  state.selectedDates.sort().forEach(dateStr => {
    const dData = state.rawWeeklyData[dateStr.replace(/\//g, '-')];
    if (!dData) return;
    const isAll = state.currentWeeklyRegions.includes('All');
    let dRev = 0, dAunt = 0, dAgent = 0, dWorks = 0, dProfit = 0;
    if (isAll) {
      dRev = dData.revenue || 0;
      dAunt = dData.aunt || 0;
      dAgent = dData.agentTotal || 0;
      dWorks = dData.works || 0;
      dProfit = dData.profit || 0;
      if (dData.agentMap) {
        for (const [agent, fee] of Object.entries(dData.agentMap)) {
          breakdowns.agentMap[agent] = (breakdowns.agentMap[agent] || 0) + fee;
        }
      }
    } else {
      state.currentWeeklyRegions.forEach(r => {
        const rData = (dData.regionData && dData.regionData[r]) || {};
        dRev += rData.revenue || 0;
        dAunt += rData.aunt || 0;
        dAgent += rData.agentTotal || 0;
        dWorks += rData.works || 0;
        dProfit += rData.profit || 0;
        if (rData.agentMap) {
          for (const [agent, fee] of Object.entries(rData.agentMap)) {
            breakdowns.agentMap[agent] = (breakdowns.agentMap[agent] || 0) + fee;
          }
        }
      });
    }
    totals.rev += dRev;
    totals.aunt += dAunt;
    totals.agent += dAgent;
    totals.works += dWorks;
    totals.dailyProfit += dProfit;
    breakdowns.rev.push({ date: dateStr, val: dRev });
    breakdowns.aunt.push({ date: dateStr, val: dAunt });
    breakdowns.works.push({ date: dateStr, val: dWorks });
    breakdowns.dailyProfit.push({ date: dateStr, val: dProfit });
  });

  const fStr = (arr) => arr.map(x => `<div class="breakdown-row"><span>${x.date}</span><span>$${x.val.toLocaleString()}</span></div>`).join('');
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  const setH = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
  set('week_revenue', totals.rev.toLocaleString());
  setH('week_revenue_breakdown', fStr(breakdowns.rev));
  set('week_aunt', totals.aunt.toLocaleString());
  setH('week_aunt_breakdown', fStr(breakdowns.aunt));
  set('week_works', totals.works.toLocaleString());
  setH('week_works_breakdown', breakdowns.works.map(x => `<div class="breakdown-row"><span>${x.date}</span><span>${x.val}</span></div>`).join(''));
  set('week_daily_profit', '$' + totals.dailyProfit.toLocaleString());
  setH('week_daily_profit_breakdown', fStr(breakdowns.dailyProfit));
  set('week_agent_total', '$' + totals.agent.toLocaleString());
  let agentHtml = '';
  for (const [a, v] of Object.entries(breakdowns.agentMap)) {
    if (v > 0) agentHtml += `<div class="breakdown-row"><span>${escapeHtml(a)}</span><span style="color:#c0392b; font-weight:bold;">$${v.toLocaleString()}</span></div>`;
  }
  setH('week_agent_breakdown', agentHtml || '<div style="color:#aaa; font-size:12px;">無經紀費支出</div>');
  updateFinalProfit(totals.dailyProfit);
}

function renderExpenses() {
  const container = document.getElementById('weekly_expenses_container');
  if (!container) return;
  let totalExpenseAmount = 0;
  container.innerHTML = '';
  state.expenseGroups.forEach((group, gIdx) => {
    let groupTotal = 0;
    const itemsHtml = group.items.map((item, iIdx) => {
      groupTotal += parseInt(item.amount) || 0;
      return `<div class="expense-item-row">
        <input type="text" value="${escapeHtml(item.name)}" placeholder="項目" style="flex:1;" onchange="updateExpense(${gIdx}, ${iIdx}, 'name', this.value)">
        <span style="color:#95a5a6;">$</span>
        <input type="number" value="${item.amount}" placeholder="0" style="width:80px; text-align:right;" onchange="updateExpense(${gIdx}, ${iIdx}, 'amount', this.value)">
        <button class="btn-circle btn-red" style="width:20px; height:20px;" onclick="removeExpenseItem(${gIdx}, ${iIdx})">×</button>
      </div>`;
    }).join('');
    totalExpenseAmount += groupTotal;
    const card = document.createElement('div');
    card.className = 'expense-card';
    card.innerHTML = `
      <div class="expense-header">
        👤 <input type="text" value="${escapeHtml(group.name)}" onchange="updateExpenseGroup(${gIdx}, this.value)" style="border:none; background:transparent; font-weight:bold; width:80px;">
        <div style="display:flex; gap:10px; align-items:center;">
          <span>$${groupTotal.toLocaleString()}</span>
          <button class="btn-circle btn-red" style="width:20px; height:20px;" onclick="removeExpenseGroup(${gIdx})">×</button>
        </div>
      </div>
      ${itemsHtml}
      <button class="add-expense-item-btn" onclick="addExpenseItem(${gIdx})">+ 新增支出項目</button>`;
    container.appendChild(card);
  });
  const topSpan = document.getElementById('week_expenses_total_top');
  const bottomSpan = document.getElementById('week_expenses_total_bottom');
  if (topSpan) topSpan.innerText = totalExpenseAmount.toLocaleString();
  if (bottomSpan) bottomSpan.innerText = totalExpenseAmount.toLocaleString();
  calculateAndRenderSummaries();
}

function updateFinalProfit(dailyProfitSum) {
  const totalExpense = state.expenseGroups.reduce(
    (sum, g) => sum + g.items.reduce((s, i) => s + (parseInt(i.amount) || 0), 0),
    0,
  );
  const el = document.getElementById('week_final_profit');
  if (el) el.innerText = (dailyProfitSum - totalExpense).toLocaleString();
}

export function addExpenseGroup() {
  state.expenseGroups.push({ id: Date.now(), name: '人員', items: [] });
  saveWeeklyState();
  renderExpenses();
}

export function removeExpenseGroup(gIdx) {
  if (!confirm('刪除人員？')) return;
  state.expenseGroups.splice(gIdx, 1);
  saveWeeklyState();
  renderExpenses();
}

export function updateExpenseGroup(gIdx, newName) {
  state.expenseGroups[gIdx].name = newName;
  saveWeeklyState();
}

export function addExpenseItem(gIdx) {
  state.expenseGroups[gIdx].items.push({ name: '', amount: 0 });
  saveWeeklyState();
  renderExpenses();
}

export function removeExpenseItem(gIdx, iIdx) {
  state.expenseGroups[gIdx].items.splice(iIdx, 1);
  saveWeeklyState();
  renderExpenses();
}

export function updateExpense(gIdx, iIdx, field, value) {
  if (field === 'amount') value = parseInt(value) || 0;
  state.expenseGroups[gIdx].items[iIdx][field] = value;
  saveWeeklyState();
  renderExpenses();
}

function saveWeeklyState() {
  if (!state.activeWeekRange) return;
  const safeKey = state.activeWeekRange.replace(/\//g, '-').replace(/\s/g, '');
  return dbUpdate('shop_v8_weekly_expenses/' + safeKey, { expenseGroups: state.expenseGroups });
}

export function copyWeeklyReport() {
  const datesText = state.activeWeekRange ? `[${state.activeWeekRange}]` : '';
  const getText = (id) => document.getElementById(id)?.innerText || '0';
  const rev = getText('week_revenue');
  const aunt = getText('week_aunt');
  const agent = getText('week_agent_total');
  const exp = getText('week_expenses_total_top');
  const final = getText('week_final_profit');
  const text = `📅 周結報表 ${datesText}\n區域: ${state.currentWeeklyRegions.join('+')}\n總收: ${rev}\n阿姨: ${aunt}\n經紀: ${agent}\n支出: $${exp}\n--------------------\n💰 最終盈餘: $${final}`;
  navigator.clipboard.writeText(text).then(() => alert('報表已複製！'));
}
