"""
UNDER FIRE — One-off master dataset builder
============================================
Converts the gitignored raw RocketAlert.live dumps (data/raw/data1.json,
data/raw/data2.json) into the compact committed master used by the
auto-update pipeline: data/master/alerts.csv.gz

Run once locally:  python3 scripts/build_master.py
"""

import csv
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_FILES = [ROOT / "data/raw/data1.json", ROOT / "data/raw/data2.json"]
MASTER = ROOT / "data/master/alerts.csv.gz"

FIELDS = ["timestamp", "city_he", "city_en", "lat", "lon",
          "area_en", "alert_type_id", "origin", "source"]


def main():
    rows = []
    for raw_path in RAW_FILES:
        source = raw_path.stem  # data1 / data2
        with open(raw_path) as f:
            days = json.load(f)
        for day in days:
            for a in day["alerts"]:
                rows.append({
                    "timestamp": a["timeStamp"],
                    "city_he": a.get("name", ""),
                    "city_en": a.get("englishName", ""),
                    "lat": a.get("lat", ""),
                    "lon": a.get("lon", ""),
                    "area_en": a.get("areaNameEn", ""),
                    "alert_type_id": a.get("alertTypeId", 1),
                    "origin": a.get("origin", "") or "Unknown",
                    "source": source,
                })
    # stable sort by timestamp only — preserves raw-file order for alerts
    # sharing the same second (the oct7 replay animation relies on it)
    rows.sort(key=lambda r: r["timestamp"])

    MASTER.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(MASTER, "wt", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows):,} alerts to {MASTER} "
          f"({MASTER.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
