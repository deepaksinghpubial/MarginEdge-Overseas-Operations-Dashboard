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
 *    /exec?tabs=A|B        -> only those tabs (delimiter is | so tab names may contain commas)
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
 * ============================================================================
 */

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var p = (e && e.parameter) || {};
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
    var headers = scanValues[hr].map(function (h) { return String(h).trim(); });
    var totalRows = Math.max(0, lastRow - 1 - hr); // data rows count, excludes banner/header rows
    return { lastRow: lastRow, lastCol: lastCol, hr: hr, headers: headers, totalRows: totalRows };
  }

  function send(obj) {
    var s = JSON.stringify(obj);
    return cb
      ? ContentService.createTextOutput(cb + "(" + s + ");").setMimeType(ContentService.MimeType.JAVASCRIPT)
      : ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
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

  var only = p.tabs ? p.tabs.split("|").map(function (s) { return s.trim(); }) : null;
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
