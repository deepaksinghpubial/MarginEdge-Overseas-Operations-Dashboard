/**
 * ============================================================================
 *  DASHBOARD SNAPSHOT GENERATOR
 * ============================================================================
 *  Reads the live QA workbook once a day, converts the tabs the dashboards
 *  actually use into one compact JSON file, saves it to Drive, and commits it
 *  to GitHub. Netlify auto-deploys on that commit, so the dashboards then read
 *  a static file from a CDN instead of calling Google at all.
 *
 *  WHY: the previous design had every viewer call an Apps Script web app that
 *  runs as its owner. Apps Script allows only 30 simultaneous executions PER
 *  USER, shared across everyone, so ~50 people opening the dashboard in the
 *  morning exhausted that budget and requests started failing. A static file on
 *  a CDN has no such ceiling: 50 or 5,000 viewers cost the same, and nothing
 *  they do can touch the sheet or its quota.
 *
 *  WHAT RUNS WHEN
 *    dailySnapshot()      <- attach the daily time-driven trigger to THIS
 *    runSnapshotNow()     <- run by hand from the editor to test
 *    archiveMonth()       <- freeze a finished month into its own JSON file
 *    doGet()              <- optional read-only endpoint (off unless enabled)
 *
 *  SETUP (once) — see docs/SNAPSHOT-SETUP.md for the click-by-click version.
 *    Project Settings > Script Properties, add:
 *      GITHUB_TOKEN   fine-grained PAT, Contents: Read and write, THIS repo only
 *      GITHUB_REPO    deepaksinghpubial/MarginEdge-Overseas-Operations-Dashboard
 *      GITHUB_BRANCH  main
 *      DRIVE_FOLDER_ID   (optional) Drive folder for a spare copy. LEAVE THIS
 *                        UNSET unless you want it — setting it makes the script
 *                        ask for Drive permission it otherwise never needs.
 *      ENABLE_WEB_APP    (optional) "true" to serve the JSON over /exec too
 *  The token is the only secret. It is scoped to one repo and can write only
 *  file contents, so a leak cannot touch the sheet or any other repo.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
//  CONFIG — the nine tabs the dashboards read, and the columns they use.
//  Column projection is deliberate: the Mistakes tabs carry columns the
//  dashboard never reads, and every one of them would otherwise be copied into
//  the snapshot, committed to git daily and downloaded by every viewer.
//  `cols: null` means "take every column in the tab".
// ---------------------------------------------------------------------------
var TABS = [
  { key: "legacyProductivity", tab: "Legacy Productivity",
    cols: ["analyst_login", "team_lead_login", "completed_date", "productivity_score",
           "total_errors", "total_possible_error_points", "error_rate", "final_score"] },

  { key: "legacyMistakes", tab: "Legacy Mistakes",
    cols: ["mistake_date", "mistake_area", "variable", "analyst_login", "team_lead_login",
           "entered_value", "closed_value", "current_value", "status", "order_url",
           "differs_from_closed"] },

  { key: "ipaProductivity", tab: "IPA Productivity",
    cols: ["analyst_login", "team_lead_login", "completed_date", "productivity_score",
           "total_tasks", "error_rate", "final_score"] },

  { key: "ipaMistakes", tab: "IPA Mistakes",
    cols: ["mistake_date", "mistake_area", "variable", "analyst_login", "team_lead_login",
           "line_item_position", "proposed_value", "closed_value", "current_value",
           "task_type", "order_url", "flow_type", "differs_from_closed"] },

  // Small reference tabs. Taken whole because the dashboard reads most of them
  // and FR Details has one column PER DAY, so the list is not fixed.
  { key: "roleDetails",     tab: "Role Details",                 cols: null },
  { key: "locationDetails", tab: "Location Details",             cols: null },
  { key: "teamDetails",     tab: "Team Details - Legacy & IPA",  cols: null },
  { key: "frDetails",       tab: "FR Details",                   cols: null },

  // Written by the dashboard's review popup. Absent until the first review is
  // saved, which is not an error.
  { key: "errorReviews",    tab: "Error Reviews",                cols: null, optional: true }
];

var SNAPSHOT_SCHEMA = 2;   // 2 = split into per-portal parts (see PARTS)

// The snapshot is split into three files rather than one.
//
// WHY: measured on day 13 of a month the single file was 22.7 MB, which GitHub
// needs base64-encoded to 30 MB. The mistakes tabs are ~91% of that and grow all
// month, so by around day 25 the encoded payload passes UrlFetchApp's 50 MB
// limit and the daily run would simply start failing in the last week of every
// month. Splitting keeps every file well clear of that ceiling.
//
// It also makes the dashboards much lighter: a Legacy viewer fetches core+legacy
// and never downloads IPA's 77k mistake rows, which they cannot see anyway.
var PARTS = {
  core:   ["roleDetails", "locationDetails", "teamDetails", "frDetails", "errorReviews"],
  legacy: ["legacyProductivity", "legacyMistakes"],
  ipa:    ["ipaProductivity", "ipaMistakes"]
};
var DATA_DIR = "data";                 // repo folder the JSON lives in
var MANIFEST_PATH = DATA_DIR + "/manifest.json";

// ===========================================================================
//  ENTRY POINTS
// ===========================================================================

/**
 * Archive July 2026 from its own workbook. A named wrapper so nobody has to
 * paste a spreadsheet id, and so the id is recorded in one place.
 */
