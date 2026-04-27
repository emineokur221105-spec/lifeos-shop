/**
 * LifeOS 班表 bot — Google Apps Script (GAS)
 *
 * 功能：
 * (1) 寫入班表：私訊「A 4/25\n蒼華13.00 120/7400-3+nocon」→ 寫到對應員工 content
 * (2) 查詢空檔：完全照 LifeOS-Shop 「複製空檔」按鈕（copySingleAvailability）的邏輯
 *     - 「現在」/「目前」 / 「空檔」/「誰有空」 → 全部員工每人一行
 *     - 「<藝名>」/「<藝名>空檔」 → 單一員工一行
 *
 * 群組：訊息開頭必須是 "bot " 才會回應（LINE Official Account 不能被 @）
 *
 * 環境變數：
 *   LINE_CHANNEL_ACCESS_TOKEN
 *   LINE_CHANNEL_SECRET
 *   LINE_USER_ID_WHITELIST    （可選；多個用逗號）
 *   FIREBASE_DB_URL
 *   FIREBASE_AUTH             （可選）
 *   TARGET_REGION             （可選）
 *   GEMINI_API_KEY            （可選；翻譯用，沒填就 fallback 到 GAS 內建翻譯）
 *   DEBUG_LOG                 "1" 開啟 log
 *
 * 群組行為：
 *   - "bot " 開頭     → 走查詢／班表寫入（同私訊）
 *   - 無前綴+房號日期 → 自動寫班表
 *   - 無前綴+中/泰文  → 中泰雙向翻譯
 *   - 其他            → 不回應
 */

const TZ = 'Asia/Taipei';
const PENDING_TTL_MS = 5 * 60 * 1000;
const TIME_AXIS_CUTOFF_HOUR = 11;  // 跟 LifeOS-Shop utils.js parseTime 一致：< 11 加 24

function getProps() {
  const p = PropertiesService.getScriptProperties();
  return {
    LINE_CHANNEL_ACCESS_TOKEN: p.getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '',
    LINE_CHANNEL_SECRET: p.getProperty('LINE_CHANNEL_SECRET') || '',
    LINE_USER_ID_WHITELIST: p.getProperty('LINE_USER_ID_WHITELIST') || '',
    FIREBASE_DB_URL: (p.getProperty('FIREBASE_DB_URL') || '').replace(/\/$/, ''),
    FIREBASE_AUTH: p.getProperty('FIREBASE_AUTH') || '',
    TARGET_REGION: p.getProperty('TARGET_REGION') || '',
    GEMINI_API_KEY: p.getProperty('GEMINI_API_KEY') || '',
    DEBUG_LOG: p.getProperty('DEBUG_LOG') === '1',
  };
}

// === LINE webhook 入口 ===
function doPost(e) {
  try {
    const body = e.postData.contents;
    const props = getProps();
    if (props.DEBUG_LOG) console.log('webhook body:', body);

    const data = JSON.parse(body);
    (data.events || []).forEach(function (ev) {
      try {
        handleEvent(ev, props);
      } catch (err) {
        console.error('handleEvent error:', err && err.stack ? err.stack : err);
      }
    });
  } catch (err) {
    console.error('doPost error:', err && err.stack ? err.stack : err);
  }
  return ContentService.createTextOutput('OK');
}

function doGet() {
  return ContentService.createTextOutput('LifeOS LINE bot is running.');
}

