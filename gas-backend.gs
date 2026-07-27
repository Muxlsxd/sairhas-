/**
 * สายรหัส (Code Line) - Google Apps Script Backend
 * Senior/Junior anonymous pairing system for KMUTT APE/TME
 * 
 * Setup:
 * 1. Create Google Sheet with tabs: pairs, seniors, messages
 * 2. Paste this code.gs into Apps Script project
 * 3. Deploy as Web App (Execute as: Me, Who has access: Anyone)
 * 4. Copy Web App URL to frontend CONFIG.GAS_URL
 */

// ============ CONFIG ============
const SHEET_NAME = 'สายรหัส_Data'; // or use SpreadsheetApp.getActiveSpreadsheet()
const TABS = {
  PAIRS: 'pairs',
  SENIORS: 'seniors',
  MESSAGES: 'messages'
};

// Column definitions
const COL = {
  PAIRS: { pair_key: 1, y2_id: 2, y1_id: 3, reveal_at: 4, status: 5, picked_at: 6 },
  SENIORS: { y2_id: 1, name: 2, faculty: 3, max_picks: 4, current_picks: 5 },
  MESSAGES: { id: 1, pair_key: 2, from_id: 3, content: 4, type: 5, sent_at: 6, read_at: 7 }
};

// ============ UTILITIES ============
function parseStudentId(id) {
  const s = String(id).trim().replace(/\D/g, '');
  // Support both 11-digit and 13-digit IDs
  if (s.length === 11) {
    return {
      year: s.slice(0, 2),
      core: s.slice(2, 8),
      suffix: s.slice(8, 11),
      pairKey: s.slice(8, 11),  // Use only last 3 digits (suffix) for pairing
      role: s.startsWith('68') ? 'Y2' : s.startsWith('69') ? 'Y1' : null,
      full: s
    };
  }
  if (s.length === 13) {
    return {
      year: s.slice(0, 2),
      core: s.slice(2, 8),
      variable: s.slice(8, 10),
      suffix: s.slice(10, 13),
      pairKey: s.slice(10, 13),  // Use only last 3 digits (suffix) for pairing
      role: s.startsWith('68') ? 'Y2' : s.startsWith('69') ? 'Y1' : null,
      full: s
    };
  }
  return null;
}

function getSheet(tabName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    // Write headers
    if (tabName === TABS.PAIRS) {
      sheet.getRange(1, 1, 1, 6).setValues([['pair_key', 'y2_id', 'y1_id', 'reveal_at', 'status', 'picked_at']]);
    } else if (tabName === TABS.SENIORS) {
      sheet.getRange(1, 1, 1, 5).setValues([['y2_id', 'name', 'faculty', 'max_picks', 'current_picks']]);
    } else if (tabName === TABS.MESSAGES) {
      sheet.getRange(1, 1, 1, 7).setValues([['id', 'pair_key', 'from_id', 'content', 'type', 'sent_at', 'read_at']]);
    }
  }
  return sheet;
}

function getDataRows(tabName) {
  const sheet = getSheet(tabName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
}

function findRow(tabName, colIndex, value) {
  const rows = getDataRows(tabName);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][colIndex - 1]).trim() === String(value).trim()) {
      return { rowIndex: i + 2, data: rows[i] };
    }
  }
  return null;
}

function appendRow(tabName, values) {
  const sheet = getSheet(tabName);
  sheet.appendRow(values);
}

function updateRow(tabName, rowIndex, values) {
  const sheet = getSheet(tabName);
  sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
}