function archiveJul2026() {
  return archiveMonth("2026-07", "1uCFShcJrAG41WU50z-VAFaxucM1k3GbXR44vpuqTMdk");
}

/** Attach the daily time-driven trigger to this one. */
function dailySnapshot() {
  return buildAndPublish({ publish: true });
}

/* ===========================================================================
 * checkAndPublish - the 15-minute poller
 *
 * Publishing once a day meant anything Redash wrote after the run sat in the
 * sheet until the next morning: on 25 Aug the job published at 10:43 with data
 * through the 24th, and the 25th's figures then waited a full day.
 *
 * Running the full build every 15 minutes would be worse - each publish is a
 * GitHub commit, and every commit is a Netlify production deploy at 15 credits,
 * about 4,500 a month.
 *
 * So this probes first and builds second. getLastRow() and getLastColumn() are
 * metadata reads costing milliseconds, not a scan of 180,000 rows. If nothing
 * has grown since the last publish it returns in a couple of seconds having
 * touched nothing: no build, no commit, no deploy, no credits. The sheet still
 * changes about once a day, so the credit cost stays where it was while the
 * data becomes current within 15 minutes of arriving.
 *
 * Error Reviews is deliberately NOT part of the signature. Verdicts are saved
 * all day and the dashboard already reads them live, so including them would
 * fire a deploy on every review - the exact cost this is avoiding.
 * ======================================================================== */
var WATCH_TABS = [
  "Legacy Productivity", "Legacy Mistakes", "IPA Productivity", "IPA Mistakes",
  "Role Details", "Location Details", "Team Details - Legacy & IPA", "FR Details"
];
var SHAPE_PROP = "LAST_PUBLISHED_SHAPE";

/** Cheap shape of the watched tabs: rows and columns, nothing read. */
function sheetShape() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), out = [];
  for (var i = 0; i < WATCH_TABS.length; i++) {
    var sh = ss.getSheetByName(WATCH_TABS[i]);
    out.push(WATCH_TABS[i] + "=" + (sh ? sh.getLastRow() + "x" + sh.getLastColumn() : "missing"));
  }
  return out.join("|");
}

/**
 * Trigger entry point. Publishes only when the watched tabs have changed.
 * Pass true to publish regardless, which is what the daily safety net uses.
 */
