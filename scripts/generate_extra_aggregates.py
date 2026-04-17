"""
UNDER FIRE — Extra aggregates
Generates daily_counts.json, actor_hour.json, records.json
from existing processed aggregates (no raw CSV required).

Run: python3 scripts/generate_extra_aggregates.py
"""
import json
from pathlib import Path
from datetime import date, timedelta

PROC = Path(__file__).resolve().parent.parent / "data" / "processed"


def load(name):
    return json.loads((PROC / name).read_text())


def build_daily(weekly, hourly_dow):
    # Each week's total is distributed across 7 days (Mon-Sun) weighted by
    # the global day-of-week distribution. Keeps Saturday-peak pattern.
    dow_counts = {d["day"]: d["count"] for d in hourly_dow["day_of_week"]}
    day_order = ["Monday", "Tuesday", "Wednesday", "Thursday",
                 "Friday", "Saturday", "Sunday"]
    weights = [dow_counts[d] for d in day_order]
    total_w = sum(weights)
    frac = [w / total_w for w in weights]

    daily = []
    for wk in weekly:
        monday = date.fromisoformat(wk["week"])
        wk_total = wk["total"]
        for i in range(7):
            d = monday + timedelta(days=i)
            count = int(round(wk_total * frac[i]))
            daily.append({"date": d.isoformat(), "count": count})
    return daily


def build_actor_hour(hourly_dow):
    actors = ["Hamas", "Hezbollah", "Houthis", "Iran"]
    cells = []
    for h in hourly_dow["hourly"]:
        for actor in actors:
            cells.append({
                "actor": actor,
                "hour": h["hour"],
                "count": h.get(actor, 0),
            })
    return cells


def build_records(weekly, hourly_dow, areas, stats):
    busiest_day = stats["busiest_day"]
    peak_hour = max(hourly_dow["hourly"], key=lambda h: h["count"])

    quiet_threshold = 5
    longest = 0
    longest_start = longest_end = None
    cur = 0
    cur_start = None
    for wk in weekly:
        if wk["total"] < quiet_threshold:
            if cur == 0:
                cur_start = wk["week"]
            cur += 1
            if cur > longest:
                longest = cur
                longest_start = cur_start
                longest_end = wk["week"]
        else:
            cur = 0
            cur_start = None

    biggest = max(areas, key=lambda a: a.get("peak_day_count", 0))

    dow_sorted = sorted(hourly_dow["day_of_week"],
                        key=lambda d: d["count"], reverse=True)

    return {
        "total_alerts": stats["total_alerts"],
        "busiest_day": {
            "date": busiest_day["date"],
            "count": busiest_day["count"],
        },
        "busiest_hour": {
            "hour": peak_hour["hour"],
            "count": peak_hour["count"],
        },
        "longest_quiet_streak": {
            "weeks": longest,
            "start_week": longest_start,
            "end_week": longest_end,
            "threshold": quiet_threshold,
        },
        "biggest_area_spike": {
            "area": biggest["area"],
            "date": biggest["peak_day"],
            "count": biggest["peak_day_count"],
        },
        "busiest_weekday": dow_sorted[0],
    }


def main():
    weekly = load("timeline_weekly.json")
    hourly_dow = load("hourly_dow.json")
    areas = load("areas_summary.json")
    stats = load("stats_summary.json")

    daily = build_daily(weekly, hourly_dow)
    (PROC / "daily_counts.json").write_text(json.dumps(daily))
    print(f"daily_counts.json: {len(daily)} days  "
          f"({daily[0]['date']} -> {daily[-1]['date']})")

    ah = build_actor_hour(hourly_dow)
    (PROC / "actor_hour.json").write_text(json.dumps(ah))
    print(f"actor_hour.json: {len(ah)} cells (4 actors x 24 hours)")

    records = build_records(weekly, hourly_dow, areas, stats)
    (PROC / "records.json").write_text(json.dumps(records, indent=2))
    print(f"records.json: longest quiet streak = "
          f"{records['longest_quiet_streak']['weeks']} weeks; "
          f"busiest area spike = "
          f"{records['biggest_area_spike']['count']} on "
          f"{records['biggest_area_spike']['date']} "
          f"({records['biggest_area_spike']['area']})")


if __name__ == "__main__":
    main()
