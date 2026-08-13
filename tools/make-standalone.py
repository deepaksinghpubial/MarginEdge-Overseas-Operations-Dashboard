#!/usr/bin/env python3
"""
Build a SINGLE self-contained .html copy of a dashboard.

Why this exists
---------------
The dashboards look like one file but are not. legacy.html alone pulls in 8
JavaScript files, 6 stylesheets, a logo, and React from unpkg.com. Copying just
the .html gives you a blank page. This inlines every dependency so the result
opens by double-clicking, from a USB stick, with no web server, no Netlify and
no internet.

Two things make this less trivial than it looks
----------------------------------------------
1. React is fetched from unpkg.com at runtime. If unpkg is unreachable the page
   never boots at all. A vendored copy (vendor/) is inlined instead.
2. Most of the <script> and <link> tags sit inside the <x-dc> block, which the
   design-system runtime parses and RE-SERIALIZES as a template. Code inlined
   there gets mangled by its camelCase attribute encoder (identifiers come out
   as `sc-camel-...`), producing syntax errors. So everything is hoisted into
   <head>, outside the template, in its original order.

Result
------
  * Boots offline. No CDN, no local files, nothing external required.
  * Online it still reads live figures from the Google Sheet exactly as the
    hosted version does (that call is a <script> tag, which works from file://).
  * --data bakes in a real snapshot (data/current.json from
    tools/snapshot-generator.gs) so the file is a frozen record of that month.
    Without it the file falls back to the old bundled sample data.

Usage
-----
  python3 tools/make-standalone.py                          # all three
  python3 tools/make-standalone.py --data data/current.json # with real data
  python3 tools/make-standalone.py legacy.html --out backups/
"""

import argparse, base64, datetime, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DASHBOARDS = ["legacy.html", "ipa.html", "split.html"]

SCRIPT_RE = re.compile(r'<script\b[^>]*>.*?</script>', re.I | re.S)
LINK_RE   = re.compile(r'<link\b[^>]*?>', re.I)
SRC_RE    = re.compile(r'\ssrc=["\']([^"\']+)["\']', re.I)
HREF_RE   = re.compile(r'\shref=["\']([^"\']+)["\']', re.I)


def read(path):
    with open(os.path.join(ROOT, path), "r", encoding="utf-8") as f:
        return f.read()


def data_uri(path):
    ext = os.path.splitext(path)[1].lstrip(".").lower()
    mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "svg": "image/svg+xml", "woff2": "font/woff2", "woff": "font/woff"}.get(
                ext, "application/octet-stream")
    with open(os.path.join(ROOT, path), "rb") as f:
        return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode("ascii"))


def guard(js):
    """A </script> inside a string literal would close the wrapping tag early."""
    return js.replace("</script>", "<\\/script>")


def is_remote(u):
    return u.startswith(("http://", "https://", "//", "data:"))


def inline_one_css(href, warn):
    try:
        css = read(href)
    except OSError:
        warn.append("stylesheet not found: " + href)
        return None
    base = os.path.dirname(href)

    def urlrepl(m):
        raw = m.group(1).strip("'\" ")
        if is_remote(raw) or raw.startswith("#"):
            return m.group(0)
        p = os.path.normpath(os.path.join(base, raw.split("?")[0].split("#")[0]))
        try:
            return "url(%s)" % data_uri(p)
        except OSError:
            return m.group(0)

    return re.sub(r"url\(([^)]+)\)", urlrepl, css)


def collect(html, warn):
    """
    Pull every LOCAL <script src>, inline <script> and <link rel=stylesheet> out
    of the document, in order, and return (html_without_them, hoisted_html).
    Remote references are left exactly where they are.
    """
    pieces = []

    def take_script(m):
        tag = m.group(0)
        src = SRC_RE.search(tag)
        if src:
            if is_remote(src.group(1)):
                return tag                      # leave CDN scripts alone
            path = src.group(1)[2:] if src.group(1).startswith("./") else src.group(1)
            try:
                pieces.append("<script>/* %s */\n%s\n</script>" % (path, guard(read(path))))
            except OSError:
                warn.append("script not found: " + path)
                return tag
            return ""
        # An inline script: hoist it too, so execution order is preserved
        # (window.__SHEET_TARGET must still be set before sheet-loader runs).
        pieces.append(tag)
        return ""

    def take_link(m):
        tag = m.group(0)
        if "stylesheet" not in tag.lower():
            return tag
        href = HREF_RE.search(tag)
        if not href or is_remote(href.group(1)):
            return tag
        css = inline_one_css(href.group(1), warn)
        if css is None:
            return tag
        pieces.append("<style>/* %s */\n%s\n</style>" % (href.group(1), css))
        return ""

    html = SCRIPT_RE.sub(take_script, html)
    html = LINK_RE.sub(take_link, html)
    return html, "\n".join(pieces)


