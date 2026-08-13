# Keeping an offline backup of the dashboard

There are two different things worth backing up. They protect against different
problems, so it's worth having both.

## 1. The code — already done, for free

Every version of every file lives in the GitHub repository. If Netlify is paused,
suspended or cancelled, nothing is lost: point any static host at this repo and
the dashboard is back.

To keep a copy on your own machine: on the GitHub repo page, **Code ▾ → Download
ZIP**. That single file contains everything needed to rebuild the site.

## 2. A working offline copy — one file you can double-click

`tools/make-standalone.py` builds a **single self-contained `.html`** that opens
with no web server, no Netlify and no internet:

```bash
python3 tools/make-standalone.py --data data/current.json
```

That produces `legacy-standalone.html`, `ipa-standalone.html` and
`split-standalone.html`. Copy them anywhere — Desktop, USB stick, Google Drive,
an email attachment — and double-click to open.

### What "self-contained" actually required

Copying `legacy.html` on its own gives you a **blank page**. It is not one file:

| Dependency | Count | Handling |
| --- | --- | --- |
| JavaScript files | 8 | inlined |
| Stylesheets | 6 | inlined, with fonts/images converted to data URIs |
| Logo | 1 | inlined as a data URI |
| **React, from `unpkg.com`** | 2 | inlined from `vendor/` |

That last row is the important one. The dashboard downloads React from unpkg.com
**every time it loads**. If unpkg is unreachable, the page never starts — you get
a blank screen and `[dc] failed to load React or boot` in the console. That
applies to the live site too, not just backups.

One other trap: most of those tags sit inside the `<x-dc>` block, which the
design system re-serializes as a template at runtime. Code inlined *there* gets
mangled by its attribute encoder (identifiers come out as `sc-camel-…`) and
throws syntax errors. The builder hoists everything into `<head>`, outside the
template, keeping the original order.

### Which data does the backup show?

| How you build it | What it shows |
| --- | --- |
| `--data data/current.json` | **that month's real figures**, frozen at build time |
| no `--data` | the old bundled sample data — which renders as an **empty** dashboard, so don't rely on it |

**Always pass `--data`.** Without it the backup opens but shows nothing useful.

If the machine happens to be online, the file still refreshes from the Google
Sheet by itself. If not, it keeps showing the embedded snapshot and the "Updated
…" stamp beside the data selector tells the reader how old the figures are.

## Suggested routine

- **Monthly**, when you archive a month: build a standalone copy from that
  month's snapshot and keep it with your records. It stays readable years later
  with no dependency on Netlify, Google or unpkg.
- **After any big change**: download the repo ZIP.

```bash
# a dated set, kept out of the way
python3 tools/make-standalone.py --data data/2026-08.json --out backups/2026-08/
```