function handleEvent(event, props) {
  if (event.type !== 'message' || !event.message || event.message.type !== 'text') return;

  var sourceType = event.source && event.source.type;
  var userId = event.source && event.source.userId;
  var text = event.message.text || '';
  var replyToken = event.replyToken;

  if (props.DEBUG_LOG) console.log('source:', sourceType, 'userId:', userId, 'text:', text);

  if (sourceType === 'group' || sourceType === 'room') {
    var rawTrimmed = text.replace(/^[\s\n]+|[\s\n]+$/g, '');
    if (/^bot([\s\n]|$)/i.test(rawTrimmed)) {
      // bot 前綴 → 走原本邏輯（查詢、特殊指令）
      text = rawTrimmed.replace(/^bot[\s\n]*/i, '');
      if (props.DEBUG_LOG) console.log('group msg after strip prefix:', text);
    } else {
      // 無前綴 → 1) 試班表（房號+日期）2) 試翻譯 3) 都不是就忽略
      var groupParsed = parseScheduleMessage(rawTrimmed);
      if (groupParsed) {
        var groupResult = writeScheduleToFirebase(groupParsed, props);
        reply(replyToken, [{ type: 'text', text: groupResult.message }], props);
        return;
      }
      var translated = translateMessage(rawTrimmed, props);
      if (translated) {
        reply(replyToken, [{ type: 'text', text: translated }], props);
      }
      return;
    }
  } else {
    if (props.LINE_USER_ID_WHITELIST) {
      var allowed = props.LINE_USER_ID_WHITELIST.split(',').map(function (s) { return s.trim(); });
      if (allowed.indexOf(userId) === -1) {
        console.log('Unauthorized userId, ignored:', userId);
        return;
      }
    } else {
      console.log('No whitelist set. Your userId is:', userId);
    }
  }

  var trimmedText = text.replace(/^[\s\n]+|[\s\n]+$/g, '');

  // 1. 查詢類訊息
  var queryMode = detectQueryMode(trimmedText);
  if (queryMode) {
    var queryResult = handleQuery(queryMode, props);
    reply(replyToken, [{ type: 'text', text: queryResult }], props);
    return;
  }

  // 2. 「回答上一個沒房號的問題」
  var pending = loadPending(userId);
  if (pending && isShortRoomReply(trimmedText)) {
    var combined = trimmedText + '\n' + pending;
    var parsedFromPending = parseScheduleMessage(combined);
    clearPending(userId);
    if (!parsedFromPending) {
      reply(replyToken, [{ type: 'text', text: '❌ 結合上一則訊息後仍解析失敗，請重傳完整班表' }], props);
      return;
    }
    var resultP = writeScheduleToFirebase(parsedFromPending, props);
    reply(replyToken, [{ type: 'text', text: resultP.message }], props);
    return;
  }

  // 3. 班表寫入
  var parsed = parseScheduleMessage(trimmedText);
  if (!parsed) {
    if (looksLikeSchedule(trimmedText)) {
      savePending(userId, trimmedText);
      reply(replyToken, [{
        type: 'text',
        text: '收到班表，請問要覆蓋哪一間房？\n直接回房號就好（例：A、A房、215）',
      }], props);
      return;
    }
    reply(replyToken, [{
      type: 'text',
      text: '❓ 看不懂\n\n寫班表：\nA 4/25\n蒼華13.00 120/7400-3+nocon\n\n查詢：\n現在 / 空檔 / <藝名>',
    }], props);
    return;
  }

  var result = writeScheduleToFirebase(parsed, props);
  reply(replyToken, [{ type: 'text', text: result.message }], props);
}

// =============================================================
// === 查詢模式判定 ============================================
// =============================================================

function detectQueryMode(text) {
  var t = text.replace(/\s+/g, '');

  if (/^(現在|目前|此時|空檔|誰有空|誰可以|誰能接|今日空檔|今天空檔)$/.test(t)) return { mode: 'all' };

  var m = t.match(/^(.+?)(空檔|有空(?:嗎)?|可以(?:嗎)?|能接(?:嗎)?)$/);
  if (m) return { mode: 'staff', name: m[1] };

  // 純中文 2-6 字當藝名查詢
  if (/^[一-龥]{2,6}$/.test(t)) return { mode: 'staff', name: t };

  return null;
}

// =============================================================
// === 查詢執行 ================================================
// =============================================================

function handleQuery(query, props) {
  var ctx = loadContext(props);
  if (!ctx) return '❌ 讀不到 LifeOS-Shop 設定';
  if (query.mode === 'all') return queryAll(ctx);
  if (query.mode === 'staff') return queryStaff(ctx, query.name);
  return '❓ 未知查詢';
}

