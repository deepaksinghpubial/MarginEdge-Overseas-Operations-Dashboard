# Dashboard data snapshots — setup and daily running

**Who this is for:** the operations team. No coding needed. You will copy one
file, paste four settings, and click "Deploy" once. After that it runs itself.

---

## Why we changed this

The dashboard used to call Google Sheets every time someone opened it. Google
only allows **30 things to run at once for one account**, and because the script
runs as its owner, *everyone shares that one allowance*. With ~50 people opening
the dashboard each morning, that limit was being hit and the dashboard started
failing — sometimes showing sample figures instead of real ones.

Now a job reads the sheet **once a day** and saves the result as a file. The
dashboard reads that file. Fifty people cost exactly the same as one, and nobody
opening the dashboard can touch the sheet at all.

```
Google Sheet  ──(once a day, 7am)──>  Apps Script  ──>  JSON file in GitHub
                                                              │
                                                    Netlify publishes it
                                                              │
                                                   everyone's dashboard
```

---

## Part 1 — Create the GitHub token (5 minutes, once)

The job needs permission to save the file into GitHub.

1. Go to **github.com** → click your photo (top right) → **Settings**
2. Scroll to the bottom of the left menu → **Developer settings**
3. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
4. Fill in:
   - **Token name:** `dashboard-snapshot`
   - **Expiration:** 1 year *(put a reminder in your calendar to redo this)*
   - **Repository access:** choose **Only select repositories**, then pick
     `MarginEdge-Overseas-Operations-Dashboard`
   - **Permissions** → **Repository permissions** → find **Contents** → set it to
     **Read and write**. Leave everything else alone.
5. Click **Generate token** and **copy it now** — GitHub only shows it once.

> This token can only write files in that one repository. It cannot read the
> Google Sheet, touch other repos, or change any settings.

---

## Part 2 — Install the script (10 minutes, once)

1. Open the **live Google Sheet**.
2. **Extensions** → **Apps Script**.
3. In the file list on the left, click **+** → **Script**, and name it
   `snapshot-generator`.
4. Open `tools/snapshot-generator.gs` from the repository, copy **all** of it,
   and paste it into that new file (replacing anything already there).
5. Click the **save** icon.

### Now add the four settings

6. Click the **gear icon** (⚙ Project Settings) in the left menu.
7. Scroll to **Script Properties** → **Add script property**. Add these:

   | Property | Value |
   | --- | --- |
   | `GITHUB_TOKEN` | the token you copied in Part 1 |
   | `GITHUB_REPO` | `deepaksinghpubial/MarginEdge-Overseas-Operations-Dashboard` |
   | `GITHUB_BRANCH` | `main` |
   | `DRIVE_FOLDER_ID` | *(optional)* a Drive folder ID to keep a spare copy in |

8. Click **Save script properties**.

### Test it before automating

9. Go back to the **code** (`< >` icon), pick **`dryRunSnapshot`** from the
   function dropdown at the top, and click **Run**.
   - The first time, Google asks for permission. Click **Review permissions** →
     choose your account → **Advanced** → **Go to (unsafe)** → **Allow**.
     *(This warning is normal for your own scripts.)*
   - Open **Execution log** at the bottom. You should see a line per tab with
     row counts, and no `WARNING:` lines.
   - `dryRunSnapshot` does **not** write to GitHub, so nothing can break.
10. Happy with the log? Now run **`runSnapshotNow`**. This does the real thing.
    The log should end with `Published to GitHub`.
11. Check GitHub. The `data/` folder should contain `core-current.json`,
    `legacy-current.json`, `ipa-current.json` and `manifest.json` — all four
    written as a **single commit**, so Netlify runs one deploy, not four.

### Turn on the schedule

12. Pick **`installPoller`** from the dropdown → **Run**.

    This is the recommended setup. It checks the sheet **every 15 minutes** and
    publishes only when the data has actually changed, so figures reach the
    dashboard within a quarter of an hour of landing in the workbook, whatever
    time Redash finishes.

    A check that finds nothing new costs about two seconds. It reads only the
    row and column counts of the eight source tabs — not the 180,000 mistake
    rows — and if they match what was last published it stops there: no build,
    no GitHub commit, and therefore **no Netlify deploy and no credits**. The
    sheet genuinely changes about once a day, so the running cost stays where
    the daily job left it.

    `Error Reviews` is deliberately not watched. Verdicts are saved all day and
    the dashboard already reads them live, so watching that tab would fire a
    deploy on every review — the exact cost this design avoids.

    It also installs one **daily forced publish at 10:00 IST** as a safety net,
    for the case where a correction replaces a row rather than adding one and
    the row counts therefore look unchanged.

    Run **`pollerStatus`** any time to see what the poller can see and whether
    it would publish right now.

    To use a different interval: **`installPoller(30)`**. Apps Script accepts
    1, 5, 10, 15 or 30 minutes.

