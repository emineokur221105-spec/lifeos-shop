// 共用可變狀態：用一個 state 物件當 single source of truth
// 取代舊版 classic-script 的 script-global 變數
export const state = {
  // === 系統預設 / 參數 ===
  PX_PER_MIN: 2,
  WORK_UNIT_TABLE: { 40: 1, 50: 1, 60: 1, 120: 2, 200: 3, 240: 3 },
  AUNT_EXTRA_NAMES: ['顏同', '有菜', '澄澄', '姚貴', '曼達', '阿鳴', '鳴'],

  // === 排班 / 日結 共用 ===
  REGIONS: [],
  currentRegion: ['All'],
  roomConfig: {},
  regionPrefixes: {},
  staffData: [],
  services: [],
  currentEditingStaffId: null,
  currentTaskElement: null,
  currentTaskInfo: null,
  currentParamsStaffId: null,
  isLocked: false,
  showWorkingOnly: false,

  // === 日期相關 ===
  currentActiveDate: '',
  currentDbPath: '',      // shop_v8_daily_schedules/<safeDate>

  // === 周結 ===
  rawWeeklyData: {},
  expenseGroups: [],
  currentWeeklyRegions: ['All'],
  weekRangesMap: {},
  weekRangeKeys: [],
  activeWeekRange: '',
  selectedDates: [],

  // === 日結全局底薪/底價/工數表（由 DOM 讀出來的快取）===
  globalCommTable: {},
  globalCostTable: {},
  globalWorkTable: {},
};

// 系統密碼常數
export const SYSTEM_PASSWORD = '8888';

// 鬧鐘音效
export const ALARM_URL = 'https://cdn.pixabay.com/audio/2022/03/15/audio_db1b9ef55c.mp3';
