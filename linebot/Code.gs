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
 *   - 無前綴+中/泰文  → 中泰雙向翻譯（本群未關閉的話）
 *   - 其他            → 不回應
 *
 * 群組翻譯開關（每群獨立，預設開啟，存 ScriptProperties.TRANSLATE_DISABLED_GROUPS）：
 *   - bot 關閉翻譯 / 關翻譯 / 停止翻譯
 *   - bot 開啟翻譯 / 開翻譯 / 啟用翻譯
 *   - bot 查詢翻譯 / 翻譯狀態
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
  // bot 被加進群組/聊天室 → 發歡迎訊息
  if (event.type === 'join') {
    handleJoinEvent(event, props);
    return;
  }
  // 卡片按鈕觸發
  if (event.type === 'postback') {
    handlePostback(event, props);
    return;
  }
  if (event.type !== 'message' || !event.message || event.message.type !== 'text') return;

  var sourceType = event.source && event.source.type;
  var userId = event.source && event.source.userId;
  var text = event.message.text || '';
  var replyToken = event.replyToken;

  if (props.DEBUG_LOG) console.log('source:', sourceType, 'userId:', userId, 'text:', text);

  var groupId = (event.source && (event.source.groupId || event.source.roomId)) || null;

  if (sourceType === 'group' || sourceType === 'room') {
    var rawTrimmed = text.replace(/^[\s\n]+|[\s\n]+$/g, '');

    // 停用群組：bot 全靜默，僅允許「bot 設定房號 X」重啟
    if (isGroupSuspended(groupId)) {
      if (/^bot([\s\n]|$)/i.test(rawTrimmed)) {
        var stripped = rawTrimmed.replace(/^bot[\s\n]*/i, '');
        var bindRoom_s = detectRoomBindCommand(stripped);
        if (bindRoom_s) {
          reply(replyToken, [{ type: 'text', text: handleRoomBind(bindRoom_s, groupId) }], props);
          return;
        }
      }
      if (props.DEBUG_LOG) console.log('Group suspended, silent:', groupId);
      return;
    }

    if (/^bot([\s\n]|$)/i.test(rawTrimmed)) {
      // bot 前綴 → 走原本邏輯（查詢、特殊指令）
      text = rawTrimmed.replace(/^bot[\s\n]*/i, '');
      rememberGroup(groupId);
      if (props.DEBUG_LOG) console.log('group msg after strip prefix:', text);

      // 設定房號（群組專用）
      var bindRoom = detectRoomBindCommand(text);
      if (bindRoom) {
        reply(replyToken, [{ type: 'text', text: handleRoomBind(bindRoom, groupId) }], props);
        return;
      }

      // 解除綁定（群組專用）
      if (detectUnbindCommand(text)) {
        reply(replyToken, [{ type: 'text', text: handleUnbind(groupId) }], props);
        return;
      }

      // 翻譯開關（群組專用）
      var toggle = detectTranslateToggleCommand(text);
      if (toggle) {
        reply(replyToken, [{ type: 'text', text: handleTranslateToggle(toggle, groupId) }], props);
        return;
      }

      // 早安開關（群組專用）
      var morning = detectMorningToggleCommand(text);
      if (morning) {
        reply(replyToken, [{ type: 'text', text: handleMorningToggle(morning, groupId) }], props);
        return;
      }

      // Whoami（誰都能用，回自己 userId）
      if (detectWhoamiCommand(text)) {
        reply(replyToken, [{ type: 'text', text: handleWhoami(userId) }], props);
        return;
      }

      // Boss 管理員指令清單（whitelist 嚴格模式：未授權者完全靜默）
      if (detectBossCommand(text)) {
        if (!isBossAuthorized(userId, props)) {
          if (props.DEBUG_LOG) console.log('Unauthorized boss attempt in group, userId:', userId);
          return;
        }
        reply(replyToken, [buildBossFlex(props)], props);
        return;
      }
    } else {
      rememberGroup(groupId);
      // 無前綴 → 1) 試班表（房號+日期）2) 試翻譯 3) 都不是就忽略
      var groupParsed = parseScheduleMessage(rawTrimmed);
      if (groupParsed) {
        try {
          var groupResult = writeScheduleToFirebase(groupParsed, props);
          reply(replyToken, [{ type: 'text', text: groupResult.message }], props);
        } catch (e) {
          notifyAdmin('⚠️ 班表寫入失敗\n房：' + groupParsed.roomLabel + ' / 日：' + groupParsed.dateStr + '\n錯誤：' + (e && e.message ? e.message : e) + '\n\n請重發班表', props);
          console.error('Schedule write failed (group):', e);
        }
        return;
      }
      if (isTranslateDisabled(groupId)) {
        if (props.DEBUG_LOG) console.log('translate disabled for group:', groupId);
        return;
      }
      var translated = translateMessage(rawTrimmed, props);
      if (translated) {
        reply(replyToken, [{ type: 'text', text: translated }], props);
      }
      return;
    }
  } else {
    // Whoami：whitelist 檢查之前處理，未授權者也能查自己 userId（給 kabe 第一次設 whitelist 用）
    var prelimText = (text || '').replace(/^[\s\n]+|[\s\n]+$/g, '').replace(/^bot\s*/i, '');
    if (detectWhoamiCommand(prelimText)) {
      reply(replyToken, [{ type: 'text', text: handleWhoami(userId) }], props);
      return;
    }

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

  // Boss 管理員指令清單（私訊路徑）
  if (detectBossCommand(trimmedText)) {
    reply(replyToken, [buildBossFlex(props)], props);
    return;
  }

  // 測試早安推送（私訊路徑，whitelist 已擋住外人）
  if (detectTestMorningCommand(trimmedText)) {
    var testResult = testMorningCall();
    reply(replyToken, [{ type: 'text', text: '📤 早安測試發送結果：\n' + testResult }], props);
    return;
  }

  // 批次指令（全部早安開關 / 全部翻譯開關 / 全部解綁）
  var batchCmd = detectBatchCommand(trimmedText);
  if (batchCmd) {
    reply(replyToken, [{ type: 'text', text: handleBatchCommand(batchCmd) }], props);
    return;
  }

  // 自訂排序（排序 A B C）
  var orderList = detectOrderCommand(trimmedText);
  if (orderList) {
    reply(replyToken, [
      { type: 'text', text: handleOrderCommand(orderList) },
      buildBossFlex(props),
    ], props);
    return;
  }

  // 私訊用房號解綁（A 解綁 / 紙房子 解除綁定 等）
  var adminUnbind = detectAdminUnbindCommand(trimmedText);
  if (adminUnbind) {
    reply(replyToken, [{ type: 'text', text: handleAdminUnbind(adminUnbind) }], props);
    return;
  }

  // 私訊用房號 reference 管理（A 早安開啟 / B 翻譯關閉 等）
  var adminCmd = detectAdminCommand(trimmedText);
  if (adminCmd) {
    reply(replyToken, [{ type: 'text', text: handleAdminCommand(adminCmd) }], props);
    return;
  }

  // 0. 教學／說明（給群組老闆們快速看怎麼用）
  if (detectHelpCommand(trimmedText)) {
    reply(replyToken, [{ type: 'text', text: HELP_TEXT }], props);
    return;
  }

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
    try {
      var resultP = writeScheduleToFirebase(parsedFromPending, props);
      reply(replyToken, [{ type: 'text', text: resultP.message }], props);
    } catch (e) {
      notifyAdmin('⚠️ 班表寫入失敗\n房：' + parsedFromPending.roomLabel + ' / 日：' + parsedFromPending.dateStr + '\n錯誤：' + (e && e.message ? e.message : e) + '\n\n請重發班表', props);
      console.error('Schedule write failed (pending):', e);
    }
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
      text: '無效指令\n查詢:現在 空檔 <藝名>',
    }], props);
    return;
  }

  try {
    var result = writeScheduleToFirebase(parsed, props);
    reply(replyToken, [{ type: 'text', text: result.message }], props);
  } catch (e) {
    notifyAdmin('⚠️ 班表寫入失敗\n房：' + parsed.roomLabel + ' / 日：' + parsed.dateStr + '\n錯誤：' + (e && e.message ? e.message : e) + '\n\n請重發班表', props);
    console.error('Schedule write failed (private):', e);
  }
}

