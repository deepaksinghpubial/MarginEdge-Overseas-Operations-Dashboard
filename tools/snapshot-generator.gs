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
 *      DRIVE_FOLDER_ID   (optional) folder to keep a dated copy in
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

var SNAPSHOT_SCHEMA = 1;
var DATA_DIR = "data";                 // repo folder the JSON lives in
var MANIFEST_PATH = DATA_DIR + "/manifest.json";

// ===========================================================================
//  ENTRY POINTS
// ===========================================================================

/** Attach the daily time-driven trigger to this one. */
function dailySnapshot() {
  return buildAndPublish({ publish: true });
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
 * Freeze a finished month. Copies the current snapshot to data/<month>.json and
 * marks it archived in the manifest, so the dashboard's month dropdown keeps
 * offering it after the live sheet has moved on to the next month.
 * Call as: archiveMonth("2026-08")
 */
function archiveMonth(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) {
    throw new Error('archiveMonth needs a month like "2026-08"');
  }
  var built = buildSnapshot(monthKey);
  var json = JSON.stringify(built.snapshot);
  saveToDrive(DATA_DIR.replace("/", "-") + "-" + monthKey + ".json", json);
  githubPut(DATA_DIR + "/" + monthKey + ".json", json,
    "Archive dashboard snapshot for " + monthKey);
  updateManifest(monthKey, built.snapshot.lastUpdated, /*isCurrent=*/false);
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
    Logger.log("Drive save failed (continuing): " + (e && e.message || e));
  }

  if (opts.publish) {
    githubPut(DATA_DIR + "/current.json", json,
      "Daily dashboard snapshot " + built.snapshot.lastUpdated);
    updateManifest(monthKey, built.snapshot.lastUpdated, /*isCurrent=*/true);
    Logger.log("Published to GitHub. Netlify will redeploy automatically.");
  } else {
    Logger.log("Dry run — GitHub not touched.");
  }

  built.summary.elapsedSec = Math.round((new Date() - started) / 100) / 10;
  built.summary.sizeMb = Number(sizeMb);
  return { summary: built.summary, json: json };
}

function buildSnapshot(monthKey) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
function isoDate(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, "yyyy-MM-dd");
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

// ===========================================================================
//  DRIVE
// ===========================================================================

function saveToDrive(name, json) {
  var folderId = PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID");
  var folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
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

/** Current sha of a file, or null if it does not exist yet. */
function githubSha(path) {
  var c = ghConf();
  var res = UrlFetchApp.fetch(
    "https://api.github.com/repos/" + c.repo + "/contents/" + encodeURI(path) + "?ref=" + encodeURIComponent(c.branch),
    { method: "get", muteHttpExceptions: true,
      headers: { Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json" } });
  var code = res.getResponseCode();
  if (code === 200) return JSON.parse(res.getContentText()).sha;
  if (code === 404) return null;
  throw new Error("GitHub sha lookup failed (" + code + "): " + res.getContentText().slice(0, 300));
}

/** Create or overwrite one file. Retries once — a same-second write can 409. */
function githubPut(path, content, message) {
  var c = ghConf();
  for (var attempt = 0; attempt < 2; attempt++) {
    var sha = githubSha(path);
    var payload = {
      message: message,
      content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
      branch: c.branch
    };
    if (sha) payload.sha = sha;      // omitted on first-ever create

    var res = UrlFetchApp.fetch(
      "https://api.github.com/repos/" + c.repo + "/contents/" + encodeURI(path),
      { method: "put", contentType: "application/json", muteHttpExceptions: true,
        headers: { Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json" },
        payload: JSON.stringify(payload) });

    var code = res.getResponseCode();
    if (code === 200 || code === 201) {
      Logger.log("GitHub: wrote " + path + " (" + (content.length / 1048576).toFixed(2) + " MB)");
      return;
    }
    if (code === 409 && attempt === 0) {
      Logger.log("GitHub: 409 conflict on " + path + " — refreshing sha and retrying once");
      Utilities.sleep(1500);
      continue;
    }
    throw new Error("GitHub write failed for " + path + " (" + code + "): " + res.getContentText().slice(0, 400));
  }
}

/**
 * The manifest is what the dashboard's month dropdown is built from. It is
 * read-modify-written so archiving a month never drops the others.
 */
function updateManifest(monthKey, lastUpdated, isCurrent) {
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

  var file = isCurrent ? (DATA_DIR + "/current.json") : (DATA_DIR + "/" + monthKey + ".json");
  var entry = { key: monthKey, label: monthLabel(monthKey), file: file, lastUpdated: lastUpdated, live: !!isCurrent };

  var found = false;
  for (var i = 0; i < manifest.months.length; i++) {
    if (manifest.months[i].key === monthKey) { manifest.months[i] = entry; found = true; }
    else if (isCurrent && manifest.months[i].live) {
      // Only one month can be the live one. A previous live month that has been
      // archived now points at its frozen file instead.
      manifest.months[i].live = false;
      manifest.months[i].file = DATA_DIR + "/" + manifest.months[i].key + ".json";
    }
  }
  if (!found) manifest.months.push(entry);

  manifest.months.sort(function (a, b) { return a.key < b.key ? 1 : a.key > b.key ? -1 : 0; });
  manifest.current = isCurrent ? monthKey : manifest.current;
  manifest.updated = lastUpdated;

  githubPut(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "Update dashboard data manifest (" + monthKey + ")");
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

/** Convenience: create the daily trigger. Run once, from the editor. */
function installDailyTrigger() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === "dailySnapshot") ScriptApp.deleteTrigger(existing[i]);
  }
  ScriptApp.newTrigger("dailySnapshot").timeBased().atHour(7).everyDays(1).create();
  Logger.log("Daily trigger installed for ~07:00 in the script's timezone.");
}