// ============ API HANDLERS ============
function doPost(e) {
  try {
    let payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      // Handle GET with query params
      payload = e.parameter;
    } else {
      payload = {};
    }
    
    const action = payload.action;
    let result;

    switch (action) {
      case 'verifyStudentId':
        result = handleVerifyStudentId(payload.student_id);
        break;
      case 'getPairByKey':
        result = handleGetPairByKey(payload.pair_key);
        break;
      case 'getAvailableJuniors':
        result = handleGetAvailableJuniors();
        break;
      case 'pickJunior':
        result = handlePickJunior(payload.y2_id, payload.y1_id);
        break;
      case 'sendMessage':
        result = handleSendMessage(payload.pair_key, payload.from_id, payload.content, payload.type);
        break;
      case 'getThread':
        result = handleGetThread(payload.pair_key);
        break;
      case 'getCountdown':
        result = handleGetCountdown(payload.pair_key);
        break;
      default:
        result = { ok: false, error: 'Unknown action' };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    console.error('doPost error:', err);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return doPost(e);
}

// ---------- verifyStudentId ----------
function handleVerifyStudentId(studentId) {
  const parsed = parseStudentId(studentId);
  if (!parsed || !parsed.role) {
    return { ok: false, error: 'รหัสนักศึกษาไม่ถูกต้อง (ต้อง 11 หรือ 13 หลัก เริ่มต้น 68 หรือ 69)' };
  }

  // First, try exact match in pairs sheet (y2_id or y1_id column)
  const pairs = getDataRows(TABS.PAIRS);
  for (const row of pairs) {
    const y2 = String(row[COL.PAIRS.y2_id - 1]).trim();
    const y1 = String(row[COL.PAIRS.y1_id - 1]).trim();
    if (y2 === parsed.full || y1 === parsed.full) {
      return {
        ok: true,
        pair: {
          pair_key: row[COL.PAIRS.pair_key - 1],
          y2_id: y2,
          y1_id: y1,
          reveal_at: row[COL.PAIRS.reveal_at - 1],
          status: row[COL.PAIRS.status - 1]
        }
      };
    }
  }

  // Not paired yet - check if senior exists in seniors tab
  if (parsed.role === 'Y2') {
    const seniorRow = findRow(TABS.SENIORS, COL.SENIORS.y2_id, parsed.full);
    if (!seniorRow) {
      appendRow(TABS.SENIORS, [parsed.full, '', 'APE/TME', 3, 0]);
    }
  }

  // Find potential match by suffix (last 3 digits)
  const match = pairs.find(r => {
    const y2 = String(r[COL.PAIRS.y2_id - 1]).trim();
    const y1 = String(r[COL.PAIRS.y1_id - 1]).trim();
    const status = String(r[COL.PAIRS.status - 1]).trim();
    if (parsed.role === 'Y2') {
      // Senior looking for junior with same suffix
      return y1 && parseStudentId(y1).suffix === parsed.suffix && !y2 && status !== 'matched';
    } else {
      // Junior looking for senior with same suffix
      return y2 && parseStudentId(y2).suffix === parsed.suffix && !y1 && status !== 'matched';
    }
  });

  if (match) {
    return {
      ok: true,
      pair: {
        pair_key: match[COL.PAIRS.pair_key - 1],
        y2_id: match[COL.PAIRS.y2_id - 1],
        y1_id: match[COL.PAIRS.y1_id - 1],
        reveal_at: match[COL.PAIRS.reveal_at - 1],
        status: match[COL.PAIRS.status - 1]
      }
    };
  }

  return {
    ok: true,
    pair: null,
    parsed: parsed
  };
}

// ---------- getPairByKey ----------
function handleGetPairByKey(pairKey) {
  const pairRow = findRow(TABS.PAIRS, COL.PAIRS.pair_key, pairKey);
  if (!pairRow) return { ok: false, error: 'Pair not found' };
  const p = pairRow.data;
  return {
    ok: true,
    pair: {
      pair_key: p[COL.PAIRS.pair_key - 1],
      y2_id: p[COL.PAIRS.y2_id - 1],
      y1_id: p[COL.PAIRS.y1_id - 1],
      reveal_at: p[COL.PAIRS.reveal_at - 1],
      status: p[COL.PAIRS.status - 1]
    }
  };
}

// ---------- getAvailableJuniors ----------
function handleGetAvailableJuniors() {
  const pairs = getDataRows(TABS.PAIRS);
  const pairedY1Ids = new Set(pairs.map(r => String(r[COL.PAIRS.y1_id - 1]).trim()).filter(Boolean));

  // Get all Y1 IDs from pairs sheet (including unpaired ones in column 3)
  // For now, return Y1s that are in pairs but have no Y2 (status = unpaired)
  const available = pairs
    .filter(r => {
      const y1 = String(r[COL.PAIRS.y1_id - 1]).trim();
      const y2 = String(r[COL.PAIRS.y2_id - 1]).trim();
      const status = String(r[COL.PAIRS.status - 1]).trim();
      return y1 && !y2 && status !== 'matched';
    })
    .map(r => ({
      y1_id: r[COL.PAIRS.y1_id - 1],
      pair_key: r[COL.PAIRS.pair_key - 1],
      core: 'APE/TME',  // fallback
      suffix: r[COL.PAIRS.pair_key - 1]  // pair_key IS the suffix now
    }));

  return { ok: true, juniors: available };
}

// ---------- pickJunior ----------
// ---------- pickJunior ----------
function handlePickJunior(y2Id, y1Id) {
  // Check senior's current picks
  const seniorRow = findRow(TABS.SENIORS, COL.SENIORS.y2_id, y2Id);
  const currentPicks = seniorRow ? parseInt(seniorRow.data[COL.SENIORS.current_picks - 1]) || 0 : 0;
  const maxPicks = seniorRow ? parseInt(seniorRow.data[COL.SENIORS.max_picks - 1]) || 3 : 3;

  if (currentPicks >= maxPicks) {
    return { ok: false, error: `คุณเลือกน้องได้สูงสุด ${maxPicks} คนแล้ว` };
  }

  // Find the pair row for this Y1
  const pairRow = findRow(TABS.PAIRS, COL.PAIRS.y1_id, y1Id);
  if (!pairRow) return { ok: false, error: 'ไม่พบข้อมูลน้องนี้' };

  const pairData = pairRow.data;
  const existingY2 = String(pairData[COL.PAIRS.y2_id - 1]).trim();
  if (existingY2) return { ok: false, error: 'น้องคนนี้มีพี่แล้ว' };

  // Update pair
  const now = new Date().toISOString();
  const newValues = [...pairData];
  newValues[COL.PAIRS.y2_id - 1] = y2Id;
  newValues[COL.PAIRS.status - 1] = 'matched';
  newValues[COL.PAIRS.picked_at - 1] = now;
  updateRow(TABS.PAIRS, pairRow.rowIndex, newValues);

  // Update senior pick count
  if (seniorRow) {
    const seniorValues = [...seniorRow.data];
    seniorValues[COL.SENIORS.current_picks - 1] = currentPicks + 1;
    updateRow(TABS.SENIORS, seniorRow.rowIndex, seniorValues);
  }

  return { ok: true, pair_key: pairData[COL.PAIRS.pair_key - 1] };
}

// ---------- sendMessage ----------
function handleSendMessage(pairKey, fromId, content, type) {
  const validTypes = ['advice', 'encourage', 'secret', 'custom'];
  if (!validTypes.includes(type)) type = 'custom';
  if (!content || content.trim().length === 0) return { ok: false, error: 'ข้อความว่าง' };
  if (content.length > 500) return { ok: false, error: 'ข้อความยาวเกิน 500 ตัวอักษร' };

  const msgId = Utilities.getUuid();
  const now = new Date().toISOString();
  appendRow(TABS.MESSAGES, [msgId, pairKey, fromId, content.trim(), type, now, '']);
  return { ok: true, message: { id: msgId, pair_key: pairKey, from_id: fromId, content: content.trim(), type, sent_at: now } };
}

// ---------- getThread ----------
function handleGetThread(pairKey) {
  const rows = getDataRows(TABS.MESSAGES);
  const messages = rows
    .filter(r => String(r[COL.MESSAGES.pair_key - 1]).trim() === String(pairKey).trim())
    .map(r => ({
      id: r[COL.MESSAGES.id - 1],
      pair_key: r[COL.MESSAGES.pair_key - 1],
      from_id: r[COL.MESSAGES.from_id - 1],
      content: r[COL.MESSAGES.content - 1],
      type: r[COL.MESSAGES.type - 1],
      sent_at: r[COL.MESSAGES.sent_at - 1],
      read_at: r[COL.MESSAGES.read_at - 1]
    }))
    .sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));

  return { ok: true, messages };
}