// =============================================================
// === 教學／說明（bot 查詢）==================================
// =============================================================

var HELP_TEXT =
  '📖 LifeOS bot 查詢指令\n' +
  '\n' +
  '查全部員工空檔：\n' +
  'bot 現在\n' +
  '\n' +
  '查單一員工空檔：\n' +
  'bot <藝名>\n' +
  '例：bot 蒼華\n' +
  '\n' +
  '看這個說明：\n' +
  'bot 查詢';

function detectHelpCommand(text) {
  var t = (text || '').replace(/\s+/g, '');
  return /^(查詢|教學|說明|指令|help|Help|HELP)$/.test(t);
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

var OVERTIME_WARNING = '\n\n服務時間超過02.00需詢問是否能加班';

function handleQuery(query, props) {
  var ctx = loadContext(props);
  if (!ctx) return '❌ 讀不到 LifeOS-Shop 設定';
  if (query.mode === 'all') return queryAll(ctx) + OVERTIME_WARNING;
  if (query.mode === 'staff') {
    var staffResult = queryStaff(ctx, query.name);
    // 找不到員工的錯誤訊息不加警告
    if (staffResult.indexOf('❌') === 0) return staffResult;
    return staffResult + OVERTIME_WARNING;
  }
  return '❓ 未知查詢';
}

function loadContext(props) {
  var settings = firebaseGet('shop_v8_global_settings', props) || {};
  var openHour = settings.openHour != null ? Number(settings.openHour) : 12;
  var closeHour = 26;  // 寫死 02:00 下班（軸小時 26 = 隔日 02:00），無視網站 settings.closeHour
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
  var displayName = s.name || '未填寫';
  var prefixText = ctx.regionPrefixes[s.region] || '';
  var content = s.content || '';

  // 班表寫了「約滿」→ 直接顯示「約滿」，不列細項
  if (/約滿/.test(content)) {
    return prefixText + displayName + ' 約滿';
  }

  var nowMins = ctx.nowMins;
  var closeMins = (ctx.closeHour != null ? ctx.closeHour : 27) * 60;
  var nearClose = closeMins - nowMins < 20;
  var contentLines = content.split('\n');
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
      (target.name ? '（' + target.name + '）' : '') +
      '\nตารางใหม่มาแล้ว เช็กและตอบด้วยนะ',
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
// === 群組房號綁定 + 早安開關 + Boss 管理員指令 ===============
// =============================================================
// 設計：
//   - GROUP_ROOM_MAP (JSON {groupId: roomLabel}) — 群組綁房號
//   - KNOWN_GROUPS (JSON [groupId,...]) — bot 加入過/收過訊息的群組（給 boss 顯示用）
//   - MORNING_CALL_ENABLED_GROUPS (csv) — 已開啟早安叫醒的群組
//   - 重疊覆蓋：同一房號被新群組搶走時，舊群組變未綁定（kabe 要的「直接覆蓋」）

function _getJsonProp(key, defaultValue) {
  var raw = PropertiesService.getScriptProperties().getProperty(key);
  if (!raw) return defaultValue;
  try { return JSON.parse(raw); } catch (e) { return defaultValue; }
}

function _setJsonProp(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(value));
}

// --- 群組 ↔ 房號 ---
function getGroupRoomMap() { return _getJsonProp('GROUP_ROOM_MAP', {}); }

function getRoomByGroup(groupId) { return getGroupRoomMap()[groupId] || null; }

function getGroupByRoom(roomLabel) {
  var map = getGroupRoomMap();
  for (var gid in map) if (map[gid] === roomLabel) return gid;
  return null;
}

function setGroupRoom(groupId, roomLabel) {
  if (!groupId || !roomLabel) return;
  var map = getGroupRoomMap();
  // 重疊覆蓋：同房號的別群被踢掉，並進入「停用」（bot 在那群組沉默直到重綁）
  for (var gid in map) {
    if (map[gid] === roomLabel && gid !== groupId) {
      delete map[gid];
      setGroupSuspended(gid, true);
    }
  }
  map[groupId] = roomLabel;
  _setJsonProp('GROUP_ROOM_MAP', map);
}

// --- 已知群組（給 boss 列清單用）---
function getKnownGroups() { return _getJsonProp('KNOWN_GROUPS', []); }

function rememberGroup(groupId) {
  if (!groupId) return;
  var list = getKnownGroups();
  if (list.indexOf(groupId) === -1) {
    list.push(groupId);
    _setJsonProp('KNOWN_GROUPS', list);
  }
}

// --- 停用群組（解綁後 bot 在該群組沉默，僅允許「設定房號」重啟）---
function _getSuspendedGroups() {
  var raw = PropertiesService.getScriptProperties().getProperty('SUSPENDED_GROUPS') || '';
  return raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

function isGroupSuspended(groupId) {
  if (!groupId) return false;
  return _getSuspendedGroups().indexOf(groupId) !== -1;
}

function setGroupSuspended(groupId, suspended) {
  if (!groupId) return;
  var list = _getSuspendedGroups();
  var idx = list.indexOf(groupId);
  if (suspended && idx === -1) list.push(groupId);
  else if (!suspended && idx !== -1) list.splice(idx, 1);
  PropertiesService.getScriptProperties().setProperty('SUSPENDED_GROUPS', list.join(','));
}

// --- 早安開啟群組 ---
function _getMorningEnabledList() {
  var raw = PropertiesService.getScriptProperties().getProperty('MORNING_CALL_ENABLED_GROUPS') || '';
  return raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

function isMorningEnabled(groupId) {
  if (!groupId) return false;
  return _getMorningEnabledList().indexOf(groupId) !== -1;
}

function setMorningEnabled(groupId, enabled) {
  if (!groupId) return;
  var list = _getMorningEnabledList();
  var idx = list.indexOf(groupId);
  if (enabled && idx === -1) list.push(groupId);
  else if (!enabled && idx !== -1) list.splice(idx, 1);
  PropertiesService.getScriptProperties().setProperty('MORNING_CALL_ENABLED_GROUPS', list.join(','));
}

// === 設定房號指令（群組裡打 bot 設定房號 X）===
function detectRoomBindCommand(text) {
  var t = (text || '').replace(/^\s+|\s+$/g, '');
  // 動詞在前：設定房號 A / 綁定房號 A / 編號 A / 設房號 A / 綁定 A / 綁 A
  var m1 = t.match(/^(?:設定房號|綁定房號|編號|設房號|綁定|綁)\s*(\S{1,10})$/);
  if (m1) return m1[1].trim().toUpperCase();
  // 動詞在後：A 綁定 / A 綁
  var m2 = t.match(/^(\S{1,10})\s+(?:綁定|綁)$/);
  if (m2) return m2[1].trim().toUpperCase();
  return null;
}

function handleRoomBind(roomLabel, groupId) {
  if (!groupId) return '❌ 此指令只能在群組使用';
  var prevRoom = getRoomByGroup(groupId);
  var prevHolder = getGroupByRoom(roomLabel);
  var wasSuspended = isGroupSuspended(groupId);
  setGroupRoom(groupId, roomLabel);
  rememberGroup(groupId);
  setGroupSuspended(groupId, false); // 重綁解除停用，bot 重新運作
  var msg = '✅ 本群組已綁定房號「' + roomLabel + '」';
  if (wasSuspended) msg += '\n（已重新啟用，bot 會回應翻譯/班表）';
  if (prevRoom && prevRoom !== roomLabel) msg += '\n（原房號「' + prevRoom + '」已釋出）';
  if (prevHolder && prevHolder !== groupId) msg += '\n（原「' + roomLabel + '」房群組已自動進入停用，bot 在那群組沉默直到重新綁定）';
  return msg;
}

// === 解除綁定指令 ===
function detectUnbindCommand(text) {
  var t = (text || '').replace(/\s+/g, '');
  return /^(解除綁定|取消綁定|解除房號|取消房號|解綁|清除房號|移除房號)$/.test(t);
}

function handleUnbind(groupId) {
  if (!groupId) return '❌ 此指令只能在群組使用';
  var map = getGroupRoomMap();
  var prev = map[groupId];
  // 即使沒綁過也徹底清空，避免「未綁定群組」掛在面板上
  delete map[groupId];
  _setJsonProp('GROUP_ROOM_MAP', map);
  // 清翻譯狀態（變回預設「翻譯開啟」）
  setTranslateDisabled(groupId, false);
  // 清早安狀態（變回預設「早安關閉」）
  setMorningEnabled(groupId, false);
  // 從 KNOWN_GROUPS 移除（除非有新訊息+重綁才加回）
  var known = getKnownGroups();
  var idx = known.indexOf(groupId);
  if (idx !== -1) {
    known.splice(idx, 1);
    _setJsonProp('KNOWN_GROUPS', known);
  }
  // 加進「停用清單」 — bot 在該群組除了「重設房號」之外都不回應
  setGroupSuspended(groupId, true);
  if (!prev) return '✅ 已從面板清空 + 該群組停用（bot 沉默直到重設房號）';
  return '✅ 已解除「' + prev + '」房綁定\n翻譯 / 早安 / 班表寫入 全部失效\n要重啟：在該群組打 bot 設定房號 X';
}

// === 早安開關指令 ===
function detectMorningToggleCommand(text) {
  var t = (text || '').replace(/\s+/g, '');
  if (/^(早安開啟|開啟早安|開早安|啟用早安)$/.test(t)) return 'on';
  if (/^(早安關閉|關閉早安|關早安|停止早安)$/.test(t)) return 'off';
  if (/^(早安狀態|早安|查詢早安)$/.test(t)) return 'status';
  return null;
}

function handleMorningToggle(toggle, groupId) {
  if (!groupId) return '❌ 此指令只能在群組使用';
  if (toggle === 'on') {
    setMorningEnabled(groupId, true);
    return '✅ 已開啟本群早安叫醒\n每天約 12:30 自動發送泰文起床訊息';
  }
  if (toggle === 'off') {
    setMorningEnabled(groupId, false);
    return '✅ 已關閉本群早安叫醒';
  }
  return '本群早安：' + (isMorningEnabled(groupId) ? '開啟（每天 12:30 推送）' : '關閉');
}

// === Whoami（任何人都能用，回 userId 給 kabe 設 whitelist 用）===
function detectWhoamiCommand(text) {
  var t = (text || '').replace(/\s+/g, '');
  return /^(whoami|我的id|我的userid|查id|查userid|whoamI)$/i.test(t);
}

function handleWhoami(userId) {
  if (!userId) return '❌ 抓不到 userId（這個訊息來源沒有 user 身分）';
  return '你的 userId：\n' + userId + '\n\n（複製這串，貼進 GAS 的指令碼屬性 LINE_USER_ID_WHITELIST，多人用逗號分隔）';
}

// === Boss 授權（whitelist 模式）===
// LINE_USER_ID_WHITELIST 為空 = 寬鬆，誰都能看 boss
// 有設 = 嚴格，只有清單內 userId 能看；其他人完全靜默
function isBossAuthorized(userId, props) {
  if (!props.LINE_USER_ID_WHITELIST) return true;
  var allowed = props.LINE_USER_ID_WHITELIST.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  return allowed.indexOf(userId) !== -1;
}

// === 測試早安推送（私訊指令）===
function detectTestMorningCommand(text) {
  var t = (text || '').replace(/\s+/g, '');
  return /^(測試早安|早安測試|test早安|早安test|testmorning|morningtest)$/i.test(t);
}

// === Boss 管理員指令 ===
function detectBossCommand(text) {
  var t = (text || '').replace(/\s+/g, '');
  return /^moneyhouse$/i.test(t);
}

function buildBossText(props) {
  cleanupStaleStatus(); // 開面板前先清 stale
  var map = getGroupRoomMap();
  var known = getKnownGroups();
  var disabled = _getDisabledGroupList();
  var enabled = _getMorningEnabledList();
  var whitelist = props && props.LINE_USER_ID_WHITELIST
    ? props.LINE_USER_ID_WHITELIST.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
    : [];

  var lines = ['📋 管理員指令', ''];

  lines.push('【目前群組狀態】');
  if (known.length === 0) {
    lines.push('（沒有已加入的群組）');
  } else {
    // 已綁房號的排前面，未綁的排後面
    var bound = [], unbound = [];
    known.forEach(function (gid) { (map[gid] ? bound : unbound).push(gid); });
    bound.sort(function (a, b) { return map[a] < map[b] ? -1 : 1; });
    bound.forEach(function (gid) {
      var translateOn = disabled.indexOf(gid) === -1;
      var morningOn = enabled.indexOf(gid) !== -1;
      lines.push(map[gid] + ' 房：翻譯 ' + (translateOn ? '開' : '關') + ' / 早安 ' + (morningOn ? '開' : '關'));
    });
    unbound.forEach(function (gid) {
      var translateOn = disabled.indexOf(gid) === -1;
      var morningOn = enabled.indexOf(gid) !== -1;
      lines.push('未綁定 (...' + gid.slice(-6) + ')：翻譯 ' + (translateOn ? '開' : '關') + ' / 早安 ' + (morningOn ? '開' : '關'));
    });
  }
  lines.push('');

  lines.push('【寫班表（私訊我）】');
  lines.push('A 4/25');
  lines.push('紙房子13.00 120/7400-3+nocon');
  lines.push('');

  lines.push('【查空檔】');
  lines.push('群組：bot 現在 / bot <藝名>');
  lines.push('私訊:現在 / <藝名>（不用前綴）');
  lines.push('');

  lines.push('【群組設定（群組裡打）】');
  lines.push('bot 設定房號 A');
  lines.push('bot 解除綁定');
  lines.push('bot 早安開啟 / 關閉 / 狀態');
  lines.push('bot 開啟翻譯 / 關閉翻譯 / 翻譯狀態');
  lines.push('');

  lines.push('【私訊管理（用房號）】');
  lines.push('A 早安開啟 / 關閉');
  lines.push('A 翻譯開啟 / 關閉');
  lines.push('A 解綁');
  lines.push('測試早安（立即推送一次）');
  lines.push('');

  lines.push('【看這份清單】');
  lines.push('bot moneyhouse');
  lines.push('');

  lines.push('【權限狀態】');
  if (whitelist.length === 0) {
    lines.push('⚠️ 未設白名單（誰都看得到此面板）');
    lines.push('設定步驟：');
    lines.push('1) 私訊 bot 打 whoami → 抄 userId');
    lines.push('2) GAS 指令碼屬性 LINE_USER_ID_WHITELIST 貼上');
    lines.push('3) 重新部署');
  } else {
    lines.push('✅ 白名單已設（' + whitelist.length + ' 位管理員）');
    whitelist.forEach(function (u) {
      lines.push('  ...' + u.slice(-6));
    });
  }

  return lines.join('\n');
}

// === Boss 卡片版（Flex Message）===
// 結構：carousel 1 張總覽 + 6 張群組卡（已綁優先、未綁次之），最多 12 張（LINE limit）
// 清理 stale 資料：把不在 KNOWN_GROUPS 的 groupId 從翻譯/早安清單踢掉
// 防止舊資料導致統計算成負數
function cleanupStaleStatus() {
  var known = getKnownGroups();
  var disabled = _getDisabledGroupList().filter(function (g) { return known.indexOf(g) !== -1; });
  var enabled = _getMorningEnabledList().filter(function (g) { return known.indexOf(g) !== -1; });
  var sp = PropertiesService.getScriptProperties();
  sp.setProperty('TRANSLATE_DISABLED_GROUPS', disabled.join(','));
  sp.setProperty('MORNING_CALL_ENABLED_GROUPS', enabled.join(','));
}

function buildBossFlex(props) {
  cleanupStaleStatus(); // 開面板前先清 stale
  var map = getGroupRoomMap();
  var known = getKnownGroups();
  var disabled = _getDisabledGroupList();
  var enabled = _getMorningEnabledList();
  var whitelist = props && props.LINE_USER_ID_WHITELIST
    ? props.LINE_USER_ID_WHITELIST.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
    : [];

  var bubbles = [_overviewBubble(known, map, disabled, enabled, whitelist)];

  var bound = [], unbound = [];
  known.forEach(function (gid) { (map[gid] ? bound : unbound).push(gid); });
  // 排序：自訂順序優先、沒列到的按房號字母序排後面
  var order = getGroupOrder();
  bound.sort(function (a, b) {
    var ra = map[a], rb = map[b];
    var ia = order.indexOf(ra), ib = order.indexOf(rb);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return ra < rb ? -1 : 1;
  });

  bound.forEach(function (gid) {
    bubbles.push(_groupBubble(gid, map[gid], disabled.indexOf(gid) === -1, enabled.indexOf(gid) !== -1));
  });
  unbound.forEach(function (gid) {
    bubbles.push(_unboundBubble(gid, disabled.indexOf(gid) === -1, enabled.indexOf(gid) !== -1));
  });

  if (bubbles.length > 12) bubbles = bubbles.slice(0, 12); // LINE carousel 上限

  return {
    type: 'flex',
    altText: '📋 LifeOS bot 管理面板（' + known.length + ' 個群組）',
    contents: { type: 'carousel', contents: bubbles },
  };
}

function _overviewBubble(known, map, disabled, enabled, whitelist) {
  var bound = known.filter(function (g) { return map[g]; }).length;
  return {
    type: 'bubble', size: 'kilo',
    header: { type: 'box', layout: 'vertical', contents: [
      { type: 'text', text: '📋 管理面板', weight: 'bold', size: 'lg' },
      { type: 'text', text: 'bot moneyhouse', size: 'xs', color: '#888888' },
    ]},
    body: { type: 'box', layout: 'vertical', spacing: 'xs', contents: [
      { type: 'text', text: '群組總數：' + known.length, size: 'sm' },
      { type: 'text', text: '已綁房號：' + bound, size: 'sm' },
      { type: 'text', text: '早安開啟：' + enabled.length, size: 'sm' },
      { type: 'text', text: '翻譯開啟：' + Math.max(0, known.length - disabled.length) + ' / ' + known.length, size: 'sm' },
      { type: 'separator', margin: 'md' },
      { type: 'text', text: '管理員：' + whitelist.length + ' 位' + (whitelist.length === 0 ? '（⚠️ 寬鬆模式）' : ''), size: 'xs', color: '#888888', margin: 'md' },
    ]},
    footer: { type: 'box', layout: 'vertical', spacing: 'xs', contents: [
      { type: 'button', style: 'link', height: 'sm', action: { type: 'postback', label: '文字版面板', data: 'action=show_text' }},
    ]},
  };
}

function _groupBubble(groupId, roomLabel, translateOn, morningOn) {
  var encodedGid = encodeURIComponent(groupId);
  return {
    type: 'bubble', size: 'kilo',
    header: { type: 'box', layout: 'vertical', contents: [
      { type: 'text', text: roomLabel + ' 房', weight: 'bold', size: 'xl' },
      { type: 'text', text: '...' + groupId.slice(-6), size: 'xs', color: '#888888' },
    ]},
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
      { type: 'text', text: '翻譯：' + (translateOn ? '✅ 開啟' : '❌ 關閉') },
      { type: 'text', text: '早安：' + (morningOn ? '✅ 開啟' : '❌ 關閉') },
    ]},
    footer: { type: 'box', layout: 'vertical', spacing: 'xs', contents: [
      { type: 'button', style: morningOn ? 'secondary' : 'primary', height: 'sm', action: {
        type: 'postback', label: morningOn ? '早安關' : '早安開',
        data: 'action=toggle_morning&groupId=' + encodedGid + '&value=' + (morningOn ? 'off' : 'on'),
      }},
      { type: 'button', style: translateOn ? 'secondary' : 'primary', height: 'sm', action: {
        type: 'postback', label: translateOn ? '翻譯關' : '翻譯開',
        data: 'action=toggle_translate&groupId=' + encodedGid + '&value=' + (translateOn ? 'off' : 'on'),
      }},
      { type: 'button', style: 'link', height: 'sm', action: {
        type: 'postback', label: '解綁',
        data: 'action=unbind&groupId=' + encodedGid,
      }},
    ]},
  };
}

function _unboundBubble(groupId, translateOn, morningOn) {
  var encodedGid = encodeURIComponent(groupId);
  return {
    type: 'bubble', size: 'kilo',
    header: { type: 'box', layout: 'vertical', contents: [
      { type: 'text', text: '未綁定', weight: 'bold', size: 'lg', color: '#888888' },
      { type: 'text', text: '...' + groupId.slice(-6), size: 'xs', color: '#888888' },
    ]},
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
      { type: 'text', text: '翻譯：' + (translateOn ? '✅' : '❌'), size: 'sm' },
      { type: 'text', text: '早安：' + (morningOn ? '✅' : '❌'), size: 'sm' },
      { type: 'separator', margin: 'md' },
      { type: 'text', text: '👉 在群組裡打：', size: 'xs', color: '#888888', margin: 'md' },
      { type: 'text', text: 'bot 設定房號 X', size: 'xs', weight: 'bold' },
    ]},
    footer: { type: 'box', layout: 'vertical', contents: [
      { type: 'button', style: 'link', height: 'sm', action: {
        type: 'postback', label: '從面板移除',
        data: 'action=unbind&groupId=' + encodedGid,
      }},
    ]},
  };
}