function checkAndPublish(force) {
  var props = PropertiesService.getScriptProperties();
  var shape = sheetShape();
  var last = props.getProperty(SHAPE_PROP);

  if (!force && last === shape) {
    Logger.log("No change since the last publish — nothing to do. (" + shape + ")");
    return { published: false, reason: "unchanged", shape: shape };
  }

  // Two triggers can overlap if a build runs long. Without this, both would
  // build and both would commit, costing two deploys for one change.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log("Another run holds the lock — skipping this tick.");
    return { published: false, reason: "locked" };
  }
  try {
    Logger.log(force ? "Forced publish." : "Change detected.\n  was: " + (last || "(nothing recorded)") + "\n  now: " + shape);
    var r = buildAndPublish({ publish: true });
    // Recorded only after a successful publish, so a failed run is retried on
    // the next tick instead of being remembered as done.
    props.setProperty(SHAPE_PROP, shape);
    Logger.log("Published. Netlify will redeploy.");
    return { published: true, shape: shape, summary: r.summary };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Install the 15-minute poller, replacing the once-a-day trigger.
 * Also keeps ONE daily run as a safety net: if the shape somehow matches while
 * the contents differ - a correction that replaces a row rather than adding one
 * - the sheet would otherwise never republish.
 */
function installPoller(everyMinutes) {
  everyMinutes = everyMinutes || 15;
  if ([1, 5, 10, 15, 30].indexOf(everyMinutes) === -1) {
    throw new Error("Apps Script allows 1, 5, 10, 15 or 30 minute intervals");
  }
  var removed = 0, all = ScriptApp.getProjectTriggers();
  for (var i = 0; i < all.length; i++) {
    var fn = all[i].getHandlerFunction();
    if (fn === "dailySnapshot" || fn === "checkAndPublish" || fn === "dailyForcePublish") {
      ScriptApp.deleteTrigger(all[i]); removed++;
    }
  }
  ScriptApp.newTrigger("checkAndPublish").timeBased().everyMinutes(everyMinutes).create();

  var scriptTz = Session.getScriptTimeZone();
  var mapped = istHourToScriptHour(10, scriptTz);
  ScriptApp.newTrigger("dailyForcePublish").timeBased().atHour(mapped.hour).everyDays(1).create();

  Logger.log("---------------------------------------------------------------");
  Logger.log("Removed " + removed + " old trigger(s).");
  Logger.log("checkAndPublish   : every " + everyMinutes + " minutes");
  Logger.log("dailyForcePublish : once daily at " + pad2(mapped.hour) + ":00 " + scriptTz +
             " (= " + mapped.backInIst + " IST) as a safety net");
  Logger.log("");
  Logger.log("A tick that finds no change costs about two seconds and does not");
  Logger.log("touch GitHub, so it does not cost a Netlify deploy.");
  Logger.log("---------------------------------------------------------------");
  return { everyMinutes: everyMinutes, removed: removed };
}

/** The daily safety net: publishes whether or not the shape changed. */
function dailyForcePublish() { return checkAndPublish(true); }

/** Read-only: what the poller can see right now, and whether it would publish. */
function pollerStatus() {
  var shape = sheetShape();
  var last = PropertiesService.getScriptProperties().getProperty(SHAPE_PROP);
  Logger.log("current shape  : " + shape);
  Logger.log("last published : " + (last || "(nothing recorded yet)"));
  Logger.log("would publish  : " + (last === shape ? "no - unchanged" : "YES - changed"));
  var t = ScriptApp.getProjectTriggers(), names = [];
  for (var i = 0; i < t.length; i++) names.push(t[i].getHandlerFunction());
  Logger.log("triggers       : " + (names.join(", ") || "(none)"));
  return { shape: shape, lastPublished: last, wouldPublish: last !== shape, triggers: names };
}

/** Run from the editor to test end to end. Publishes exactly like the trigger. */
function runSnapshotNow() {
  var r = buildAndPublish({ publish: true });
  Logger.log(JSON.stringify(r.summary, null, 2));
  return r;
}

/** Build and save to Drive only — never touches GitHub. Safe to run anytime. */
function dryRunSnapshot() {
  var r = buildAndPublish({ publish: false });
  Logger.log(JSON.stringify(r.summary, null, 2));
  return r;
}

/**
 * Freeze a finished month so the dashboard's month dropdown keeps offering it
 * after the live sheet has moved on.
 *
 *   archiveMonth("2026-08")                 <- reads THIS workbook
 *   archiveMonth("2026-07", "1uCFSh...")    <- reads an archived workbook
 *
 * Pass the sheetId whenever the month you are archiving no longer lives in this
 * workbook. Archiving July from the August book would otherwise publish August's
 * numbers labelled as July, and nothing downstream could tell.
 */
function archiveMonth(monthKey, sheetId) {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) {
    throw new Error('archiveMonth needs a month like "2026-08"');
  }
  var built = buildSnapshot(monthKey, sheetId);
  if (sheetId) Logger.log("Reading from archived workbook " + sheetId);
  var w = writePartFiles(built.snapshot, monthKey, /*isCurrent=*/false);
  w.files[MANIFEST_PATH] = JSON.stringify(
    buildManifest(monthKey, built.snapshot.lastUpdated, /*isCurrent=*/false, w.fileMap), null, 2);
  githubPutMany(w.files, "Archive dashboard snapshot for " + monthKey);
  Logger.log("Archived " + monthKey + " (" + built.snapshot.counts.totalRows + " rows)");
  return built.summary;
}

// ===========================================================================
//  BUILD + PUBLISH
// ===========================================================================

function buildAndPublish(opts) {
  opts = opts || {};
  var started = new Date();
  var monthKey = currentMonthKey();
  var built, json;

  try {
    built = buildSnapshot(monthKey);
    json = JSON.stringify(built.snapshot);
  } catch (e) {
    // A build failure must be loud. It leaves the PREVIOUS snapshot in place,
    // so the dashboard keeps serving yesterday's data rather than breaking —
    // but nobody would notice without this log.
    Logger.log("SNAPSHOT BUILD FAILED: " + (e && e.stack || e));
    throw e;
  }

  var sizeMb = (json.length / 1048576).toFixed(2);
  Logger.log("Built snapshot for " + monthKey + ": " +
    built.snapshot.counts.totalRows + " rows, " + sizeMb + " MB of JSON");
  if (built.snapshot.warnings.length) {
    Logger.log("WARNINGS: " + built.snapshot.warnings.join(" | "));
  }

  // Drive copy first: it is the fallback if GitHub is unreachable, and it costs
  // nothing to keep.
  try {
    saveToDrive("dashboard-data.json", json);
  } catch (e) {
    // Never fatal: the snapshot is already built and GitHub is next.
    Logger.log("Drive copy skipped (continuing): " + (e && e.message || e));
  }

  var w = writePartFiles(built.snapshot, monthKey, /*isCurrent=*/true);

  if (opts.publish) {
    w.files[MANIFEST_PATH] = JSON.stringify(
      buildManifest(monthKey, built.snapshot.lastUpdated, /*isCurrent=*/true, w.fileMap), null, 2);
    githubPutMany(w.files, "Daily dashboard snapshot " + built.snapshot.lastUpdated);
    Logger.log("Published to GitHub. Netlify will redeploy automatically.");
  } else {
    Logger.log("Dry run — GitHub not touched.");
  }

  built.summary.elapsedSec = Math.round((new Date() - started) / 100) / 10;
  built.summary.sizeMb = Number(sizeMb);
  return { summary: built.summary, json: json };
}

