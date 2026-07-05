"""
UNDER FIRE — Aggregate generator
=================================
Regenerates the 7 processed JSON files the website consumes from the
committed master dataset (data/master/alerts.csv.gz).

The output formats reproduce the original aggregates exactly (verified by
regenerating the committed files from the same data — see
scripts/verify_aggregates.py).

Run:  python3 scripts/process_data.py
"""

import csv
import gzip
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "data/master/alerts.csv.gz"
OUT = ROOT / "data/processed"

ALERT_TYPE_NAMES = {1: "Rocket/Missile", 2: "UAV"}

# activity windows for the "What Are the Odds?" Poisson widget, in hours
ACTIVITIES = {
    "shower": 8 / 60,
    "tea": 5 / 60,
    "commute": 0.5,
    "film": 2.0,
    "sleep": 8.0,
    "lunch": 0.75,
    "workout": 1.0,
}
OCT7 = "2023-10-07"


def load_master():
    with gzip.open(MASTER, "rt", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["alert_type_id"] = int(r["alert_type_id"])
        # a small number of brand-new alert zones may lack enrichment
        r["lat"] = float(r["lat"]) if r["lat"] else None
        r["lon"] = float(r["lon"]) if r["lon"] else None
        r["date"] = r["timestamp"][:10]
    rows.sort(key=lambda r: r["timestamp"])
    return rows


def monday_of(date_str):
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    return (d - timedelta(days=d.weekday())).strftime("%Y-%m-%d")


def stats_summary(rows):
    days = Counter(r["date"] for r in rows)
    busiest, busiest_n = days.most_common(1)[0]
    return {
        "total_alerts": len(rows),
        "date_range": {"start": rows[0]["date"], "end": rows[-1]["date"]},
        "total_days_covered": len(days),
        "origins": dict(Counter(r["origin"] for r in rows)),
        "alert_types": dict(Counter(
            ALERT_TYPE_NAMES.get(r["alert_type_id"], str(r["alert_type_id"]))
            for r in rows)),
        "busiest_day": {"date": busiest, "count": busiest_n},
        "unique_locations": len({r["city_en"] for r in rows if r["city_en"]}),
        "unique_areas": len({r["area_en"] for r in rows if r["area_en"]}),
    }


def timeline_weekly(rows):
    weeks = defaultdict(Counter)
    for r in rows:
        weeks[monday_of(r["date"])][r["origin"]] += 1
    out = []
    for week in sorted(weeks):
        entry = {"week": week, "total": sum(weeks[week].values())}
        entry.update(weeks[week])
        out.append(entry)
    return out


def actors_monthly(rows):
    months = defaultdict(Counter)
    for r in rows:
        months[r["date"][:7]][r["origin"]] += 1
    out = []
    for month in sorted(months):
        entry = {"month": month}
        entry.update(months[month])
        out.append(entry)
    return out


def hourly_dow(rows):
    hours = defaultdict(Counter)
    dows = Counter()
    for r in rows:
        dt = datetime.strptime(r["timestamp"], "%Y-%m-%d %H:%M:%S")
        hours[dt.hour][r["origin"]] += 1
        dows[dt.weekday()] += 1
    hourly = []
    for h in range(24):
        entry = {"hour": h, "count": sum(hours[h].values())}
        entry.update(hours[h])
        hourly.append(entry)
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday",
                 "Friday", "Saturday", "Sunday"]
    day_of_week = [{"day": day_names[i], "count": dows[i]} for i in range(7)]
    return {"hourly": hourly, "day_of_week": day_of_week}


def areas_summary(rows):
    span_days = (datetime.strptime(rows[-1]["date"], "%Y-%m-%d")
                 - datetime.strptime(rows[0]["date"], "%Y-%m-%d")).days
    by_area = defaultdict(list)
    for r in rows:
        if r["area_en"]:
            by_area[r["area_en"]].append(r)
    out = []
    for area, items in by_area.items():
        days = Counter(r["date"] for r in items)
        # deterministic tie-break: highest count, then earliest date
        peak_day = min(days, key=lambda d: (-days[d], d))
        peak_n = days[peak_day]
        out.append({
            "area": area,
            "total": len(items),
            "rocket": sum(1 for r in items if r["alert_type_id"] == 1),
            "uav": sum(1 for r in items if r["alert_type_id"] == 2),
            "active_days": len(days),
            "avg_per_day": round(len(items) / span_days, 3),
            "peak_day": peak_day,
            "origins": dict(Counter(r["origin"] for r in items)),
            "peak_day_count": peak_n,
        })
    out.sort(key=lambda e: -e["total"])
    return out