// === Postback 處理（卡片按鈕觸發）===
function handlePostback(event, props) {
  var userId = event.source && event.source.userId;
  // 授權檢查（卡片按鈕 = 管理員操作，未授權靜默）
  if (!isBossAuthorized(userId, props)) {
    if (props.DEBUG_LOG) console.log('Unauthorized postback userId:', userId);
    return;
  }
  var data = event.postback && event.postback.data;
  if (!data) return;

  var params = {};
  data.split('&').forEach(function (kv) {
    var i = kv.indexOf('=');
    if (i === -1) return;
    params[kv.substring(0, i)] = decodeURIComponent(kv.substring(i + 1));
  });

  var action = params.action || '';
  var msg = '';

  if (action === 'toggle_morning') {
    setMorningEnabled(params.groupId, params.value === 'on');
    msg = '✅ 已切換早安為「' + (params.value === 'on' ? '開啟' : '關閉') + '」';
  } else if (action === 'toggle_translate') {
    setTranslateDisabled(params.groupId, params.value === 'off');
    msg = '✅ 已切換翻譯為「' + (params.value === 'on' ? '開啟' : '關閉') + '」';
  } else if (action === 'unbind') {
    msg = handleUnbind(params.groupId);
  } else if (action === 'batch') {
    var batchMap = {
      'morning_on': { type: 'toggle_all', target: '早安', action: 'on' },
      'morning_off': { type: 'toggle_all', target: '早安', action: 'off' },
      'translate_on': { type: 'toggle_all', target: '翻譯', action: 'on' },
      'translate_off': { type: 'toggle_all', target: '翻譯', action: 'off' },
    };
    var cmd = batchMap[params.op];
    msg = cmd ? handleBatchCommand(cmd) : '❌ 未知批次操作';
  } else if (action === 'show_text') {
    reply(event.replyToken, [{ type: 'text', text: buildBossText(props) }], props);
    return;
  } else {
    msg = '❌ 未知操作：' + action;
  }

  // 操作完成後重發 Flex 面板（讓 kabe 看到更新後狀態）
  reply(event.replyToken, [
    { type: 'text', text: msg },
    buildBossFlex(props),
  ], props);
}

