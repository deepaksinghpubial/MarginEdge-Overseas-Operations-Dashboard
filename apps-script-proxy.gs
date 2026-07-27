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

  // Find the real header row. Some tabs have a merged banner title on row 1
  // (only 1-2 non-empty cells). Scan the first few rows and pick the one with
  // the most non-empty cells as the header; data starts on the next row.
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
      var vals = sh.getDataRange().getValues();
      var hr = vals.length ? headerRowIndex(vals) : 0;
      meta[sh.getName()] = {
        rows: Math.max(0, vals.length - 1 - hr),
        headers: vals.length ? vals[hr].map(function (h) { return String(h).trim(); }) : [],
        sample: vals.length > hr + 1 ? vals[hr + 1] : []
      };
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

    var values = sh.getDataRange().getValues();
    if (!values.length) { out[name] = []; totals[name] = 0; return; }

    var hr = headerRowIndex(values);
    var headers = values[hr].map(function (h) { return String(h).trim(); });
    var lastRow = values.length - 1 - hr;            // data rows count
    totals[name] = lastRow;
    var start = hr + 1 + Math.max(0, offset);
    var end = limit > 0 ? Math.min(values.length, start + limit) : values.length;
    var rows = [];
    for (var r = start; r < end; r++) {
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
    out[name] = rows;
  });

  return send({ tabs: out, tabNames: Object.keys(out), totals: totals, offset: offset, limit: limit, generated: new Date().toISOString() });
}