function buildSnapshot(monthKey, sheetId) {
  // sheetId lets a FINISHED month be read from its own archived workbook. Without
  // it, archiveMonth("2026-07") would have read the live August book and
  // published August's figures under a July label - silently wrong data.
  var ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone();
  var data = {}, counts = {}, warnings = [], total = 0;

  for (var i = 0; i < TABS.length; i++) {
    var spec = TABS[i];
    var sh = ss.getSheetByName(spec.tab);

    if (!sh) {
      var msg = 'tab "' + spec.tab + '" not found';
      if (!spec.optional) warnings.push(msg);
      data[spec.key] = { cols: [], rows: [] };
      counts[spec.key] = 0;
      Logger.log((spec.optional ? "note: " : "WARNING: ") + msg);
      continue;
    }

    var t = readTab(sh, spec, tz);
    data[spec.key] = { cols: t.cols, rows: t.rows };
    counts[spec.key] = t.rows.length;
    total += t.rows.length;

    if (t.missing.length) {
      warnings.push('tab "' + spec.tab + '" is missing expected column(s): ' + t.missing.join(", "));
    }
    if (!t.rows.length && !spec.optional) {
      warnings.push('tab "' + spec.tab + '" returned no rows');
    }
    Logger.log("  " + spec.tab + ": " + t.rows.length + " rows x " + t.cols.length + " cols");
  }

  counts.totalRows = total;

  var snapshot = {
    schema: SNAPSHOT_SCHEMA,
    month: monthKey,
    label: monthLabel(monthKey),
    lastUpdated: Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ssXXX"),
    timezone: tz,
    sourceSheetId: ss.getId(),
    generator: "snapshot-generator v1",
    counts: counts,
    warnings: warnings,
    data: data
  };

  return {
    snapshot: snapshot,
    summary: { month: monthKey, counts: counts, warnings: warnings }
  };
}

/**
 * Read one tab into {cols, rows}.
 *
 * Rows are arrays in `cols` order rather than objects: an object per row would
 * repeat every column name on every row, which on the Mistakes tabs is
 * megabytes of nothing but duplicated key names.
 *
 * Value handling, matched to what the dashboard already expects:
 *   - real Date cells and any column whose name contains "date" -> ISO yyyy-MM-dd
 *   - Date-typed HEADERS (FR Details has one column per day) -> "d MMM yyyy"
 *   - numbers and booleans are preserved as-is, NOT stringified
 *   - blank cells become "" (never null), so a missing value and an empty
 *     string behave identically downstream
 *   - rows that are blank in every emitted column are skipped
 */
function readTab(sh, spec, tz) {
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (!lastRow || !lastCol) return { cols: [], rows: [], missing: [] };

  // Some tabs open with a merged banner title, so the header is not always row 1.
  // Pick, from the first few rows, the one with the most filled cells.
  var scan = sh.getRange(1, 1, Math.min(5, lastRow), lastCol).getValues();
  var hr = 0, best = -1;
  for (var r = 0; r < scan.length; r++) {
    var filled = 0;
    for (var c = 0; c < scan[r].length; c++) if (String(scan[r][c]).trim() !== "") filled++;
    if (filled > best) { best = filled; hr = r; }
  }

  var headers = scan[hr].map(function (h) {
    if (h instanceof Date) return Utilities.formatDate(h, tz, "d MMM yyyy");
    return String(h).trim();
  });

  // Resolve which sheet columns to emit, once per tab rather than per row.
  var idx = [], cols = [], missing = [];
  if (spec.cols) {
    for (var w = 0; w < spec.cols.length; w++) {
      var at = headers.indexOf(spec.cols[w]);
      if (at === -1) { missing.push(spec.cols[w]); continue; }
      idx.push(at); cols.push(headers[at]);
    }
  } else {
    for (var k = 0; k < headers.length; k++) {
      if (!headers[k]) continue;          // skip unnamed columns
      idx.push(k); cols.push(headers[k]);
    }
  }
  if (!idx.length) return { cols: [], rows: [], missing: missing };

  var isDateCol = cols.map(function (h) { return /date/i.test(h); });
  var nData = lastRow - (hr + 1);
  if (nData <= 0) return { cols: cols, rows: [], missing: missing };

  var values = sh.getRange(hr + 2, 1, nData, lastCol).getValues();
  var rows = [];
  for (var v = 0; v < values.length; v++) {
    var src = values[v], out = new Array(idx.length), blank = true;
    for (var e = 0; e < idx.length; e++) {
      var val = src[idx[e]];
      if (val instanceof Date || isDateCol[e]) val = isoDate(val, tz);
      if (val === null || val === undefined) val = "";
      out[e] = val;
      if (val !== "") blank = false;
    }
    if (!blank) rows.push(out);
  }
  return { cols: cols, rows: rows, missing: missing };
}

