# `vendor/` — local copies of React

The dashboards load React and ReactDOM at runtime. Normally they come from
`unpkg.com`, which means the dashboard **stops working entirely if unpkg is
unreachable** — you get a blank page and `[dc] failed to load React or boot` in
the console.

These are byte-identical copies of the exact versions the app asks for
(**18.3.1**, matching the URLs and SRI hashes in `support.js`), obtained from the
npm registry.

They are used by `tools/make-standalone.py`, which inlines them so an offline
backup copy boots with no internet at all.

They could also be used to remove the unpkg dependency from the hosted site —
`support.js` already supports this via the `window.__resources` override:

```html
<script>
  window.__resources = window.__resources || {};
  window.__resources["https://unpkg.com/react@18.3.1/umd/react.production.min.js"]     = "vendor/react.production.min.js";
  window.__resources["https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"] = "vendor/react-dom.production.min.js";
</script>
```

If you upgrade React, replace these files AND the URLs/SRI hashes in
`support.js` together, or the two will disagree.
