# Under Fire

**Patterns in rocket, missile, and drone attacks on Israel — an interactive data journalism project.**

Six years of alert data (2020–2026), visualised across eight pages: timelines, heatmaps, geographic arcs, and records. Built to make the scale and rhythm of the conflict legible.

---

## Live site

**[alfierees.github.io/under-fire](https://alfierees.github.io/under-fire)**

Deployed automatically from the `main` branch via GitHub Pages. Any push to `main` goes live within a minute or two.

---

## Running locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` — use `http://`, not `file://`, as the pages load data via `fetch()`.

---

## Architecture

Static site — no build step, no server, no database.

```
Python scripts (offline)
    │  process raw alert data
    ▼
data/processed/*.json   ← pre-aggregated, committed to the repo
    │  fetched at page load
    ▼
HTML + D3 + Leaflet pages
```

---

## Scripts

All in `scripts/`. Run from the repo root.

| Script | What it does |
|--------|-------------|
| `generate_extra_aggregates.py` | Rebuilds all JSON files in `data/processed/` — run this after changing source data |
| `generate_story_chapters.py` | Regenerates the scroll-driven story map chapter data |
| `oref_scraper.py` | Fetches raw alert data from the OREF API |
| `backfill.py` | Historical data backfill |
| `sync.sh` | Pulls latest from origin and rebases — run before starting any edits |

To update what the website shows, edit the source data and then run `generate_extra_aggregates.py` to regenerate the JSON files.

---

## File structure

```
index.html                    ← Homepage (hero + card grid)
timeline.html                 ← Six-year area chart
fronts.html                   ← Stacked monthly bars by actor
calendar.html                 ← Daily heatmap (2020–present)
patterns.html                 ← 24h polar clock + weekday + heatmap
arcs.html                     ← Schematic arcs from each origin
records.html                  ← Records & extremes
oct7.html                     ← Oct 7 minute-by-minute replay
data/processed/               ← Pre-aggregated JSON (source of truth for charts)
scripts/                      ← Data pipeline
src/css/                      ← Shared + page-specific styles
src/js/                       ← Shared utilities + page scripts
images/                       ← Static assets
```

---

## Sync before editing

This repo is edited both locally and via Claude Code on the web. Always pull before starting work:

```bash
./scripts/sync.sh
```
