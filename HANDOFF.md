# Under Fire — Handoff
_Last updated: 2026-04-17 (late session — graphs/maps/patterns/stats overhaul)_

## What We're Building
"Under Fire" is a public-interest data visualisation website tracking rocket, missile, and drone alerts across Israel from 2020 to present. Built by Alfie Rees as a data science project. Multi-page card hub with 9 interactive D3.js + Leaflet visualisations, deployed on GitHub Pages.

## Repository
**GitHub:** https://github.com/alfierees/under-fire  
**Deploy:** GitHub Pages (Settings → Pages → main branch / root). Fully static — no build step needed.  
**Local dev:** `python3 -m http.server 8000` then open `http://localhost:8000`

> **Important:** Never open `index.html` directly via `file://` — the browser blocks `fetch()` and no charts will load. Always use the local server.

---

## Current State — LIVE BUILD (v2 Card Hub)

### Site structure
- `index.html` — **Hero** (Iron Dome canvas animation over `images/hero-bg.jpg` + "UNDER FIRE" gradient title + animated counters) + **card grid** with 4 categories. Each card has a live D3 sparkline preview and links to a dedicated page.
- `timeline.html` — Six Years area chart. Has code-runner pseudo-code UI (press Enter/▶ Run to execute), actor filter (All / Hamas / Hezbollah / Houthis / Iran / Unattributed), and salvo overlay on week-click.
- `fronts.html` — Four Fronts **stacked monthly bars** by actor. Each actor layer grows from zero (staggered attrTween). Code-runner UI; auto-plays on scroll-into-view.
- `calendar.html` — GitHub-contributions-style daily heatmap. One cell per day, Jan 2020 → present. Log-scale colour ramp black → red.
- `oct7.html` — Oct 7 Leaflet replay map. Play/pause/reset controls.
- `patterns.html` — 24h polar clock (per-actor concentric rings + animated sweep reveal + 10am flare), day-of-week bar chart, and a 4×24 "who attacks when" actor × hour heatmap. Code-runner UI.
- `areas.html` — Area vulnerability horizontal bar leaderboard.
- `arcs.html` — Schematic "Four Sources, One Target" map. Animated arcs from Gaza, Lebanon, Iran, Yemen into a central target, widths scaled by attributed alert totals. Toggle between all-time / since Oct 7.
- `records.html` — Records & extremes board: busiest day, busiest hour, longest quiet streak, biggest single-area spike, plus the Oct 7 peak day plotted minute by minute.

### Shared files
| File | Purpose |
|------|---------|
| `src/css/shared.css` | Design tokens, nav, tooltip, footer, code-runner styles, filter bar |
| `src/css/hub.css` | Hero + card grid (index.html only) |
| `src/js/shared.js` | `fetchData()`, tooltip helpers, nav-badge boot |
| `src/js/iron-dome.js` | Hero canvas animation (index.html only) |
| `src/js/hub.js` | Hero counters + card sparkline preview renderers |
| `src/js/code-runner.js` | `mountCodeRunner({ mount, file, lines, onRun })` |
| `src/js/salvo.js` | `mountSalvo({ mount }).fire({ count, label })` |

### What's complete and working
- Iron Dome hero animation on landing page with photo background (`images/hero-bg.jpg` — path is relative to the CSS file, so `url('../../images/hero-bg.jpg')`)
- "UNDER FIRE" gradient title
- Card hub with 4 categories (Graphs ×3 / Maps ×2 / Patterns ×2 / Stats ×1) and sparkline previews
- Timeline page: 10s left-to-right reveal, actor filter, salvo overlay on click
- Fronts page: per-actor stacked bars, each layer grows from zero, staggered by actor; auto-plays on scroll-into-view and re-runnable via the code-runner
- Calendar heatmap: daily grid 2020 → present, derived from weekly totals × day-of-week distribution
- Patterns page: clock 00:00 now correctly at 12 o'clock; concentric actor rings; sweep-hand reveal with 10am flare; weekday bar with grow-from-zero; 4×24 actor × hour heatmap
- Arcs page: schematic SVG of Israel with four animated origin arcs (dash-offset draw-in) pulsing source dots, toggle all-time/Oct 7
- Records page: four record cards + Oct 7 minute-by-minute bars
- Salvo label reads "N alerts" (no more "(M shown)" parenthetical)
- Nav bar across all pages (Timeline / Oct 7 / Fronts / Calendar / Patterns / By Area / Arcs / Records)
- Sync workflow: `scripts/sync.sh` + SessionStart hook + `CLAUDE.md`

### Data files in repo (small processed aggregates only)
The 9 JSON files in `data/processed/` (~500KB total). Raw data is **gitignored**.
- `stats_summary.json` — totals & origin breakdown
- `timeline_weekly.json` — weekly totals with per-actor columns (Hamas, Hezbollah, Houthis, Iran, Unknown, total, week)
- `actors_monthly.json` — monthly per-actor totals
- `daily_counts.json` — per-day alert counts 2020-01-06 → 2026-03-29 (derived: weekly total × day-of-week distribution)
- `oct7_replay.json` — every Oct 7 alert with `{ ts, lat, lon }`
- `hourly_dow.json` — `{ hourly: [...], day_of_week: [...] }`
- `actor_hour.json` — flattened `{ actor, hour, count }` for the patterns heatmap
- `areas_summary.json` — per-region totals
- `records.json` — precomputed extremes (busiest day/hour, longest quiet streak, biggest single-area spike)
- `shower_probs.json` — legacy Poisson probabilities (page retired; file kept for archival)