def shower_probs(rows):
    start = datetime.strptime(rows[0]["date"], "%Y-%m-%d")
    end = datetime.strptime(rows[-1]["date"], "%Y-%m-%d")
    span_h_all = ((end - start).days + 1) * 24
    span_h_oct7 = ((end - datetime.strptime(OCT7, "%Y-%m-%d")).days + 1) * 24

    by_area = defaultdict(list)
    for r in rows:
        if r["area_en"]:
            by_area[r["area_en"]].append(r)

    out = {}
    for area, items in sorted(by_area.items(),
                              key=lambda kv: -len(kv[1])):
        lam_all = len(items) / span_h_all
        n_oct7 = sum(1 for r in items if r["date"] >= OCT7)
        lam_oct7 = n_oct7 / span_h_oct7
        out[area] = {
            act: {
                "all_time": round(1 - math.exp(-lam_all * t), 4),
                "since_oct7": round(1 - math.exp(-lam_oct7 * t), 4),
            }
            for act, t in ACTIVITIES.items()
        }
    return out


def oct7_replay(rows):
    return [
        {"ts": r["timestamp"], "lat": r["lat"], "lon": r["lon"],
         "area": r["area_en"], "loc": r["city_en"]}
        for r in rows if r["date"] == OCT7
    ]


def area_monthly(rows):
    """Per-area alert counts for every calendar month in the dataset —
    feeds the time-lapse choropleth. Months are contiguous first→last so
    the scrubber can index straight into the arrays."""
    first, last = rows[0]["date"][:7], rows[-1]["date"][:7]
    months = []
    y, m = int(first[:4]), int(first[5:7])
    while f"{y:04d}-{m:02d}" <= last:
        months.append(f"{y:04d}-{m:02d}")
        m += 1
        if m == 13:
            y, m = y + 1, 1
    idx = {mo: i for i, mo in enumerate(months)}

    by_area = defaultdict(lambda: [0] * len(months))
    totals = [0] * len(months)
    for r in rows:
        i = idx[r["date"][:7]]
        totals[i] += 1
        if r["area_en"]:
            by_area[r["area_en"]][i] += 1

    areas = sorted(by_area, key=lambda a: -sum(by_area[a]))
    return {"months": months, "areas": areas,
            "counts": {a: by_area[a] for a in areas}, "totals": totals}


