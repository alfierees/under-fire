# Under Fire — Handoff
_Last updated: 2026-04-16_

## What We're Building
"Under Fire" is a public-interest data visualisation website tracking rocket, missile, and drone alerts across Israel from 2020 to present. Built by Alfie Rees as a data science project. Single-page scrollytelling site with 7 chapters of interactive D3.js + Leaflet visualisations, deployed on GitHub Pages.

## Repository
**GitHub:** https://github.com/alfierees/under-fire  
**Deploy:** GitHub Pages (Settings → Pages → main branch / root). Fully static — no build step needed.  
**Local dev:** `python3 -m http.server 8000` then open `http://localhost:8000`

> **Important:** Never open `index.html` directly via `file://` — the browser blocks `fetch()` and no charts will load. Always use the local server.

---

## Current State — LIVE BUILD

### What's complete
- `index.html` — Full single-page scrollytelling site, ~1,300 lines, all 7 chapters built and functional
- **Iron Dome hero animation** — Canvas-based animation of missile arcs being intercepted mid-air. Missiles (red) arc from screen edges, Iron Dome interceptors (blue) rise from city battery positions, gold/white explosions at interception points. Stars, city silhouette, and battery glow halos. Runs continuously in the hero background.
- **Gradient hero title** — "UNDER FIRE" styled with a blue→gold→red gradient matching the interceptor/explosion/missile colour palette
- All charts lazy-load via `IntersectionObserver` when each section scrolls into view

### The 7 Chapters
| # | Section | Chart type | Data file |
|---|---------|-----------|-----------|
| 1 | Hero Counter | Animated counters | `stats_summary.json` |
| 2 | Six Years of Alerts | D3 area chart, weekly totals | `timeline_weekly.json` |
| 3 | October 7 Replay | Leaflet map, animated 4,000 alerts | `oct7_replay.json` |
| 4 | The Four Fronts | D3 stacked area by actor | `actors_monthly.json` |
| 5 | Patterns | D3 24h polar clock + day-of-week bars | `hourly_dow.json` |
| 6 | Area Vulnerability | D3 horizontal bar leaderboard | `areas_summary.json` |
| 7 | What Are the Odds? | Poisson probability widget | `shower_probs.json` |

### Data files in repo (small processed aggregates only)
The 7 JSON files in `data/processed/` that the website uses are committed (~440KB total). Raw alert records and full dataset are **gitignored** and stored locally only:
- `data/raw/` — original JSON from RocketAlert.live (gitignored)
- `data/processed/alerts_clean.json` — full 54MB flat file (gitignored, for EDA only)
- `data/processed/alerts_clean.csv/.xlsx` — same, gitignored

---

## Design System
- **Background:** `#07070a` · **Surface:** `#0f0f14` · **Surface2:** `#16161e`
- **Accent gold:** `#e8b84b` · **Red:** `#d63031` · **Blue:** `#4a9eff` · **Purple:** `#c678dd`
- **Fonts:** Playfair Display (headings, weight 900), IBM Plex Mono (labels/data), IBM Plex Sans (body weight 300)
- **Actor colours:** Iran `#c678dd` · Hezbollah `#f39c12` · Houthis `#4a9eff` · Hamas `#d63031`
- **Iron Dome palette:** Interceptors `#4a9eff` (blue) · Missiles `#d63031` (red) · Explosions `#e8b84b` (gold) → white core

## Decisions Made
- **Single scrollytelling page** — not multi-page hub. Better narrative flow.
- **Pre-computed data files** — 7 small JSON files loaded lazily per section. The 54MB full dataset never loads in browser.
- **Canvas-based Iron Dome animation** — uses `requestAnimationFrame` + quadratic Bezier curves. No external animation library needed beyond GSAP (already loaded for scroll entrances).
- **IntersectionObserver lazy loading** — all charts use `threshold: 0.05, rootMargin: '0px 0px -80px 0px'` to trigger just before section enters view.
- **Neutral framing** — purely data-driven, no political commentary.
- **RocketAlert.live data** — used instead of OREF scraper (complete, clean, with origin attribution).

---

## Data Notes
- **Total alerts:** 142,837 (Jan 2020 – Mar 2026)
- **data1.json:** 8,329 alerts, Jan 2020–Jul 2023, no origin attribution
- **data2.json:** 134,508 alerts, Oct 2023–Mar 2026, with origin attribution
- **Origin breakdown:** Iran 82,288 / Hezbollah 29,950 / Houthis 13,022 / Hamas 8,981 / Unknown 8,596
- Origin field is an *estimated* attribution based on location + timestamp
- **Credit required:** Data from RocketAlert.live — credited in site footer

