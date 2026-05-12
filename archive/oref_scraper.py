"""
UNDER FIRE — OREF / Tzeva Adom Alert Scraper
=============================================
Polls the Israeli Home Front Command (OREF) API for rocket alerts.
Designed to run on a schedule (GitHub Actions, cron, etc.) and
append new alerts to a cumulative JSON data file.

No API key required — OREF is a public government endpoint.

Run manually:   python scripts/oref_scraper.py
Run via cron:   */10 * * * * python /path/to/scripts/oref_scraper.py
"""

import requests
import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
DATA_FILE   = Path("data/alerts.json")
LOG_FILE    = Path("data/scraper.log")
BASE_OREF   = "https://www.oref.org.il"

HEADERS = {
    "Referer":       "https://www.oref.org.il/",
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent":    "Mozilla/5.0 (compatible; research-bot/1.0)",
    "Accept":        "application/json, text/javascript, */*",
}

# ─────────────────────────────────────────────
# CITY → COORDINATES LOOKUP
# Covers major alert-receiving cities/areas
# Extend as needed
# ─────────────────────────────────────────────
CITY_COORDS = {
    # Tel Aviv metro
    "תל אביב - יפו": (32.0853, 34.7818),
    "תל אביב":       (32.0853, 34.7818),
    "בת ים":         (32.0204, 34.7508),
    "חולון":         (32.0130, 34.7795),
    "פתח תקווה":     (32.0840, 34.8878),
    "בני ברק":       (32.0836, 34.8338),
    "רמת גן":        (32.0707, 34.8238),
    "גבעתיים":       (32.0719, 34.8118),
    "רמת השרון":     (32.1466, 34.8350),
    "הרצליה":        (32.1664, 34.8440),

    # Jerusalem
    "ירושלים":       (31.7683, 35.2137),
    "בית שמש":       (31.7469, 34.9882),

    # Haifa / North
    "חיפה":          (32.7940, 34.9896),
    "נשר":           (32.7598, 35.0388),
    "קריית ביאליק":  (32.8369, 35.0798),
    "עכו":           (32.9281, 35.0818),
    "נהריה":         (33.0046, 35.0972),
    "קריית שמונה":   (33.2070, 35.5688),
    "צפת":           (32.9646, 35.4969),
    "טבריה":         (32.7921, 35.5311),
    "נצרת":          (32.6996, 35.3035),

    # South / Gaza envelope
    "שדרות":         (31.5246, 34.5965),
    "אשקלון":        (31.6688, 34.5742),
    "אשדוד":         (31.8040, 34.6553),
    "באר שבע":       (31.2519, 34.7913),
    "נתיבות":        (31.4217, 34.5880),
    "אופקים":        (31.3118, 34.6213),
    "קריית גת":      (31.6089, 34.7642),
    "קריית מלאכי":   (31.7320, 34.7430),
    "רהט":           (31.3935, 34.7545),
    "דימונה":        (31.0673, 35.0336),

    # Center
    "ראשון לציון":   (31.9650, 34.8053),
    "רחובות":        (31.8928, 34.8113),
    "נס ציונה":      (31.9300, 34.8000),
    "לוד":           (31.9527, 34.8954),
    "רמלה":          (31.9292, 34.8706),
    "מודיעין":       (31.8969, 35.0095),
    "ראש העין":      (32.0956, 34.9576),
    "כפר סבא":       (32.1789, 34.9077),
    "נתניה":         (32.3329, 34.8598),
    "הוד השרון":     (32.1516, 34.8875),
    "רעננה":         (32.1842, 34.8706),

    # Gush Dan / misc
    "גדרה":          (31.8107, 34.7773),
    "יבנה":          (31.8780, 34.7394),
    "קיסריה":        (32.5013, 34.9049),

    # Fallback for unknown
    "אזור לא ידוע":  (31.5, 34.9),
}

def get_coords(city_name):
    """Look up coordinates for a city name. Fuzzy fallback."""
    if city_name in CITY_COORDS:
        return CITY_COORDS[city_name]
    # Partial match
    for key, val in CITY_COORDS.items():
        if city_name in key or key in city_name:
            return val
    # Centre of Israel as fallback
    return (31.5, 34.9)


# ─────────────────────────────────────────────
# FETCH FUNCTIONS
# ─────────────────────────────────────────────
def fetch_live_alerts():
    """
    Fetch currently active alert (if any).
    This endpoint returns an empty response or {"cat":"1","data":[...],"desc":"...","id":"...","title":"..."}
    """
    try:
        url = f"{BASE_OREF}/WarningMessages/alert/alerts.json"
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code == 200 and r.text.strip() and r.text.strip() != "":
            data = r.json()
            if "data" in data and data["data"]:
                return data
    except Exception as e:
        log(f"Live fetch error: {e}")
    return None