// ---------- getCountdown ----------
function handleGetCountdown(pairKey) {
  const pairRow = findRow(TABS.PAIRS, COL.PAIRS.pair_key, pairKey);
  if (!pairRow) return { ok: false, error: 'Pair not found' };
  return { ok: true, reveal_at: pairRow.data[COL.PAIRS.reveal_at - 1] };
}

// ============ ADMIN HELPERS ============
/**
 * Pre-match pairs from a 2D array: [[y2_id, y1_id, reveal_at], ...]
 * reveal_at format: '2026-08-15 18:00'
 */
function adminPreMatchPairs(pairsData) {
  const sheet = getSheet(TABS.PAIRS);
  pairsData.forEach(([y2, y1, revealAt]) => {
    const parsedY2 = parseStudentId(y2);
    const parsedY1 = parseStudentId(y1);
    if (!parsedY2 || !parsedY1) return;
    if (parsedY2.pairKey !== parsedY1.pairKey) return; // pair keys must match

    // Check if pair exists
    const existing = findRow(TABS.PAIRS, COL.PAIRS.pair_key, parsedY2.pairKey);
    if (existing) {
      const vals = [...existing.data];
      vals[COL.PAIRS.y2_id - 1] = y2;
      vals[COL.PAIRS.y1_id - 1] = y1;
      vals[COL.PAIRS.reveal_at - 1] = revealAt;
      vals[COL.PAIRS.status - 1] = 'matched';
      vals[COL.PAIRS.picked_at - 1] = new Date().toISOString();
      updateRow(TABS.PAIRS, existing.rowIndex, vals);
    } else {
      appendRow(TABS.PAIRS, [parsedY2.pairKey, y2, y1, revealAt, 'matched', new Date().toISOString()]);
    }

    // Ensure senior exists
    const seniorRow = findRow(TABS.SENIORS, COL.SENIORS.y2_id, y2);
    if (!seniorRow) {
      appendRow(TABS.SENIORS, [y2, '', 'APE/TME', 3, 1]);
    } else {
      const vals = [...seniorRow.data];
      vals[COL.SENIORS.current_picks - 1] = (parseInt(vals[COL.SENIORS.current_picks - 1]) || 0) + 1;
      updateRow(TABS.SENIORS, seniorRow.rowIndex, vals);
    }
  });
}

