"""
UNDER FIRE — Incremental data updater
======================================
Fetches new alerts since the master's last date, attributes their origin,
appends them to data/master/alerts.csv.gz and regenerates the 7 processed
aggregates the site consumes.

Primary source:  RocketAlert.live aggregation API (same source and schema as
                 the original dataset; includes English names + coordinates).
Fallback:        api.tzevaadom.co.il (last ~11 days only, Hebrew city names
                 mapped to coordinates via the master's own city lookup).

Designed for GitHub Actions cron — dependency-free (stdlib only), exits 0
with "no new alerts" on quiet days. Run: python3 scripts/update_data.py
"""

import csv
import gzip
import json
import re
import subprocess
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import attribution  # noqa: E402
import process_data  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "data/master/alerts.csv.gz"

ROCKETALERT = "https://agg.rocketalert.live/api/v1/alerts/details"
TZEVAADOM = "https://api.tzevaadom.co.il/alerts-history/"
TZEVAADOM_CITIES = "https://www.tzevaadom.co.il/static/cities.json"
FETCH_WINDOW_DAYS = 30  # max days per RocketAlert request
# Proper DST-aware Israel time (UTC+2 winter / UTC+3 summer). Fall back to
# the old fixed UTC+3 approximation if tzdata is unavailable — at day
# granularity the boundary shifts by an hour and the next run catches up.
try:
    from zoneinfo import ZoneInfo
    ISRAEL_TZ = ZoneInfo("Asia/Jerusalem")
except Exception:
    ISRAEL_TZ = timezone(timedelta(hours=3))


