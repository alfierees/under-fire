# Under Fire — Working Notes for Claude

## Project overview
Data-vis site about rocket/missile/drone alerts over Israel (2020–2026). Static — no build step. Python (offline EDA) → JSON in `data/processed/` → HTML pages using D3 + Leaflet.

## Site structure (as of v2 "card hub" refactor)
- `index.html` — hero (Iron Dome canvas + "UNDER FIRE" title) + card grid, grouped into four categories: **Graphs**, **Maps**, **Patterns**, **Stats**.
- `timeline.html` — Six Years area chart. Has code-runner UI, actor filter, salvo overlay on click.
- `fronts.html` — Four Fronts stacked area. Has code-runner UI.
- `oct7.html`, `patterns.html`, `areas.html`, `odds.html` — individual chart pages.
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
- Timeline/Fronts reveal: **10s** left-to-right clip-rect sweep, triggered by the code-runner's `onRun` callback.
- Re-drawing (e.g. actor filter change) uses a shorter 2s reveal.
- Salvo animation cap: **80 missiles max** regardless of raw alert count; label shows both raw count and shown count.

## Data files (small aggregates, committed)
Files in `data/processed/`. Large raw data is gitignored.
- `stats_summary.json` — totals & origin breakdown.
- `timeline_weekly.json` — weekly totals with per-actor breakdown (columns: Hamas, Hezbollah, Houthis, Iran, Unknown, total, week).
- `actors_monthly.json` — monthly per-actor totals.
- `oct7_replay.json` — every Oct 7 alert with `{ ts, lat, lon }`.
- `hourly_dow.json` — { hourly: [...], day_of_week: [...] }.
- `areas_summary.json` — per-region totals.
- `shower_probs.json` — precomputed Poisson probabilities per region × activity.

## Not yet done (future work)
See `HANDOFF.md` for the full list. Next candidates: zoomable timeline, actor filter memorising selection across pages, mobile particle-count tweak for the hero animation.