/**
 * Add unpaired juniors (Y1 only) for seniors to pick
 * juniorsData: [[y1_id], ...]
 */
function adminAddUnpairedJuniors(juniorsData) {
  juniorsData.forEach(([y1]) => {
    const parsed = parseStudentId(y1);
    if (!parsed || parsed.role !== 'Y1') return;
    const existing = findRow(TABS.PAIRS, COL.PAIRS.y1_id, y1);
    if (!existing) {
      appendRow(TABS.PAIRS, [parsed.pairKey, '', y1, '', 'unpaired', '']);
    }
  });
}

/**
 * Import APE student data from ExcelReport APE .xlsx
 * Run this ONCE to populate pairs sheet with all matched pairs
 * revealAt: reveal date for all pairs (default: 2026-08-15 18:00)
 */
function adminImportAPEData(revealAt = '2026-08-15 18:00') {
  // Y2 students (Year 68) - 35 students
  const y2Students = [
    '68070507601','68070507602','68070507603','68070507605','68070507606',
    '68070507607','68070507608','68070507609','68070507610','68070507611',
    '68070507612','68070507613','68070507614','68070507615','68070507616',
    '68070507618','68070507619','68070507620','68070507622','68070507624',
    '68070507625','68070507626','68070507627','68070507630','68070507631',
    '68070507632','68070507633','68070507634','68070507635','68070507636',
    '68070507637','68070507638','68070507639','68070507640','68070507641',
    '68070507643'
  ];

  // Y1 students (Year 69) - 40 students
  const y1Students = [
    '69070509601','69070509602','69070509603','69070509604','69070509605',
    '69070509606','69070509607','69070509608','69070509609','69070509610',
    '69070509611','69070509612','69070509613','69070509614','69070509615',
    '69070509616','69070509617','69070509618','69070509619','69070509620',
    '69070509621','69070509622','69070509623','69070509624','69070509625',
    '69070509626','69070509627','69070509628','69070509629','69070509630',
    '69070509631','69070509632','69070509633','69070509634','69070509635',
    '69070509636','69070509637','69070509638','69070509639','69070509640'
  ];

  // Build pairs by matching suffix
  const pairsToCreate = [];
  const unpairedY1 = [];
  const unpairedY2 = [];

  y2Students.forEach(y2 => {
    const p2 = parseStudentId(y2);
    const match = y1Students.find(y1 => parseStudentId(y1).suffix === p2.suffix);
    if (match) {
      pairsToCreate.push([y2, match, revealAt]);
    } else {
      unpairedY2.push(y2);
    }
  });

  y1Students.forEach(y1 => {
    const p1 = parseStudentId(y1);
    const match = y2Students.find(y2 => parseStudentId(y2).suffix === p1.suffix);
    if (!match) {
      unpairedY1.push(y1);
    }
  });

  // Create matched pairs
  adminPreMatchPairs(pairsToCreate);

  // Add unpaired Y1s for seniors to pick
  adminAddUnpairedJuniors(unpairedY1.map(id => [id]));

  // Add unpaired Y2s to seniors list
  unpairedY2.forEach(y2 => {
    const parsed = parseStudentId(y2);
    const existing = findRow(TABS.SENIORS, COL.SENIORS.y2_id, y2);
    if (!existing) {
      appendRow(TABS.SENIORS, [y2, '', 'APE/TME', 3, 0]);
    }
  });

  console.log(`Imported: ${pairsToCreate.length} pairs, ${unpairedY1.length} unpaired Y1, ${unpairedY2.length} unpaired Y2`);
}

// ============ TEST ============
function testParse() {
  console.log(parseStudentId('68070507606'));
  console.log(parseStudentId('69070509606'));
}

function testImportAPEData() {
  adminImportAPEData('2026-08-15 18:00');
}