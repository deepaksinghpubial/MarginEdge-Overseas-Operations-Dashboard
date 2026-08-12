/**
 * ============================================================================
 *  QA DASHBOARDS — Google Sheet data proxy  (paste this whole file)
 * ============================================================================
 *  Lets the Legacy & IPA dashboards read this workbook WITHOUT making the file
 *  public. Runs as YOU; the sheet stays private.
 *
 *  SETUP: Extensions ▸ Apps Script ▸ (Ctrl+A, delete, paste this) ▸ Save ▸
 *  Deploy ▸ Manage deployments ▸ edit (pencil) ▸ Version: New version ▸ Deploy.
 *  Access: Execute as Me · Who has access: Anyone within MarginEdge.
 *
 *  ENDPOINTS
 *    /exec                 -> {"tabs":{tab:[rows...]}, "tabNames":[...], "totals":{tab:n}}
 *    /exec?meta=1          -> {"meta":{tab:{rows,headers,sample}}, "tabNames":[...]}  (tiny)
 *    /exec?tabs=A|B        -> only those tabs (delimiter is | or , so tab names may
 *                              contain the other character)
 *    /exec?tabs=A&offset=0&limit=10000  -> a page of rows (for large tabs)
 *    add &callback=fn to any of the above for JSONP.
 *
 *  PERFORMANCE NOTE (2026-08): the original version called
 *  sh.getDataRange().getValues() on every single request, reading the WHOLE
 *  tab into memory even when only one page of rows was asked for. As the
 *  Mistakes tabs grow with each month of data, that full-sheet read gets
 *  slower on every page (page 1, 2, 3… all re-read the entire, ever-larger
 *  sheet), and eventually a single doGet() call runs past Apps Script's
 *  execution time limit. The client (sheet-loader.js) retries 3 times and
 *  then gives up, so window.QA_DATA never populates and every view derived
 *  from the Mistakes tab — including the order link column — goes blank,
 *  even though the daily-score views (a much smaller tab) keep working fine.
 *  This version uses getLastRow()/getLastColumn() (cheap metadata calls) plus
 *  a targeted getRange() read for just the requested page, so response time
 *  no longer grows with total sheet size.
 *
 *  BUGFIX (2026-08): the dashboard's own client code (sheet-loader.js) joins
 *  requested tab names with commas ("tabs=Sheet A,Sheet B"), but this file was
 *  splitting on "|" only. With no "|" present, the whole comma-joined string
 *  was treated as a single (unmatched) tab name, so EVERY tab silently came
 *  back empty and the dashboard fell back to the bundled static data. Now
 *  splits on either "," or "|".
 *
 *  ARCHIVE MONTHS (2026-08): add &sheetId=<spreadsheet id> to any request to
 *  read from a DIFFERENT spreadsheet (e.g. an archived month's snapshot)
 *  instead of the one this script is bound to. The script runs as you, so
 *  this only works for spreadsheets you own or have at least view access to.
 *  Omit sheetId (or leave it blank) to read the live, bound spreadsheet as
 *  before — this is fully backward compatible with existing calls.
 *
 *  ERROR REVIEWS (2026-08): the dashboards can now record a review verdict
 *  against an individual mistake. Reviews are appended to an "Error Reviews"
 *  tab in this workbook (created automatically on the first save, with its
 *  header row), so every reviewer sees the same audit trail and it is visible
 *  and editable in the sheet like any other tab.
 *    /exec?action=saveReview&review_date=...&reviewer_username=...&verdict=...
 *      ...&remarks=...&order_url=...&target_login=...&mistake_key=...
 *      -> {"ok":true,"review_id":"..."}
 *  Re-saving the same mistake_key UPDATES that row rather than appending a
 *  duplicate, so a verdict can be corrected. Reads come back through the
 *  normal tabs mechanism (tabs=Error Reviews), so no extra read endpoint.
 *  NOTE: this writes to the workbook, so the deployment must run as you (it
 *  already does) and you need edit access (you own it).
 *
 *  BUGFIX (2026-08): FR Details' per-day columns ("1 Aug 2026", "2 Aug 2026",
 *  ...) are real Date cells, not text. sheetInfo() was reading every header
 *  with a blind String(h), which for a Date cell produces JS's verbose
 *  default toString() (e.g. "Sat Aug 01 2026 00:00:00 GMT..."), not
 *  "1 Aug 2026" — so the client's date-header parser never matched a single
 *  column and every per-day Final Review count silently came back empty.
 *  Date-typed headers are now formatted explicitly to match.
 * ============================================================================
 */

