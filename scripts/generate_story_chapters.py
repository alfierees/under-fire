#!/usr/bin/env python3
"""Generate story_chapters.json for the scroll-driven narrative story map."""
import json, random
from pathlib import Path

random.seed(42)
BASE = Path(__file__).parent.parent
PROCESSED = BASE / 'data' / 'processed'

# Approximate bounding boxes for each Israeli alert area [lat_min, lat_max], [lon_min, lon_max]
AREA_BOUNDS = {
    "Gaza Envelope":      ([31.20, 31.68], [34.35, 34.68]),
    "Lakhish":            ([31.70, 31.92], [34.65, 34.95]),
    "Western Lakhish":    ([31.45, 31.78], [34.45, 34.72]),
    "Western Negev":      ([31.10, 31.52], [34.40, 34.72]),
    "Central Negev":      ([30.90, 31.32], [34.70, 35.10]),
    "Southern Negev":     ([29.80, 30.90], [34.65, 35.10]),
    "Arabah":             ([30.00, 30.80], [34.95, 35.20]),
    "Eilat":              ([29.50, 29.65], [34.88, 34.98]),
    "Shfela (Lowlands)":  ([31.75, 32.05], [34.70, 34.98]),
    "Shfelat Yehuda":     ([31.60, 31.90], [34.85, 35.10]),
    "Jerusalem":          ([31.72, 31.88], [35.12, 35.28]),
    "Judea":              ([31.40, 31.72], [34.95, 35.28]),
    "Dead Sea":           ([31.20, 31.80], [35.35, 35.60]),
    "Samaria":            ([32.00, 32.40], [34.98, 35.40]),
    "Sharon":             ([32.10, 32.55], [34.82, 35.02]),
    "Yarkon":             ([32.05, 32.25], [34.80, 34.98]),
    "Dan":                ([31.98, 32.18], [34.72, 34.92]),
    "HaAmakim":           ([32.55, 32.82], [35.15, 35.50]),
    "Menashe":            ([32.42, 32.68], [34.90, 35.22]),
    "Wadi Ara":           ([32.40, 32.62], [35.02, 35.20]),
    "HaCarmel":           ([32.58, 32.85], [34.88, 35.15]),
    "HaMifratz":          ([32.82, 33.12], [35.05, 35.22]),
    "Center Galilee":     ([32.82, 33.04], [35.20, 35.60]),
    "Lower Galilee":      ([32.62, 32.88], [35.15, 35.55]),
    "Upper Galilee":      ([33.00, 33.32], [35.35, 35.72]),
    "Confrontation Line": ([33.05, 33.30], [35.10, 35.72]),
    "Southern Golan":     ([32.80, 33.10], [35.72, 35.92]),
    "Northern Golan":     ([33.10, 33.40], [35.72, 35.92]),
    "Bika'a":             ([32.95, 33.15], [35.60, 35.78]),
    "Beit Sha'an Valley": ([32.45, 32.62], [35.45, 35.62]),
}

DOT_CAP = 450


def sample_dots(area_counts, cap=DOT_CAP):
    total = sum(area_counts.values())
    if total == 0:
        return []
    dots = []
    for area, count in area_counts.items():
        if area not in AREA_BOUNDS or count <= 0:
            continue
        lat_r, lon_r = AREA_BOUNDS[area]
        n = max(1, round(cap * count / total))
        for _ in range(n):
            dots.append([
                round(random.uniform(*lat_r), 5),
                round(random.uniform(*lon_r), 5),
            ])
    random.shuffle(dots)
    return dots[:cap]


def actor_area_counts(actor, areas_list):
    return {a['area']: a.get('origins', {}).get(actor, 0) for a in areas_list}