/**
 * Normalise a date to ISO yyyy-MM-dd.
 * Text dates in this workbook are entered DAY-first (DD-MM-YYYY), so "7-1-2026"
 * is 7 January, not 1 July. Guessing wrong here silently shifts records into the
 * wrong month, so day-first is applied deliberately rather than left to Date().
 */
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
function sheetsSerial(v, tz) {
  var p = Utilities.formatDate(v, tz, "yyyy-MM-dd HH:mm:ss").split(/[- :]/);
  var days = (Date.UTC(+p[0], +p[1] - 1, +p[2]) - Date.UTC(1899, 11, 30)) / 86400000;
  var frac = (+p[3] * 3600 + +p[4] * 60 + +p[5]) / 86400;
  var n = days + frac;
  // Trim floating-point noise without losing genuine decimals.
  return Math.abs(n - Math.round(n)) < 1e-9 ? Math.round(n) : Math.round(n * 1e6) / 1e6;
}

function isoDate(v, tz) {
  if (v instanceof Date) {
    if (looksLikeSerial(v)) return sheetsSerial(v, tz);
    return Utilities.formatDate(v, tz, "yyyy-MM-dd");
  }
  var s = String(v).trim();
  if (!s) return "";
  var m = s.match(/^(\d{1,4})[-\/](\d{1,2})[-\/](\d{1,4})$/);
  if (!m) return v;
  var y, mo, d;
  if (m[1].length === 4) { y = +m[1]; mo = +m[2]; d = +m[3]; }   // already ISO
  else { d = +m[1]; mo = +m[2]; y = +m[3]; }                      // day-first
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return v;
  return y + "-" + ("0" + mo).slice(-2) + "-" + ("0" + d).slice(-2);
}

/**
 * Build every file for a snapshot: split into parts, chunk any part that is too
 * large, and report both the bodies to upload and the per-part file lists the
 * manifest needs.
 */
function writePartFiles(snapshot, monthKey, isCurrent) {
  var parts = splitSnapshot(snapshot);
  var files = {}, fileMap = {}, biggest = 0;
  Object.keys(parts).forEach(function (p) {
    var chunks = chunkPart(parts[p]);
    fileMap[p] = [];
    chunks.forEach(function (ch, i) {
      var name = partFileName(p, monthKey, isCurrent, chunks.length > 1 ? (i + 1) : 0);
      var body = JSON.stringify(ch);
      files[name] = body;
      fileMap[p].push(name);
      if (body.length > biggest) biggest = body.length;
      Logger.log("  " + p + (chunks.length > 1 ? " [" + (i + 1) + "/" + chunks.length + "]" : "") +
        ": " + ch.counts.totalRows.toLocaleString() + " rows, " + (body.length / 1048576).toFixed(2) + " MB");
    });
    if (chunks.length > 1) Logger.log("  (" + p + " split into " + chunks.length + " files to stay under the upload limit)");
  });
  Logger.log("Largest file " + (biggest / 1048576).toFixed(2) + " MB -> " +
    (biggest * 4 / 3 / 1048576).toFixed(1) + " MB base64 (GitHub accepts up to 50 MB).");
  return { files: files, fileMap: fileMap };
}

/**
 * Slice one built snapshot into the per-part files that actually get published.
 * Each part carries the same metadata so any one of them can be read on its own
 * and still say which month it is and when it was generated.
 */
function splitSnapshot(snap) {
  var out = {};
  Object.keys(PARTS).forEach(function (part) {
    var data = {}, counts = {}, total = 0;
    PARTS[part].forEach(function (key) {
      if (!snap.data[key]) return;
      data[key] = snap.data[key];
      counts[key] = (snap.data[key].rows || []).length;
      total += counts[key];
    });
    counts.totalRows = total;
    out[part] = {
      schema: SNAPSHOT_SCHEMA,
      part: part,
      month: snap.month,
      label: snap.label,
      lastUpdated: snap.lastUpdated,
      timezone: snap.timezone,
      sourceSheetId: snap.sourceSheetId,
      generator: snap.generator,
      counts: counts,
      warnings: snap.warnings,
      data: data
    };
  });
  return out;
}

function partFileName(part, monthKey, isCurrent, chunk) {
  var base = DATA_DIR + "/" + part + "-" + (isCurrent ? "current" : monthKey);
  return base + (chunk ? "." + chunk : "") + ".json";
}