function loadContext(props) {
  var settings = firebaseGet('shop_v8_global_settings', props) || {};
  var openHour = settings.openHour != null ? Number(settings.openHour) : 12;
  var closeHour = settings.closeHour != null ? Number(settings.closeHour) : 27;
  var regionPrefixes = settings.regionPrefixes || {};

  var now = nowParts();
  var businessDay = now.h < 5 ? shiftDate(now.y, now.mon, now.day, -1) : { y: now.y, mon: now.mon, day: now.day };
  var safeDateKey = pad(businessDay.mon) + '-' + pad(businessDay.day);
  var dailyData = firebaseGet('shop_v8_daily_schedules/' + safeDateKey, props);
  var staffArr = dailyData && dailyData.staffData ? toArray(dailyData.staffData) : [];

  if (props.TARGET_REGION) {
    staffArr = staffArr.filter(function (s) { return s && s.region === props.TARGET_REGION; });
  }
  staffArr = staffArr.filter(function (s) { return s && s.attendance !== false; });

  // 現在的「軸分鐘」（跟 parseTime 用同一個 cutoff = 11）
  var nh = now.h < TIME_AXIS_CUTOFF_HOUR ? now.h + 24 : now.h;
  var nowMins = nh * 60 + now.min;

  return {
    settings: settings,
    openHour: openHour,
    closeHour: closeHour,
    regionPrefixes: regionPrefixes,
    safeDateKey: safeDateKey,
    staffArr: staffArr,
    nowMins: nowMins,
    now: now,
  };
}

function queryAll(ctx) {
  var lines = ctx.staffArr.map(function (s) { return formatStaffAvailability(s, ctx); });
  return lines.length ? lines.join('\n') : '目前沒有員工資料\n（' + ctx.safeDateKey + '）';
}

function queryStaff(ctx, queryName) {
  var qn = queryName.replace(/\s+/g, '');
  var staff = ctx.staffArr.find(function (s) {
    return s && (s.name || '').replace(/\s+/g, '') === qn;
  });
  if (!staff) {
    var allNames = ctx.staffArr.map(function (s) { return s.name; }).filter(Boolean).join('、');
    return '❌ 找不到「' + queryName + '」\n當天員工：' + (allNames || '無');
  }
  return formatStaffAvailability(staff, ctx);
}

// =============================================================
// === 員工空檔（完全照 LifeOS-Shop copySingleAvailability）====
// =============================================================
function formatStaffAvailability(s, ctx) {
  var nowMins = ctx.nowMins;
  var closeMins = (ctx.closeHour != null ? ctx.closeHour : 27) * 60;
  var nearClose = closeMins - nowMins < 20;
  var contentLines = (s.content || '').split('\n');
  var tasks = [];

  contentLines.forEach(function (line) {
    var trimmedLine = (line || '').trim();
    if (!trimmedLine) return;
    // 日期行跳過
    if (/^[\d./-]+\s*(?:\([^)]+\))?$/.test(trimmedLine) && trimmedLine.length < 15) return;

    var match = trimmedLine.match(/([\d.:]+)\s*(\d+.*)/) || trimmedLine.match(/(\D+)\s*([\d.:]+)\s*(\d+.*)/);
    if (!match) return;
    var timeStr, detailStr;
    if (match.length === 3) { timeStr = match[1]; detailStr = match[2]; }
    else { timeStr = match[2]; detailStr = match[3]; }

    var duration = 60;
    var numMatch = detailStr.match(/^(\d+)/);
    if (numMatch) duration = parseInt(numMatch[1]);

    var start = parseTime(timeStr);
    if (start !== null) tasks.push({ start: start, end: start + duration + 10 });
  });

  tasks.sort(function (a, b) { return a.start - b.start; });
  var hasValidTasks = tasks.length > 0;
  var mergedTasks = [];
  if (hasValidTasks) {
    var currentTask = tasks[0];
    for (var i = 1; i < tasks.length; i++) {
      var nextTask = tasks[i];
      if (nextTask.start - currentTask.end < 40) {
        currentTask.end = Math.max(currentTask.end, nextTask.end);
      } else {
        mergedTasks.push(currentTask);
        currentTask = nextTask;
      }
    }
    mergedTasks.push(currentTask);
  }

  var futureTasks = mergedTasks.filter(function (t) { return t.end > nowMins; });
  var displayName = s.name || '未填寫';
  var prefixText = ctx.regionPrefixes[s.region] || '';
  var parts = [prefixText + displayName];

  if (futureTasks.length === 0) {
    // 沒未來 task → 整段空到下班
    if (!hasValidTasks && (s.content || '').trim() !== '') {
      parts.push('(' + (s.content || '').trim().replace(/\n/g, ' ') + ')');
    } else if (!nearClose) {
      parts.push('現走');
    }
  } else {
    var firstTask = futureTasks[0];
    var inFirstBooking = nowMins >= firstTask.start && nowMins < firstTask.end;
    // 現在可約 + 到下個客人 ≥ 40 分 + 離下班 ≥ 20 分 → 第一個 token 寫「現走」
    if (!inFirstBooking && firstTask.start - nowMins >= 40 && !nearClose) parts.push('現走');
    futureTasks.forEach(function (t, i) {
      var startStr = formatTimeDot(t.start);
      var endStr = formatTimeDot(t.end);
      var inBooking = nowMins >= t.start && nowMins < t.end;
      if (i === 0 && inBooking) {
        // 第一段已經在客中 → 跳過 startStr，直接 endStr 可約
        parts.push(endStr + '可約');
      } else {
        parts.push(startStr + '有客');
        parts.push(endStr + '可約');
      }
    });
  }
  return parts.join(' ');
}

