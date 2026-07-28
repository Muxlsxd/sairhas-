// ============================================================================
// BP18 Form Backend — Google Apps Script
// Deployed as: Execute as = ME (owner), Who has access = Only myself
// This gives the bridge (running as you) full read/write to Sheets in YOUR account.
// ============================================================================

// ---- CONFIG: put your form-response sheet ID here ----
// (the part between /spreadsheets/d/ and /edit in the URL)
var SHEET_ID = '1kRmXS_4WqKCbUxFyY_vg4lhEvhmlZcSwKJOnzIfOCto';

function getSheet() {
  return SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
}

// ---- MCP tool: list_sheets ----
function list_sheets() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var names = ss.getSheets().map(function (s) { return s.getName(); });
  return JSON.stringify({ sheets: names });
}

// ---- MCP tool: read_sheet ----
// opts: { range?: "A1:Z", maxRows?: number }
function read_sheet(opts) {
  opts = opts || {};
  var sheet = getSheet();
  var data = opts.range ? sheet.getRange(opts.range).getValues()
                         : sheet.getDataRange().getValues();
  if (opts.maxRows && data.length > opts.maxRows) {
    data = data.slice(0, opts.maxRows);
  }
  return JSON.stringify({ rows: data.length, values: data });
}

// ---- MCP tool: append_row ----
// opts: { values: [...] }
function append_row(opts) {
  var sheet = getSheet();
  sheet.appendRow(opts.values || []);
  return JSON.stringify({ ok: true, lastRow: sheet.getLastRow() });
}

// ---- MCP tool: update_cell ----
// opts: { row: number, col: number, value: any }  (1-indexed)
function update_cell(opts) {
  var sheet = getSheet();
  sheet.getRange(opts.row, opts.col).setValue(opts.value);
  return JSON.stringify({ ok: true });
}

// ---- MCP tool: get_info ----
function get_info() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getActiveSheet();
  return JSON.stringify({
    title: ss.getName(),
    sheet: sheet.getName(),
    lastRow: sheet.getLastRow(),
    lastColumn: sheet.getLastColumn(),
    url: ss.getUrl()
  });
}

// ---- Web App entry (only used for the deploy health check) ----
function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'bp18_form_backend ok', deployedAs: Session.getActiveUser().getEmail() || 'owner' })
  ).setMimeType(ContentService.MimeType.JSON);
}