// === 私訊管理指令（用房號 reference）===
// 例：A 早安開啟 / B 翻譯關閉
function detectAdminCommand(text) {
  var t = (text || '').replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ');
  // <房號> <對象> <動作>  例：A 早安 開啟
  var m = t.match(/^(\S+)\s+(早安|翻譯)\s*(開啟|開|啟用|關閉|關|停止|狀態|查詢)$/);
  if (!m) {
    // 沒空白也接受：A早安開啟
    m = t.match(/^(\S{1,5})(早安|翻譯)(開啟|開|啟用|關閉|關|停止|狀態|查詢)$/);
    if (!m) return null;
  }
  var actionWord = m[3];
  var action = /^(開啟|開|啟用)$/.test(actionWord) ? 'on'
             : /^(關閉|關|停止)$/.test(actionWord) ? 'off'
             : 'status';
  return { roomLabel: m[1].toUpperCase(), target: m[2], action: action };
}

// === 自訂排序（私訊：排序 A B C）===
function detectOrderCommand(text) {
  var t = (text || '').replace(/^\s+|\s+$/g, '');
  var m = t.match(/^(?:排序|順序|排列)\s+(.+)$/);
  if (!m) return null;
  return m[1].split(/[\s,，、]+/).map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean);
}

function handleOrderCommand(orderList) {
  if (!orderList.length) return '❌ 請給房號清單，例：排序 A B C';
  PropertiesService.getScriptProperties().setProperty('GROUP_ORDER', orderList.join(','));
  return '✅ 已設定排序：' + orderList.join(' → ') + '\n\n（沒列到的房號會排在後面、按字母序）';
}