def fetch_json(url, timeout=30):
    req = urllib.request.Request(url, headers={
        "User-Agent": "under-fire-data-pipeline (github.com/alfierees/under-fire)",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_rocketalert(from_date, to_date):
    """Fetch alerts from RocketAlert.live, windowed. Returns master-schema rows."""
    rows = []
    cur = from_date
    while cur <= to_date:
        end = min(cur + timedelta(days=FETCH_WINDOW_DAYS - 1), to_date)
        url = (f"{ROCKETALERT}?from={cur:%Y-%m-%d}&to={end:%Y-%m-%d}")
        data = fetch_json(url)
        if not data.get("success"):
            raise RuntimeError(f"RocketAlert API error for {url}: "
                               f"{data.get('error')}")
        payload = data.get("payload") or []
        for day in payload:
            for a in day.get("alerts", []):
                rows.append({
                    "timestamp": a["timeStamp"],
                    "city_he": a.get("name", ""),
                    "city_en": a.get("englishName", "") or "",
                    "lat": a.get("lat", ""),
                    "lon": a.get("lon", ""),
                    "area_en": a.get("areaNameEn", "") or "",
                    "alert_type_id": a.get("alertTypeId", 1),
                    "origin": "",  # attributed below
                    "source": "rocketalert-live",
                })
        cur = end + timedelta(days=1)
    return rows


def fetch_tzevaadom_fallback(existing_rows):
    """Fallback: last ~11 days from tzevaadom, enriched via master's cities."""
    city_lookup = {}
    for r in existing_rows:
        city_lookup.setdefault(r["city_he"], (r["city_en"], r["lat"],
                                              r["lon"], r["area_en"]))
    data = fetch_json(TZEVAADOM)
    rows, skipped = [], 0
    for event in data:
        for alert in event.get("alerts", []):
            if alert.get("isDrill"):
                continue
            ts = datetime.fromtimestamp(alert["time"], tz=ISRAEL_TZ)
            # tzevaadom threat codes: 0 = rockets/missiles, 5 = hostile aircraft
            type_id = 2 if alert.get("threat") == 5 else 1
            for city in alert.get("cities", []):
                if city not in city_lookup:
                    skipped += 1
                    continue
                en, lat, lon, area = city_lookup[city]
                rows.append({
                    "timestamp": ts.strftime("%Y-%m-%d %H:%M:%S"),
                    "city_he": city, "city_en": en, "lat": lat, "lon": lon,
                    "area_en": area, "alert_type_id": type_id,
                    "origin": "", "source": "tzevaadom-fallback",
                })
    if skipped:
        print(f"  fallback: skipped {skipped} alerts for unknown cities")
    return rows


def enrich_rows(new_rows, existing_rows):
    """Fill missing city_en / lat / lon / area_en on fetched rows.

    Coordinates and English names come from the Tzofar city database;
    area_en is assigned from the geographically nearest city already in the
    master (alert areas are contiguous regions, so nearest-known-city is a
    sound approximation for brand-new alert zones).
    """
    needs = [r for r in new_rows
             if not r["lat"] or not r["lon"] or not r["city_en"]
             or not r["area_en"]]
    if not needs:
        return

    try:
        cities = fetch_json(TZEVAADOM_CITIES).get("cities", {})
    except Exception as e:
        print(f"  city DB fetch failed ({e}); leaving "
              f"{len(needs)} rows unenriched")
        return

    known = []  # (lat, lon, area_en) from rows that have both
    seen_cities = set()
    for r in existing_rows:
        if r["lat"] and r["area_en"] and r["city_he"] not in seen_cities:
            seen_cities.add(r["city_he"])
            known.append((float(r["lat"]), float(r["lon"]), r["area_en"]))

    def nearest_area(lat, lon):
        best, best_d = "", float("inf")
        for klat, klon, area in known:
            d = (klat - lat) ** 2 + (klon - lon) ** 2
            if d < best_d:
                best_d, best = d, area
        return best

    enriched = unresolved = 0
    for r in needs:
        c = cities.get(r["city_he"])
        if not c:
            unresolved += 1
            continue
        r["city_en"] = r["city_en"] or c.get("en", "")
        r["lat"] = r["lat"] or c.get("lat", "")
        r["lon"] = r["lon"] or c.get("lng", "")
        if not r["area_en"] and r["lat"]:
            r["area_en"] = nearest_area(float(r["lat"]), float(r["lon"]))
        enriched += 1
    print(f"  enriched {enriched} rows from city DB"
          + (f"; {unresolved} unresolved" if unresolved else ""))


def load_master_rows():
    with gzip.open(MASTER, "rt", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def save_master_rows(rows):
    rows.sort(key=lambda r: r["timestamp"])
    with gzip.open(MASTER, "wt", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def main():
    existing = load_master_rows()
    watermark = max(r["timestamp"] for r in existing)[:10]
    today = datetime.now(ISRAEL_TZ).date()
    from_date = datetime.strptime(watermark, "%Y-%m-%d").date()
    print(f"Master: {len(existing):,} alerts, last date {watermark}; "
          f"fetching {from_date} → {today}")

    try:
        fetched = fetch_rocketalert(from_date, today)
        print(f"RocketAlert returned {len(fetched):,} alerts in range")
    except Exception as e:
        print(f"RocketAlert fetch failed ({e}); trying tzevaadom fallback")
        fetched = fetch_tzevaadom_fallback(existing)
        print(f"tzevaadom returned {len(fetched):,} alerts")

    seen = {(r["timestamp"], r["city_he"]) for r in existing}
    new = [r for r in fetched
           if (r["timestamp"], r["city_he"]) not in seen]
    # in-batch dedup too (APIs occasionally repeat records)
    unique_new, batch_seen = [], set()
    for r in sorted(new, key=lambda r: r["timestamp"]):
        key = (r["timestamp"], r["city_he"])
        if key not in batch_seen:
            batch_seen.add(key)
            unique_new.append(r)

    if not unique_new:
        print("No new alerts — nothing to do.")
        return

    enrich_rows(unique_new, existing)
    iran_days = attribution.detect_iran_days(existing + unique_new)
    attribution.attribute(unique_new, iran_days)
    by_origin = {}
    for r in unique_new:
        by_origin[r["origin"]] = by_origin.get(r["origin"], 0) + 1
    print(f"Appending {len(unique_new):,} new alerts: {by_origin}")

    save_master_rows(existing + unique_new)
    process_data.main()

    # downstream aggregates derived from the 7 base files
    scripts_dir = Path(__file__).parent
    for script in ("generate_extra_aggregates.py",
                   "generate_story_chapters.py"):
        subprocess.run([sys.executable, str(scripts_dir / script)],
                       check=True)
        print(f"  ran {script}")

    bump_data_version()
    print("Done.")


def bump_data_version():
    """Bump DATA_V in shared.js so browsers fetch the fresh JSONs."""
    shared = ROOT / "src/js/shared.js"
    today = datetime.now(ISRAEL_TZ).strftime("%Y%m%d")
    text = shared.read_text(encoding="utf-8")
    new_text = re.sub(r"const DATA_V = '\d+';",
                      f"const DATA_V = '{today}';", text)
    if new_text != text:
        shared.write_text(new_text, encoding="utf-8")
        print(f"  bumped DATA_V → {today}")


if __name__ == "__main__":
    main()