# Operation/campaign windows for the comparison page. Editorial text lives
# HERE (not in operations.json) — the pipeline regenerates the JSON every
# 30 minutes, same rule as story chapters. `origin` filters the window to
# one attributed actor (fronts overlap after Oct 7); None = all alerts.
# `end` None = ongoing (window extends to the newest alert).
OPERATIONS = [
    {"id": "guardian-walls", "name": "Guardian of the Walls",
     "label": "May 2021 Gaza war", "start": "2021-05-10", "end": "2021-05-21",
     "origin": None, "front": "Gaza",
     "desc": "Eleven days of barrages from Gaza after clashes in Jerusalem — "
             "the heaviest fire Israel had seen until then."},
    {"id": "breaking-dawn", "name": "Breaking Dawn",
     "label": "Aug 2022 PIJ weekend", "start": "2022-08-05", "end": "2022-08-07",
     "origin": None, "front": "Gaza",
     "desc": "A three-day exchange with Palestinian Islamic Jihad; Hamas "
             "stayed out and it ended as abruptly as it began."},
    {"id": "shield-arrow", "name": "Shield and Arrow",
     "label": "May 2023 PIJ round", "start": "2023-05-09", "end": "2023-05-13",
     "origin": None, "front": "Gaza",
     "desc": "Five days against Islamic Jihad five months before Oct 7 — "
             "at the time it felt like a major escalation."},
    {"id": "iron-swords", "name": "Iron Swords",
     "label": "The Gaza war, Oct 2023 → Jan 2025", "start": "2023-10-07",
     "end": "2025-01-19", "origin": None, "front": "All fronts",
     "desc": "From the Oct 7 attack to the January 2025 ceasefire — 15 "
             "months in which every other front joined in. Counted here: "
             "every alert in the window, whoever fired."},
    {"id": "northern-war", "name": "The Northern War",
     "label": "Hezbollah, Oct 2023 → Nov 2024", "start": "2023-10-08",
     "end": "2024-11-27", "origin": "Hezbollah", "front": "Lebanon",
     "desc": "Hezbollah opened fire on Oct 8 and kept it up for 14 months "
             "until the November 2024 ceasefire. Hezbollah-attributed "
             "alerts only."},
    {"id": "houthi-campaign", "name": "The Houthi Campaign",
     "label": "Yemen, Oct 2023 → present", "start": "2023-10-19",
     "end": None, "origin": "Houthis", "front": "Yemen",
     "desc": "Long-range missiles and drones from 1,800 km away, a "
             "slow-drip campaign that has outlasted every ceasefire. "
             "Houthi-attributed alerts only."},
    {"id": "true-promise-1", "name": "True Promise I",
     "label": "Iran's first direct attack, Apr 2024", "start": "2024-04-13",
     "end": "2024-04-14", "origin": "Iran", "front": "Iran",
     "desc": "Iran's first-ever direct attack on Israel: roughly 170 "
             "drones, 30 cruise and 120 ballistic missiles in one night. "
             "Iran-attributed alerts only."},
    {"id": "true-promise-2", "name": "True Promise II",
     "label": "Iran's ballistic barrage, Oct 2024", "start": "2024-10-01",
     "end": "2024-10-02", "origin": "Iran", "front": "Iran",
     "desc": "About 200 ballistic missiles fired in under an hour — the "
             "largest single ballistic-missile attack in history at that "
             "point. Iran-attributed alerts only."},
    {"id": "rising-lion", "name": "Rising Lion — the 12-Day War",
     "label": "Israel–Iran war, Jun 2025", "start": "2025-06-13",
     "end": "2025-06-24", "origin": "Iran", "front": "Iran",
     "desc": "Twelve days of Iranian ballistic-missile salvos on Israeli "
             "cities while Israel struck Iran's nuclear and missile "
             "programmes. Iran-attributed alerts only."},
    {"id": "total-war", "name": "The 2026 Total War",
     "label": "Iran-led, Feb 2026 → present", "start": "2026-02-28",
     "end": None, "origin": None, "front": "All fronts",
     "desc": "On February 28, 2026 Iran opened the largest coordinated "
             "barrage in modern history — 10,162 alerts in a single day, "
             "all 30 regions under fire — with Hezbollah joining from the "
             "north. Counted here: every alert since Feb 28, whoever "
             "fired."},
]


def operations(rows):
    """Per-operation stats + aligned daily series for the comparison page."""
    data_end = rows[-1]["date"]
    out = []
    for op in OPERATIONS:
        # An ongoing op whose start postdates the newest alert hasn't begun in
        # this dataset yet — skip it rather than emit a negative-length window.
        if op["start"] > data_end:
            continue
        end = op["end"] or data_end
        sel = [r for r in rows if op["start"] <= r["date"] <= end
               and (op["origin"] is None or r["origin"] == op["origin"])]
        days = Counter(r["date"] for r in sel)
        n_days = (datetime.strptime(end, "%Y-%m-%d")
                  - datetime.strptime(op["start"], "%Y-%m-%d")).days + 1
        window = [(datetime.strptime(op["start"], "%Y-%m-%d")
                   + timedelta(days=i)).strftime("%Y-%m-%d")
                  for i in range(n_days)]
        peak_day = (min(days, key=lambda d: (-days[d], d)) if days else None)
        top_areas = Counter(r["area_en"] for r in sel if r["area_en"])
        out.append({
            "id": op["id"], "name": op["name"], "label": op["label"],
            "desc": op["desc"], "front": op["front"],
            "start": op["start"], "end": op["end"],
            "ongoing": op["end"] is None,
            "origin_filter": op["origin"],
            "days": n_days,
            "total": len(sel),
            "per_day": round(len(sel) / n_days, 1) if n_days else 0,
            "peak": ({"date": peak_day, "count": days[peak_day]}
                     if peak_day else None),
            "uav_share": (round(sum(1 for r in sel
                                    if r["alert_type_id"] == 2)
                                / len(sel), 3) if sel else 0),
            "origins": dict(Counter(r["origin"] for r in sel)),
            "top_areas": [{"area": a, "count": c}
                          for a, c in top_areas.most_common(5)],
            "daily": [days.get(d, 0) for d in window],
        })
    return {"generated_through": data_end, "operations": out}