function getGroupOrder() {
  var raw = PropertiesService.getScriptProperties().getProperty('GROUP_ORDER') || '';
  return raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

// === 批次指令（私訊：全部 X 開/關）===
function detectBatchCommand(text) {
  var t = (text || '').replace(/\s+/g, '');
  var m = t.match(/^全部(早安|翻譯)(開啟|開|啟用|關閉|關|停止)$/);
  if (m) {
    var action = /^(開啟|開|啟用)$/.test(m[2]) ? 'on' : 'off';
    return { type: 'toggle_all', target: m[1], action: action };
  }
  if (/^(全部解綁|全部解除綁定|全部清空|清空所有群組)$/.test(t)) {
    return { type: 'unbind_all' };
  }
  return null;
}

function handleBatchCommand(cmd) {
  var known = getKnownGroups();
  if (!known.length) return '沒有任何已知群組';
  if (cmd.type === 'toggle_all') {
    var count = 0;
    known.forEach(function (gid) {
      if (cmd.target === '早安') setMorningEnabled(gid, cmd.action === 'on');
      else setTranslateDisabled(gid, cmd.action === 'off'); // 翻譯邏輯反向：disabled=關閉
      count++;
    });
    return '✅ 已對 ' + count + ' 個群組' + cmd.target + '：' + (cmd.action === 'on' ? '全部開啟' : '全部關閉');
  }
  if (cmd.type === 'unbind_all') {
    var n = known.length;
    known.forEach(function (gid) {
      setMorningEnabled(gid, false);
      setTranslateDisabled(gid, false);
      setGroupSuspended(gid, true); // 全部停用，bot 在這些群組沉默
    });
    _setJsonProp('GROUP_ROOM_MAP', {});
    _setJsonProp('KNOWN_GROUPS', []);
    return '✅ 已清空所有 ' + n + ' 個群組綁定，bot 全部停用\n要重啟某個群組：在那群組打 bot 設定房號 X';
  }
  return '❌ 未知批次指令';
}

// 私訊用房號解綁：例 A 解綁 / 紙房子 解除綁定
function detectAdminUnbindCommand(text) {
  var t = (text || '').replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ');
  var m = t.match(/^(\S{1,10})\s*(解綁|解除綁定|解除房號|取消綁定|清除房號|移除房號)$/);
  if (!m) return null;
  return m[1].toUpperCase();
}

function handleAdminUnbind(roomLabel) {
  var groupId = getGroupByRoom(roomLabel);
  if (!groupId) return '❌ 找不到房號「' + roomLabel + '」的群組';
  return handleUnbind(groupId);
}

function handleAdminCommand(cmd) {
  var groupId = getGroupByRoom(cmd.roomLabel);
  if (!groupId) {
    return '❌ 找不到房號「' + cmd.roomLabel + '」的群組\n（綁定方式：在該群組打 bot 設定房號 ' + cmd.roomLabel + '）';
  }
  if (cmd.target === '早安') {
    if (cmd.action === 'on') { setMorningEnabled(groupId, true); return '✅「' + cmd.roomLabel + '」房早安：開啟'; }
    if (cmd.action === 'off') { setMorningEnabled(groupId, false); return '✅「' + cmd.roomLabel + '」房早安：關閉'; }
    return '「' + cmd.roomLabel + '」房早安：' + (isMorningEnabled(groupId) ? '開啟' : '關閉');
  }
  // 翻譯
  if (cmd.action === 'on') { setTranslateDisabled(groupId, false); return '✅「' + cmd.roomLabel + '」房翻譯：開啟'; }
  if (cmd.action === 'off') { setTranslateDisabled(groupId, true); return '✅「' + cmd.roomLabel + '」房翻譯：關閉'; }
  return '「' + cmd.roomLabel + '」房翻譯：' + (isTranslateDisabled(groupId) ? '關閉' : '開啟');
}

// === Join event：bot 被加進群組 ===
function handleJoinEvent(event, props) {
  var groupId = (event.source && (event.source.groupId || event.source.roomId)) || null;
  if (!groupId) return;
  rememberGroup(groupId);
  var welcome =
    '👋 LifeOS 班表 bot 已加入\n\n' +
    '請先為本群組編號：\n' +
    'bot 設定房號 A\n' +
    '（A 換成實際房號，例如 215、紙房子）\n\n' +
    '編號後就能用 bot 查空檔、寫班表、開啟翻譯／早安叫醒等功能。';
  if (event.replyToken) {
    reply(event.replyToken, [{ type: 'text', text: welcome }], props);
  }
}

// =============================================================
// === 翻譯開關（每群組獨立，存 ScriptProperties）==============
// =============================================================

function detectTranslateToggleCommand(text) {
  var t = (text || '').replace(/\s+/g, '');
  if (/^(關閉翻譯|關翻譯|停止翻譯)$/.test(t)) return 'off';
  if (/^(開啟翻譯|開翻譯|啟用翻譯)$/.test(t)) return 'on';
  if (/^(查詢翻譯|翻譯狀態|翻譯)$/.test(t)) return 'status';
  return null;
}

function _getDisabledGroupList() {
  var raw = PropertiesService.getScriptProperties().getProperty('TRANSLATE_DISABLED_GROUPS') || '';
  return raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

function isTranslateDisabled(groupId) {
  if (!groupId) return false;
  return _getDisabledGroupList().indexOf(groupId) !== -1;
}

function setTranslateDisabled(groupId, disabled) {
  if (!groupId) return;
  var list = _getDisabledGroupList();
  var idx = list.indexOf(groupId);
  if (disabled && idx === -1) list.push(groupId);
  else if (!disabled && idx !== -1) list.splice(idx, 1);
  PropertiesService.getScriptProperties().setProperty('TRANSLATE_DISABLED_GROUPS', list.join(','));
}

function handleTranslateToggle(toggle, groupId) {
  if (!groupId) return '❌ 此指令只能在群組使用';
  if (toggle === 'off') {
    setTranslateDisabled(groupId, true);
    return '✅ 已關閉本群翻譯';
  }
  if (toggle === 'on') {
    setTranslateDisabled(groupId, false);
    return '✅ 已開啟本群翻譯';
  }
  // status
  return '本群翻譯：' + (isTranslateDisabled(groupId) ? '關閉' : '開啟（中⇄泰自動翻譯）');
}

// =============================================================
// === 翻譯（中泰雙向）=========================================
// =============================================================

function translateMessage(text, props) {
  if (!text) return null;
  var hasThai = /[฀-๿]/.test(text);
  var hasChinese = /[一-鿿]/.test(text);
  var hasEnglish = /[A-Za-z]/.test(text);

  // 優先順序：
  //   有泰文（含泰英混雜、泰中混雜）→ 翻中（th2zh）
  //   有中文（含中英混雜）→ 翻泰（zh2th）
  //   純英文（無泰無中）→ 翻中 + 翻泰兩行（en2both）
  //   都沒有 → 不翻
  // 用整段判定 direction，逐行翻譯時所有行共用同一個方向避免混亂
  var direction;
  if (hasThai) direction = 'th2zh';
  else if (hasChinese) direction = 'zh2th';
  else if (hasEnglish) direction = 'en2both';
  else return null;

  // 多行訊息：逐行翻譯，保留行結構（標點/分隔線/空行原樣保留）
  // 理由：kabe 反映文字過多時 Gemini 翻不準；逐行送 API 比較精準
  if (text.indexOf('\n') !== -1) {
    return text.split('\n').map(function (line) {
      // 空行原樣保留
      if (!line.trim()) return line;
      // 該行沒有任何翻譯目標語言字符（純符號 ~~ / 數字 / emoji）→ 原樣保留
      if (!/[฀-๿一-鿿A-Za-z]/.test(line)) return line;
      return translateOneLine(line, direction, props);
    }).join('\n');
  }

  return translateOneLine(text, direction, props);
}

function translateOneLine(text, direction, props) {
  if (props.GEMINI_API_KEY) {
    try {
      return translateWithGemini(text, direction, props);
    } catch (e) {
      console.error('Gemini translate failed, fallback to LanguageApp:', e);
    }
  }
  // Fallback：GAS 內建翻譯（品質較差但保證有譯文）
  if (direction === 'th2zh') return LanguageApp.translate(text, 'th', 'zh-TW');
  if (direction === 'zh2th') return LanguageApp.translate(text, 'zh-TW', 'th');
  if (direction === 'en2both') {
    var zh = LanguageApp.translate(text, 'en', 'zh-TW');
    var th = LanguageApp.translate(text, 'en', 'th');
    return zh + '\n' + th;
  }
  return text;
}

function translateWithGemini(text, direction, props) {
  var directionNote;
  if (direction === 'th2zh') directionNote = '把以下泰文翻譯成台灣繁體中文';
  else if (direction === 'zh2th') directionNote = '把以下中文翻譯成泰文';
  else if (direction === 'en2both') directionNote = '把以下英文同時翻譯成 (1) 台灣繁體中文 (2) 泰文。輸出格式：第一行中文、第二行泰文，中間不加任何標籤、引號、編號';
  else directionNote = '把以下中文翻譯成泰文';

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
    '- 只回譯文，不要加說明、引號、前綴\n' +
    '- 保留原文的標點符號（。，！？～：等）原樣，不要刪減' +
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

// =============================================================
// === LINE Push API + 早安叫醒排程 ============================
// =============================================================
// GAS trigger 設定：每 5 分鐘執行 sendMorningCall
//   - 內部判斷只在 12:30-12:34 視窗發送
//   - 用 LAST_MORNING_CALL_DATE 防同一天重發

var MORNING_MESSAGE = 'ตื่นแล้วช่วยบอกสตาฟด้วยนะ และรีบแต่งหน้าให้เสร็จโดยเร็วที่สุดครับ';

// 推訊息給所有管理員（用 LINE Push API，吃月配額但失敗才會發，量很小）
function notifyAdmin(message, props) {
  if (!props.LINE_USER_ID_WHITELIST) {
    if (props.DEBUG_LOG) console.log('No whitelist set, skip notifyAdmin');
    return;
  }
  var admins = props.LINE_USER_ID_WHITELIST.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  admins.forEach(function (uid) {
    linePush(uid, message, props);
  });
}

function linePush(toGroupId, text, props) {
  try {
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + props.LINE_CHANNEL_ACCESS_TOKEN },
      payload: JSON.stringify({
        to: toGroupId,
        messages: [{ type: 'text', text: text }],
      }),
      muteHttpExceptions: true,
    });
    var code = res.getResponseCode();
    if (props.DEBUG_LOG) console.log('LINE push to', toGroupId, code, res.getContentText());
    return code === 200;
  } catch (e) {
    console.error('linePush exception:', e);
    return false;
  }
}

