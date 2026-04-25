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
 *   DEBUG_LOG                 "1" 開啟 log
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
    if (!/^bot([\s\n]|$)/i.test(rawTrimmed)) return;
    text = rawTrimmed.replace(/^bot[\s\n]*/i, '');
    if (props.DEBUG_LOG) console.log('group msg after strip prefix:', text);
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
    } else {
      parts.push('現走');
    }
  } else {
    var firstTask = futureTasks[0];
    var inFirstBooking = nowMins >= firstTask.start && nowMins < firstTask.end;
    // 現在可約 → 第一個 token 寫「現走」
    if (!inFirstBooking) parts.push('現走');
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
