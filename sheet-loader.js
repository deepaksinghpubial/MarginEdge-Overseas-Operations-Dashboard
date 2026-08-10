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

  var SHARED = {
    role:     { tab: "Role Details",     user: "username", designation: "designation", lead: "Allocated Team Lead", am: "Allocated Asst Manager" },
    location: { tab: "Location Details", user: "username", loc: "location" },
    teams:    { tab: "Team Details - Legacy & IPA", legacy: "Legacy Team Names", ipa: "IPA Team Names" },
    fr:       { tab: "FR Details", user: "User", count: "Final Review" }
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
        st: "status", url: "order_url", org: null } }
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
        st: "task_type", url: "order_url", org: "flow_type" } }
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
      current_value: m.cur ? row[m.cur] : "", status: m.st ? row[m.st] : "", order_url: m.url ? row[m.url] : "" };
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

  function build(daily, mist, roleRows, locRows, teamRows, frRows) {
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
    var badAm = function (v) { return !v || /^#?n\/?a$/i.test(v) || /^unassigned/i.test(v); };
    (roleRows || []).forEach(function (r) {
      var u = String(r[SHARED.role.user] || "").trim().toLowerCase();
      if (!u) return;
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
    var roleMap = {}, locMap = {};
    order.forEach(function (u) {
      roleMap[disp[u].toLowerCase()] = roleByLogin[u.toLowerCase()] || "Analyst";
      locMap[disp[u].toLowerCase()] = locByLogin[u.toLowerCase()] || "Unknown";
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
        qrecords.push([
          qdi[d], ai[r[M.area]] || 0, vi[r[M.variable]] || 0, an, analyst_team[an],
          M.lp ? (r[M.lp] || "") : "", M.ent ? (r[M.ent] || "") : "",
          M.clo ? (r[M.clo] || "") : "", M.cur ? (r[M.cur] || "") : "",
          M.st ? (r[M.st] !== "" && r[M.st] != null && si[r[M.st]] != null ? si[r[M.st]] : -1) : -1, r[M.url] || "", M.org ? (r[M.org] || "") : ""
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
        "&callback=" + cbName + "&_=" + Date.now();
      document.head.appendChild(s);
    });
  }
  function jsonp(tabList, timeoutMs, sheetId) {
    return jsonpFull("tabs=" + encodeURIComponent(tabList.join(",")), timeoutMs, sheetId).then(function (j) { return (j && j.tabs) || {}; });
  }

  // Fetch a large tab in fixed-size pages, retrying each page, and concatenate.
  var PAGE = 24000;
  // How many pages to have in flight at once after the first page tells us
  // the total row count. Apps Script tolerates a modest amount of concurrent
  // execution per user; the org's Workspace account has a generous
  // per-execution time budget, and each page already retries 3x on failure,
  // so a stray timeout here just costs one retry rather than breaking the
  // load. If you start seeing "JSONP timeout"/"JSONP failed to load"
  // warnings in bulk, lower this back down rather than raising PAGE further.
  var PAGE_CONCURRENCY = 8;

  function fetchPaged(tab, onProgress, sheetId) {
    function fetchOne(offset) {
      var q = "tabs=" + encodeURIComponent(tab) + "&offset=" + offset + "&limit=" + PAGE;
      function attempt(n) {
        return jsonpFull(q, 120000, sheetId).then(function (j) {
          var rows = (j.tabs && j.tabs[tab]) || [];
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
  window.__QA_SOURCES = SOURCES;
  window.__QA_ACTIVE_SOURCE_KEY = "live";
  window.__QA_LOADING = false;
  window.__QA_LOAD_PROGRESS = null; // {loaded, total} while a big tab paginates

  var SNAPSHOT_VERSION = 1;
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
  }

  function runLoad(sheetId, sourceKey) {
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
    var detailTabs = [SHARED.role.tab, SHARED.location.tab, SHARED.teams.tab, SHARED.fr.tab];
    var phase1Tabs = (TARGET === "split"
      ? [CONFIG.legacy.daily.tab, CONFIG.ipa.daily.tab]
      : [cfg.daily.tab]).concat(detailTabs);
    return jsonp(phase1Tabs, 120000, sheetId).then(function (tabs) {
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
      var g = build(CORE.daily, [], CORE.role, CORE.loc, CORE.team, CORE.fr);
      window.SCORES = g.SCORES; window.ROLES = g.ROLES; window.LOCATIONS = g.LOCATIONS; window.AMS = g.AMS; window.TEAM_SETS = g.TEAM_SETS;
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
        mistPromise = fetchPaged(CONFIG.legacy.mistakes.tab, function (l, t) { reportProgress(l, t); console.log("[sheet-loader] legacy mistakes " + l + "/" + t + " …"); }, sheetId)
          .then(function (lm) {
            window.__QA_LOAD_PROGRESS = null;
            return fetchPaged(CONFIG.ipa.mistakes.tab, function (l, t) { reportProgress(l, t); console.log("[sheet-loader] ipa mistakes " + l + "/" + t + " …"); }, sheetId)
              .then(function (im) {
                return lm.map(function (r) { return normMist(r, "legacy"); }).concat(im.map(function (r) { return normMist(r, "ipa"); }));
              });
          });
      } else {
        mistPromise = fetchPaged(cfg.mistakes.tab, function (loaded, total) { reportProgress(loaded, total); console.log("[sheet-loader] mistakes " + loaded + "/" + total + " …"); }, sheetId);
      }
      return mistPromise.then(function (mist) {
        if (mySeq !== loadSeq) return;
        var g2 = build(CORE.daily, mist, CORE.role, CORE.loc, CORE.team, CORE.fr);
        window.SCORES = g2.SCORES; window.QA_DATA = g2.QA_DATA;
        window.ROLES = g2.ROLES; window.LOCATIONS = g2.LOCATIONS; window.AMS = g2.AMS; window.TEAM_SETS = g2.TEAM_SETS;
        console.log("[sheet-loader] phase 2: " + (g2.QA_DATA ? g2.QA_DATA.records.length + " mistakes across " + g2.QA_DATA.analysts.length + " analysts" : "no mistakes") + " merged.");
        window.__QA_LOADING = false;
        window.__QA_LOAD_PROGRESS = null;
        var snapshot = { v: SNAPSHOT_VERSION, ts: Date.now(), SCORES: g2.SCORES, QA_DATA: g2.QA_DATA, ROLES: g2.ROLES, LOCATIONS: g2.LOCATIONS, AMS: g2.AMS, TEAM_SETS: g2.TEAM_SETS };
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
      console.warn("[sheet-loader] could not load sheet (" + e.message + ") — using bundled data.");
    });
  }

  // Called by the dashboard's data-source dropdown to switch between the
  // live sheet and an archived month snapshot. Re-runs the full load
  // pipeline against the chosen spreadsheet (or serves it from the
  // in-memory cache if this session already loaded it once);
  // window.__QA_RELOAD() (set up by the dashboard component) fires the same
  // way it does on initial load.
  window.__QA_LOAD_SOURCE = function (key) {
    var src = SOURCES[key];
    if (!src) return;
    window.__QA_ACTIVE_SOURCE_KEY = key;
    console.log("[sheet-loader] switching data source -> " + src.label);
    runLoad(src.sheetId, key);
  };

  if (!WEBAPP_URL) { console.log("[sheet-loader] WEBAPP_URL not set — using bundled data."); } else {
    console.log("[sheet-loader] target=" + TARGET + " — loading from sheet …");
    runLoad(null, "live");
  }
})();