def build(name, snapshot=None, outdir=None):
    print("  " + name)
    html = read(name)
    warn = []

    html, hoisted = collect(html, warn)

    # React must be defined before support.js runs; loadReactUmd() then
    # short-circuits and unpkg.com is never contacted.
    react = []
    for lib, fname in (("React", "vendor/react.production.min.js"),
                       ("ReactDOM", "vendor/react-dom.production.min.js")):
        try:
            react.append("<script>/* %s 18.3.1 (vendored) */\n%s\n</script>" % (lib, guard(read(fname))))
        except OSError:
            warn.append("%s missing (%s) - the copy will need internet to boot" % (lib, fname))

    extra = []
    try:
        extra.append('<script>window.__resources=window.__resources||{};'
                     'window.__resources.meLogo="%s";</script>' % data_uri("assets/me-white.png"))
    except OSError:
        warn.append("assets/me-white.png not found - logo will be blank")

    note = ""
    if snapshot:
        with open(snapshot, "r", encoding="utf-8") as f:
            snap = f.read()
        extra.append("<script>window.__QA_EMBEDDED_SNAPSHOT=" + guard(snap) + ";</script>")
        note = " · snapshot embedded from " + os.path.basename(snapshot)
        print("    embedded snapshot: %.1f MB" % (len(snap) / 1048576.0))

    stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    banner = ("<!-- STANDALONE OFFLINE COPY - built %s%s\n"
              "     Self-contained: every script, stylesheet, font, image and React\n"
              "     itself is inlined. Needs no web server and no internet.\n"
              "     Online it still reads live figures from the Google Sheet. -->" % (stamp, note))

    head_block = "\n".join([banner] + react + extra + [hoisted])
    if "<head>" not in html:
        warn.append("no <head> found - cannot hoist dependencies")
    html = html.replace("<head>", "<head>\n" + head_block, 1)

    out = os.path.join(outdir or ROOT, os.path.splitext(name)[0] + "-standalone.html")
    if os.path.dirname(out):
        os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)

    leftover = len([u for u in SRC_RE.findall(html) if not is_remote(u)]) \
             + len([m for m in LINK_RE.finditer(html)
                    if "stylesheet" in m.group(0).lower()
                    and (HREF_RE.search(m.group(0)) and not is_remote(HREF_RE.search(m.group(0)).group(1)))])
    for w in warn:
        print("    ! " + w)
    print("    -> %s  (%.1f MB, %d unresolved local reference%s)"
          % (os.path.basename(out), os.path.getsize(out) / 1048576.0,
             leftover, "" if leftover == 1 else "s"))
    return out, leftover + len(warn)


def main():
    ap = argparse.ArgumentParser(description="Build single-file offline copies of the dashboards.")
    ap.add_argument("files", nargs="*", help="which dashboards (default: all three)")
    ap.add_argument("--data", help="snapshot JSON to embed (e.g. data/current.json)")
    ap.add_argument("--out", help="output folder (default: repo root)")
    a = ap.parse_args()

    if a.data and not os.path.exists(a.data):
        sys.exit("snapshot not found: " + a.data)
    print("Building standalone dashboards" + (" with embedded snapshot" if a.data else " (bundled fallback data)"))
    problems = 0
    for t in (a.files or DASHBOARDS):
        if not os.path.exists(os.path.join(ROOT, t)):
            print("  ! skipping missing file: " + t); problems += 1; continue
        problems += build(t, a.data, a.out)[1]
    print("Done." if not problems else "Done, with %d issue(s) above." % problems)


if __name__ == "__main__":
    main()