// Largest JSON we will hand to GitHub in one blob. Base64 inflates by a third,
// so 12 MB becomes ~16 MB on the wire - comfortably inside UrlFetchApp's 50 MB
// POST limit with room for a month to grow.
var CHUNK_TARGET_BYTES = 12 * 1024 * 1024;

/**
 * Split one part into as many files as needed to stay under the POST limit.
 *
 * This is not hypothetical: a PARTIAL August split into three parts fine, but a
 * COMPLETE July did not - legacy alone was 18.77 MB and the IPA part blew the
 * limit outright. Per-part splitting is not enough for a full month.
 *
 * The part's biggest tab is sliced across the chunks; the smaller tabs ride along
 * in the first one. Every chunk is a valid part file in its own right, and the
 * loader concatenates rows for a tab it sees more than once.
 */
function chunkPart(partObj) {
  var body = JSON.stringify(partObj);
  if (body.length <= CHUNK_TARGET_BYTES) return [partObj];

  var keys = Object.keys(partObj.data);
  if (!keys.length) return [partObj];
  var big = keys[0];
  keys.forEach(function (k) {
    if ((partObj.data[k].rows || []).length > (partObj.data[big].rows || []).length) big = k;
  });

  var rows = partObj.data[big].rows || [];
  var n = Math.ceil(body.length / CHUNK_TARGET_BYTES);
  if (rows.length < n) n = Math.max(1, rows.length);        // cannot split fewer rows than chunks
  var per = Math.ceil(rows.length / n);
  var out = [];

  for (var i = 0; i < n; i++) {
    var data = {}, counts = {}, total = 0;
    if (i === 0) {
      keys.forEach(function (k) {
        if (k === big) return;
        data[k] = partObj.data[k];
        counts[k] = (partObj.data[k].rows || []).length;
        total += counts[k];
      });
    }
    var slice = rows.slice(i * per, (i + 1) * per);
    data[big] = { cols: partObj.data[big].cols, rows: slice };
    counts[big] = slice.length;
    total += slice.length;

    var chunk = {};
    Object.keys(partObj).forEach(function (k) { if (k !== "data" && k !== "counts") chunk[k] = partObj[k]; });
    chunk.chunk = i + 1;
    chunk.chunks = n;
    chunk.counts = counts;
    chunk.counts.totalRows = total;
    chunk.data = data;
    out.push(chunk);
  }
  return out;
}

// ===========================================================================
//  DRIVE
// ===========================================================================

function saveToDrive(name, json) {
  var folderId = PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID");

  // The Drive copy is an OPTIONAL spare. Touching DriveApp at all forces this
  // script to request Drive permission, which is a lot to ask for a file nobody
  // reads — GitHub is the destination that matters. So unless a folder is
  // explicitly configured, Drive is not touched and no such permission is needed.
  if (!folderId) {
    Logger.log("Drive copy skipped (no DRIVE_FOLDER_ID set). GitHub is the destination that matters.");
    return;
  }

  var folder;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (e) {
    // Almost always the missing Drive scope rather than a bad folder id: this
    // project was first authorised before it contained any Drive code, and
    // Apps Script does not re-prompt on its own.
    Logger.log("Drive copy skipped — this script has not been granted Drive access. " +
      "To enable it: clear the DRIVE_FOLDER_ID property (simplest), or re-authorise the " +
      "project by choosing Run once more and accepting the extra permission. " +
      "The snapshot itself is unaffected. (" + (e && e.message || e) + ")");
    return;
  }
  var blob = Utilities.newBlob(json, "application/json", name);
  var existing = folder.getFilesByName(name);
  if (existing.hasNext()) {
    var f = existing.next();
    f.setContent(json);          // keeps the same file id and any shared links
    Logger.log("Drive: updated " + name + " (" + f.getId() + ")");
  } else {
    var created = folder.createFile(blob);
    Logger.log("Drive: created " + name + " (" + created.getId() + ")");
  }
}

// ===========================================================================
//  GITHUB
// ===========================================================================

function ghConf() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("GITHUB_TOKEN");
  var repo = props.getProperty("GITHUB_REPO");
  if (!token) throw new Error("Script Property GITHUB_TOKEN is not set — see docs/SNAPSHOT-SETUP.md");
  if (!repo) throw new Error("Script Property GITHUB_REPO is not set (owner/repo)");
  return { token: token, repo: repo, branch: props.getProperty("GITHUB_BRANCH") || "main" };
}

/**
 * Write SEVERAL files in ONE commit, using the Git Data API.
 *
 * The Contents API creates a commit PER FILE, and each commit is a separate Netlify
 * production deploy at 15 credits a go — publishing four files that way would
 * cost 60 credits a day instead of 15. So blobs are created first (which do not
 * commit anything), then a single tree, then a single commit.
 *
 * files: { "path/in/repo.json": "contents", ... }
 */
