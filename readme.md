# MarginEdge Design System

A brand + product design system for **MarginEdge** — restaurant management software that turns invoices, POS and accounting data into real-time cost reporting. Abbreviated **[me]** (lowercase, in brackets — always).

> *"Made by restaurateurs, for restaurateurs."* MarginEdge digitizes invoices in 24–48 hrs, pulls sales nightly from the POS, and gives operators a daily controllable P&L, inventory, recipe costing, ordering and budgeting — so they can get out of the back office and back onto the floor.

---

## Sources this system was built from
All under `uploads/` (extracted copies + rendered assets in `research/`). No codebase or Figma was provided — the system is derived from brand + sales collateral:

- **ME-Style-Guidelines-04_2022** — the official brand guide (logos, color, type, graphic styles, photography). Primary source of truth.
- **Sales Builder Deck U.S. 2026**, **Demo IDR Deck**, **Proposal Template** — product copy, pricing, feature lists, testimonials, product/lifestyle photography, client logos.
- **Multi-unit Reporting**, **Burger21 case study**, **Professional Services / Theoreticals / Franchisor** one-pagers, **marketing emails** — tone, terminology, feature framing.
- **TOC slide.jpg** — reference for the agenda/section slide treatment.

Brand contact (from the guide): Jessie Leiber, Creative Director — jessie@marginedge.com.

---

## CONTENT FUNDAMENTALS — how MarginEdge writes

**Voice: warm, plain-spoken, restaurant-insider, lightly funny.** They are operators talking to operators, never a faceless SaaS vendor.

- **Person:** Second person ("you", "your restaurant"), first-person plural for the company ("we", "our team"). "We are restaurant people."
- **Tone:** Confident and reassuring, with dry humor. Headlines have swagger ("Inventories that don't suck (as much).", "Invoices tell the story."). Body copy is direct and benefit-led.
- **Casing:** Sentence case for headlines and UI. `MarginEdge` is **one word, two capitals** — never "Margin Edge", "Marginedge", "margin edge". Abbreviate only as **[me]** (lowercase, bracketed) — never `[ME]`, `ME`, or `me`.
- **Punchy value framing:** lead with the pain, resolve with the product. "Get your final P&L in days, not weeks." "No surprises at the end of the month." "With none of the data entry."
- **Humans, not bots:** support is a point of pride — "real, live humans (no support bots here!)".
- **Emoji:** not used in brand copy. Checkmarks (✓) appear in feature/pricing lists; the brand's own hand-drawn check is preferred where legibility allows.
- **Playful internal naming:** the color palette has joke names (see below) — a good tell for the brand's personality, though these stay internal.

Representative lines: *"Where hospitality meets technology." · "It all starts with a picture." · "Crumpled up, annoying paperwork no more." · "Let [me] help you get out of the back office and back onto the floor."*

---

## VISUAL FOUNDATIONS

**Color.** Cool, confident **[me] blue `#0072ce`** is the hero — "if you use only one color, [me] blue should be it." Paired with **forgot-a-timer black `#282827`** and white. Warm secondaries (**persimmon `#f06246`**, **honey `#faaa41`**) evoke "cooking over an open flame" and stay supportive — never the star. Additional colors (**chartreuse `#dbe442`**, **teal/bon-appeteal `#00c7b1`**, **ube `#981d97`**) are reserved for data-viz, notifications and accents. Full 50→900 tint/shade ramps live in `tokens/colors.css`. In reporting, **teal = favorable/under budget**, **persimmon = unfavorable/over budget**.

