# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **General public** arriving from a shared link (social, messaging). They want to grasp the scale of rocket, missile and drone fire on Israel in one screen, explore a chart or map or two, and maybe share it on. Mostly on phones.
- **Portfolio reviewers** (employers, clients) judging Alfie Rees's data-science and front-end craft. They skim the homepage, open two or three pages, and look for rigour and finish.

Journalists and researchers remain a welcome secondary audience (the `data.html` open-data page serves them), but they are not the design's primary reader.

## Product Purpose
Make the scale, rhythm and geography of alerts over Israel legible through data: every alert since January 2020, attributed by front, mapped, charted and kept up to date. Success means a first-time visitor understands the scale within seconds and goes on to explore, and a reviewer comes away convinced of the rigour behind it.

## Positioning
A single, live-updating, attributed record of every alert since 2020 (160,000+ and counting), refreshed every 30 minutes by a public pipeline, with the underlying data downloadable. News graphics cover single days or wars; this covers the whole six-year record across all four fronts.

## Operating Context
- Fully static site (HTML + D3 + Leaflet from CDN, no build step), deployed on Cloudflare Workers at `under-fire.org` with a GitHub Pages mirror.
- A GitHub Actions pipeline regenerates `data/processed/*.json`, `sitemap.xml` and `llms.txt` every 30 minutes. Live figures on pages derive from `stats_summary.json` via `[data-live]` in `shared.js`.
- Pages: index hub, timeline, fronts, calendar, compare, oct7 replay, story, timelapse, patterns, areas, records, arsenal (generated from a template), data, live feed, mission, 404.

## Capabilities and Constraints
- Content, data and chart logic stay as they are in a visual redesign. Light copy edits for tone are allowed; numbers and factual claims do not change.
- Origin attribution is estimated from location and timing, and must be disclosed as such.
- Story chapter text lives in `scripts/generate_story_chapters.py`; arsenal static sections in `scripts/_arsenal_template.html`. Never hand-edit the generated outputs.
- Actor colours (Hamas, Hezbollah, Houthis, Iran, Unknown) are one token set shared by CSS and every D3 chart. They may be retuned, but must stay one consistent system.

## Brand Commitments
- Name and wordmark: **UNDER FIRE**, set in a heavy serif with a fire-coloured gradient (owner request, 2026-09-27).
- The homepage hero keeps the animated Iron Dome interceptor canvas over a city photograph.
- Neutral framing: no political commentary, no advocacy.

## Evidence on Hand
- Full alert dataset (`data/master/alerts.csv.gz`) and 15+ aggregates in `data/processed/`.
- Hero photograph `images/hero-bg.jpg`, card preview images for oct7 and story, `images/og-card.png`.
- Data credit: RocketAlert.live. No testimonials, press coverage or usage figures exist; do not invent any.

## Product Principles
1. **The data leads.** Every design move should make a number or pattern easier to see, never compete with it.
2. **Gravity without alarm.** These are real people running to shelters. Serious, not sensational; human, not sterile.
3. **Live and honest.** Show freshness and caveats plainly; never state a number the data can't back.
4. **Craft is the proof.** For reviewers, finish and consistency across all pages are the argument.