// =============================================================
// === Time helpers ============================================
// =============================================================
function parseTime(timeStr) {
  if (!timeStr) return null;
  timeStr = String(timeStr).replace('.', ':');
  var parts = timeStr.split(':');
  var h = 0, m = 0;
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
  if (h < TIME_AXIS_CUTOFF_HOUR) h += 24;
  return h * 60 + m;
}

function formatTimeDot(mins) {
  var hh = Math.floor(mins / 60);
  var mm = mins % 60;
  if (hh >= 24) hh -= 24;
  return (hh < 10 ? '0' + hh : hh) + '.' + (mm < 10 ? '0' + mm : mm);
}

function nowParts() {
  var d = new Date();
  var fmt = Utilities.formatDate(d, TZ, 'yyyy-MM-dd-HH-mm').split('-').map(Number);
  return { y: fmt[0], mon: fmt[1], day: fmt[2], h: fmt[3], min: fmt[4] };
}

function shiftDate(y, mon, day, delta) {
  var dt = new Date(y, mon - 1, day);
  dt.setDate(dt.getDate() + delta);
  return { y: dt.getFullYear(), mon: dt.getMonth() + 1, day: dt.getDate() };
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }

// =============================================================
// === 寫入班表 ================================================
// =============================================================

function parseScheduleMessage(text) {
  if (!text) return null;
  var trimmed = text.replace(/^[\s\n]+|[\s\n]+$/g, '');
  if (!trimmed) return null;

  var lines = trimmed.split('\n');
  var firstLine = (lines[0] || '').trim();

  var roomMatch = firstLine.match(/^([A-Za-z]|\d{2,4})\s*房?/);
  if (!roomMatch) return null;

  var roomKey = roomMatch[1];
  var roomLabel = /^[A-Za-z]$/.test(roomKey) ? roomKey.toUpperCase() + '房' : roomKey;

  var dateMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})/);
  if (!dateMatch) return null;

  var month = parseInt(dateMatch[1], 10);
  var day = parseInt(dateMatch[2], 10);
  var year = inferYear(month);
  var dateStr = year + '/' + month + '/' + day;
  var safeDateKey = pad(month) + '-' + pad(day);

  var firstLineRemainder = firstLine.replace(/^([A-Za-z]|\d{2,4})\s*房?\s*/, '').trim();
  var contentLines = [];
  if (firstLineRemainder) contentLines.push(firstLineRemainder);
  contentLines = contentLines.concat(lines.slice(1));
  var content = contentLines.join('\n').replace(/^\s+|\s+$/g, '');

  return { roomLabel: roomLabel, dateStr: dateStr, safeDateKey: safeDateKey, content: content };
}

function inferYear(month) {
  var now = new Date();
  var nowMonth = now.getMonth() + 1;
  var year = now.getFullYear();
  if (month - nowMonth > 6) year -= 1;
  if (nowMonth - month > 6) year += 1;
  return year;
}