Regenerate aggregates with `python3 scripts/generate_extra_aggregates.py`.

---

## Design System
- **Background:** `#07070a` · **Surface:** `#0f0f14` · **Surface2:** `#16161e`
- **Accent gold:** `#e8b84b` · **Red:** `#d63031` · **Blue:** `#4a9eff` · **Purple:** `#c678dd`
- **Fonts:** Playfair Display (headings, weight 900), IBM Plex Mono (labels/data), IBM Plex Sans (body weight 300)
- **Actor colours:** Iran `#c678dd` · Hezbollah `#f39c12` · Houthis `#4a9eff` · Hamas `#d63031`
- **Iron Dome palette:** Interceptors `#4a9eff` · Missiles `#d63031` · Explosions `#e8b84b` → white core

## Decisions Made
- **Multi-page card hub** — index is hero + cards, each chart has its own page with nav. Better for adding new charts independently.
- **Code-runner UI** — pseudo-code "terminal" on timeline and fronts pages. User presses Enter/Run; lines type out, then 10s reveal animation plays. Non-technical readable language.
- **Salvo cap at 80 missiles** — raw alert count is scaled via `sqrt * 1.8`, capped at 80. Label shows raw count and displayed count. Oct 7-sized spikes stay readable.
- **Actor filter re-renders at 2s** — first reveal is 10s (the wow moment), filter changes use 2s (snappy response).
- **Pre-computed data files** — 7 small JSON files. The 54MB full dataset never loads in browser.
- **Neutral framing** — purely data-driven, no political commentary.
- **RocketAlert.live data** — complete, clean, with origin attribution.

---

## Git Workflow
This project is edited both locally and in the cloud. **Always sync before editing.**

```bash
./scripts/sync.sh          # pull + rebase current branch, auto-stash dirty changes
./scripts/sync.sh main     # switch to main first, then sync
```

A SessionStart hook in `.claude/settings.json` auto-fetches and warns if the branch is behind origin.

**Version tags (local):**
- `v1-scrollytelling` → commit `53d18d1` — original single-page scrollytelling build
- `v2-card-hub` → current HEAD — multi-page card hub refactor

---

## Data Notes
- **Total alerts:** 142,837 (Jan 2020 – Mar 2026)
- **Origin breakdown:** Iran 82,288 / Hezbollah 29,950 / Houthis 13,022 / Hamas 8,981 / Unknown 8,596
- Origin field is an *estimated* attribution based on location + timestamp
- **Credit required:** Data from RocketAlert.live — credited in site footer

---

## Ideas for Future Updates

### 🎯 More Iron Dome-style interactive animations

**Live interception counter** — A running tally in the corner of the hero that counts how many "interceptions" the animation has performed since page load.

**Threat direction compass** — An animated radar-style circle showing which cardinal directions alerts originated from (North = Hezbollah/Lebanon, South = Hamas/Gaza, East = Iran ballistic, West = Houthis/sea).

**Iron Dome battery map** — A schematic map of Israel with the real Iron Dome battery positions as glowing blue dots. When the Oct 7 replay plays, show interception arcs firing from the nearest battery.

---

### 📊 Chart enhancements

**Zoomable timeline** — Click-drag to zoom into any time window on the Six Years chart. Useful for isolating specific operations (e.g. Guardian of the Walls, May 2021).

**Region comparison** — Select two regions from the Area Vulnerability chart and see a side-by-side breakdown of their alert profiles.

**Code-runner on remaining pages** — Extend the pseudo-code execution UI to `oct7.html` and `areas.html`. (Patterns and Fronts now have it.)

---

### 🗺️ Map features

**Persistent dot map** — A static Leaflet layer showing all 142,837 alerts as tiny dots coloured by actor. Add a time slider to filter by year. (Threat-origin arcs landed instead this session; dot map still open.)

**Animated "spread" replay** — Show how the geographic envelope of attacks expanded over time — starting from Gaza in 2020, then northern border in 2023, then national coverage post-Oct 7.

---

### 🔢 Data & interactivity

**Live data toggle** — Connect `oref_scraper.py` to a GitHub Actions schedule. Show a "last updated" badge.

**Download / share** — Let users download the current chart view as a PNG or copy a shareable link.

---

### ✨ Polish & UX

**Mobile-first pass** — Proper mobile layout: stack patterns grid, enlarge map touch targets, reduce Iron Dome particle count on low-powered devices.

**Dark/light mode** — Light mode with pale cream background, same typography and data colours.

---

## Starting a New Session
When picking this up in Claude Code:
1. Run `./scripts/sync.sh` to pull latest before touching anything
2. Run `python3 -m http.server 8000` and open `http://localhost:8000`
3. Click through `index.html` → each card → each chart to verify nothing is broken
4. Read `CLAUDE.md` for the condensed working notes
5. Commit and push when done — GitHub Pages auto-deploys on push to `main`