def fetch_history(from_date, to_date):
    """
    Fetch historical alerts for a date range.
    from_date / to_date: datetime objects
    """
    url = f"{BASE_OREF}/Shared/Ajax/GetAlertsHistory.aspx"
    params = {
        "lang":     "he",
        "fromDate": from_date.strftime("%d.%m.%Y"),
        "toDate":   to_date.strftime("%d.%m.%Y"),
    }
    try:
        r = requests.get(url, headers=HEADERS, params=params, timeout=20)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        log(f"History fetch error: {e}")
    return []


def fetch_recent_history():
    """Fetch the last 7 days to catch anything missed."""
    now = datetime.now()
    return fetch_history(now - timedelta(days=7), now)


# ─────────────────────────────────────────────
# DATA MANAGEMENT
# ─────────────────────────────────────────────
def load_data():
    """Load existing alerts JSON, or return empty structure."""
    if DATA_FILE.exists():
        with open(DATA_FILE) as f:
            return json.load(f)
    return {
        "meta": {
            "description": "UNDER FIRE — Israeli Red Alert (Tzeva Adom) Data",
            "source":      "OREF / Israeli Home Front Command (oref.org.il)",
            "note":        "Automatically collected. Timestamps in Israel time (Asia/Jerusalem).",
            "first_collected": datetime.now(timezone.utc).isoformat(),
        },
        "last_updated":  None,
        "total_count":   0,
        "alerts":        [],
    }


def save_data(store):
    """Save data back to JSON."""
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    store["last_updated"] = datetime.now(timezone.utc).isoformat()
    store["total_count"]  = len(store["alerts"])
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False, indent=2)


def normalise_alert(raw):
    """
    Convert a raw OREF alert record into our normalised schema.

    OREF history record fields vary — handle multiple formats.
    """
    # OREF history format: {"alertDate":"2024-10-15 14:31:22","city":"שדרות","category":"1"}
    # Live alert format can differ
    city = raw.get("city") or raw.get("data", [""])[0] if isinstance(raw.get("data"), list) else ""

    date_str = raw.get("alertDate") or raw.get("date") or ""
    # Parse datetime
    dt = None
    for fmt in ["%Y-%m-%d %H:%M:%S", "%d.%m.%Y %H:%M:%S", "%Y-%m-%dT%H:%M:%S"]:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            break
        except Exception:
            continue

    lat, lng = get_coords(city)

    return {
        "id":       f"{date_str}_{city}".replace(" ", "_"),
        "date":     dt.strftime("%Y-%m-%d") if dt else date_str[:10],
        "time":     dt.strftime("%H:%M:%S") if dt else "",
        "hour":     dt.hour if dt else -1,
        "dow":      (dt.weekday() + 6) % 7 if dt else -1,  # 0=Mon
        "month":    dt.month if dt else -1,
        "year":     dt.year if dt else -1,
        "city":     city,
        "lat":      lat,
        "lng":      lng,
        "category": str(raw.get("category", "1")),  # 1=rockets, 6=infiltration, etc.
        "raw_city_he": city,
    }


def merge_new_alerts(store, raw_alerts):
    """Deduplicate and append new alerts."""
    existing_ids = {a["id"] for a in store["alerts"]}
    added = 0
    for raw in raw_alerts:
        normalised = normalise_alert(raw)
        if normalised["id"] not in existing_ids:
            store["alerts"].append(normalised)
            existing_ids.add(normalised["id"])
            added += 1
    # Keep sorted by date+time
    store["alerts"].sort(key=lambda a: (a["date"], a["time"]))
    return added


# ─────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────
def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def run():
    log("─── Scraper run started ───")
    store = load_data()
    before = store["total_count"]

    # 1. Check for live active alert
    live = fetch_live_alerts()
    live_added = 0
    if live:
        live_added = merge_new_alerts(store, [{"alertDate": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), **live}])
        log(f"Live alert captured: {live_added} new")

    # 2. Fetch recent history (catches anything missed between runs)
    history = fetch_recent_history()
    if isinstance(history, list):
        hist_added = merge_new_alerts(store, history)
        log(f"History fetch: {len(history)} records, {hist_added} new")

    total_added = store["total_count"] - before

    if total_added > 0:
        save_data(store)
        log(f"✓ Saved: {total_added} new alerts (total: {store['total_count']})")
    else:
        # Still update timestamp even if no new alerts
        save_data(store)
        log(f"No new alerts. Total: {store['total_count']}")

    log("─── Run complete ───")
    return total_added


if __name__ == "__main__":
    run()