// 測試用：手動觸發早安推送（GAS 編輯器選函式 testMorningCall 執行）
// 跳過時間檢查 + 不更新 LAST_MORNING_CALL_DATE（不影響正式排程）
function testMorningCall() {
  var props = getProps();
  var enabled = _getMorningEnabledList();
  if (!enabled.length) {
    console.log('❌ 沒有群組開啟早安。先在群組打 bot 早安開啟');
    return '沒有群組開啟早安';
  }
  console.log('Test: 推送早安訊息給', enabled.length, '個群組');
  var results = [];
  enabled.forEach(function (gid) {
    var ok = linePush(gid, MORNING_MESSAGE, props);
    var line = (ok ? '✅' : '❌') + ' ' + gid.slice(-6);
    console.log('  ', line);
    results.push(line);
  });
  return results.join('\n');
}

function sendMorningCall() {
  var props = getProps();
  var now = nowParts();

  // 12:30-12:34 視窗外不執行（每 5 分鐘 trigger 會剛好命中其中一次）
  if (now.h !== 12 || now.min < 30 || now.min > 34) return;

  // 同一天只發一次
  var todayKey = now.y + '-' + pad(now.mon) + '-' + pad(now.day);
  var sp = PropertiesService.getScriptProperties();
  if (sp.getProperty('LAST_MORNING_CALL_DATE') === todayKey) return;

  var enabled = _getMorningEnabledList();
  // 不論有沒有 enabled，都先記今天執行過，避免下個 5 分鐘 trigger 再進來判斷
  sp.setProperty('LAST_MORNING_CALL_DATE', todayKey);

  if (!enabled.length) {
    if (props.DEBUG_LOG) console.log('Morning call: no enabled groups today');
    return;
  }

  enabled.forEach(function (gid) {
    linePush(gid, MORNING_MESSAGE, props);
  });
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
