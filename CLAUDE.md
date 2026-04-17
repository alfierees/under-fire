# Under Fire — Working Notes for Claude

## Project overview
Data-vis site about rocket/missile/drone alerts over Israel (2020–2026). Static — no build step. Python (offline EDA) → JSON in `data/processed/` → HTML pages using D3 + Leaflet.

## Site structure (as of v3 overhaul — 2026-04-17)
- `index.html` — hero (Iron Dome canvas + hero-bg.jpg + "UNDER FIRE" title) + card grid: **Graphs** (3), **Maps** (2), **Patterns** (2), **Stats** (1).
- `timeline.html` — Six Years area chart. Code-runner UI, actor filter, salvo overlay on click.
- `fronts.html` — Four Fronts **stacked monthly bars**, each actor layer grows from zero (attrTween). Code-runner UI, auto-plays on scroll-into-view.
- `calendar.html` — Daily heatmap (GitHub-contributions style). One cell = one day 2020–present.
- `oct7.html`, `patterns.html`, `areas.html` — individual chart pages.
- `patterns.html` — 24h polar clock (concentric actor rings + sweep reveal), weekday bar, actor×hour heatmap, code-runner UI.
- `arcs.html` — Schematic arcs from Gaza/Lebanon/Iran/Yemen into Israel. Width = attributed share. Toggle all-time/Oct 7.
- `records.html` — Records & extremes: busiest day/hour, longest quiet streak, biggest area spike, Oct 7 minute-by-minute bars.
- `src/css/shared.css` — tokens, nav, tooltip, footer, code-runner, filter bar.
- `src/css/hub.css` — hero + card grid (index only).
- `src/js/shared.js` — `fetchData`, tooltip helpers, nav-badge boot.
- `src/js/iron-dome.js` — hero canvas animation (index only).
- `src/js/code-runner.js` — `mountCodeRunner({ mount, file, lines, onRun })`. Press `Enter` or click `▶ Run`.
- `src/js/salvo.js` — `mountSalvo({ mount }).fire({ count, label })` — missile-arc overlay scaled by alert count, capped at 80 missiles.
- `src/js/hub.js` — card sparkline previews.

## Running locally
```
python3 -m http.server 8000
```
Always open via `http://localhost:8000` — `file://` blocks `fetch()`.

## Git workflow — sync before editing
This project is edited both locally and in the cloud (Claude Code on web). Files drift easily.

**Rule: always sync before starting work.**

```
./scripts/sync.sh              # pulls + rebases current branch, shows status
./scripts/sync.sh main         # switch to main first
```

A SessionStart hook in `.claude/settings.json` runs `git fetch` automatically and warns you if the branch is behind origin. That's early warning — still run `sync.sh` before you start typing changes.

Before pushing: run the local server and click through `index.html` → each card → each chart at least once. Pushes to any branch on `origin` are live on GitHub immediately; the `main` branch auto-deploys to GitHub Pages.

## Animation decisions
- Timeline reveal: **10s** left-to-right clip-rect sweep via code-runner `onRun`.
- Fronts reveal: per-actor stacked bars grow from zero, **1200ms each, staggered 450ms**. Auto-plays on IntersectionObserver.
- Patterns clock: sweep hand **2.2s**, wedges fade in as hand passes. 10am flare.
- Salvo animation cap: **80 missiles max**; label shows raw count only (no "N shown").
- Hero background: `images/hero-bg.jpg` — CSS path is `url('../../images/hero-bg.jpg')` (relative to `src/css/hub.css`).

## Data files (small aggregates, committed)
Files in `data/processed/`. Large raw data is gitignored. Regenerate with `python3 scripts/generate_extra_aggregates.py`.
- `stats_summary.json` — totals & origin breakdown.
- `timeline_weekly.json` — weekly totals (Hamas, Hezbollah, Houthis, Iran, Unknown, total, week).
- `actors_monthly.json` — monthly per-actor totals.
- `daily_counts.json` — per-day counts derived from weekly × day-of-week distribution.
- `oct7_replay.json` — every Oct 7 alert with `{ ts, lat, lon }`.
- `hourly_dow.json` — `{ hourly: [...], day_of_week: [...] }` with per-actor hourly counts.
- `actor_hour.json` — flat `{ actor, hour, count }` for patterns heatmap.
- `areas_summary.json` — per-region totals.
- `records.json` — precomputed extremes (busiest day/hour, longest quiet, biggest area spike).

## Not yet done (future work)
See `HANDOFF.md`. Next candidates: zoomable timeline, code-runner on oct7/areas, mobile particle-count tweak.