<details>
<summary>Alternative: the original once-a-day schedule</summary>

Pick **`installDailyTriggerIST`** from the dropdown → **Run**.

    Be aware of the trade-off that prompted the poller: anything Redash writes
    after the run waits until the next morning. On 25 Aug the job published at
    10:43 with data through the 24th, and the 25th's figures sat in the sheet
    for a full day.

    This sets the job to **10:00 IST** — an hour after your Redash update lands
    at ~09:00, with a little margin.

    You give it the time in **IST** and it works out the rest. That matters
    because Apps Script schedules in the *script project's* timezone, which is
    not necessarily yours, and US timezones observe daylight saving while IST
    does not. The function measures the real offset when it runs and rounds up,
    so the job can never fire *before* the IST time you asked for.

    For a different time: **`installDailyTriggerIST(11)`** for 11:00 IST, and so
    on. Apps Script fires within an hour of the set time, so 10:00 means
    "some time between 10:00 and 11:00 IST".

    The log prints exactly what it set and what that comes to in IST — worth a
    glance to confirm.

    ⚠️ If the clocks change where your script timezone lives, the trigger can
    drift by an hour. Re-run `installDailyTriggerIST()` if that matters.

</details>

---

## Part 3 — Every month (2 minutes)

When a month finishes and before ops clears the live sheet for the new month:

1. Apps Script → pick **`archiveMonth`** → but first change the month in the
   code call, or simpler: use the **Execution** approach below.
2. Easiest way: in the editor, temporarily change the top of `archiveMonth` test
   call — or ask whoever maintains the dashboard to run:
   `archiveMonth("2026-08")` with the month you are closing.
3. That saves `data/2026-08.json` and adds **August 2026** to the dashboard's
   month dropdown permanently.

After that, ops clears the live sheet as usual. The next daily run picks up the
new month automatically.

---

## Daily running — what to check

Nothing, normally. If someone reports stale numbers:

| What you see | What it means | What to do |
| --- | --- | --- |
| Dashboard shows **"Updated 2 d ago"** in amber | The daily job hasn't run | Apps Script → **Executions** (left menu) → look for a failed `dailySnapshot` |
| Red banner: **"bundled sample figures"** | The data file could not be loaded at all | Check Netlify deployed, then run `runSnapshotNow` by hand |
| Log says `WARNING: tab "X" not found` | A tab was renamed in the sheet | Rename it back, or tell the dashboard maintainer the new name |
| Log says `missing expected column(s)` | A column header changed | Same — the header names must match exactly |
| GitHub write fails with `401`/`403` | The token expired or was revoked | Redo Part 1 and update `GITHUB_TOKEN` |

To force an update right now: Apps Script → **`runSnapshotNow`** → **Run**.
Or, in the dashboard, click the **↻** button next to the data selector.

---

## What people see in the dashboard

- **Updated 3 h ago** next to the data picker — how old the figures are. Turns
  amber with a ⚠ if the job hasn't run for more than a day and a half.
- A **month dropdown** listing the current month plus every archived month.
- The dashboard **re-checks for new data every 5 minutes**, so when the daily job
  publishes, open dashboards pick it up without anyone reloading.
- If the data file is briefly unavailable (e.g. mid-deploy), the dashboard keeps
  showing the last copy it loaded rather than going blank.

---

## The tabs that get copied

Nine tabs, because that is what the dashboards read:

`Legacy Productivity` · `Legacy Mistakes` · `IPA Productivity` ·
`IPA Mistakes` · `Role Details` · `Location Details` ·
`Team Details - Legacy & IPA` · `FR Details` · `Error Reviews`

**Not copied:** `Team Summary` and `Dashboard Summary`. The dashboard calculates
those figures itself from the tabs above, so copying them would just make the
file bigger. If you ever want them included, add a line to the `TABS` list at the
top of `snapshot-generator.gs`.

Only the columns the dashboard actually uses are copied from the two Mistakes
tabs. That is deliberate — those tabs carry extra columns which would otherwise
be downloaded by every viewer, every day, for nothing.