**Type.** Two sans families. **Obviously** (wide, confident) for headlines; **Proxima Nova** for everything else. Neither is web-licensed here, so the system substitutes **Archivo** (display) and **Montserrat** (body — the brand's own documented free alternative). Display is set heavy (800–900), tight tracking, sentence case. Eyebrows are wide-tracked uppercase blue kickers. Numbers use tabular figures for reports.

**Layout & backgrounds.** Clean, generous whitespace. App canvas is a faint cool-blue tint (`--surface-page`). Slides alternate between full-bleed photography, solid [me]-blue section headers, and dark charcoal. The brand explicitly discourages "stark white" — sprinkle in **concrete/paper texture** (`assets/textures/concrete.png`) for warmth, "a little goes a long way."

**The signature motif: "knife cuts."** A dynamic company that "stands out from the crowd" — so rectangles get *trimmed / angled edges* to create interest and point toward a CTA. Implemented as `--clip-cut-br` / `--clip-cut-tr` / `--clip-slash` clip-paths and used on slide panels and featured cards. (The guide also shows literal torn-paper edges; where a torn asset isn't available, the clean knife-cut diagonal is the on-brand stand-in.)

**Handwritten graphics.** Because restaurants still live on pen-and-paper, the brand layers in **hand-drawn scribbles** — checkmarks, circles, sparkles/asterisks (`assets/scribbles/`) — as subtle, human background decoration. Never redraw these; use the raster assets.

**Corners, borders, shadows.** Friendly-but-not-bubbly radii (cards `16px`, controls `10px`, chips pill). Hairline `#e5e5e5` borders. Soft, cool-tinted functional shadows (`--shadow-xs…lg`); a blue glow (`--shadow-brand`) for hero CTAs. Focus = 3px blue ring.

**Motion.** Gentle and quick — 120–320ms, standard/ease-out curves, opacity + small translate. No bounces, no infinite decorative loops.

**Interaction states.** Hover: primary darkens (`--blue-700`), subtle surfaces tint blue-50; press: 1px nudge down. Toggles/checks fill [me] blue when active.

**Photography.** Real client kitchens, food, and hardware (Freepour smart scale) — warm, natural light, candid. "The use of stock imagery is highly discouraged." White logo over photos.

---

## ICONOGRAPHY

MarginEdge uses **thin, single-weight line icons** (see the real support-headset glyph in `assets/icons/support-headset.png`). No built-in icon font or SVG sprite was available in the source files.

- **Substitute (flagged):** the UI kit and components use **[Lucide](https://lucide.dev)** — thin, rounded-cap strokes that match the brand's line-icon style. Shared set in `ui_kits/web-app/icons.jsx` (`window.MEIcons`); load Lucide from CDN in production. Replace with MarginEdge's own icon set when available.
- **Hand-drawn elements** (checkmarks, circles, sparkles) are a distinct brand device — raster assets in `assets/scribbles/`, used decoratively, not as functional UI icons.
- **Emoji:** not used. Feature lists use `✓`; prefer the hand-drawn blue check (`assets/scribbles/check-blue.png`) on brand surfaces.
- **Unicode** triangles (▲▼) denote variance direction in KPI chips.

---

## Foundations
- `styles.css` — the single entry point consumers link. `@import`s everything below.
- `tokens/fonts.css` — webfont loading + the Obviously/Proxima Nova substitution note.
- `tokens/colors.css` — brand core, secondary, additional, full 50→900 ramps, semantic aliases.
- `tokens/typography.css` — families, weights, sizes, line-heights, `.me-eyebrow/.me-display/.me-heading/.me-body/.me-num` roles.
- `tokens/spacing.css` — 4px grid, containers, app-chrome + slide dimensions.
- `tokens/effects.css` — radii, borders, shadows, knife-cut clip-paths, motion.

Specimen cards (Design System tab) live in `guidelines/foundations/` — grouped **Colors, Type, Spacing, Brand**.

---

## Components (`components/`, namespace `window.MarginEdgeDesignSystem_e6ce8f`)

**forms/** — `Button`, `IconButton`, `TextField`, `Select`, `Checkbox`, `Radio`, `Switch`
**data/** — `Card`, `StatTile`, `Badge`, `DataTable`
**feedback/** — `Dialog`, `Toast`, `Tooltip`
**navigation/** — `Tabs`, `SidebarNav`

Each has a `.jsx` implementation, a `.d.ts` props contract, a `.prompt.md` usage note, and every directory has one `@dsCard` demo HTML. All styling references CSS custom properties — no CSS-in-JS libs, React only.

*No formal component library existed in the source (brand + sales collateral only), so this is a standard product set sized to MarginEdge's needs. `StatTile` and `DataTable` are deliberately reporting-first (tabular numbers, favorable/unfavorable variance coloring) to match the product's core job.*

---

## UI kits (`ui_kits/`)
- **web-app/** — high-fidelity recreation of the MarginEdge back-office web app: `DashboardScreen`, `InvoicesScreen`, `ProfitLossScreen`, `InventoryScreen`, in an `AppShell` (dark sidebar + top bar). `index.html` is an interactive click-through. See its README for the fidelity note.

## Slides (`slides/`)
Sample deck slides matching the sales-deck style — `title`, `agenda`, `section`, `content`, `quote`, `stat`, `clients`, `pricing`. 1280×720, using the logo, photography, scribbles and knife-cut motif.

## Assets (`assets/`)
`logos/` (2-color + white [me] stacked), `clients/` (maman, Clyde's, Chef Geoff's), `icons/` (support glyph), `scribbles/` (checks, circles, sparkles), `textures/` (concrete), `photos/` (Freepour smart scale).

---

## Caveats
- **Fonts are substitutes.** Obviously → Archivo, Proxima Nova → Montserrat. Provide the licensed `.woff2` files to go pixel-accurate.
- **No horizontal / acronym-only logo, no partner "powered-by" lockups** were extractable — only the 2-color and white **stacked** logos (169×135, small). Larger uses will be slightly soft; provide vector logo files.
- **UI kit is reconstructed** from copy + marketing screenshots, not clean in-app captures. Confirm exact spacing/labels against the live product.
- **Icons are Lucide** (substitute) — swap in MarginEdge's own set when available.
