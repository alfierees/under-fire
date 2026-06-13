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

    # Real per-actor totals used in the guided-replay captions (never hardcode —
    # these flow from the live aggregates so the 30-min pipeline keeps them true).
    n_oct7 = len(oct7)
    n_hamas = stats['origins'].get('Hamas', 0)
    n_hez = stats['origins'].get('Hezbollah', 0)
    n_hou = stats['origins'].get('Houthis', 0)

    # ── Guided-replay captions ────────────────────────────────────────────────
    # Short, ~8.5s-read beat captions for the chapter-by-chapter replay (story.html).
    # EDIT THIS COPY HERE, never in the JSON — the pipeline regenerates the JSON.
    REPLAY = {
        "oct7": {
            "time": "7 OCT 2023 · 06:29", "head": "It begins",
            "body": f"A Shabbat morning, the quiet peak of the holiday season. At 06:29 Hamas opens a coordinated, multi-front assault — the heaviest single day Israel has ever recorded, {n_oct7:,} rocket alerts blanketing the Gaza Envelope, the Negev and the coastal heartland. As families ran for shelters, gunmen breached the border by land, sea and air.",
        },
        "gaza": {
            "time": "OCT 2023 – OCT 2024", "head": "The grind",
            "body": f"Even as the ground operation began, the sky over the south rarely cleared. For the year that followed, Hamas kept up a steady rhythm of fire over the Gaza Envelope, Lakhish and the Western Negev — {n_hamas:,} alerts in all. Not front-line statistics, but the daily soundtrack of a region that couldn't return to normal.",
        },
        "hezbollah": {
            "time": "OCT 2023 · THE NORTH", "head": "The north ignites",
            "body": f"On October 8 a second front opened in the north. Hezbollah's anti-tank fire and explosive drones turned the Galilee's kibbutzim and tourist towns into a combat zone — {n_hez:,} alerts along the Confrontation Line. By the following autumn more than 60,000 residents had been evacuated, leaving ghost towns behind.",
        },
        "houthis": {
            "time": "NOV 2023 · FROM YEMEN", "head": "From 2,000 km away",
            "body": f"In November 2023 the war reached a distance once thought impossible for a non-state actor. From nearly 2,000 km away in Yemen, the Houthis launched drones and ballistic missiles — first at Eilat, later at Tel Aviv — {n_hou:,} alerts in total. Some were intercepted in space by the Arrow system, half a continent from where they were fired.",
        },
        "iran-direct": {
            "time": "APR & OCT 2024 · IRAN", "head": "Iran steps out of the shadows",
            "body": "For decades the Iran–Israel conflict was fought in the shadows. On April 14, 2024 that ended: over 300 drones and missiles launched directly from Iranian soil, met by a five-nation coalition that intercepted more than 99%. Iran struck again on October 1 with nearly 200 ballistic missiles — the front line was now the whole country.",
        },
        "total-war": {
            "time": "28 FEB 2026", "head": "Total war",
            "body": "On February 28, 2026 the conflict became what many had feared for decades. In a single 24-hour window Iran launched the largest coordinated missile-and-drone barrage in modern history — 10,162 alerts in one day, every one of the 30 regions under fire from the Golan to Eilat. The war had moved from the borders into every home.",
        },
    }

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
            "title": "The Day Everything Changed",
            "date": "7 October 2023, 06:29 – 23:13",
            "actor": "Hamas",
            "color": "#d63031",
            "description": "On a Saturday morning that should have been the quiet peak of the Jewish holiday season, the silence was shattered. At 06:29, Hamas launched a coordinated, multi-front invasion that would become the deadliest day in Israel's history.Within minutes, thousands of rockets began raining down across the Gaza Envelope, the Negev, and the coastal heartland. As families scrambled into bomb shelters, thousands of terrorists breached the border by land, sea, and air. By the time the first day ended, nearly 4,000 rocket alerts had been triggered, and 1,200 lives—children, parents, and festival-goers—had been taken.",
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
            "description": "Even as the IDF moved into the Gaza Strip, the sky over southern Israel rarely stayed clear. For the residents of the Gaza Envelope, Lakhish, and the Western Negev, the war didn't just happen on the front lines—it happened in their living rooms and bomb shelters. Day after day, Hamas maintained a steady rhythm of rocket fire, a grinding campaign designed to ensure that life could not return to normal. These weren't just data points; they were the soundtrack of a region under siege, where the familiar whistle of an incoming projectile became a grim, daily certainty.",
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
            "description": "While the south was still reeling, a second front ignited in the north. On October 8, Hezbollah began a campaign of \"solidarity\" that effectively turned the Galilee into a combat zone. For nearly a year, the Confrontation Line—once a string of thriving kibbutzim and tourist towns—became a landscape of sirens and smoke. The threat here was different: precision anti-tank missiles fired directly at homes and swarms of explosive UAVs that gave residents seconds to find cover. By the fall of 2024, more than 60,000 people had been forced from their homes, leaving behind \"ghost towns\" and a region in a state of suspended animation.",
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
            "description": "In November 2023, the war reached a distance previously thought impossible for non-state actors. From nearly 2,000 kilometers away in Yemen, the Houthi movement began launching a sophisticated arsenal of drones and ballistic missiles toward Israel. The first targets were the southern resort city of Eilat, turning a vacation destination into a front line. But the reach of these weapons quickly expanded, eventually triggering sirens in Tel Aviv and central Israel. This front redefined modern warfare: for the first time in history, ballistic missiles were intercepted in space by the Arrow system, neutralizing threats from half a continent away before they could reach Israeli soil.",
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
            "description": "For decades, the conflict between Iran and Israel was fought in the shadows. In 2024, that shadow war vanished. On the night of April 14, the world watched as Iran launched over 300 drones and missiles in the first-ever direct assault from Iranian soil. It was a surreal spectacle: streaks of light across the Jerusalem sky as a historic coalition of five nations—Israel, the US, the UK, France, and Jordan—worked in unison to intercept nearly every threat before it reached its target. But the quiet didn't last. On October 1, Iran struck again, this time with a more aggressive barrage of nearly 200 high-speed ballistic missiles. This second wave bypassed the slower drone phase, sending millions of Israelis into shelters simultaneously. While the defense held, the impact sites in central Israel and the Negev signaled a new, dangerous era of direct confrontation where the \"front line\" was now the entire country. ",
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
            "description": "On February 28, 2026, the long-simmering regional conflict exploded into what many had feared for decades: a total war. In a single 24-hour window, Iran launched the most massive coordinated missile and drone barrage in the history of modern warfare.This was no longer a limited front. From the northern peaks of the Golan Heights to the southern tip of Eilat, and from the coastal plains to the Jordan Valley, the entire country was unified under the scream of over 10,000 alerts. The sheer volume of fire tested the limits of the world’s most advanced defense systems and forced millions of Israelis into shelters for hours on end. It was the day the conflict moved from the borders into every single home, crossing a threshold from which the region would never be the same.",
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

    # Attach the short replay caption to each chapter (keyed by id).
    for ch in chapters:
        ch["replay"] = REPLAY[ch["id"]]

    out = {"generated": "2026-04-23", "chapters": chapters}
    out_path = PROCESSED / 'story_chapters.json'
    with open(out_path, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f"Written: {out_path}")
    for ch in chapters:
        print(f"  Ch{ch['chapter']}: {ch['title']} — {len(ch['points'])} dots")


if __name__ == '__main__':
    main()