def recent_alerts(rows):
    """Last 30 alert events, newest first. Consecutive alerts from the same
    origin within 10 minutes of each other are grouped into one salvo event.
    A handful of alerts have a blank area/city — they still count, but blank
    strings never appear in the lists."""
    events = []
    for r in reversed(rows):  # rows sorted ascending → walk newest first
        ts = datetime.strptime(r["timestamp"], "%Y-%m-%d %H:%M:%S")
        area, city = r["area_en"].strip(), r["city_en"].strip()
        ev = events[-1] if events else None
        if (ev and ev["origin"] == r["origin"]
                and (ev["_oldest"] - ts).total_seconds() <= 600):
            ev["count"] += 1
            ev["_oldest"] = ts
            if area and area not in ev["areas"]:
                ev["areas"].append(area)
            if city:
                ev["_cities"].add(city)
            ev["_types"].add(ALERT_TYPE_NAMES.get(r["alert_type_id"], "Other"))
        else:
            if len(events) == 30:
                break
            events.append({
                "ts": r["timestamp"],
                "origin": r["origin"],
                "areas": [area] if area else [],
                "count": 1,
                "_cities": {city} if city else set(),
                "_types": {ALERT_TYPE_NAMES.get(r["alert_type_id"], "Other")},
                "_oldest": ts,
            })
    for ev in events:
        ev["locations"] = len(ev.pop("_cities"))
        ev["type"] = " + ".join(sorted(ev.pop("_types")))
        del ev["_oldest"]

    # real per-day counts for the last 14 calendar days (daily_counts.json is
    # an estimate spread from weekly totals — not suitable for a live feed)
    last_day = datetime.strptime(rows[-1]["date"], "%Y-%m-%d").date()
    window = [(last_day - timedelta(days=i)).strftime("%Y-%m-%d")
              for i in range(13, -1, -1)]
    by_day = Counter(r["date"] for r in rows)
    last14 = [{"date": d, "count": by_day.get(d, 0)} for d in window]

    return {"generated": rows[-1]["timestamp"], "events": events,
            "last14": last14}


GENERATORS = {
    "stats_summary": stats_summary,
    "timeline_weekly": timeline_weekly,
    "actors_monthly": actors_monthly,
    "hourly_dow": hourly_dow,
    "areas_summary": areas_summary,
    "shower_probs": shower_probs,
    "oct7_replay": oct7_replay,
    "recent_alerts": recent_alerts,
    "area_monthly": area_monthly,
    "operations": operations,
}

# Pages listed in sitemap.xml. Data-driven pages take the master's newest
# alert date as lastmod (their rendered content really does change with the
# data); editorial pages keep a hand-set date — bump it when the prose
# changes. design-brief.html is robots-disallowed and deliberately absent.
SITE = "https://under-fire.org"
SITEMAP_PAGES = [
    # (path, priority, changefreq|None, editorial lastmod|None=data date)
    ("/",          "1.0", None,     None),
    ("/live",      "0.9", "hourly", None),
    ("/timeline",  "0.8", None,     None),
    ("/fronts",    "0.8", None,     None),
    ("/calendar",  "0.8", None,     None),
    ("/oct7",      "0.9", None,     None),
    ("/story",     "0.9", None,     None),
    ("/patterns",  "0.7", None,     None),
    ("/areas",     "0.7", None,     None),
    ("/timelapse", "0.8", None,     None),
    ("/compare",   "0.8", None,     None),
    ("/arcs",      "0.7", None,     None),
    ("/records",   "0.7", None,     None),
    ("/arsenal",   "0.8", None,     "2026-07-04"),
    ("/data",      "0.7", None,     None),
    ("/mission",   "0.6", None,     "2026-06-12"),
]


def write_sitemap(rows):
    lastmod = rows[-1]["date"]
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, prio, freq, fixed in SITEMAP_PAGES:
        bits = [f"<loc>{SITE}{path}</loc>",
                f"<lastmod>{fixed or lastmod}</lastmod>"]
        if freq:
            bits.append(f"<changefreq>{freq}</changefreq>")
        bits.append(f"<priority>{prio}</priority>")
        lines.append("  <url>" + "".join(bits) + "</url>")
    lines.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(lines) + "\n",
                                      encoding="utf-8")