function normalizeRoom(s) {
  return (s || '').toString().replace(/房$/, '').toUpperCase().trim();
}

function looksLikeSchedule(text) {
  if (!text) return false;
  return /\d{1,2}\/\d{1,2}/.test(text) || /\d{1,2}[\.\:]\d{2}/.test(text);
}

function isShortRoomReply(text) {
  if (!text) return false;
  if (text.length > 5) return false;
  return /^([A-Za-z]|\d{2,4})\s*房?$/.test(text.trim());
}

function savePending(userId, text) {
  PropertiesService.getScriptProperties().setProperty(
    'pending_' + userId,
    JSON.stringify({ text: text, ts: Date.now() })
  );
}

function loadPending(userId) {
  var raw = PropertiesService.getScriptProperties().getProperty('pending_' + userId);
  if (!raw) return null;
  try {
    var obj = JSON.parse(raw);
    if (Date.now() - obj.ts > PENDING_TTL_MS) {
      clearPending(userId);
      return null;
    }
    return obj.text;
  } catch (e) {
    return null;
  }
}

function clearPending(userId) {
  PropertiesService.getScriptProperties().deleteProperty('pending_' + userId);
}

function writeScheduleToFirebase(parsed, props) {
  var path = 'shop_v8_daily_schedules/' + parsed.safeDateKey;
  var dailyData = firebaseGet(path, props);

  if (!dailyData || !dailyData.staffData) {
    var yesterdayKey = shiftDateKey(parsed.safeDateKey, -1);
    var yesterday = firebaseGet('shop_v8_daily_schedules/' + yesterdayKey, props);
    if (!yesterday || !yesterday.staffData) {
      return {
        ok: false,
        message: '❌ ' + parsed.dateStr + ' 跟前一天的排班都還沒建立\n請先到網站打開「' + parsed.dateStr + '」這天，bot 才能寫入',
      };
    }
    var prevArr = toArray(yesterday.staffData);
    var newStaff = prevArr.map(function (s) {
      var copy = Object.assign({}, s);
      copy.content = '';
      copy.taskStatuses = {};
      copy.overrides = {};
      copy.manualExpense = 0;
      return copy;
    });
    dailyData = { date: parsed.dateStr, isLocked: false, staffData: newStaff, timestamp: Date.now() };
  }

  var staffArr = toArray(dailyData.staffData);
  var targetRegion = props.TARGET_REGION;
  var roomKeyNorm = normalizeRoom(parsed.roomLabel);
  var target = staffArr.filter(function (s) {
    return s && normalizeRoom(s.roomName) === roomKeyNorm
      && (!targetRegion || s.region === targetRegion);
  })[0];

  if (!target) {
    var available = staffArr
      .filter(function (s) { return s && (!targetRegion || s.region === targetRegion); })
      .map(function (s) { return s.roomName; })
      .filter(Boolean).join(', ');
    return {
      ok: false,
      message: '❌ 找不到「' + parsed.roomLabel + '」' +
        (targetRegion ? '（地區：' + targetRegion + '）' : '') +
        '\n當天可用房號：' + (available || '無'),
    };
  }

  target.content = parsed.content;

  firebaseSet(path, {
    date: dailyData.date || parsed.dateStr,
    isLocked: !!dailyData.isLocked,
    staffData: staffArr,
    timestamp: Date.now(),
  }, props);

  return {
    ok: true,
    message: '✅ 已更新 ' + (target.roomName || parsed.roomLabel) +
      (target.name ? '（' + target.name + '）' : '') + ' ' + parsed.dateStr,
  };
}

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return Object.values(v);
  return [];
}

function shiftDateKey(safeKey, deltaDays) {
  var parts = safeKey.split('-').map(Number);
  var month = parts[0];
  var day = parts[1];
  var year = inferYear(month);
  var d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + deltaDays);
  return pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// =============================================================
// === Firebase / LINE I/O =====================================
// =============================================================

