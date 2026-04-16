# Under Fire — Handoff
_Last updated: 2026-04-02_

## What We're Building
"Under Fire" is a public-interest data visualisation website tracking rocket, missile, and drone alerts across Israel from 2020 to present. Built by Alfie Rees as a data science project. Single-page scrollytelling site with 7 chapters of interactive D3.js + Leaflet visualisations, deployed on GitHub Pages.

## Current State — ACTIVE BUILD
The full single-page site is now built and all real data is wired in.

**What's complete:**
- `index.html` — Full 1,126-line scrollytelling site with all 7 chapters built and functional
- `data/raw/` — Original JSON files from RocketAlert.live (data1.json, data2.json)
- `data/processed/` — All cleaned and pre-computed data files ready for the frontend:
  - `alerts_clean.csv` — 142,837 rows, for Alfie's EDA (open in Excel/Sheets)
  - `alerts_clean.json` — Full flat data (54MB, for offline analysis only)
  - `stats_summary.json` — Headline stats (0.4KB)
  - `timeline_weekly.json` — 177 weeks of weekly totals (10KB)
  - `oct7_replay.json` — 4,000 Oct 7 alerts with second-level timestamps (386KB)
  - `actors_monthly.json` — Monthly breakdown by actor (3KB)
  - `hourly_dow.json` — Hourly + day-of-week distributions (2KB)
  - `areas_summary.json` — Per-area stats for 30 regions (9KB)
  - `shower_probs.json` — Pre-computed Poisson probabilities (10KB)
- `src/css/style.css` — Design system CSS (reference, styles are now inline in index.html)
- `scripts/` — oref_scraper.py, backfill.py (for future live data updates)
- `archive/` — Old placeholder pages and ACLED scripts (kept for reference)

## The 7 Chapters
1. **Hero Counter** — Animated count to 142,837, 3 headline stats
2. **Six Years of Alerts** — D3 area chart, weekly totals 2020–2026, Oct 7 annotated
3. **October 7 Replay** — Leaflet map, animated 4,000 alerts, play/pause/reset controls
4. **The Four Fronts** — D3 stacked area by actor (Iran/Hezbollah/Houthis/Hamas)
5. **Patterns** — D3 24h polar clock + day-of-week horizontal bars
6. **Area Vulnerability** — D3 horizontal bar leaderboard, 30 regions
7. **What Are the Odds?** — Poisson probability widget (region × activity) + Scale section

## Known Issues / Next Steps
- **To view locally:** Must run a local HTTP server — fetch() won't work over file://
  ```
  cd "Interactive missile website"
  python3 -m http.server 8000
  # then open http://localhost:8000
  ```
- **To deploy:** Push entire folder to a GitHub repo, enable GitHub Pages (Settings → Pages → main/root). That's it.
- **Responsive:** Basic mobile responsiveness is in — could be further refined on small screens
- **Future:** Could add a GitHub Actions workflow to update data periodically via oref_scraper.py

## Data Notes
- **Total alerts:** 142,837 (Jan 2020 – Mar 2026)
- **data1.json:** 8,329 alerts, Jan 2020–Jul 2023, no origin attribution
- **data2.json:** 134,508 alerts, Oct 2023–Mar 2026, with origin attribution
- **Origin breakdown:** Iran 82,288 / Hezbollah 29,950 / Houthis 13,022 / Hamas 8,981 / Unknown 8,596
- **Credit required:** Data from RocketAlert.live — credited in site footer
- Origin field is an *estimated* attribution based on location + timestamp

## Design System
- Background: `#07070a`, Surface: `#0f0f14`, Accent gold: `#e8b84b`, Red: `#d63031`, Blue: `#4a9eff`
- Fonts: Playfair Display (headings, 900), IBM Plex Mono (labels/data), IBM Plex Sans (body 300)
- Actor colours: Iran `#c678dd`, Hezbollah `#f39c12`, Houthis `#4a9eff`, Hamas `#d63031`

## Decisions Made
- **Single scrollytelling page** — not multi-page hub. Better narrative flow.
- **Pre-computed data files** — 7 small JSON files (<400KB each) loaded lazily per section. The 54MB full dataset never loads in browser.
- **Option A + C interactive** — "What Are the Odds?" Poisson widget + scale cards at bottom
- **Neutral framing** — purely data-driven, no political commentary
- **RocketAlert.live data** — used instead of OREF scraper (complete, clean, with origin attribution)
