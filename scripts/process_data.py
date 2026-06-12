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


def recent_alerts(rows):
    """Last 20 alert events, newest first. Consecutive alerts from the same
    origin within 10 minutes of each other are grouped into one salvo event."""
    events = []
    for r in reversed(rows):  # rows sorted ascending → walk newest first
        ts = datetime.strptime(r["timestamp"], "%Y-%m-%d %H:%M:%S")
        ev = events[-1] if events else None
        if (ev and ev["origin"] == r["origin"]
                and (ev["_oldest"] - ts).total_seconds() <= 600):
            ev["count"] += 1
            ev["_oldest"] = ts
            if r["area_en"] not in ev["areas"]:
                ev["areas"].append(r["area_en"])
            ev["_cities"].add(r["city_en"])
            ev["_types"].add(ALERT_TYPE_NAMES.get(r["alert_type_id"], "Other"))
        else:
            if len(events) == 20:
                break
            events.append({
                "ts": r["timestamp"],
                "origin": r["origin"],
                "areas": [r["area_en"]],
                "count": 1,
                "_cities": {r["city_en"]},
                "_types": {ALERT_TYPE_NAMES.get(r["alert_type_id"], "Other")},
                "_oldest": ts,
            })
    for ev in events:
        ev["locations"] = len(ev.pop("_cities"))
        ev["type"] = " + ".join(sorted(ev.pop("_types")))
        del ev["_oldest"]
    return {"generated": rows[-1]["timestamp"], "events": events}


GENERATORS = {
    "stats_summary": stats_summary,
    "timeline_weekly": timeline_weekly,
    "actors_monthly": actors_monthly,
    "hourly_dow": hourly_dow,
    "areas_summary": areas_summary,
    "shower_probs": shower_probs,
    "oct7_replay": oct7_replay,
    "recent_alerts": recent_alerts,
}


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


if __name__ == "__main__":
    main()