function firebaseGet(path, props) {
  var url = props.FIREBASE_DB_URL + '/' + path + '.json';
  if (props.FIREBASE_AUTH) url += '?auth=' + encodeURIComponent(props.FIREBASE_AUTH);
  var res = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (props.DEBUG_LOG) console.log('firebaseGet', path, code);
  if (code !== 200) {
    console.error('firebaseGet error:', code, res.getContentText());
    return null;
  }
  var t = res.getContentText();
  return t ? JSON.parse(t) : null;
}

function firebaseSet(path, data, props) {
  var url = props.FIREBASE_DB_URL + '/' + path + '.json';
  if (props.FIREBASE_AUTH) url += '?auth=' + encodeURIComponent(props.FIREBASE_AUTH);
  var res = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(data),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  if (props.DEBUG_LOG) console.log('firebaseSet', path, code);
  if (code !== 200) {
    console.error('firebaseSet error:', code, res.getContentText());
    throw new Error('Firebase write failed: ' + code);
  }
}

// =============================================================
// === 翻譯（中泰雙向）=========================================
// =============================================================

function translateMessage(text, props) {
  if (!text) return null;
  var hasThai = /[฀-๿]/.test(text);
  var hasChinese = /[一-鿿]/.test(text);
  if (!hasThai && !hasChinese) return null;

  var direction = hasThai ? 'th2zh' : 'zh2th';

  if (props.GEMINI_API_KEY) {
    try {
      return translateWithGemini(text, direction, props);
    } catch (e) {
      console.error('Gemini translate failed, fallback to LanguageApp:', e);
    }
  }
  // Fallback：GAS 內建翻譯（品質較差但保證有譯文）
  if (direction === 'th2zh') return LanguageApp.translate(text, 'th', 'zh-TW');
  return LanguageApp.translate(text, 'zh-TW', 'th');
}