function doGet(e) {
  var p = (e && e.parameter) || {};
  var ss = p.sheetId ? SpreadsheetApp.openById(p.sheetId) : SpreadsheetApp.getActiveSpreadsheet();
  var cb = p.callback;
  var tz = ss.getSpreadsheetTimeZone();

  // Emit every date as unambiguous ISO yyyy-MM-dd.
  //  • real Date cells -> formatDate (authoritative).
  //  • text cells -> parsed as DAY-first (DD-MM-YYYY or DD/MM/YYYY), the format
  //    entered in this workbook, so July 1 never gets read as Jan 7.
  function isoDate(v) {
    if (v instanceof Date) return Utilities.formatDate(v, tz, "yyyy-MM-dd");
    var s = String(v).trim();
    var m = s.match(/^(\d{1,4})[-\/](\d{1,2})[-\/](\d{1,4})$/);
    if (!m) return v;
    var y, mo, d;
    if (m[1].length === 4) { y = +m[1]; mo = +m[2]; d = +m[3]; }   // yyyy-mm-dd (already ISO)
    else { d = +m[1]; mo = +m[2]; y = +m[3]; }                     // dd-mm-yyyy (day first)
    if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return v;
    return y + "-" + ("0" + mo).slice(-2) + "-" + ("0" + d).slice(-2);
  }
  function isDateHeader(h) { return /date/i.test(h); }

  // Find the real header row from a SMALL sample of rows (not the whole tab).
  // Some tabs have a merged banner title on row 1 (only 1-2 non-empty cells).
  // Scan the first few rows and pick the one with the most non-empty cells as
  // the header; data starts on the next row.
  function headerRowIndex(values) {
    var scan = Math.min(5, values.length), best = 0, bestN = -1;
    for (var r = 0; r < scan; r++) {
      var n = 0;
      for (var c = 0; c < values[r].length; c++) {
        if (String(values[r][c]).trim() !== "") n++;
      }
      if (n > bestN) { bestN = n; best = r; }
    }
    return best;
  }

  // Cheap metadata about a sheet: header row index/headers + total data-row
  // count, using getLastRow()/getLastColumn() and a tiny getRange() scan
  // instead of reading every cell in the tab.
  function sheetInfo(sh) {
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow === 0 || lastCol === 0) {
      return { lastRow: 0, lastCol: 0, hr: 0, headers: [], totalRows: 0 };
    }
    var scanRows = Math.min(5, lastRow);
    var scanValues = sh.getRange(1, 1, scanRows, lastCol).getValues();
    var hr = headerRowIndex(scanValues);
    var headers = scanValues[hr].map(function (h) {
      // A header can itself be a real Date cell, not just plain text — e.g.
      // FR Details' per-day columns ("1 Aug 2026", "2 Aug 2026", ...). Format
      // those explicitly; otherwise String(dateObj) falls through to JS's
      // verbose default toString() (e.g. "Sat Aug 01 2026 00:00:00 GMT..."),
      // which the client's "1 Aug 2026" header parser doesn't recognize, so
      // every per-day FR column was silently being dropped.
      if (h instanceof Date) return Utilities.formatDate(h, tz, "d MMM yyyy");
      return String(h).trim();
    });
    var totalRows = Math.max(0, lastRow - 1 - hr); // data rows count, excludes banner/header rows
    return { lastRow: lastRow, lastCol: lastCol, hr: hr, headers: headers, totalRows: totalRows };
  }

  function send(obj) {
    var s = JSON.stringify(obj);
    return cb
      ? ContentService.createTextOutput(cb + "(" + s + ");").setMimeType(ContentService.MimeType.JAVASCRIPT)
      : ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
  }

  // ---- ERROR REVIEWS ------------------------------------------------------
  // Column order is fixed here and mirrored by sheet-loader.js. Anything the
  // dashboard does not send is written blank rather than omitted, so the tab
  // stays rectangular and readable.
  var REVIEW_TAB = "Error Reviews";
  var REVIEW_COLS = ["review_id", "review_date", "reviewer_username", "reviewer_designation",
    "portal", "mistake_key", "mistake_date", "order_url", "target_login",
    "target_designation", "verdict", "remarks", "logged_at"];

  function reviewSheet() {
    var sh = ss.getSheetByName(REVIEW_TAB);
    if (!sh) {
      sh = ss.insertSheet(REVIEW_TAB);
      sh.appendRow(REVIEW_COLS);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, REVIEW_COLS.length).setFontWeight("bold");
    }
    return sh;
  }

  if (p.action === "saveReview") {
    var sh = reviewSheet();
    var now = new Date();
    var mk = String(p.mistake_key || "").trim();
    if (!mk) return send({ ok: false, error: "mistake_key is required" });

    var rec = {
      review_id: String(p.review_id || "").trim() || (Utilities.getUuid ? Utilities.getUuid() : "r" + now.getTime()),
      review_date: String(p.review_date || Utilities.formatDate(now, tz, "yyyy-MM-dd")),
      reviewer_username: String(p.reviewer_username || ""),
      reviewer_designation: String(p.reviewer_designation || ""),
      portal: String(p.portal || ""),
      mistake_key: mk,
      mistake_date: String(p.mistake_date || ""),
      order_url: String(p.order_url || ""),
      target_login: String(p.target_login || ""),
      target_designation: String(p.target_designation || ""),
      verdict: String(p.verdict || ""),
      remarks: String(p.remarks || ""),
      logged_at: Utilities.formatDate(now, tz, "yyyy-MM-dd HH:mm:ss")
    };
    var rowVals = REVIEW_COLS.map(function (c) { return rec[c]; });

    // Correcting an existing verdict must not leave a duplicate behind, so
    // look for this mistake_key first and overwrite that row if present.
    var keyCol = REVIEW_COLS.indexOf("mistake_key") + 1;
    var last = sh.getLastRow();
    var foundRow = 0;
    if (last > 1) {
      var keys = sh.getRange(2, keyCol, last - 1, 1).getValues();
      for (var ki = 0; ki < keys.length; ki++) {
        if (String(keys[ki][0]).trim() === mk) { foundRow = ki + 2; break; }
      }
    }
    if (foundRow) sh.getRange(foundRow, 1, 1, REVIEW_COLS.length).setValues([rowVals]);
    else sh.appendRow(rowVals);

    return send({ ok: true, review_id: rec.review_id, updated: !!foundRow, review: rec });
  }

  // META MODE: tiny payload — tab names, headers, one sample row, row counts.
  if (p.meta) {
    var meta = {};
    ss.getSheets().forEach(function (sh) {
      var info = sheetInfo(sh);
      var sample = [];
      if (info.totalRows > 0) {
        sample = sh.getRange(info.hr + 2, 1, 1, info.lastCol).getValues()[0];
      }
      meta[sh.getName()] = { rows: info.totalRows, headers: info.headers, sample: sample };
    });
    return send({ meta: meta, tabNames: Object.keys(meta) });
  }

  var only = p.tabs ? p.tabs.split(/[|,]/).map(function (s) { return s.trim(); }) : null;
  var offset = p.offset ? parseInt(p.offset, 10) : 0;   // 0-based data-row offset (excludes header)
  var limit = p.limit ? parseInt(p.limit, 10) : 0;      // 0 = all remaining rows

  var out = {};
  var totals = {};
  ss.getSheets().forEach(function (sh) {
    var name = sh.getName();
    if (only && only.indexOf(name) === -1) return;

    var info = sheetInfo(sh);
    if (info.totalRows === 0) { out[name] = []; totals[name] = 0; return; }

    totals[name] = info.totalRows;
    var headers = info.headers;

    // First data row (1-based, for getRange) after the header row + offset.
    var firstDataRow1based = info.hr + 2 + Math.max(0, offset);
    var remaining = info.lastRow - firstDataRow1based + 1;
    var numRows = limit > 0 ? Math.min(remaining, limit) : remaining;

    var rows = [];
    if (numRows > 0) {
      var values = sh.getRange(firstDataRow1based, 1, numRows, info.lastCol).getValues();
      for (var r = 0; r < values.length; r++) {
        var o = {}, blank = true;
        for (var c = 0; c < headers.length; c++) {
          if (!headers[c]) continue;
          var v = values[r][c];
          if (v instanceof Date || isDateHeader(headers[c])) {
            v = isoDate(v);
          }
          o[headers[c]] = v;
          if (v !== "" && v !== null) blank = false;
        }
        if (!blank) rows.push(o);
      }
    }
    out[name] = rows;
  });

  return send({ tabs: out, tabNames: Object.keys(out), totals: totals, offset: offset, limit: limit, generated: new Date().toISOString() });
}
