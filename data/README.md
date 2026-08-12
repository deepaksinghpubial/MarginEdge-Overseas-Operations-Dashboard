# `data/` — dashboard snapshots

Everything here is **generated**. Do not hand-edit these files; the next daily
run overwrites them.

| File | What it is | Written by |
| --- | --- | --- |
| `manifest.json` | List of available months. The dashboard's month dropdown is built from this, so adding a month needs no code change. | `dailySnapshot()` / `archiveMonth()` |
| `current.json` | The month currently being worked on. Overwritten every day. | `dailySnapshot()` |
| `2026-07.json`, `2026-08.json`, … | Frozen months. Written once when the month closes, then never again. | `archiveMonth("2026-07")` |
| `manifest.example.json`, `example-current.json` | Committed examples so the shape is reviewable. Not read by the dashboard. | by hand, once |

## How a month moves through here

1. **During the month** — `dailySnapshot()` runs once a day and rewrites
   `current.json`. Only this one file changes, so git history grows by one
   snapshot per day rather than one per month of accumulated data.
2. **When the month ends** — run `archiveMonth("2026-08")` once. It copies the
   snapshot to `2026-08.json` and flips that month to `live: false` in the
   manifest, pointing it at the frozen file.
3. **New month** — the ops team clears the live sheet as usual. The next daily
   run writes the new month into `current.json` and adds it to the manifest.

Archived files are immutable, so they can be cached hard; `current.json` is the
only file that changes day to day.
