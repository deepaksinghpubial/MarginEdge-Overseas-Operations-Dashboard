/* =============================================================================
   Google Sheet data loader — Legacy & IPA QA dashboards.

   Reads the workbook via the Apps Script proxy (JSONP, no CORS, uses your
   Google login) and rebuilds window.SCORES / QA_DATA / ROLES / LOCATIONS / AMS.
   On any failure it silently keeps the bundled *-data.js so the dashboard
   never breaks.

   Each dashboard sets window.__SHEET_TARGET = "legacy" | "ipa" before loading.
   Paste your Apps Script /exec URL into WEBAPP_URL below to go live.
============================================================================= */
(function () {
  "use strict";

  var TARGET = (window.__SHEET_TARGET === "ipa") ? "ipa" : (window.__SHEET_TARGET === "split") ? "split" : "legacy";

  // ---- CONFIG ---------------------------------------------------------------
  var WEBAPP_URL = "https://script.google.com/a/macros/marginedge.com/s/AKfycby2M4d01zsjdBAw9FmiLFf7BYLPAM3aDptxOeZyHw86yJ5wttDCKjaBIKaqZtVopW9aSQ/exec";

  // ---- STATIC SNAPSHOT TRANSPORT -------------------------------------------
  // Preferred data path. A daily job (tools/snapshot-generator.gs) writes
  // data/current.json into the repo, so the dashboards read a file from
  // Netlify's CDN instead of calling Apps Script. That removes the shared
  // 30-simultaneous-execution ceiling entirely: 50 viewers cost the same as 1,
  // and nothing a viewer does can reach the sheet or its quota.
  //
  // If the snapshot is missing (not generated yet) the loader falls back to the
  // old live-sheet path automatically, so this can be deployed before the
  // Apps Script side is ready without breaking anything.
  var SNAP = {
    manifest: "data/manifest.json",
    current: "data/current.json",
    // Friendly snapshot key -> the sheet tab name the rest of this file expects.
    map: {
      legacyProductivity: "Legacy Productivity",
      legacyMistakes: "Legacy Mistakes",
      ipaProductivity: "IPA Productivity",
      ipaMistakes: "IPA Mistakes",
      roleDetails: "Role Details",
      locationDetails: "Location Details",
      teamDetails: "Team Details - Legacy & IPA",
      frDetails: "FR Details",
      errorReviews: "Error Reviews"
    }
  };
  var REFRESH_MS = 5 * 60 * 1000;   // re-check the snapshot every 5 minutes

  // The snapshot is published as three parts (see tools/snapshot-generator.gs).
  // Fetch only what this dashboard can display: a Legacy viewer has no use for
  // IPA's 71k mistake rows, which are the bulk of the payload.
  var SNAP_PARTS = {
    legacy: ["core", "legacy"],
    ipa:    ["core", "ipa"],
    split:  ["core", "legacy", "ipa"]
  };

  // Combine parts into the single object applySnapshot_ expects. Metadata comes
  // from whichever part answered first; they are written together so it matches.
  function mergeParts(list) {
    var merged = null;
    list.forEach(function (p) {
      if (!p) return;
      if (!merged) {
        merged = { schema: p.schema, month: p.month, label: p.label, lastUpdated: p.lastUpdated,
                   timezone: p.timezone, generator: p.generator, counts: {}, warnings: [], data: {} };
      }
      Object.keys(p.data || {}).forEach(function (k) { merged.data[k] = p.data[k]; });
      Object.keys(p.counts || {}).forEach(function (k) {
        if (k === "totalRows") merged.counts.totalRows = (merged.counts.totalRows || 0) + p.counts[k];
        else merged.counts[k] = p.counts[k];
      });
      (p.warnings || []).forEach(function (w) { if (merged.warnings.indexOf(w) === -1) merged.warnings.push(w); });
    });
    return merged;
  }

  function fetchJSON(url, timeoutMs) {
    // Cache-busted so a refresh cannot be served a stale copy by the browser or
    // an intermediate proxy; Netlify sets long cache headers on static assets.
    var u = url + (url.indexOf("?") < 0 ? "?" : "&") + "_=" + Date.now();
    if (typeof fetch !== "function") return Promise.reject(new Error("fetch unavailable"));
    var ctl = (typeof AbortController === "function") ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, timeoutMs || 30000) : null;
    return fetch(u, ctl ? { signal: ctl.signal } : undefined).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  // Snapshot {cols, rows} -> the array-of-objects keyed by tab name that
  // build() already consumes, so nothing downstream changes.
  function snapshotToTabs(snap) {
    var tabs = {};
    var data = (snap && snap.data) || {};
    Object.keys(SNAP.map).forEach(function (k) {
      var blockName = SNAP.map[k], block = data[k];
      if (!block || !block.cols) { tabs[blockName] = []; return; }
      var cols = block.cols, rows = block.rows || [], out = new Array(rows.length);
      for (var i = 0; i < rows.length; i++) {
        var src = rows[i], o = {};
        for (var c = 0; c < cols.length; c++) o[cols[c]] = src[c];
        out[i] = o;
      }
      tabs[blockName] = out;
    });
    return tabs;
  }

  var SHARED = {
    role:     { tab: "Role Details",     user: "username", designation: "designation", lead: "Allocated Team Lead", am: "Allocated Asst Manager" },
    location: { tab: "Location Details", user: "username", loc: "location" },
    teams:    { tab: "Team Details - Legacy & IPA", legacy: "Legacy Team Names", ipa: "IPA Team Names" },
    fr:       { tab: "FR Details", user: "User", count: "Final Review" },
    // Written by the dashboards via the Apps Script saveReview action. The tab
    // is created on the first save, so it is absent (not an error) until then.
    reviews:  { tab: "Error Reviews" }
  };

  var CONFIG = {
    legacy: {
      daily: { tab: "Legacy Productivity", cols: {
        username: "analyst_login", team: "team_lead_login", date: "completed_date",
        productivity: "productivity_score", errs: "total_errors",
        pts: "total_possible_error_points", errorRate: "error_rate", finalScore: "final_score" } },
      mistakes: { tab: "Legacy Mistakes", cols: {
        date: "mistake_date", area: "mistake_area", variable: "variable",
        username: "analyst_login", team: "team_lead_login", lp: null,
        ent: "entered_value", clo: "closed_value", cur: "current_value",
        st: "status", url: "order_url", org: null, diffClo: "differs_from_closed" } }
    },
    ipa: {
      daily: { tab: "IPA Productivity", cols: {
        username: "analyst_login", team: "team_lead_login", date: "completed_date",
        productivity: "productivity_score", tasks: "total_tasks", errs: null,
        pts: "total_tasks", errorRate: "error_rate", finalScore: "final_score" } },
      mistakes: { tab: "IPA Mistakes", cols: {
        date: "mistake_date", area: "mistake_area", variable: "variable",
        username: "analyst_login", team: "team_lead_login", lp: "line_item_position",
        ent: "proposed_value", clo: "closed_value", cur: "current_value",
        st: "task_type", url: "order_url", org: "flow_type", diffClo: "differs_from_closed" } }
    }
  };

  // error_rate in the sheet is already a 0–1 fraction (e.g. 0.0125), not a %.
  var ERROR_RATE_IS_FRACTION = true;
  // ---------------------------------------------------------------------------

  // The Split portal ("Both Portals — Split-Time Leads") combines BOTH feeds and
  // keeps only people who appear on BOTH platforms. It uses Legacy-style column
  // names; IPA rows are normalized into that shape before merging.
  function normDaily(row, src) {
    var c = CONFIG[src].daily.cols;
    var er = num(row[c.errorRate]);
    var pts = c.pts ? num(row[c.pts]) : 0;
    var errs = c.errs ? num(row[c.errs]) : Math.round(er * pts);
    return { analyst_login: row[c.username], team_lead_login: row[c.team], completed_date: row[c.date],
      productivity_score: row[c.productivity], total_errors: errs, total_possible_error_points: pts,
      error_rate: row[c.errorRate], final_score: row[c.finalScore], __src: src };
  }
  function normMist(row, src) {
    var m = CONFIG[src].mistakes.cols;
    return { mistake_date: row[m.date], mistake_area: row[m.area], variable: row[m.variable],
      analyst_login: row[m.username], team_lead_login: row[m.team],
      entered_value: m.ent ? row[m.ent] : "", closed_value: m.clo ? row[m.clo] : "",
      current_value: m.cur ? row[m.cur] : "", status: m.st ? row[m.st] : "", order_url: m.url ? row[m.url] : "",
      differs_from_closed: m.diffClo ? row[m.diffClo] : "",
      // Which portal this row came from. Needed to tell a Legacy analyst error
      // from an IPA one on the Split dashboard, where both are merged and
      // TEAM_SETS cannot distinguish them (it lists every team under "split").
      __portal: src };
  }

  var cfg = CONFIG[TARGET] || CONFIG.legacy;

  var titleCase = function (s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); }).trim();
  };
  var num = function (v) { var n = parseFloat(v); return isFinite(n) ? n : 0; };
  var mode = function (arr) {
    var c = {}, best = null, n = 0;
    arr.forEach(function (v) { if (v == null || v === "") return; c[v] = (c[v] || 0) + 1; if (c[v] > n) { n = c[v]; best = v; } });
    return best;
  };
  var SPECIALIST_DESIGS = {
    legacy: ["specialist", "specialist, french process"],
    ipa:    ["specialist, ipa", "specialist, ipa/fp"]
  };
  var ANALYST_DESIGS = {
    legacy: ["analyst", "analysts, french process", "analyst, french process", "analyst, special task team"],
    ipa:    ["analysts, ipa", "analyst, ipa"]
  };
  var normRole = function (d) {
    if (!d) return null;
    var s = String(d).trim().toLowerCase();
    if (/special/i.test(d)) return "Specialist";    // any specialist designation
    if (/lead/i.test(d)) return "Lead Analyst";
    if (/assistant|manager|\bam\b/i.test(d)) return "Assistant Manager";
    if (/analyst/i.test(d)) return "Analyst";       // any analyst designation
    return null;
  };
  var idx = function (list) { var m = {}; list.forEach(function (v, i) { m[v] = i; }); return m; };
  // Normalize the sheet's mixed date formats to ISO yyyy-mm-dd.
  // Google returns DD-MM-YYYY text rows as-is, but silently reads day-<=12 rows
  // as US MM-DD and emits them as yyyy-MM-dd with month & day SWAPPED. We first
  // parse to a raw {y,mo,d,ambig} then un-swap ambiguous rows against the
  // dominant month found in the unambiguous rows (day>12).
  var rawDate = function (s) {
    s = String(s == null ? "" : s).trim();
    var p = s.split(/[-\/]/);
    if (p.length !== 3) return null;
    var y, a, b;
    if (p[0].length === 4) { y = +p[0]; a = +p[1]; b = +p[2]; }        // yyyy-A-B (A=month per proxy, B=day)
    else { y = +p[2]; a = +p[1]; b = +p[0]; }                          // D-M-yyyy text -> a=month, b=day
    if (!y || !a || !b) return null;
    return { y: y, mo: a, d: b, ambig: a <= 12 && b <= 12 };
  };
  var DOMINANT_MONTH = null; // set in build() from unambiguous rows
  var normDate = function (s) {
    var r = rawDate(s);
    if (!r) return String(s == null ? "" : s).trim();
    var mo = r.mo, d = r.d;
    // Un-swap: if this row is ambiguous and its day-value equals the dataset's
    // dominant month while its month-value does not, the two were swapped.
    if (r.ambig && DOMINANT_MONTH && r.d === DOMINANT_MONTH && r.mo !== DOMINANT_MONTH) { mo = r.d; d = r.mo; }
    return r.y + "-" + ("0" + mo).slice(-2) + "-" + ("0" + d).slice(-2);
  };
  var computeDominantMonth = function (rows, key) {
    var counts = {};
    rows.forEach(function (r) { var rd = rawDate(r[key]); if (rd && !rd.ambig) counts[rd.mo] = (counts[rd.mo] || 0) + 1; });
    var best = null, n = 0;
    Object.keys(counts).forEach(function (m) { if (counts[m] > n) { n = counts[m]; best = +m; } });
    return best;
  };
  var uniqSort = function (arr) {
    var seen = {}, out = [];
    arr.forEach(function (v) { if (v != null && v !== "" && !seen[v]) { seen[v] = 1; out.push(v); } });
    return out.sort();
  };

  // FR Details is a "wide" tab: column A is the login, then one column PER
  // CALENDAR DATE ("1 Aug 2026", "2 Aug 2026", …) holding that day's Final
  // Review count. Recognize a header as a date column and normalize it to
  // ISO yyyy-mm-dd; anything else (like a literal "Final Review" total
  // column, used by older archived sheets before this layout existed) is
  // left alone and handled separately as a flat fallback total.
  var FR_MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  var frDateHeaderIso = function (h) {
    var s = String(h == null ? "" : h).trim();
    var m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})[a-z]*\.?\s+(\d{4})$/);
    if (m) {
      var mo = FR_MONTHS[m[2].slice(0, 3).toLowerCase()];
      var d = +m[1];
      if (mo && d >= 1 && d <= 31) return m[3] + "-" + ("0" + mo).slice(-2) + "-" + ("0" + d).slice(-2);
    }
    // Defensive fallback: if the Apps Script proxy is ever redeployed without
    // the header-date-formatting fix, a real Date header cell serializes to
    // JS's verbose default toString(), e.g. "Sat Aug 01 2026 00:00:00 GMT...".
    // Recognize that shape too so per-day FR columns degrade gracefully
    // instead of silently vanishing again.
    var m2 = s.match(/^\w{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\s+\d{2}:\d{2}:\d{2}/);
    if (m2) {
      var mo2 = FR_MONTHS[m2[1].toLowerCase()];
      var d2 = +m2[2];
      if (mo2 && d2 >= 1 && d2 <= 31) return m2[3] + "-" + ("0" + mo2).slice(-2) + "-" + ("0" + d2).slice(-2);
    }
    return null;
  };

  function build(daily, mist, roleRows, locRows, teamRows, frRows, reviewRows) {
    var C = cfg.daily.cols, M = cfg.mistakes.cols;
    DOMINANT_MONTH = computeDominantMonth(daily, C.date) || computeDominantMonth(mist, M.date);

    // --- Team Details tab: two columns of team-lead logins ---
    //   "Legacy Team Names" = the 28 Legacy team leads
    //   "IPA Team Names"    = the 9 IPA team leads
    var legacyLeads = {}, ipaLeads = {};
    (teamRows || []).forEach(function (r) {
      var lg = String(r[SHARED.teams.legacy] || "").trim().toLowerCase();
      var ip = String(r[SHARED.teams.ipa] || "").trim().toLowerCase();
      if (lg) legacyLeads[lg] = 1;
      if (ip) ipaLeads[ip] = 1;
    });
    // Team-lead allowlist for THIS dashboard (by lead login):
    //   legacy -> 28 legacy leads, ipa -> 9 ipa leads, split -> union (37).
    var teamAllow;
    if (TARGET === "ipa") teamAllow = ipaLeads;
    else if (TARGET === "split") { teamAllow = {}; Object.keys(legacyLeads).forEach(function (k) { teamAllow[k] = 1; }); Object.keys(ipaLeads).forEach(function (k) { teamAllow[k] = 1; }); }
    else teamAllow = legacyLeads;
    var hasAllow = Object.keys(teamAllow).length > 0;
    var inAllow = function (tl) { return !hasAllow || teamAllow[String(tl || "").trim().toLowerCase()]; };

    // --- Role Details: designation, Allocated Team Lead (name), Allocated AM ---
    var roleByLogin = {}, amByLogin = {}, leadByLogin = {};
    // The RAW designation text ("Associate Director, Operations"), as distinct
    // from normRole()'s coarse bucket — the review audit shows it verbatim.
    var desigByLogin = {}, roster = [];
    var badAm = function (v) { return !v || /^#?n\/?a$/i.test(v) || /^unassigned/i.test(v); };
    (roleRows || []).forEach(function (r) {
      var u = String(r[SHARED.role.user] || "").trim().toLowerCase();
      if (!u) return;
      var rawD = String(r[SHARED.role.designation] || "").trim();
      if (rawD) desigByLogin[u] = rawD;
      roster.push({ u: String(r[SHARED.role.user] || "").trim(), d: rawD });
      var role = normRole(r[SHARED.role.designation]);
      if (role) roleByLogin[u] = role;
      var am = String(r[SHARED.role.am] || "").trim();
      if (!badAm(am)) amByLogin[u] = am;
      var ld = String(r[SHARED.role.lead] || "").trim();
      if (ld && !badAm(ld)) leadByLogin[u] = ld;
    });

    // --- Location Details ---
    var locByLogin = {};
    (locRows || []).forEach(function (r) {
      var u = String(r[SHARED.location.user] || "").trim().toLowerCase();
      if (u) locByLogin[u] = String(r[SHARED.location.loc] || "").trim();
    });

    // --- gather users + their manager (team_lead) ---
    var mgrVotes = {}, users = {};
    daily.forEach(function (r) {
      var u = String(r[C.username] || "").trim(); if (!u) return;
      users[u] = 1;
      (mgrVotes[u] = mgrVotes[u] || []).push(String(r[C.team] || "").trim());
    });
    mist.forEach(function (r) { var u = String(r[M.username] || "").trim(); if (u) users[u] = 1; });

    var logins = Object.keys(users);
    var mgrOf = {};
    logins.forEach(function (u) {
      var votes = mgrVotes[u] || [];
      // Prefer an allowlisted team lead among this member's rows.
      if (hasAllow) {
        var allowed = votes.filter(inAllow);
        mgrOf[u] = allowed.length ? mode(allowed) : (mode(votes) || "");
      } else {
        mgrOf[u] = mode(votes) || "";
      }
    });

    // Learn login -> proper team-lead name from the details tab (Team Lead
    // Name column), keyed by the productivity team_lead_login.
    var leadNameVotes = {};
    logins.forEach(function (u) {
      var login = mgrOf[u], nm = leadByLogin[u.toLowerCase()];
      if (login && nm) { (leadNameVotes[login] = leadNameVotes[login] || []).push(nm); }
    });
    var leadNameOf = {};
    Object.keys(leadNameVotes).forEach(function (lg) { leadNameOf[lg] = mode(leadNameVotes[lg]); });

    // Keep only members whose team lead is in THIS dashboard's allowlist, and
    // whose designation qualifies them as a Specialist or Analyst.
    if (hasAllow) {
      logins = logins.filter(function (u) { return inAllow(mgrOf[u]); });
    }
    logins = logins.filter(function (u) {
      var role = roleByLogin[u.toLowerCase()];
      return role === "Specialist" || role === "Analyst";
    });

    // --- display names (unique) ---
    var disp = {}, seen = {};
    logins.slice().sort().forEach(function (u) {
      var nm = titleCase(u) || u;
      if (seen[nm]) nm = nm + " (" + u + ")";
      seen[nm] = 1; disp[u] = nm;
    });
    var order = logins.slice().sort(function (a, b) { return disp[a].localeCompare(disp[b]); });
    var analysts = order.map(function (u) { return disp[u]; });
    var loginIdx = idx(order);

    // --- FR Details: Final Review counts (Specialists). Two possible sheet
    // shapes are supported:
    //   1) "wide" (current live sheet, 2026-08+): one column per calendar
    //      date holding that day's count — gives a true daily breakdown.
    //   2) "flat" (older/archived sheets): a single "Final Review" column
    //      with one running total per login — no date breakdown possible,
    //      kept as frTotalByLogin so old archives still show a number.
    var frDateCols = [];
    if (frRows && frRows.length) {
      Object.keys(frRows[0]).forEach(function (h) {
        var iso = frDateHeaderIso(h);
        if (iso) frDateCols.push({ header: h, iso: iso });
      });
    }
    var frDailyByLogin = {}, frTotalByLogin = {};
    (frRows || []).forEach(function (r) {
      var u = String(r[SHARED.fr.user] || "").trim().toLowerCase();
      if (!u) return;
      if (frDateCols.length) {
        var day = (frDailyByLogin[u] = frDailyByLogin[u] || {});
        frDateCols.forEach(function (c) {
          var v = r[c.header];
          if (v === "" || v == null) return;
          day[c.iso] = num(v);
        });
      } else {
        frTotalByLogin[u] = num(r[SHARED.fr.count]);
      }
    });
    var frDaily = {}, frTotal = {};
    order.forEach(function (u) {
      var lu = u.toLowerCase();
      if (frDailyByLogin[lu]) frDaily[loginIdx[u]] = frDailyByLogin[lu];
      if (frTotalByLogin[lu] != null && !isNaN(frTotalByLogin[lu])) frTotal[loginIdx[u]] = frTotalByLogin[lu];
    });
    var frDates = uniqSort(frDateCols.map(function (c) { return c.iso; }));

    // --- teams = distinct allowlisted team-lead logins of the kept members ---
    var teamLogins = uniqSort(order.map(function (u) { return mgrOf[u]; }).filter(inAllow));
    var teamName = {}; teamLogins.forEach(function (tl) { teamName[tl] = leadNameOf[tl] || disp[tl] || titleCase(tl) || tl; });
    var teamDisplays = teamLogins.map(function (tl) { return teamName[tl]; });
    // ensure unique + stable order
    var teams = uniqSort(teamDisplays);
    var teamIdx = idx(teams);
    var teamOfLogin = {};
    order.forEach(function (u) { var tl = mgrOf[u]; teamOfLogin[u] = (tl && inAllow(tl) && teamName[tl]) ? teamName[tl] : "Unassigned"; });
    if (teams.indexOf("Unassigned") === -1 && order.some(function (u) { return teamOfLogin[u] === "Unassigned"; })) {
      teams.push("Unassigned"); teamIdx = idx(teams);
    }
    var analyst_team = order.map(function (u) { return teamIdx[teamOfLogin[u]]; });

    // --- AM per team: the Assistant Manager most of the team's members are
    //     allocated to in the Role Details tab (Allocated Asst Manager) ---
    var amVotesByTeam = {};
    order.forEach(function (u) {
      var t = teamOfLogin[u]; var am = amByLogin[u.toLowerCase()];
      if (t && am) (amVotesByTeam[t] = amVotesByTeam[t] || []).push(am);
    });
    var amMap = {};
    teams.forEach(function (t) { amMap[t] = mode(amVotesByTeam[t] || []) || "Unassigned AM"; });

    // --- roles & locations keyed by display name (what the dashboard uses) ---
    var roleMap = {}, locMap = {}, desigMap = {};
    order.forEach(function (u) {
      roleMap[disp[u].toLowerCase()] = roleByLogin[u.toLowerCase()] || "Analyst";
      locMap[disp[u].toLowerCase()] = locByLogin[u.toLowerCase()] || "Unknown";
      desigMap[disp[u].toLowerCase()] = desigByLogin[u.toLowerCase()] || "";
    });

    // --- mistake counts per login|date (for IPA errs) ---
    var errCount = {};
    mist.forEach(function (r) {
      var u = String(r[M.username] || "").trim(), d = String(r[M.date] || "").trim();
      if (u && d) errCount[u + "|" + normDate(d)] = (errCount[u + "|" + normDate(d)] || 0) + 1;
    });

    // --- SCORES ---
    var sdates = uniqSort(daily.map(function (r) { return normDate(r[C.date]); }));
    var sdi = idx(sdates);
    var records = [];
    daily.forEach(function (r) {
      var u = String(r[C.username] || "").trim();
      var d = normDate(r[C.date]);
      if (loginIdx[u] == null || sdi[d] == null) return;
      var an = loginIdx[u];
      var er = num(r[C.errorRate]); if (!ERROR_RATE_IS_FRACTION) er = er / 100;
      var errs = C.errs ? num(r[C.errs]) : (errCount[u + "|" + d] || 0);
      var pts = C.pts ? num(r[C.pts]) : 0;
      records.push([ sdi[d], an, analyst_team[an], +num(r[C.productivity]).toFixed(2),
                     errs, pts, +er.toFixed(5), +num(r[C.finalScore]).toFixed(2) ]);
    });
    var SCORES = { dates: sdates, analysts: analysts, teams: teams, analyst_team: analyst_team, records: records, frDaily: frDaily, frTotal: frTotal, frDates: frDates };

    // --- Split portal: per-analyst per-platform breakdown (Legacy vs IPA) ---
    if (TARGET === "split") {
      var plat = {};   // login-index -> {legacy:{p,e,n}, ipa:{p,e,n}}
      daily.forEach(function (r) {
        var u = String(r[C.username] || "").trim();
        if (loginIdx[u] == null) return;
        var an = loginIdx[u], src = r.__src === "ipa" ? "ipa" : "legacy";
        var er = num(r[C.errorRate]); if (!ERROR_RATE_IS_FRACTION) er = er / 100;
        var o = plat[an] || (plat[an] = { legacy: { p: 0, e: 0, n: 0 }, ipa: { p: 0, e: 0, n: 0 } });
        o[src].p += num(r[C.productivity]); o[src].e += er; o[src].n++;
      });
      var ps = {};
      Object.keys(plat).forEach(function (an) {
        var o = plat[an], has = [];
        var lg = o.legacy.n ? { prod: o.legacy.p / o.legacy.n, er: o.legacy.e / o.legacy.n, n: o.legacy.n } : null;
        var ip = o.ipa.n ? { prod: o.ipa.p / o.ipa.n, er: o.ipa.e / o.ipa.n, n: o.ipa.n } : null;
        if (lg) has.push("Legacy"); if (ip) has.push("IPA");
        ps[an] = { legacy: lg, ipa: ip, portals: has.slice().reverse().join(" + ") };
      });
      SCORES.platformStats = ps;
    }

    // --- QA_DATA ---
    var QA = null;
    if (mist.length) {
      var qdates = uniqSort(mist.map(function (r) { return normDate(r[M.date]); }));
      var areas = uniqSort(mist.map(function (r) { return r[M.area]; }));
      var vars = uniqSort(mist.map(function (r) { return r[M.variable]; }));
      var statuses = uniqSort(mist.map(function (r) { return M.st ? r[M.st] : ""; }));
      var qdi = idx(qdates), ai = idx(areas), vi = idx(vars), si = idx(statuses);
      var qrecords = [];
      mist.forEach(function (r) {
        var u = String(r[M.username] || "").trim();
        var d = normDate(r[M.date]);
        if (loginIdx[u] == null || qdi[d] == null) return;
        var an = loginIdx[u];
        var diffCloRaw = M.diffClo ? r[M.diffClo] : null;
        var diffClo = (diffCloRaw === true || diffCloRaw === false) ? diffCloRaw
          : (diffCloRaw == null || diffCloRaw === "") ? null
          : /^true$/i.test(String(diffCloRaw).trim()) ? true
          : /^false$/i.test(String(diffCloRaw).trim()) ? false
          : null;
        qrecords.push([
          qdi[d], ai[r[M.area]] || 0, vi[r[M.variable]] || 0, an, analyst_team[an],
          M.lp ? (r[M.lp] || "") : "", M.ent ? (r[M.ent] || "") : "",
          M.clo ? (r[M.clo] || "") : "", M.cur ? (r[M.cur] || "") : "",
          M.st ? (r[M.st] !== "" && r[M.st] != null && si[r[M.st]] != null ? si[r[M.st]] : -1) : -1, r[M.url] || "", M.org ? (r[M.org] || "") : "",
          diffClo,
          // Split merges both portals via normMist, which tags each row. Single-
          // portal dashboards read their tab directly, so fall back to TARGET.
          r.__portal || (TARGET === "split" ? "" : TARGET)
        ]);
      });
      QA = { url_prefix: "", dates: qdates, areas: areas, vars: vars, statuses: statuses, analysts: analysts, records: qrecords };
    }

    // --- ROLES / LOCATIONS / AMS ---
    var roleList = ["Lead Analyst", "Specialist", "Analyst"];
    var rCounts = {}; roleList.forEach(function (x) { rCounts[x] = 0; });
    Object.keys(roleMap).forEach(function (k) { if (rCounts[roleMap[k]] != null) rCounts[roleMap[k]]++; });
    var locations = uniqSort(Object.keys(locMap).map(function (k) { return locMap[k]; }).filter(function (l) { return l && l !== "Unknown"; }));
    var lCounts = {}; locations.forEach(function (l) { lCounts[l] = 0; });
    Object.keys(locMap).forEach(function (k) { if (lCounts[locMap[k]] != null) lCounts[locMap[k]]++; });

    return {
      SCORES: SCORES, QA_DATA: QA,
      ROLES: { map: roleMap, roles: roleList, counts: rCounts },
      ROSTER: (function () {
        // De-duplicated, alphabetical usernames for the reviewer dropdown.
        var seen = {}, out = [];
        roster.forEach(function (x) {
          var k = x.u.toLowerCase();
          if (!x.u || seen[k]) return;
          seen[k] = 1; out.push(x);
        });
        out.sort(function (a, b) { return a.u.toLowerCase() < b.u.toLowerCase() ? -1 : 1; });
        return out;
      })(),
      DESIGNATIONS: { byLogin: desigByLogin, byName: desigMap },
      REVIEWS: (reviewRows || []).map(function (r) {
        return {
          review_id: String(r.review_id || ""),
          review_date: String(r.review_date || ""),
          reviewer_username: String(r.reviewer_username || ""),
          reviewer_designation: String(r.reviewer_designation || ""),
          portal: String(r.portal || ""),
          mistake_key: String(r.mistake_key || ""),
          mistake_date: String(r.mistake_date || ""),
          order_url: String(r.order_url || ""),
          target_login: String(r.target_login || ""),
          target_designation: String(r.target_designation || ""),
          verdict: String(r.verdict || ""),
          remarks: String(r.remarks || "")
        };
      }).filter(function (r) { return r.mistake_key; }),
      LOCATIONS: { locations: locations, map: locMap, counts: lCounts },
      AMS: { map: amMap },
      TEAM_SETS: (function () {
        var mine = teams.filter(function (t) { return t !== "Unassigned"; });
        if (TARGET === "ipa") return { legacy: [], ipa: mine, split: [] };
        if (TARGET === "split") return { legacy: [], ipa: [], split: mine };
        return { legacy: mine, ipa: [], split: [] };
      })()
    };
  }

  // Set for the duration of a forced-refresh load; appends nocache=1 so the
  // script-side cache is bypassed rather than serving the same 60s snapshot.
  var forceFresh = false;
  function jsonpFull(tabList, timeoutMs, sheetId) {
    // Returns the full JSONP payload object (tabs + totals), not just .tabs.
    return new Promise(function (resolve, reject) {
      var cbName = "__qaSheet_" + TARGET + "_" + Math.random().toString(36).slice(2);
      var s = document.createElement("script");
      var timer = setTimeout(function () { cleanup(); reject(new Error("JSONP timeout")); }, timeoutMs || 120000);
      function cleanup() { clearTimeout(timer); try { delete window[cbName]; } catch (e) { window[cbName] = undefined; } if (s.parentNode) s.parentNode.removeChild(s); }
      window[cbName] = function (j) { cleanup(); resolve(j || {}); };
      s.onerror = function () { cleanup(); reject(new Error("JSONP failed to load")); };
      s.src = WEBAPP_URL + (WEBAPP_URL.indexOf("?") < 0 ? "?" : "&") + tabList +
        (sheetId ? "&sheetId=" + encodeURIComponent(sheetId) : "") +
        (forceFresh ? "&nocache=1" : "") +
        "&callback=" + cbName + "&_=" + Date.now();
      document.head.appendChild(s);
    });
  }
  function jsonp(tabList, timeoutMs, sheetId, cols) {
    // Passing cols lets the proxy narrow BOTH the payload and the range it
    // reads, which keeps computed columns at the right-hand end of a tab
    // (median_*, delta_*) from being evaluated on every request.
    var q = "tabs=" + encodeURIComponent(tabList.join(","));
    if (cols && cols.length) q += "&fmt=rows&cols=" + encodeURIComponent(cols.join("|"));
    return jsonpFull(q, timeoutMs, sheetId).then(function (j) {
      var tabs = (j && j.tabs) || {};
      var out = {};
      Object.keys(tabs).forEach(function (k) { out[k] = normShape(tabs[k]); });
      return out;
    });
  }

  // ---- Saving an error review -----------------------------------------------
  // Appends (or corrects) one row in the workbook's "Error Reviews" tab via the
  // Apps Script saveReview action, and mirrors it into window.REVIEWS so the UI
  // updates immediately rather than waiting for a refetch. Writes go to the
  // workbook currently on screen, so reviewing an archived month records the
  // verdict in that month's file.
  //
  // Resolves { ok:true, review } on success. On failure it REJECTS and does not
  // touch window.REVIEWS, so the dashboard can tell the user the verdict was
  // not stored instead of showing a review that only exists on their screen.
  window.__QA_SAVE_REVIEW = function (rec) {
    rec = rec || {};
    if (!rec.mistake_key) return Promise.reject(new Error("mistake_key is required"));
    var q = "action=saveReview";
    ["review_id", "review_date", "reviewer_username", "reviewer_designation", "portal",
      "mistake_key", "mistake_date", "order_url", "target_login", "target_designation",
      "verdict", "remarks"].forEach(function (k) {
        if (rec[k] != null && rec[k] !== "") q += "&" + k + "=" + encodeURIComponent(String(rec[k]));
      });
    return jsonpFull(q, 45000, activeSheetId).then(function (j) {
      if (!j || !j.ok) throw new Error((j && j.error) || "the sheet rejected the save");
      var saved = j.review || rec;
      window.REVIEWS = window.REVIEWS || [];
      var i = window.REVIEWS.findIndex
        ? window.REVIEWS.findIndex(function (r) { return r.mistake_key === saved.mistake_key; })
        : -1;
      if (i >= 0) window.REVIEWS[i] = saved; else window.REVIEWS.push(saved);
      return { ok: true, review: saved, updated: !!j.updated };
    });
  };

  // Fetch a large tab in fixed-size pages, retrying each page, and concatenate.
  var PAGE = 24000;
  // How many pages to have in flight at once after the first page tells us
  // the total row count. Apps Script tolerates a modest amount of concurrent
  // execution per user; the org's Workspace account has a generous
  // per-execution time budget, and each page already retries 3x on failure,
  // so a stray timeout here just costs one retry rather than breaking the
  // load. If you start seeing "JSONP timeout"/"JSONP failed to load"
  // warnings in bulk, lower this back down rather than raising PAGE further.
  // Lowered from 8. This web app runs as its owner, so all viewers share ONE
  // 30-simultaneous-execution budget; at 8 in flight per viewer, three or four
  // people opening the dashboard together exhausted it and Google began
  // refusing requests. Column projection made each page ~4x smaller and the
  // script-side cache means most requests never touch the sheet, so a lower
  // fan-out costs little and buys a much higher ceiling on concurrent viewers.
  var PAGE_CONCURRENCY = 3;

  // The Mistakes tabs dominate load time, so ask the proxy for ONLY the columns
  // we read, in the compact rows-of-arrays shape. See apps-script-proxy.gs.
  function mistCols(cfgCols) {
    var seen = {}, out = [];
    Object.keys(cfgCols).forEach(function (k) {
      var name = cfgCols[k];
      if (!name || seen[name]) return;
      seen[name] = 1; out.push(name);
    });
    return out;
  }
  // Accepts either response shape and always hands back array-of-objects, so
  // build() is untouched and an older Apps Script deployment still works:
  //   new: {c:[...headers...], r:[[v,...],...]}
  //   old: [{header:v,...},...]
  function normShape(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;                 // old deployment
    var cols = payload.c || [], rws = payload.r || [];
    var out = new Array(rws.length);
    for (var i = 0; i < rws.length; i++) {
      var src = rws[i], o = {};
      for (var c = 0; c < cols.length; c++) o[cols[c]] = src[c];
      out[i] = o;
    }
    return out;
  }

  function fetchPaged(tab, onProgress, sheetId, cols) {
    var proj = (cols && cols.length) ? "&fmt=rows&cols=" + encodeURIComponent(cols.join("|")) : "";
    function fetchOne(offset) {
      var q = "tabs=" + encodeURIComponent(tab) + "&offset=" + offset + "&limit=" + PAGE + proj;
      function attempt(n) {
        return jsonpFull(q, 120000, sheetId).then(function (j) {
          var rows = normShape(j.tabs && j.tabs[tab]);
          var tot = (j.totals && j.totals[tab] != null) ? j.totals[tab] : null;
          return { rows: rows, total: tot };
        }).catch(function (e) {
          if (n < 3) return attempt(n + 1);
          throw e;
        });
      }
      return attempt(0);
    }

    // Phase 1: fetch the first page alone so we learn the true total row
    // count (and so a totally empty/missing tab short-circuits immediately).
    return fetchOne(0).then(function (first) {
      var total = first.total != null ? first.total : first.rows.length;
      var loaded = first.rows.length;
      if (onProgress) onProgress(loaded, total);
      if (loaded >= total || first.rows.length === 0) return first.rows;

      // Phase 2: fetch every remaining page in parallel, throttled to
      // PAGE_CONCURRENCY in-flight requests at a time. Results are slotted
      // back into offset order before being concatenated, so the merged
      // array is identical to what the old sequential fetch produced.
      var offsets = [];
      for (var off = PAGE; off < total; off += PAGE) offsets.push(off);
      var results = new Array(offsets.length);
      var next = 0;

      function worker() {
        if (next >= offsets.length) return Promise.resolve();
        var i = next++;
        return fetchOne(offsets[i]).then(function (res) {
          results[i] = res.rows;
          loaded += res.rows.length;
          if (onProgress) onProgress(loaded, total);
          return worker();
        });
      }

      var workers = [];
      for (var w = 0; w < Math.min(PAGE_CONCURRENCY, offsets.length); w++) workers.push(worker());
      return Promise.all(workers).then(function () {
        var all = first.rows;
        for (var k = 0; k < results.length; k++) all = all.concat(results[k] || []);
        return all;
      });
    });
  }

  // ---- Data sources: the live sheet (bound to this Apps Script deployment)
  // plus any archived month snapshots (separate spreadsheet files, same tab
  // layout). Add an entry here each time a month gets archived.
  var SOURCES = {
    live: { label: "Live Dashboard Data", sheetId: null },
    archive_jul2026: { label: "Archive \u2014 Jul 2026", sheetId: "1uCFShcJrAG41WU50z-VAFaxucM1k3GbXR44vpuqTMdk" }
  };
  // Default so the picker has something before the manifest arrives; the
  // snapshot manifest replaces this with the real month list once loaded.
  window.__QA_SOURCES = SOURCES;
  window.__QA_ACTIVE_SOURCE_KEY = "live";
  window.__QA_LOADING = false;
  window.__QA_LOAD_PROGRESS = null; // {loaded, total} while a big tab paginates

  var SNAPSHOT_VERSION = 2;   // bumped: snapshots now carry ROSTER/DESIGNATIONS/REVIEWS
  var LIVE_TTL_MS = 3 * 60 * 1000; // re-fetch Live at most once every 3 minutes
  var LS_PREFIX = "qaCache_" + TARGET + "_";
  var LS_MAX_CHARS = 4500000; // ~4.5MB guard so we never trip a QuotaExceededError

  var loadSeq = 0;
  // In-memory cache for THIS page load (any source). Archived months never
  // change, so they're cached indefinitely; "live" gets a short TTL since it
  // updates through the day — good enough to make repeated toggling within a
  // few minutes instant, without ever showing meaningfully stale numbers.
  var MEM_CACHE = {};

  function lsGet(key) {
    try {
      var raw = localStorage.getItem(LS_PREFIX + key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return obj && obj.v === SNAPSHOT_VERSION ? obj : null;
    } catch (e) { return null; }
  }
  function lsSet(key, obj) {
    try {
      var raw = JSON.stringify(obj);
      if (raw.length > LS_MAX_CHARS) {
        console.log("[sheet-loader] " + key + " snapshot too large for localStorage (" + (raw.length / 1e6).toFixed(1) + "MB) — kept in memory only, will refetch after a page reload.");
        return;
      }
      localStorage.setItem(LS_PREFIX + key, raw);
    } catch (e) {
      console.log("[sheet-loader] could not persist " + key + " to localStorage (" + e.message + ") — kept in memory only.");
    }
  }
  function applySnapshot(s) {
    window.SCORES = s.SCORES; window.QA_DATA = s.QA_DATA;
    window.ROLES = s.ROLES; window.LOCATIONS = s.LOCATIONS; window.AMS = s.AMS; window.TEAM_SETS = s.TEAM_SETS;
    window.ROSTER = s.ROSTER || []; window.DESIGNATIONS = s.DESIGNATIONS || { byLogin: {}, byName: {} };
    window.REVIEWS = s.REVIEWS || [];
  }

  var activeSheetId = null;   // null = the live, bound workbook

  function runLoad(sheetId, sourceKey, fresh) {
    activeSheetId = sheetId || null;
    forceFresh = !!fresh;
    var mySeq = ++loadSeq;
    var key = sourceKey || "live";
    var isLive = key === "live";

    // 1) In-memory cache — instant, covers repeated toggling within this page load.
    var mem = MEM_CACHE[key];
    if (mem && (!isLive || (Date.now() - mem.ts) < LIVE_TTL_MS)) {
      applySnapshot(mem);
      window.__QA_LOADING = false;
      console.log("[sheet-loader] " + key + " served from in-memory cache — instant.");
      if (typeof window.__QA_RELOAD === "function") window.__QA_RELOAD();
      return Promise.resolve();
    }

    // 2) localStorage — archives only, survives a full page reload (a fresh
    //    tab/refresh always wipes MEM_CACHE, so this is what actually fixes
    //    "every reload re-fetches the whole archive from scratch").
    if (!isLive) {
      var stored = lsGet(key);
      if (stored) {
        MEM_CACHE[key] = stored;
        applySnapshot(stored);
        window.__QA_LOADING = false;
        console.log("[sheet-loader] " + key + " restored from localStorage — instant, no reload needed.");
        if (typeof window.__QA_RELOAD === "function") window.__QA_RELOAD();
        return Promise.resolve();
      }
    }

    window.__QA_LOADING = true;
    window.__QA_LOAD_PROGRESS = null;
    var CORE = {};
    var detailTabs = [SHARED.role.tab, SHARED.location.tab, SHARED.teams.tab, SHARED.fr.tab, SHARED.reviews.tab];
    // Phase 1 is two requests on purpose. A column projection applies to every
    // tab in a request, so the productivity tabs and the reference tabs cannot
    // share one: FR Details has one column PER DAY (the list is not fixed) and
    // the others are read whole, so projecting them would strip what we need.
    // Splitting lets the big productivity tabs be read narrowly — skipping the
    // computed median_*/delta_* columns entirely — while the small reference
    // tabs come back complete.
    var dailyTabs = (TARGET === "split")
      ? [CONFIG.legacy.daily.tab, CONFIG.ipa.daily.tab]
      : [cfg.daily.tab];
    var dailyCols = [];
    (TARGET === "split" ? [CONFIG.legacy.daily.cols, CONFIG.ipa.daily.cols] : [cfg.daily.cols])
      .forEach(function (cset) {
        Object.keys(cset).forEach(function (k) {
          var n = cset[k];
          if (n && dailyCols.indexOf(n) === -1) dailyCols.push(n);
        });
      });
    return Promise.all([
      jsonp(dailyTabs, 120000, sheetId, dailyCols),   // narrow: skips computed columns
      jsonp(detailTabs, 120000, sheetId)              // whole: small reference tabs
    ]).then(function (parts) {
      var tabs = {};
      parts.forEach(function (p) { Object.keys(p).forEach(function (k) { tabs[k] = p[k]; }); });
      return tabs;
    }).then(function (tabs) {
      if (mySeq !== loadSeq) return; // a newer source switch superseded this load
      var daily;
      if (TARGET === "split") {
        var lg = (tabs[CONFIG.legacy.daily.tab] || []).map(function (r) { return normDaily(r, "legacy"); });
        var ip = (tabs[CONFIG.ipa.daily.tab] || []).map(function (r) { return normDaily(r, "ipa"); });
        daily = lg.concat(ip);
      } else {
        daily = tabs[cfg.daily.tab] || [];
      }
      if (!daily.length) { console.warn("[sheet-loader] daily returned no rows — keeping bundled data."); window.__QA_LOADING = false; return null; }
      CORE.daily = daily;
      CORE.role = tabs[SHARED.role.tab] || []; CORE.loc = tabs[SHARED.location.tab] || []; CORE.team = tabs[SHARED.teams.tab] || []; CORE.fr = tabs[SHARED.fr.tab] || [];
      window.__QA_LOAD_FAILED = null;   // this attempt reached the sheet
      CORE.reviews = tabs[SHARED.reviews.tab] || [];   // absent until the first review is saved
      var g = build(CORE.daily, [], CORE.role, CORE.loc, CORE.team, CORE.fr, CORE.reviews);
      window.SCORES = g.SCORES; window.ROLES = g.ROLES; window.LOCATIONS = g.LOCATIONS; window.AMS = g.AMS; window.TEAM_SETS = g.TEAM_SETS;
      window.ROSTER = g.ROSTER; window.DESIGNATIONS = g.DESIGNATIONS; window.REVIEWS = g.REVIEWS;
      console.log("[sheet-loader] phase 1: " + g.SCORES.analysts.length + " people, " + g.SCORES.records.length +
        " analyst-days through " + g.SCORES.dates[g.SCORES.dates.length - 1] + " — mistakes loading…");
      window.QA_DATA = null;
      if (typeof window.__QA_RELOAD === "function") window.__QA_RELOAD();
      // Phase 2: mistakes (largest) — paginated. Split loads both mistake tabs.
      var mistPromise;
      var reportProgress = function (loaded, total) {
        if (mySeq !== loadSeq) return;
        window.__QA_LOAD_PROGRESS = { loaded: loaded, total: total };
      };
      if (TARGET === "split") {
        mistPromise = fetchPaged(CONFIG.legacy.mistakes.tab, function (l, t) { reportProgress(l, t); console.log("[sheet-loader] legacy mistakes " + l + "/" + t + " …"); }, sheetId, mistCols(CONFIG.legacy.mistakes.cols))
          .then(function (lm) {
            window.__QA_LOAD_PROGRESS = null;
            return fetchPaged(CONFIG.ipa.mistakes.tab, function (l, t) { reportProgress(l, t); console.log("[sheet-loader] ipa mistakes " + l + "/" + t + " …"); }, sheetId, mistCols(CONFIG.ipa.mistakes.cols))
              .then(function (im) {
                return lm.map(function (r) { return normMist(r, "legacy"); }).concat(im.map(function (r) { return normMist(r, "ipa"); }));
              });
          });
      } else {
        mistPromise = fetchPaged(cfg.mistakes.tab, function (loaded, total) { reportProgress(loaded, total); console.log("[sheet-loader] mistakes " + loaded + "/" + total + " …"); }, sheetId, mistCols(cfg.mistakes.cols));
      }
      return mistPromise.then(function (mist) {
        if (mySeq !== loadSeq) return;
        var g2 = build(CORE.daily, mist, CORE.role, CORE.loc, CORE.team, CORE.fr, CORE.reviews);
        window.SCORES = g2.SCORES; window.QA_DATA = g2.QA_DATA;
        window.ROLES = g2.ROLES; window.LOCATIONS = g2.LOCATIONS; window.AMS = g2.AMS; window.TEAM_SETS = g2.TEAM_SETS;
        window.ROSTER = g2.ROSTER; window.DESIGNATIONS = g2.DESIGNATIONS; window.REVIEWS = g2.REVIEWS;
        console.log("[sheet-loader] phase 2: " + (g2.QA_DATA ? g2.QA_DATA.records.length + " mistakes across " + g2.QA_DATA.analysts.length + " analysts" : "no mistakes") + " merged.");
        window.__QA_LOADING = false;
        window.__QA_LOAD_PROGRESS = null;
        var snapshot = { v: SNAPSHOT_VERSION, ts: Date.now(), SCORES: g2.SCORES, QA_DATA: g2.QA_DATA, ROLES: g2.ROLES, LOCATIONS: g2.LOCATIONS, AMS: g2.AMS, TEAM_SETS: g2.TEAM_SETS, ROSTER: g2.ROSTER, DESIGNATIONS: g2.DESIGNATIONS, REVIEWS: g2.REVIEWS };
        MEM_CACHE[key] = snapshot;
        if (!isLive) {
          lsSet(key, snapshot);
          console.log("[sheet-loader] cached " + key + " (memory + localStorage) — instant next time, even after a reload.");
        } else {
          console.log("[sheet-loader] live cached in memory for " + (LIVE_TTL_MS / 60000) + " min — instant if you toggle back within that window.");
        }
        if (typeof window.__QA_RELOAD === "function") window.__QA_RELOAD();
      }).catch(function (e) {
        if (mySeq !== loadSeq) return;
        window.__QA_LOADING = false;
        window.__QA_LOAD_PROGRESS = null;
        console.warn("[sheet-loader] mistakes did not load (" + e.message + ") — scores/dates are live; mistake views stay empty.");
        if (typeof window.__QA_RELOAD === "function") window.__QA_RELOAD();
      });
    }).catch(function (e) {
      if (mySeq !== loadSeq) return;
      window.__QA_LOADING = false;
      window.__QA_LOAD_PROGRESS = null;
      // Falling back to bundled data silently is dangerous on a dashboard people
      // read numbers off: the bundled sample has its OWN (older) dates, so the
      // page looks fine while showing figures that are not live. Record the
      // failure so the UI can say so, and log something actionable.
      window.__QA_LOAD_FAILED = { message: e && e.message ? e.message : String(e), url: WEBAPP_URL, at: new Date().toISOString() };
      console.warn("[sheet-loader] could not load sheet (" + window.__QA_LOAD_FAILED.message + ") — SHOWING BUNDLED SAMPLE DATA, not live figures.");
      console.warn("[sheet-loader] endpoint tried: " + WEBAPP_URL);
      console.warn("[sheet-loader] 'JSONP failed to load' means the request never returned JS — usually the /exec URL is wrong " +
        "(creating a NEW deployment issues a NEW URL; use Manage deployments > edit > New version to keep this one), " +
        "the deployment's 'Who has access' is too restrictive, or you are not signed in to the right Google account in this browser. " +
        "Open the URL above in this browser: if you do not see JSON, the dashboard cannot read it either.");
      if (typeof window.__QA_RELOAD === "function") window.__QA_RELOAD();
    });
  }

  // Called by the dashboard's data-source dropdown to switch between the
  // live sheet and an archived month snapshot. Re-runs the full load
  // pipeline against the chosen spreadsheet (or serves it from the
  // in-memory cache if this session already loaded it once);
  // window.__QA_RELOAD() (set up by the dashboard component) fires the same
  // way it does on initial load.
  window.__QA_LOAD_SOURCE = function (key, opts) {
    var src = SOURCES[key];
    if (!src) return;
    window.__QA_ACTIVE_SOURCE_KEY = key;
    console.log("[sheet-loader] switching data source -> " + src.label);
    runLoad(src.sheetId, key, opts && opts.fresh);
  };

  // Refresh control: drop every cached copy for the active source (in-memory,
  // localStorage and the script-side 60s cache) and re-read the sheet.
  window.__QA_REFRESH = function () {
    var key = window.__QA_ACTIVE_SOURCE_KEY || "live";
    var src = SOURCES[key] || {};
    try { delete MEM_CACHE[key]; } catch (e) { MEM_CACHE[key] = null; }
    try { localStorage.removeItem(LS_PREFIX + key); } catch (e) {}
    console.log("[sheet-loader] manual refresh -> re-reading " + key + " (bypassing the 60s script cache)");
    runLoad(src.sheetId, key, true);
  };

  // ---- SNAPSHOT-FIRST STARTUP ----------------------------------------------
  // Try the static snapshot; only if that is unavailable do we call Apps Script.
  var snapMonths = null;      // manifest entries, once loaded
  var snapActive = null;      // month key currently displayed

  function applySnapshot_(snap, monthKey) {
    var tabs = snapshotToTabs(snap);
    var daily;
    if (TARGET === "split") {
      daily = (tabs[CONFIG.legacy.daily.tab] || []).map(function (r) { return normDaily(r, "legacy"); })
        .concat((tabs[CONFIG.ipa.daily.tab] || []).map(function (r) { return normDaily(r, "ipa"); }));
    } else {
      daily = tabs[cfgFor(TARGET).daily.tab] || [];
    }
    if (!daily.length) throw new Error("snapshot has no productivity rows for target=" + TARGET);

    var mist;
    if (TARGET === "split") {
      mist = (tabs[CONFIG.legacy.mistakes.tab] || []).map(function (r) { return normMist(r, "legacy"); })
        .concat((tabs[CONFIG.ipa.mistakes.tab] || []).map(function (r) { return normMist(r, "ipa"); }));
    } else {
      mist = tabs[cfgFor(TARGET).mistakes.tab] || [];
    }

    var g = build(daily, mist, tabs[SHARED.role.tab] || [], tabs[SHARED.location.tab] || [],
                  tabs[SHARED.teams.tab] || [], tabs[SHARED.fr.tab] || [], tabs[SHARED.reviews.tab] || []);
    window.SCORES = g.SCORES; window.QA_DATA = g.QA_DATA;
    window.ROLES = g.ROLES; window.LOCATIONS = g.LOCATIONS; window.AMS = g.AMS; window.TEAM_SETS = g.TEAM_SETS;
    window.ROSTER = g.ROSTER; window.DESIGNATIONS = g.DESIGNATIONS; window.REVIEWS = g.REVIEWS;
    window.__QA_LOAD_FAILED = null;
    window.__QA_LOADING = false;
    window.__QA_LOAD_PROGRESS = null;
    window.__QA_SNAPSHOT = {
      lastUpdated: snap.lastUpdated || null,
      month: snap.month || monthKey || null,
      label: snap.label || null,
      counts: snap.counts || null,
      warnings: snap.warnings || []
    };
    snapActive = snap.month || monthKey || null;
    if (snap.warnings && snap.warnings.length) {
      console.warn("[snapshot] generator reported: " + snap.warnings.join(" | "));
    }
    console.log("[snapshot] loaded " + (snap.label || snapActive) + " — " +
      g.SCORES.records.length.toLocaleString() + " analyst-days, " +
      (g.QA_DATA ? g.QA_DATA.records.length.toLocaleString() + " mistakes" : "no mistakes") +
      ", generated " + snap.lastUpdated);
    if (typeof window.__QA_RELOAD === "function") window.__QA_RELOAD();
  }

  function cfgFor(t) { return CONFIG[t] || CONFIG.legacy; }

  // Accepts a manifest entry. schema 2 carries a files{} map of parts; schema 1
  // carried a single file, still honoured so an older manifest keeps working.
  function loadSnapshot(entry, monthKey) {
    window.__QA_LOADING = true;
    var want = SNAP_PARTS[TARGET] || SNAP_PARTS.legacy;
    var urls;
    if (entry && entry.files) {
      urls = want.map(function (p) { return entry.files[p]; }).filter(Boolean);
      if (!urls.length) return Promise.reject(new Error("manifest lists no parts this dashboard can use"));
    } else {
      urls = [(entry && entry.file) || entry];
    }
    return Promise.all(urls.map(function (u) { return fetchJSON(u, 45000); })).then(function (parts) {
      var snap = (parts.length === 1 && !(entry && entry.files)) ? parts[0] : mergeParts(parts);
      if (!snap) throw new Error("snapshot parts were empty");
      applySnapshot_(snap, monthKey);
      lsSet("snap_" + (snap.month || monthKey || "current"), { v: SNAPSHOT_VERSION, ts: Date.now(), snap: snap });
      console.log("[snapshot] fetched " + urls.length + " part(s): " + want.join(" + "));
      return true;
    });
  }

  // Month dropdown is driven by the manifest, so adding a month needs no code
  // change — the generator writes it and the dropdown picks it up.
  function loadManifest() {
    return fetchJSON(SNAP.manifest, 15000).then(function (m) {
      if (!m || !m.months || !m.months.length) throw new Error("manifest has no months");
      snapMonths = m.months;
      var src = {};
      m.months.forEach(function (mo) {
        src["snap_" + mo.key] = { label: mo.label + (mo.live ? " (current)" : ""), snapshot: mo, month: mo.key };
      });
      window.__QA_SOURCES = src;
      window.__QA_ACTIVE_SOURCE_KEY = "snap_" + (m.current || m.months[0].key);
      return m;
    });
  }

  window.__QA_LOAD_SOURCE = function (key, opts) {
    // Snapshot months first; fall through to the legacy sheet-based sources.
    var snapSrc = (window.__QA_SOURCES || {})[key];
    if (snapSrc && snapSrc.snapshot) {
      window.__QA_ACTIVE_SOURCE_KEY = key;
      console.log("[snapshot] switching to " + snapSrc.label);
      loadSnapshot(snapSrc.snapshot, snapSrc.month).catch(function (e) {
        window.__QA_LOAD_FAILED = { message: "snapshot " + snapSrc.file + " — " + e.message, url: snapSrc.snapshot, at: new Date().toISOString() };
        console.warn("[snapshot] could not load " + snapSrc.snapshot + ": " + e.message);
        if (typeof window.__QA_RELOAD === "function") window.__QA_RELOAD();
      });
      return;
    }
    var src = SOURCES[key];
    if (!src) return;
    window.__QA_ACTIVE_SOURCE_KEY = key;
    console.log("[sheet-loader] switching data source -> " + src.label);
    runLoad(src.sheetId, key, opts && opts.fresh);
  };

  window.__QA_REFRESH = function () {
    var key = window.__QA_ACTIVE_SOURCE_KEY || "live";
    var snapSrc = (window.__QA_SOURCES || {})[key];
    if (snapSrc && snapSrc.snapshot) {
      console.log("[snapshot] manual refresh");
      loadSnapshot(snapSrc.snapshot, snapSrc.month).catch(function (e) {
        console.warn("[snapshot] refresh failed, keeping what is on screen: " + e.message);
      });
      return;
    }
    var src = SOURCES[key] || {};
    try { delete MEM_CACHE[key]; } catch (e) { MEM_CACHE[key] = null; }
    try { localStorage.removeItem(LS_PREFIX + key); } catch (e) {}
    console.log("[sheet-loader] manual refresh -> re-reading " + key + " (bypassing the 60s script cache)");
    runLoad(src.sheetId, key, true);
  };

  // Poll for a newer snapshot. Cheap: a ~2KB manifest read, and the month file
  // is only refetched when lastUpdated actually changes.
  function startAutoRefresh() {
    setInterval(function () {
      if (document.hidden) return;              // don't poll background tabs
      fetchJSON(SNAP.manifest, 15000).then(function (m) {
        if (!m || !m.months) return;
        var key = window.__QA_ACTIVE_SOURCE_KEY || "";
        var want = null;
        m.months.forEach(function (mo) { if ("snap_" + mo.key === key) want = mo; });
        if (!want) return;
        var have = window.__QA_SNAPSHOT && window.__QA_SNAPSHOT.lastUpdated;
        if (have && want.lastUpdated && want.lastUpdated === have) return;   // unchanged
        console.log("[snapshot] newer data published (" + want.lastUpdated + ") — reloading");
        loadSnapshot(want, want.key).catch(function (e) {
          console.warn("[snapshot] auto-refresh failed, keeping current view: " + e.message);
        });
      }).catch(function () { /* offline or deploying — try again next tick */ });
    }, REFRESH_MS);
  }

  function bootData() {
    // An offline archive (see tools/make-standalone.py) has its data baked into
    // the page. Use it straight away so the file renders instantly and works
    // with no network at all, then still try for fresher figures if we happen
    // to be online. If that fails we simply keep showing the embedded copy —
    // and deliberately do NOT raise the "bundled sample data" banner, because
    // an embedded snapshot IS real data, just frozen at build time.
    var embeddedOk = false;
    if (window.__QA_EMBEDDED_SNAPSHOT) {
      try {
        applySnapshot_(window.__QA_EMBEDDED_SNAPSHOT, window.__QA_EMBEDDED_SNAPSHOT.month);
        embeddedOk = true;
        console.log("[snapshot] using the copy embedded in this file (generated " +
          (window.__QA_EMBEDDED_SNAPSHOT.lastUpdated || "unknown") + "); will refresh if online.");
      } catch (e) {
        console.warn("[snapshot] embedded copy unusable (" + e.message + ")");
      }
    }
    loadManifest().then(function (m) {
      var cur = null;
      m.months.forEach(function (mo) { if (mo.key === (m.current || m.months[0].key)) cur = mo; });
      cur = cur || m.months[0];
      return loadSnapshot(cur, cur.key);
    }).then(function () {
      startAutoRefresh();
    }).catch(function (e) {
      // Snapshot path unavailable. Serve the last good copy if we have one, then
      // fall back to the live sheet so the dashboard still works during the
      // transition (or if a snapshot job fails).
      if (embeddedOk) {
        console.log("[snapshot] no newer data reachable — keeping the copy embedded in this file.");
        return;
      }
      console.warn("[snapshot] unavailable (" + e.message + ") — trying cached copy, then the live sheet.");
      var cached = null;
      try {
        // localStorage.length / .key(i) is the standard enumeration API;
        // Object.keys(localStorage) happens to work in browsers but is not
        // guaranteed and silently returns nothing in stricter environments.
        for (var i = 0; i < localStorage.length; i++) {
          var lk = localStorage.key(i);
          if (!lk || lk.indexOf(LS_PREFIX + "snap_") !== 0) continue;
          var obj = JSON.parse(localStorage.getItem(lk));
          if (obj && obj.snap && (!cached || obj.ts > cached.ts)) cached = obj;
        }
      } catch (e2) {}
      if (cached) {
        try {
          applySnapshot_(cached.snap, cached.snap.month);
          console.warn("[snapshot] showing the last snapshot saved in this browser (" + cached.snap.lastUpdated + ").");
          startAutoRefresh();
          return;
        } catch (e3) { console.warn("[snapshot] cached copy unusable: " + e3.message); }
      }
      if (!WEBAPP_URL) { console.log("[sheet-loader] WEBAPP_URL not set — using bundled data."); return; }
      window.__QA_SOURCES = SOURCES;
      window.__QA_ACTIVE_SOURCE_KEY = "live";
      console.log("[sheet-loader] falling back to the live sheet (target=" + TARGET + ") …");
      runLoad(null, "live");
    });
  }

  bootData();
})();