function githubPutMany(files, message) {
  var c = ghConf();
  var api = "https://api.github.com/repos/" + c.repo;
  var hdr = { Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json" };

  function call(url, method, payload) {
    var opt = { method: method, muteHttpExceptions: true, headers: hdr };
    if (payload) { opt.contentType = "application/json"; opt.payload = JSON.stringify(payload); }
    var res = UrlFetchApp.fetch(url, opt);
    var code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      throw new Error("GitHub " + method + " " + url.replace(api, "") + " failed (" + code + "): " +
        res.getContentText().slice(0, 300));
    }
    return JSON.parse(res.getContentText());
  }

  var ref = call(api + "/git/ref/heads/" + encodeURIComponent(c.branch), "get");
  var baseCommitSha = ref.object.sha;
  var baseCommit = call(api + "/git/commits/" + baseCommitSha, "get");

  var tree = [];
  Object.keys(files).forEach(function (path) {
    // base64 so the blob survives regardless of the JSON's contents.
    var blob = call(api + "/git/blobs", "post", {
      content: Utilities.base64Encode(files[path], Utilities.Charset.UTF_8),
      encoding: "base64"
    });
    Logger.log("  blob " + path + " (" + (files[path].length / 1048576).toFixed(2) + " MB)");
    tree.push({ path: path, mode: "100644", type: "blob", sha: blob.sha });
  });

  // base_tree keeps every other file in the repo untouched.
  var newTree = call(api + "/git/trees", "post", { base_tree: baseCommit.tree.sha, tree: tree });
  var commit = call(api + "/git/commits", "post", {
    message: message, tree: newTree.sha, parents: [baseCommitSha]
  });
  call(api + "/git/refs/heads/" + encodeURIComponent(c.branch), "patch", { sha: commit.sha, force: false });

  Logger.log("GitHub: committed " + tree.length + " file(s) as " + commit.sha.slice(0, 7) +
    " - one commit, so one Netlify deploy.");
}

/**
 * The manifest is what the dashboard's month dropdown is built from. It is
 * read-modify-written so archiving a month never drops the others.
 */
