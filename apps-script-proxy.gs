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
 *  NARROW READS (2026-08): getValues() was always called across the FULL width
 *  of the sheet, even when only the first few columns were wanted. That matters
 *  more than it looks: Legacy Productivity carries computed columns
 *  (median_error_rate, median_final_score, delta_from_median) whose values are
 *  identical on every row, i.e. formulas. Pulling them into a read makes Google
 *  evaluate them, for every row, on every request — which can take minutes on a
 *  full month of data and shows up in the dashboard as "the sheet took too long
 *  to respond". The read is now limited to the span of columns actually asked
 *  for, so trailing computed columns are never touched at all.
 *
 *  SHARED CACHE (2026-08): this web app runs as its owner, so EVERY viewer's
 *  request spends the owner's quota — and Apps Script allows only 30
 *  simultaneous executions per user, shared across everyone. With ~15 people
 *  opening the dashboard, each independently re-reading the whole Mistakes tab,
 *  that ceiling is reached and Google starts refusing requests (which reaches
 *  the browser as a script that never loads, then a fall back to bundled data).
 *  Responses are now cached in CacheService, which is shared script-wide: the
 *  first viewer in each 60-second window pays for the sheet read and everyone
 *  else is served from cache, so N viewers cost roughly one read instead of N.
 *  60s is deliberately short — the underlying scores are per-analyst-per-DAY,
 *  so nobody can perceive the difference — and &nocache=1 bypasses it entirely
 *  for the Refresh control, so editing the sheet and re-reading still works.
 *  Payloads are gzipped and split across cache entries because a single entry
 *  holds ~100KB; anything still too large simply is not cached rather than
 *  failing. Caching is best-effort throughout: any error falls through to a
 *  normal, uncached read.
 *
 *  PAYLOAD PROJECTION (2026-08): the Mistakes tabs are the slowest thing the
 *  dashboards load. This endpoint used to return EVERY column of a tab, as one
 *  JSON object per row — which repeats every header name on every single row —
 *  even though the dashboard reads only ~12 of those columns. On a tab with
 *  tens of thousands of rows that is megabytes of duplicated key names plus
 *  columns nobody uses, and it costs time twice: once serializing here, once
 *  parsing in the browser.
 *    &cols=a|b|c   -> return only these columns (others are skipped)
 *    &fmt=rows     -> return {c:[headers], r:[[v,v,...],...]} instead of
 *                     [{header:v,...},...], dropping the repeated key names
 *  Both are OPTIONAL and additive. Omit them and the response is byte-for-byte
 *  what it always was, so an older client keeps working against a new
 *  deployment and a new client keeps working against an older deployment.
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
  // Google Sheets stores plain numbers against its own epoch: serial 0 is
  // 1899-12-30, serial 1 is 1899-12-31. So a quantity of 1, a credit of -13 or a
  // price of 7.95 that someone date-formatted in the sheet arrives here as a
  // Date in 1899/1900 and used to be written out as "1899-12-30" - which reads
  // like corrupt data. The number is recoverable, so convert it back instead of
  // hiding it.
  //
  // The cutoff is deliberately wide: typical values (1, 12, 7.95, 1253.07) land
  // between 1899 and about 1903, and very large ones land in absurd far-future
  // years. Genuine dates in this workbook are invoice dates in the 2020s, so
  // anything outside 2000-2100 is a mis-formatted number, not a real date.
  function looksLikeSerial(v) {
    var y = v.getFullYear();
    return y < 2000 || y > 2100;
  }
  function sheetsSerial(v) {
    var p = Utilities.formatDate(v, tz, "yyyy-MM-dd HH:mm:ss").split(/[- :]/);
    var days = (Date.UTC(+p[0], +p[1] - 1, +p[2]) - Date.UTC(1899, 11, 30)) / 86400000;
    var frac = (+p[3] * 3600 + +p[4] * 60 + +p[5]) / 86400;
    var n = days + frac;
    // Trim floating-point noise without losing genuine decimals.
    return Math.abs(n - Math.round(n)) < 1e-9 ? Math.round(n) : Math.round(n * 1e6) / 1e6;
  }

  function isoDate(v) {
    if (v instanceof Date) {
      if (looksLikeSerial(v)) return sheetsSerial(v);
      return Utilities.formatDate(v, tz, "yyyy-MM-dd");
    }
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

  // Serialised body, wrapped for JSONP only if a callback was asked for. Split
  // from send() so a cached body can be returned without re-serialising it.
  function sendRaw(s) {
    return cb
      ? ContentService.createTextOutput(cb + "(" + s + ");").setMimeType(ContentService.MimeType.JAVASCRIPT)
      : ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
  }
  function send(obj) { return sendRaw(JSON.stringify(obj)); }

  // ---- shared response cache ------------------------------------------------
  var CACHE_TTL = 60;          // seconds; see SHARED CACHE note above
  var CACHE_CHUNK = 90000;     // chars per entry (a single entry holds ~100KB)
  var CACHE_MAX_CHUNKS = 40;   // beyond this, skip caching rather than thrash
  var cacheSvc = null;
  try { cacheSvc = CacheService.getScriptCache(); } catch (eC) { cacheSvc = null; }

  // The cache is keyed on everything that changes the response. The callback
  // name is deliberately excluded so JSONP and plain callers share one entry.
  // Returns null if a key cannot be derived, which disables caching for this
  // request rather than throwing. The cache is only ever an optimisation, so
  // nothing in this path is allowed to break an otherwise-serviceable read —
  // a failure here would take down every request and silently drop every
  // viewer onto bundled sample data.
  function cacheKey() {
    try {
      var raw = ["v1", p.tabs || "", p.offset || "", p.limit || "", p.cols || "",
        p.fmt || "", p.sheetId || "", p.meta ? "meta" : ""].join("|");
      var d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw);
      var hex = "";
      for (var i = 0; i < d.length; i++) {
        var v = (d[i] < 0 ? d[i] + 256 : d[i]).toString(16);
        hex += v.length === 1 ? "0" + v : v;
      }
      return "qa1_" + hex;
    } catch (e) { return null; }
  }
  function cacheRead(key) {
    if (!cacheSvc || !key) return null;
    try {
      var n = parseInt(cacheSvc.get(key + "_m"), 10);
      if (!(n > 0)) return null;
      var names = [];
      for (var i = 0; i < n; i++) names.push(key + "_" + i);
      var got = cacheSvc.getAll(names);
      var b64 = "";
      for (var j = 0; j < n; j++) {
        // A chunk can expire independently; a partial set is treated as a miss
        // rather than being stitched into a truncated, unparseable body.
        if (got[key + "_" + j] == null) return null;
        b64 += got[key + "_" + j];
      }
      return Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(b64), "application/x-gzip")).getDataAsString();
    } catch (e) { return null; }
  }
  function cacheWrite(key, body) {
    if (!cacheSvc || !key) return;
    try {
      var b64 = Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(body)).getBytes());
      var n = Math.ceil(b64.length / CACHE_CHUNK);
      if (n < 1 || n > CACHE_MAX_CHUNKS) return;
      var obj = {};
      for (var i = 0; i < n; i++) obj[key + "_" + i] = b64.substring(i * CACHE_CHUNK, (i + 1) * CACHE_CHUNK);
      cacheSvc.putAll(obj, CACHE_TTL);
      // Written last: until this exists, readers see a miss rather than a
      // half-populated entry.
      cacheSvc.put(key + "_m", String(n), CACHE_TTL);
    } catch (e) { /* best effort */ }
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

  // Read requests only: saveReview returned above, so nothing here can be a
  // write. nocache=1 forces a fresh read (the dashboard's Refresh control).
  var ckey = cacheKey();
  if (!p.nocache) {
    var hit = cacheRead(ckey);
    if (hit) return sendRaw(hit);
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
    var metaBody = JSON.stringify({ meta: meta, tabNames: Object.keys(meta) });
    cacheWrite(ckey, metaBody);
    return sendRaw(metaBody);
  }

  var only = p.tabs ? p.tabs.split(/[|,]/).map(function (s) { return s.trim(); }) : null;
  // Optional column projection. Pipe-separated so column names may contain commas.
  var wantCols = p.cols ? p.cols.split("|").map(function (s) { return s.trim(); }).filter(String) : null;
  var wantRows = String(p.fmt || "") === "rows";
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

    // Which sheet columns to actually emit, resolved once per tab rather than
    // per row. When a projection is requested, unknown names are simply absent
    // from the result instead of erroring, so a client asking for an optional
    // column (e.g. one portal has line_item_position and the other does not)
    // degrades to "no data" exactly as it did before projection existed.
    var emitIdx = [], emitNames = [];
    for (var hc = 0; hc < headers.length; hc++) {
      if (!headers[hc]) continue;
      if (wantCols && wantCols.indexOf(headers[hc]) === -1) continue;
      emitIdx.push(hc); emitNames.push(headers[hc]);
    }
    var dateFlag = emitNames.map(function (h) { return isDateHeader(h); });

    // Read only as far right as we actually need. Columns beyond the last
    // requested one are never fetched, so computed/formula columns sitting at
    // the end of a tab cost nothing.
    var readWidth = info.lastCol;
    if (wantCols && emitIdx.length) {
      var maxIdx = 0;
      for (var mi = 0; mi < emitIdx.length; mi++) if (emitIdx[mi] > maxIdx) maxIdx = emitIdx[mi];
      readWidth = maxIdx + 1;
    }

    var rows = [];
    if (numRows > 0) {
      var values = sh.getRange(firstDataRow1based, 1, numRows, readWidth).getValues();
      for (var r = 0; r < values.length; r++) {
        var src = values[r], blank = true;
        if (wantRows) {
          var arr = new Array(emitIdx.length);
          for (var e = 0; e < emitIdx.length; e++) {
            var av = src[emitIdx[e]];
            if (av instanceof Date || dateFlag[e]) av = isoDate(av);
            arr[e] = av;
            if (av !== "" && av !== null) blank = false;
          }
          if (!blank) rows.push(arr);
        } else {
          var o = {};
          for (var e2 = 0; e2 < emitIdx.length; e2++) {
            var ov = src[emitIdx[e2]];
            if (ov instanceof Date || dateFlag[e2]) ov = isoDate(ov);
            o[emitNames[e2]] = ov;
            if (ov !== "" && ov !== null) blank = false;
          }
          if (!blank) rows.push(o);
        }
      }
    }
    out[name] = wantRows ? { c: emitNames, r: rows } : rows;
  });

  var body = JSON.stringify({ tabs: out, tabNames: Object.keys(out), totals: totals, offset: offset, limit: limit, generated: new Date().toISOString() });
  cacheWrite(ckey, body);
  return sendRaw(body);
}