def write_llms_txt(rows):
    """llms.txt — a plain-text site guide for AI crawlers/agents, with the
    key statistics baked in as real numbers (the HTML pages render most
    figures client-side, which crawlers that don't execute JS never see)."""
    s = stats_summary(rows)
    o = s["origins"]
    total = s["total_alerts"]

    def n(x):
        return f"{x:,}"

    def pct(x):
        return f"{x / total:.1%}" if total else "0%"

    txt = f"""# Under Fire — under-fire.org

> Live-updated data journalism: every rocket, missile, and drone alert
> across Israel since January 2020, visualized. Data refreshes every 30
> minutes from Israeli Home Front Command (Tzeva Adom / Red Alert) alerts
> aggregated by RocketAlert.live, with estimated origin attribution.

## Key figures (as of {s['date_range']['end']})

- Total alerts recorded: {n(total)} ({s['date_range']['start']} to {s['date_range']['end']})
- Attributed to Hamas/Gaza: {n(o.get('Hamas', 0))} ({pct(o.get('Hamas', 0))})
- Attributed to Hezbollah/Lebanon: {n(o.get('Hezbollah', 0))} ({pct(o.get('Hezbollah', 0))})
- Attributed to Iran (direct attacks): {n(o.get('Iran', 0))} ({pct(o.get('Iran', 0))})
- Attributed to the Houthis/Yemen: {n(o.get('Houthis', 0))} ({pct(o.get('Houthis', 0))})
- Unattributed: {n(o.get('Unknown', 0))} ({pct(o.get('Unknown', 0))})
- Busiest single day: {s['busiest_day']['date']} with {n(s['busiest_day']['count'])} alerts
- Distinct alert locations: {n(s['unique_locations'])} across {s['unique_areas']} Home Front Command regions
- Days with at least one alert: {n(s['total_days_covered'])}

## Pages

- [Home](https://under-fire.org/): overview hub with live counters
- [Live feed](https://under-fire.org/live): most recent alerts, salvo-grouped, updated every 30 minutes
- [Timeline](https://under-fire.org/timeline): weekly alert totals 2020–today, filterable by actor
- [Fronts](https://under-fire.org/fronts): monthly stacked bars per actor (Hamas, Hezbollah, Houthis, Iran)
- [Calendar](https://under-fire.org/calendar): GitHub-style daily heatmap, one cell per day
- [Oct 7](https://under-fire.org/oct7): animated replay of the ~4,000-alert October 7, 2023 attack
- [Story](https://under-fire.org/story): scroll-driven map narrative of the war, chapter by chapter
- [Patterns](https://under-fire.org/patterns): time-of-day polar clock, weekday pattern, actor×hour heatmap
- [Areas](https://under-fire.org/areas): choropleth + ranking of alerts by Home Front Command region
- [Time-lapse](https://under-fire.org/timelapse): month-by-month animated map of where alerts fell, 2020–today
- [Compare](https://under-fire.org/compare): side-by-side stats for each named operation and campaign
- [Arcs](https://under-fire.org/arcs): schematic attack arcs from Gaza, Lebanon, Yemen, and Iran
- [Records](https://under-fire.org/records): extremes — busiest day/hour, longest quiet streak
- [Arsenal](https://under-fire.org/arsenal): the rockets, missiles, and drones fired at Israel — specs, ranges, salvo history
- [Data](https://under-fire.org/data): documentation of every dataset with download links

## Data (free to download; please cite under-fire.org)

- Master dataset (CSV, gzipped): https://under-fire.org/data/master/alerts.csv.gz
  Columns: timestamp (Israel local), city_he, city_en, lat, lon, area_en, alert_type_id (1=rocket/missile, 2=UAV), origin, source
- Processed JSON aggregates: https://under-fire.org/data/processed/
  stats_summary.json, timeline_weekly.json, actors_monthly.json, hourly_dow.json,
  areas_summary.json, area_monthly.json, operations.json, oct7_replay.json,
  recent_alerts.json, records.json, daily_counts.json, actor_hour.json,
  area_polygons.json, story_chapters.json, arsenal.json
- Source repository: https://github.com/alfierees/under-fire

## Notes for citation

Origin attribution is estimated from alert location and timing (see /mission
for methodology). Alert counts measure Home Front Command warnings, not
projectiles fired or impacts. Built by Alfie Rees; data via RocketAlert.live.
"""
    (ROOT / "llms.txt").write_text(txt, encoding="utf-8")


def main():
    rows = load_master()
    print(f"Loaded {len(rows):,} alerts "
          f"({rows[0]['date']} → {rows[-1]['date']})")
    OUT.mkdir(parents=True, exist_ok=True)
    for name, gen in GENERATORS.items():
        result = gen(rows)
        path = OUT / f"{name}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False,
                      separators=(",", ":"))
        print(f"  wrote {path.name}")
    write_sitemap(rows)
    print("  wrote sitemap.xml")
    write_llms_txt(rows)
    print("  wrote llms.txt")


if __name__ == "__main__":
    main()
