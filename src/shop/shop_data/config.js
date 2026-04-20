// 系統層預設值 + 從 Firebase 讀 system_config 覆蓋
import { state } from './state.js';
import { dbVal } from './shop-db.js';

export const SYSTEM_CONFIG = {
  systemPassword: '8888',
  defaultAgentRate: 300,
  pxPerMin: 2,
  defaultOpenHour: 12,
  defaultCloseHour: 26,
  pricingTable: [
    { duration: 40,  count: 1, comm: 1100, cost: 2300, work: 1 },
    { duration: 60,  count: 1, comm: 1400, cost: 2700, work: 1 },
    { duration: 60,  count: 2, comm: 1900, cost: 3300, work: 1 },
    { duration: 120, count: 3, comm: 2800, cost: 4800, work: 2 },
    { duration: 240, count: 3, comm: 4200, cost: 8100, work: 3 },
  ],
  workUnitTable: { 40: 1, 50: 1, 60: 1, 120: 2, 200: 3, 240: 3 },
  auntExtraNames: ['顏同', '有菜', '澄澄', '姚貴', '曼達', '阿鳴', '鳴'],
  auntExtraAmount: 100,
  auntDivisor: 100,
};

export async function loadSystemConfig() {
  try {
    const t = await dbVal('system_config');
    if (t) {
      if (t.systemPassword   !== undefined) SYSTEM_CONFIG.systemPassword   = t.systemPassword;
      if (t.defaultAgentRate !== undefined) SYSTEM_CONFIG.defaultAgentRate = t.defaultAgentRate;
      if (t.pxPerMin         !== undefined) SYSTEM_CONFIG.pxPerMin         = t.pxPerMin;
      if (t.defaultOpenHour  !== undefined) SYSTEM_CONFIG.defaultOpenHour  = t.defaultOpenHour;
      if (t.defaultCloseHour !== undefined) SYSTEM_CONFIG.defaultCloseHour = t.defaultCloseHour;
      if (t.auntExtraAmount  !== undefined) SYSTEM_CONFIG.auntExtraAmount  = t.auntExtraAmount;
      if (t.auntDivisor      !== undefined) SYSTEM_CONFIG.auntDivisor      = t.auntDivisor;
      if (Array.isArray(t.auntExtraNames)) SYSTEM_CONFIG.auntExtraNames = t.auntExtraNames;
      if (Array.isArray(t.pricingTable))   SYSTEM_CONFIG.pricingTable   = t.pricingTable;
      if (t.workUnitTable && typeof t.workUnitTable === 'object') {
        SYSTEM_CONFIG.workUnitTable = {};
        for (const [k, v] of Object.entries(t.workUnitTable)) {
          SYSTEM_CONFIG.workUnitTable[parseInt(k)] = v;
        }
      }
    }
  } catch (e) {
    console.warn('載入 system_config 失敗，使用預設值:', e);
  }
  applySystemConfig();
}

export function applySystemConfig() {
  state.PX_PER_MIN        = SYSTEM_CONFIG.pxPerMin;
  state.WORK_UNIT_TABLE   = { ...SYSTEM_CONFIG.workUnitTable };
  state.AUNT_EXTRA_NAMES  = [...SYSTEM_CONFIG.auntExtraNames];

  SYSTEM_CONFIG.pricingTable.forEach(t => {
    const key = `${t.duration}_${t.count}`;
    const commInput = document.getElementById('base_' + key);
    const costInput = document.getElementById('cost_' + key);
    if (commInput) commInput.value = t.comm;
    if (costInput) costInput.value = t.cost;
  });

  const openH  = document.getElementById('openHour');
  const closeH = document.getElementById('closeHour');
  if (openH  && !openH.dataset.userSet)  openH.value  = SYSTEM_CONFIG.defaultOpenHour;
  if (closeH && !closeH.dataset.userSet) closeH.value = SYSTEM_CONFIG.defaultCloseHour;
}

export function generatePricingInputs() {
  const container = document.getElementById('pricingInputsContainer');
  if (!container) return;
  container.innerHTML = '';
  SYSTEM_CONFIG.pricingTable.forEach(row => {
    const key = `${row.duration}_${row.count}`;
    container.innerHTML += `<input type="hidden" id="base_${key}" value="${row.comm}">`;
    container.innerHTML += `<input type="hidden" id="cost_${key}" value="${row.cost}">`;
  });
}