def main():
    with open(PROCESSED / 'oct7_replay.json') as f:
        oct7 = json.load(f)
    with open(PROCESSED / 'areas_summary.json') as f:
        areas_list = json.load(f)
    with open(PROCESSED / 'stats_summary.json') as f:
        stats = json.load(f)

    area_by_name = {a['area']: a for a in areas_list}

    # Ch1: Oct 7 — real coordinates from replay data
    oct7_pts = [[round(a['lat'], 5), round(a['lon'], 5)] for a in oct7]
    random.shuffle(oct7_pts)

    # Ch2: Hamas barrages — all Hamas-attributed alerts by area
    ch2_areas = actor_area_counts('Hamas', areas_list)

    # Ch3: Hezbollah — northern front
    ch3_areas = actor_area_counts('Hezbollah', areas_list)

    # Ch4: Houthis — long-range strikes
    ch4_areas = actor_area_counts('Houthis', areas_list)

    # Ch5: Iran direct (True Promise 1 Apr 14 2024 + True Promise 2 Oct 1 2024)
    # Areas that peaked on 2024-04-14: Central Negev, Southern Negev
    ch5_areas = {
        "Central Negev":  355,
        "Southern Negev": 189,
        "Dead Sea":        60,
        "Arabah":          40,
        "Jerusalem":       80,
        "Judea":           50,
        "Lakhish":         30,
        "Sharon":          20,
        "Dan":             20,
    }

    # Ch6: 2026 total war — all Iran-attributed alerts across every area
    ch6_areas = actor_area_counts('Iran', areas_list)

    chapters = [
        {
            "id": "oct7",
            "chapter": 1,
            "eyebrow": "Chapter 1 — October 7, 2023",
            "title": "The Day It Changed",
            "date": "7 October 2023, 06:29 – 23:13",
            "actor": "Hamas",
            "color": "#d63031",
            "description": "At 06:29 on a Saturday morning — Shabbat — Hamas launched the largest attack on Israel in decades. In under twenty minutes, rockets were falling across the Gaza Envelope, Lakhish, and the coastal lowlands. By nightfall, nearly 4,000 individual alerts had been recorded and 1,200 people were dead.",
            "stats": [
                {"label": "Alerts in one day", "value": str(len(oct7))},
                {"label": "Duration", "value": "17 hours"},
                {"label": "Areas struck", "value": "12"},
            ],
            "map": {"center": [34.55, 31.50], "zoom": 8.2},
            "points": oct7_pts[:DOT_CAP],
            "points_note": "Real alert coordinates from RocketAlert.live",
        },
        {
            "id": "gaza",
            "chapter": 2,
            "eyebrow": "Chapter 2 — Oct 2023 – Oct 2024",
            "title": "The Gaza Barrages",
            "date": "October 2023 – October 2024",
            "actor": "Hamas",
            "color": "#d63031",
            "description": "Even as Israel's ground offensive pushed deeper into Gaza, the rockets kept coming. Lakhish, the Western Negev, and the Gaza Envelope absorbed near-daily barrages. Short-range, familiar trajectories — the grinding soundtrack of a conflict now stripped of all pretence.",
            "stats": [
                {"label": "Hamas alerts (total)", "value": str(stats['origins'].get('Hamas', 0))},
                {"label": "Most-hit area", "value": "Gaza Envelope"},
                {"label": "Active days", "value": str(area_by_name.get('Gaza Envelope', {}).get('active_days', 460))},
            ],
            "map": {"center": [34.62, 31.55], "zoom": 8.0},
            "points": sample_dots(ch2_areas),
            "points_note": "Approximate positions within recorded alert areas",
        },
        {
            "id": "hezbollah",
            "chapter": 3,
            "eyebrow": "Chapter 3 — Oct 2023 – Sep 2024",
            "title": "The Northern Front",
            "date": "8 October 2023 – September 2024",
            "actor": "Hezbollah",
            "color": "#f39c12",
            "description": "The day after October 7, Hezbollah opened a second front from Lebanon. For eleven months the Confrontation Line — Israel's northern border communities — took near-daily anti-tank fire, rockets, and UAVs. 60,000 residents were evacuated. The north went dark.",
            "stats": [
                {"label": "Hezbollah alerts", "value": str(stats['origins'].get('Hezbollah', 0))},
                {"label": "Most-hit area", "value": "Confrontation Line"},
                {"label": "Evacuated residents", "value": "60,000"},
            ],
            "map": {"center": [35.48, 33.12], "zoom": 8.8},
            "points": sample_dots(ch3_areas),
            "points_note": "Approximate positions within recorded alert areas",
        },
        {
            "id": "houthis",
            "chapter": 4,
            "eyebrow": "Chapter 4 — Nov 2023 onwards",
            "title": "Houthi Long-Range",
            "date": "November 2023 onwards",
            "actor": "Houthis",
            "color": "#4a9eff",
            "description": "From 2,000 kilometres away in Yemen, Houthi drones and ballistic missiles began crossing Saudi Arabia and Jordan to reach Israel. Eilat was hit first. Then the range grew — Jerusalem, Tel Aviv, Ben Gurion airport. No country had ever intercepted missiles at this distance, at this scale.",
            "stats": [
                {"label": "Houthi alerts", "value": str(stats['origins'].get('Houthis', 0))},
                {"label": "Distance from Yemen", "value": "~2,000 km"},
                {"label": "First strike", "value": "Eilat, Nov 2023"},
            ],
            "map": {"center": [35.05, 30.80], "zoom": 7.0},
            "points": sample_dots(ch4_areas),
            "points_note": "Approximate positions within recorded alert areas",
        },
        {
            "id": "iran-direct",
            "chapter": 5,
            "eyebrow": "Chapter 5 — April & October 2024",
            "title": "Iran's First Direct Strikes",
            "date": "14 April 2024 and 1 October 2024",
            "actor": "Iran",
            "color": "#c678dd",
            "description": "On April 14, 2024, Iran attacked Israel directly for the first time in history — over 300 drones, cruise missiles, and ballistic missiles. A coalition of five nations intercepted almost everything. On October 1, Iran struck again, with ballistic missiles that reached deeper into Israel's heartland.",
            "stats": [
                {"label": "True Promise 1 alerts", "value": "655"},
                {"label": "Coalition intercept rate", "value": ">99%"},
                {"label": "Peak area", "value": "Central Negev"},
            ],
            "map": {"center": [35.0, 31.2], "zoom": 8.0},
            "points": sample_dots(ch5_areas),
            "points_note": "Approximate positions within recorded alert areas",
        },
        {
            "id": "total-war",
            "chapter": 6,
            "eyebrow": "Chapter 6 — February 2026",
            "title": "Total War",
            "date": "28 February – March 2026",
            "actor": "Iran",
            "color": "#c678dd",
            "description": "On 28 February 2026, Iran launched the largest single missile barrage ever recorded — 10,162 alerts in a single day. Every region of Israel was struck simultaneously, from Eilat to the Golan, coast to Jordan Valley. The conflict had crossed a threshold it would not come back from.",
            "stats": [
                {"label": "Alerts — Feb 28 alone", "value": "10,162"},
                {"label": "Total Iran alerts", "value": str(stats['origins'].get('Iran', 0))},
                {"label": "Regions struck", "value": "All 30"},
            ],
            "map": {"center": [35.12, 31.80], "zoom": 7.0},
            "points": sample_dots(ch6_areas),
            "points_note": "Approximate positions within recorded alert areas",
        },
    ]

    out = {"generated": "2026-04-23", "chapters": chapters}
    out_path = PROCESSED / 'story_chapters.json'
    with open(out_path, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f"Written: {out_path}")
    for ch in chapters:
        print(f"  Ch{ch['chapter']}: {ch['title']} — {len(ch['points'])} dots")


if __name__ == '__main__':
    main()