---

## Ideas for Future Updates

### 🎯 More Iron Dome-style interactive animations

These follow the same approach as the hero animation — Canvas/SVG with `requestAnimationFrame`, matching the existing colour palette.

**Salvo visualiser** — When a user clicks on a spike in the timeline chart, instead of just a tooltip, trigger a short animation: missiles arc across the canvas representing the alerts from that week, with Iron Dome interceptors rising to meet them. The number of arcs scales with the alert count (e.g. Oct 7 would fire hundreds).

**Live interception counter** — A running tally in the corner of the hero that counts how many "interceptions" the animation has performed since page load. Ties the visual metaphor to the real data.

**Threat direction compass** — An animated radar-style circle showing which cardinal directions alerts originated from (North = Hezbollah/Lebanon, South = Hamas/Gaza, East = Iran ballistic, West = Houthis/sea). Arcs radiate outward from the compass as you scroll through the timeline.

**Iron Dome battery map** — A small schematic map of Israel with the real Iron Dome battery positions shown as glowing blue dots. When the Oct 7 replay is playing, show interception arcs firing from the nearest battery to each incoming alert.

---

### 📊 Chart enhancements

**Actor filter on timeline** — Add toggle buttons (Hamas / Hezbollah / Houthis / Iran / All) above the Six Years chart to isolate each actor's contribution. The area fill updates with a smooth D3 transition. The archive `timeline.html` had a UI sketch for this.

**Zoomable timeline** — Click-drag to zoom into any time window on the Six Years chart. Useful for isolating specific operations (e.g. Guardian of the Walls, May 2021).

**Animated area chart entrance** — When the Four Fronts chart scrolls into view, have each actor's layer grow from zero rather than appearing instantly. Uses D3's `transition().attrTween`.

**Heatmap calendar** — A GitHub-contributions-style calendar heatmap of alert density by day. Each cell is one day, colour intensity = alert count. Makes the episodic clustering very visible.

**Region comparison** — Allow the user to select two regions from the Area Vulnerability chart and see a side-by-side breakdown of their alert profiles by actor and time of day.

---

### 🗺️ Map features

**Persistent dot map** — A static Leaflet layer showing all 142,837 alerts as tiny dots, coloured by actor. Render at low opacity so clusters emerge. Add a time slider to filter by year.

**Animated "spread" replay** — Show how the geographic envelope of attacks expanded over time — starting from Gaza in 2020, then northern border in 2023, then national coverage post-Oct 7. Animate the frontier outward.

**3D trajectory arcs** — Use Deck.gl (a WebGL layer on top of Leaflet/Mapbox) to draw actual 3D arc trajectories between estimated launch points and impact areas. The arcs arc over the terrain.

---

### 🔢 Data & interactivity

**Live data toggle** — Connect `oref_scraper.py` to a GitHub Actions schedule (the workflow file is already in `.github/workflows/`). Show a "last updated" badge and a pulse indicator when new alerts have been added since the last visit.

**Personal risk calculator expansion** — Beyond Poisson probability, add a "blast radius" widget: given a region, show a map inset of which Iron Dome batteries would respond and the expected response time based on historical data.

**Comparative country scale** — The "What Are the Odds?" section could include a comparison: *"142,837 alerts is equivalent to every person in [City X] receiving one alert."* Dynamic based on selected region population.

**Download / share** — Let users download the current chart view as a PNG (using `canvas.toBlob()` or `html2canvas`) or copy a shareable link that pre-scrolls to a specific section with a specific filter active.

---

### ✨ Polish & UX

**Scroll progress bar** — A thin gold line at the top of the page that fills as you read through all 7 chapters.

**Chapter transition sounds** — Very subtle, optional audio: a short radar ping when a new section loads, a soft explosion sound when the Oct 7 map starts playing. Toggle with a speaker icon. Use the Web Audio API.

**Dark/light mode** — The design system is dark-first but a light mode with the same typography and data colours could look striking — pale cream background, charcoal text, same gold/red/blue accents.

**Mobile-first pass** — The site is readable on mobile but the charts are compressed. A proper mobile layout would stack the patterns grid, enlarge touch targets on the map controls, and simplify the Iron Dome animation particle count for lower-powered devices.

---

## Starting a New Session
When picking this up in Claude Code:
1. Open the repo folder (or clone: `git clone https://github.com/alfierees/under-fire`)
2. Claude will read this file and the code and be up to speed immediately
3. Run `python3 -m http.server 8000` to preview locally while editing
4. All charts and the Iron Dome animation will work without any extra setup
5. Commit and push when done — GitHub Pages auto-deploys on push to `main`