function buildManifest(monthKey, lastUpdated, isCurrent, fileMap) {
  var c = ghConf();
  var manifest = { schema: SNAPSHOT_SCHEMA, months: [] };

  var res = UrlFetchApp.fetch(
    "https://api.github.com/repos/" + c.repo + "/contents/" + encodeURI(MANIFEST_PATH) + "?ref=" + encodeURIComponent(c.branch),
    { method: "get", muteHttpExceptions: true,
      headers: { Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json" } });
  if (res.getResponseCode() === 200) {
    try {
      var body = JSON.parse(res.getContentText());
      manifest = JSON.parse(Utilities.newBlob(Utilities.base64Decode(body.content)).getDataAsString());
      if (!manifest.months) manifest.months = [];
    } catch (e) {
      Logger.log("Manifest unreadable, rebuilding it: " + (e && e.message || e));
      manifest = { schema: SNAPSHOT_SCHEMA, months: [] };
    }
  }

  function fileSet(mKey, live) {
    var f = {};
    Object.keys(PARTS).forEach(function (p) { f[p] = partFileName(p, mKey, live); });
    return f;
  }
  // fileMap comes from writePartFiles and may list SEVERAL files per part when a
  // month was too large for one upload. Fall back to the single-file naming when
  // it is absent (e.g. rewriting an older entry).
  var entry = { key: monthKey, label: monthLabel(monthKey),
                files: fileMap || fileSet(monthKey, !!isCurrent),
                lastUpdated: lastUpdated, live: !!isCurrent };

  var found = false;
  for (var i = 0; i < manifest.months.length; i++) {
    if (manifest.months[i].key === monthKey) { manifest.months[i] = entry; found = true; }
    else if (isCurrent && manifest.months[i].live) {
      // Only one month can be live. A month that was live and has since been
      // archived must point at its frozen files instead of the -current ones.
      manifest.months[i].live = false;
      manifest.months[i].files = fileSet(manifest.months[i].key, false);
      delete manifest.months[i].file;     // drop any schema-1 single-file key
    }
  }
  if (!found) manifest.months.push(entry);

  manifest.months.sort(function (a, b) { return a.key < b.key ? 1 : a.key > b.key ? -1 : 0; });
  manifest.schema = SNAPSHOT_SCHEMA;
  manifest.current = isCurrent ? monthKey : manifest.current;
  manifest.updated = lastUpdated;
  return manifest;
}

// ===========================================================================
//  OPTIONAL WEB APP  (off unless ENABLE_WEB_APP = "true")
// ===========================================================================

function doGet(e) {
  var props = PropertiesService.getScriptProperties();
  if (String(props.getProperty("ENABLE_WEB_APP")) !== "true") {
    return ContentService.createTextOutput(JSON.stringify({ error: "disabled" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  try {
    var json = JSON.stringify(buildSnapshot(currentMonthKey()).snapshot);
    var cb = e && e.parameter && e.parameter.callback;
    return cb
      ? ContentService.createTextOutput(cb + "(" + json + ");").setMimeType(ContentService.MimeType.JAVASCRIPT)
      : ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: String(err && err.message || err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ===========================================================================
//  HELPERS
// ===========================================================================

function currentMonthKey() {
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  return Utilities.formatDate(new Date(), tz, "yyyy-MM");
}

function monthLabel(monthKey) {
  var names = ["January","February","March","April","May","June",
               "July","August","September","October","November","December"];
  var parts = String(monthKey).split("-");
  var mi = parseInt(parts[1], 10) - 1;
  return (names[mi] || parts[1]) + " " + parts[0];
}

/**
 * SET THE DAILY SCHEDULE IN IST — run this one.
 *
 *   installDailyTriggerIST()     -> 10:00 IST (default; Redash lands by ~09:00)
 *   installDailyTriggerIST(11)   -> 11:00 IST
 *
 * Why this exists: Apps Script's atHour() uses the SCRIPT PROJECT's timezone,
 * which is not necessarily the spreadsheet's and not necessarily yours. Rather
 * than hard-code an offset — which would also be wrong for half the year, since
 * IST has no daylight saving but US timezones do — the offset is measured at run
 * time by rendering the same instant in both zones. The result is rounded UP to
 * the next whole hour so the job can never fire BEFORE the IST time you asked
 * for, only after.
 *
 * Apps Script also runs time-based triggers within a one-hour window, so asking
 * for 10:00 IST means "some time between 10:00 and 11:00 IST".
 */
function installDailyTriggerIST(istHour) {
  istHour = (istHour == null) ? 10 : Number(istHour);
  if (!(istHour >= 0 && istHour <= 23)) throw new Error("istHour must be 0-23");

  var scriptTz = Session.getScriptTimeZone();
  var mapped = istHourToScriptHour(istHour, scriptTz);
  installDailyTrigger(mapped.hour);

  Logger.log("---------------------------------------------------------------");
  Logger.log("Requested        : " + pad2(istHour) + ":00 IST");
  Logger.log("Script timezone  : " + scriptTz);
  Logger.log("Trigger set to   : " + pad2(mapped.hour) + ":00 " + scriptTz +
             "  (= " + mapped.backInIst + " IST)");
  Logger.log("Sheet timezone   : " + SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() +
             "   (only affects how dates are written, not when this runs)");
  Logger.log("Apps Script fires within an hour of the set time.");
  if (mapped.rounded) {
    Logger.log("NOTE: rounded up to a whole hour, so it runs slightly after " +
               pad2(istHour) + ":00 IST rather than before it.");
  }
  Logger.log("If your timezone observes daylight saving, this can drift by an");
  Logger.log("hour when the clocks change — re-run this function if it matters.");
  Logger.log("---------------------------------------------------------------");
  return mapped;
}

function pad2(n) { return (n < 10 ? "0" : "") + n; }

/** Minutes past midnight for an instant, as seen in a given timezone. */
function tzMinutes(d, tz) {
  var p = Utilities.formatDate(d, tz, "HH:mm").split(":");
  return Number(p[0]) * 60 + Number(p[1]);
}

/**
 * Convert an IST hour to the whole hour in scriptTz that lands at or just after
 * it. Offsets are measured, not assumed, so this stays correct across zones.
 */
function istHourToScriptHour(istHour, scriptTz) {
  var now = new Date();
  var diff = tzMinutes(now, scriptTz) - tzMinutes(now, "Asia/Kolkata");
  // Same wall-clock reading can sit either side of midnight; normalise to +/-12h.
  while (diff > 720) diff -= 1440;
  while (diff < -720) diff += 1440;

  var targetMin = (istHour * 60 + diff + 1440) % 1440;
  var hour = Math.ceil(targetMin / 60) % 24;          // never earlier than asked
  var backMin = (hour * 60 - diff + 1440) % 1440;
  return {
    hour: hour,
    rounded: (targetMin % 60) !== 0,
    backInIst: pad2(Math.floor(backMin / 60)) + ":" + pad2(backMin % 60)
  };
}

/**
 * Lower-level: set the trigger using an hour in the SCRIPT's timezone.
 * Prefer installDailyTriggerIST() unless you specifically want that.
 */
function installDailyTrigger(hour) {
  hour = (hour == null) ? 7 : Number(hour);
  if (!(hour >= 0 && hour <= 23)) throw new Error("hour must be 0-23");

  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === "dailySnapshot") ScriptApp.deleteTrigger(existing[i]);
  }
  ScriptApp.newTrigger("dailySnapshot").timeBased().atHour(hour).everyDays(1).create();
  Logger.log("Daily trigger installed for ~" + pad2(hour) + ":00 " + Session.getScriptTimeZone() + ".");
}