function translateWithGemini(text, direction, props) {
  var directionNote = direction === 'th2zh'
    ? '把以下泰文翻譯成台灣繁體中文'
    : '把以下中文翻譯成泰文';

  // === 行業術語對照表（必須遵守，之後新增請改這裡）============
  // 格式：'泰文 / 縮寫 = 中文（備註）'，一行一條
  // 來源：知識庫/翻譯機器人改善分析.md
  var glossary = [
    // --- 服務項目（無套相關）---
    'nocon / โนคอน / ไม่มีคอน = 無套（絕對不能翻「沒有控制」「沒有缺點」）',
    'หลั่งข้างใน / หลั่งใน = 內射',
    'อมสด = 無套吹（口）',
    // --- 服務項目（口/嘴）---
    'ปากเป่า / อมปาก / แตกปาก = 口爆',
    'จูบปาก = 親嘴',
    'จูบแบบแลกลิ้น = 舌吻',
    // --- 服務項目（其他）---
    'มังกรพิษ / เลียก้น = 毒龍',
    'ทวารหนัก / เอาก้น = 肛交（後門／走後門）',
    'ฟองนม / เอาที่ร่องนม = 乳交（奶炮）',
    'ให้แขกเลียจิ๋ม = 品鮑',
    'แตกบนหน้า = 射顏',
    'ถุงน่อง = 絲襪',
    // --- 動作回報（注意：是回報狀態、不是命令）---
    'In / 1in / 2in = 客人進房（第 N 位）',
    'Out / ออก / ออกไป = 客人離開／服務結束（絕對不是「出去」）',
    'เปิด / open / open door / เปิดประตู = 幫忙開大門（遠端門禁）',
    // --- 角色稱呼 ---
    'บอส / พี่ชาย = 老闆／派單哥（行業習慣，不是「哥哥」）',
    'ลูกค้า = 客人',
    // --- 工作場合委婉語（重要！）---
    'น้องสาว（在工作對話中）= 私密處／陰道（絕對不能翻「妹妹」，會誤會成親妹妹）',
    // --- 員工狀態 ---
    'ประจำเดือน = 生理期／月經',
    'พัก / พักกินข้าว = 休息吃飯（保留空檔）',
    'ปิดงาน = 今日下班／不再接單',
    'เก็บเงิน / รับเงิน = 收錢／結帳',
  ];
  // =============================================================

  var glossaryBlock = glossary.length
    ? '\n【行業術語對照（必須遵守）】\n' + glossary.join('\n') + '\n'
    : '';

  var prompt =
    '你是中泰雙語翻譯助理，工作場合是【特種服務行業派單群組】（女員工在 A/C/D 房接客，老闆遠端派單與門禁）。\n' +
    '最高原則：意思必須精準、不能誤導；其次才是語氣自然。\n' +
    '\n' +
    '【角色】\n' +
    '- 老闆／派單員（中文）：派客、開大門、報價、結帳。指令簡潔，安撫員工時溫和。\n' +
    '- 員工（泰籍女）：回報 in/out、收錢、生理狀況、突發狀況。對老闆極度禮貌（ค่ะ + 🙏）。\n' +
    '\n' +
    '【規則】\n' +
    '- ' + directionNote + '\n' +
    '\n' +
    '【代詞絕對不能錯（最常見錯誤）】\n' +
    '- 泰文 ฉัน = 我；คุณ / เธอ = 你\n' +
    '- 泰文 เค้า / เขา = 他/她（在這群組常指「客人」），絕對不是「我」\n' +
    '- 泰文 พวกเรา = 我們；พวกเค้า = 他們\n' +
    '- 中文「他/她」絕對不能翻成 ฉัน/คุณ；中文「我」絕對不能翻成 เค้า/เขา\n' +
    '- 例：「พอดีแบตเค้าหมด」= 剛好客人/他的電池沒電（不是「我的電池」）\n' +
    '- 例：「เจ้านายเค้าโทตามกลับด่วน」= 客人的老闆催客人回去（不是「我老闆叫我回去」）\n' +
    '- 主詞模糊時保留模糊，不要自作主張補主詞\n' +
    '\n' +
    '【常見陷阱（看到這些先警覺）】\n' +
    '- 「วัด（寺廟）」很多時候是「บอส（老闆）」的打錯字，看上下文判斷\n' +
    '- 「นก（鳥）」在工作對話中通常是員工的自稱／暱稱 Nok，不是動物\n' +
    '- 「ตาย（死）」是感嘆詞「完蛋了／天啊」，不是真的死亡\n' +
    '- 「น้องสาว（妹妹）」在工作對話中是「私密處」的委婉說法\n' +
    '- 「In / Out」是員工回報客人進出房，不是叫人「進入／出去」\n' +
    '- 「มอบความรู้สึก / มอบครั้งแรก（在客人語境下）」= 把第一次/初夜給她，不是「給感覺」\n' +
    '\n' +
    '【慣用語意譯】\n' +
    '- 字面直譯會變怪話的詞組，用最接近原意的通順表達\n' +
    '- 例：「ที่นั่งในใจ」字面是「心裡的座位」但實際指「掛心的事」\n' +
    '- 翻完讀一遍，如果不通順就重翻\n' +
    '\n' +
    '【語氣】\n' +
    '- 保留原文的正式程度（原文有 ค่ะ/🙏 等禮貌標記就翻得有禮、原文簡短指令就翻得簡短）\n' +
    '- 不要主動加原文沒有的語尾詞（喔、啦、齁、นะ）或客套詞（請問、麻煩您）\n' +
    '- 中性陳述句翻成中性陳述句\n' +
    '\n' +
    '【輸出】\n' +
    '- 只回譯文，不要加說明、引號、前綴' +
    glossaryBlock + '\n' +
    '原文：\n' + text;

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' +
    encodeURIComponent(props.GEMINI_API_KEY);
  var payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3 },
  };
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  if (props.DEBUG_LOG) console.log('Gemini', code);
  if (code !== 200) {
    throw new Error('Gemini ' + code + ': ' + res.getContentText());
  }
  var data = JSON.parse(res.getContentText());
  var output = data.candidates && data.candidates[0] && data.candidates[0].content
    && data.candidates[0].content.parts && data.candidates[0].content.parts[0]
    && data.candidates[0].content.parts[0].text;
  if (!output) throw new Error('Gemini returned empty');
  return String(output).trim();
}

function reply(replyToken, messages, props) {
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + props.LINE_CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify({ replyToken: replyToken, messages: messages }),
    muteHttpExceptions: true,
  });
  if (props.DEBUG_LOG) console.log('LINE reply', res.getResponseCode(), res.getContentText());
}
