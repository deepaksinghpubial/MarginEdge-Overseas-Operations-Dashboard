# MarginEdge Overseas Operations Dashboard

Static site with three dashboards (Legacy, IPA, Both Portals). Data is pulled
live from Google Sheets at runtime via an Apps Script JSONP proxy — no build
step, no server, no npm.

## Files

| File | Purpose |
|---|---|
| `index.html` | Shell with the dashboard dropdown (entry point) |
| `legacy.html` | Legacy Dashboard |
| `ipa.html` | IPA Dashboard |
| `split.html` | Both Portals (Split-Time Leads) |
| `sheet-loader.js` | Fetches + reshapes the Google Sheet data |
| `support.js` | Component runtime |
| `*-data.js` | Bundled fallback data (used if the sheet is unreachable) |
| `_ds/` | Design-system tokens and styles |
| `assets/` | Logos |
| `apps-script-proxy.gs` | Source of the Apps Script web app (not deployed here) |

## Run locally

The pages must be served over HTTP (not opened as `file://`).

```bash
cd site
python3 -m http.server 8080
# then open http://localhost:8080
```

In VS Code you can instead use the **Live Server** extension: right-click
`index.html` → *Open with Live Server*.

## Deploy to Netlify via GitHub

1. Create a new GitHub repo and push this folder as the repo root:

   ```bash
   cd site
   git init
   git add .
   git commit -m "MarginEdge Overseas Operations Dashboard"
   git branch -M main
   git remote add origin https://github.com/<your-org>/<your-repo>.git
   git push -u origin main
   ```

2. In Netlify: **Add new site → Import an existing project → GitHub**, pick the repo.
3. Build settings:
   - **Build command:** *(leave empty)*
   - **Publish directory:** `.`  (or `site` if you committed the parent folder)
4. Deploy. Every `git push` to `main` redeploys automatically.

## Updating the data

The dashboards read the Google Sheet at load time, so refreshing the page picks
up new rows — no redeploy needed. Only redeploy when the dashboard *code*
changes.

The sheet is reached through the Apps Script web app URL configured in
`sheet-loader.js` (`WEBAPP_URL`). If you redeploy the Apps Script, update that
constant and push.

## Editing

All dashboard logic and markup live inside the three HTML files (a `<script
data-dc-script>` block near the bottom of each). Edit, save, refresh.
