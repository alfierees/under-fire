"""
UNDER FIRE — Phase 1: ACLED Data Pull
======================================
Pulls conflict event data from ACLED API for Israel, Palestine, Lebanon.
Filters for rocket/missile/shelling events. Saves clean CSV.

SETUP REQUIRED:
1. Register free at: https://developer.acleddata.com/
2. Set your credentials below (or use env vars)
3. pip install requests pandas python-dotenv

ACLED API docs: https://apidocs.acleddata.com/
"""

import requests
import pandas as pd
import json
import os
import time
from datetime import datetime

# ─────────────────────────────────────────────
# CONFIG — set your credentials here
# Or use environment variables: ACLED_KEY, ACLED_EMAIL
# ─────────────────────────────────────────────
ACLED_KEY   = os.getenv("ACLED_KEY", "YOUR_API_KEY_HERE")
ACLED_EMAIL = os.getenv("ACLED_EMAIL", "your@email.com")

BASE_URL = "https://api.acleddata.com/acled/read"

# ─────────────────────────────────────────────
# FETCH FUNCTION
# ─────────────────────────────────────────────
def fetch_acled(country, start_date, end_date, page=1, per_page=500):
    """Fetch a single page of ACLED data for a country + date range."""
    params = {
        "key":        ACLED_KEY,
        "email":      ACLED_EMAIL,
        "country":    country,
        "start_date": start_date,
        "end_date":   end_date,
        "page":       page,
        "limit":      per_page,
        # Focus on explosion/remote violence events
        "event_type": "Explosions/Remote violence",
    }
    r = requests.get(BASE_URL, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def fetch_all_pages(country, start_date, end_date):
    """Paginate through all results for a country."""
    print(f"\n  Fetching: {country} ({start_date} → {end_date})")
    all_data = []
    page = 1

    while True:
        resp = fetch_acled(country, start_date, end_date, page=page)
        data = resp.get("data", [])
        count = resp.get("count", 0)

        if not data:
            break

        all_data.extend(data)
        print(f"    Page {page}: {len(data)} events (total so far: {len(all_data)} / {count})")

        if len(all_data) >= count or len(data) == 0:
            break

        page += 1
        time.sleep(0.5)  # be polite to the API

    return all_data


# ─────────────────────────────────────────────
# MAIN PULL
# ─────────────────────────────────────────────
def pull_data():
    """Pull all relevant data and save raw CSV."""

    # Countries of interest
    targets = [
        ("Israel", "2008-01-01", "2025-12-31"),
        ("Palestine", "2008-01-01", "2025-12-31"),
        ("Lebanon", "2008-01-01", "2025-12-31"),
    ]

    all_records = []

    for country, start, end in targets:
        try:
            records = fetch_all_pages(country, start, end)
            for r in records:
                r["_source_country"] = country
            all_records.extend(records)
        except Exception as e:
            print(f"  ERROR fetching {country}: {e}")

    df = pd.DataFrame(all_records)
    print(f"\n✓ Total records pulled: {len(df)}")

    # Save raw
    df.to_csv("data/raw_acled.csv", index=False)
    print("✓ Saved: data/raw_acled.csv")

    return df


# ─────────────────────────────────────────────
# CLEANING & FILTERING
# ─────────────────────────────────────────────
def clean_data(df):
    """
    Clean and filter to rocket/missile events directed at Israel.

    ACLED sub_event_types relevant to us:
     - 'Shelling/artillery/missile attack'
     - 'Air/drone strike'  (we'll keep to cross-check IDF strikes)
     - 'Rocket attack'  (not always coded separately)
    """

    # Parse dates
    df["event_date"] = pd.to_datetime(df["event_date"], errors="coerce")
    df["year"]  = df["event_date"].dt.year
    df["month"] = df["event_date"].dt.month
    df["dow"]   = df["event_date"].dt.day_name()   # day of week
    df["week"]  = df["event_date"].dt.isocalendar().week.astype(int)

    # Numeric coordinates
    df["latitude"]  = pd.to_numeric(df["latitude"],  errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
    df["fatalities"] = pd.to_numeric(df["fatalities"], errors="coerce").fillna(0)

    # Print all sub_event_types so we can see what's available
    print("\nAll sub_event_types in dataset:")
    print(df["sub_event_type"].value_counts().to_string())

    # ── FILTER: events where Israel is the target (not perpetrator) ──
    # ACLED codes: country = where it happened, actor1 = perpetrator, actor2 = target
    # For rockets INTO Israel, the event location is Israel, and actor1 is a Palestinian/Lebanese/Iranian group

    ROCKET_TYPES = [
        "Shelling/artillery/missile attack",
        "Remote explosive/landmine/IED",  # occasionally used
    ]

    MILITANT_KEYWORDS = [
        "Hamas", "Hezbollah", "Islamic Jihad", "PIJ", "Fatah", "PFLP",
        "Palestinian", "Houthi", "IRGC", "Iran", "Izz", "Qassam",
        "Al-Qassam", "Abu Ali Mustafa", "resistance", "Resistance",
    ]

    # Filter sub-event types
    df_filtered = df[df["sub_event_type"].isin(ROCKET_TYPES)].copy()

    # Keep events in Israel (the country being targeted) OR
    # events in Lebanon/Palestine where the attack direction is toward Israel
    # (ACLED codes some cross-border events at the launch location)
    df_israel = df_filtered[df_filtered["country"] == "Israel"].copy()

    # Also get cross-border events from Lebanon/Palestine targeting Israel
    # These will have notes/actor fields referencing Israel as target
    df_cross = df_filtered[
        (df_filtered["country"].isin(["Palestine", "Lebanon"])) &
        (df_filtered["notes"].str.contains("Israel|Israeli", case=False, na=False))
    ].copy()

    df_clean = pd.concat([df_israel, df_cross], ignore_index=True)

    # Tag actor category
    def classify_actor(actor_str):
        if pd.isna(actor_str):
            return "Unknown"
        actor = str(actor_str)
        if any(k in actor for k in ["Hamas", "Qassam", "Al-Qassam"]):
            return "Hamas"
        if any(k in actor for k in ["Hezbollah", "Hizballah"]):
            return "Hezbollah"
        if any(k in actor for k in ["Islamic Jihad", "PIJ", "Abu Ali"]):
            return "PIJ"
        if any(k in actor for k in ["PFLP", "Fatah", "Palestinian"]):
            return "Other Palestinian"
        if any(k in actor for k in ["Houthi", "Ansar", "Yemen"]):
            return "Houthis"
        if any(k in actor for k in ["Iran", "IRGC"]):
            return "Iran Direct"
        return "Unknown"

    df_clean["actor_group"] = df_clean["actor1"].apply(classify_actor)

    # Drop duplicates (same event_id)
    df_clean = df_clean.drop_duplicates(subset=["event_id_cnty"])

    print(f"\n✓ Filtered to {len(df_clean)} rocket/missile events targeting Israel")
    print("\nActor breakdown:")
    print(df_clean["actor_group"].value_counts().to_string())

    df_clean.to_csv("data/clean_acled.csv", index=False)
    print("\n✓ Saved: data/clean_acled.csv")

    return df_clean


# ─────────────────────────────────────────────
# QUICK EDA SUMMARY
# ─────────────────────────────────────────────
def quick_eda(df):
    """Print a quick summary of the cleaned dataset."""

    print("\n" + "═"*60)
    print("QUICK EDA SUMMARY")
    print("═"*60)

    print(f"\nDate range: {df['event_date'].min().date()} → {df['event_date'].max().date()}")
    print(f"Total events: {len(df):,}")
    print(f"Total fatalities: {df['fatalities'].sum():,.0f}")
    print(f"Countries in data: {df['country'].unique().tolist()}")

    print("\n── Events by Year ──")
    by_year = df.groupby("year").size().reset_index(name="count")
    for _, row in by_year.iterrows():
        bar = "█" * int(row["count"] / by_year["count"].max() * 30)
        print(f"  {int(row['year'])}: {bar} {row['count']:,}")

    print("\n── Events by Actor ──")
    print(df["actor_group"].value_counts().to_string())

    print("\n── Events by Day of Week ──")
    dow_order = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
    dow_counts = df.groupby("dow").size().reindex(dow_order)
    for day, count in dow_counts.items():
        bar = "█" * int(count / dow_counts.max() * 25)
        print(f"  {day:12s}: {bar} {count:,}")

    print("\n── Top 10 Locations ──")
    print(df["location"].value_counts().head(10).to_string())

    # Note on time-of-day
    print("\n── NOTE: Time of Day ──")
    print("  ACLED does not typically record time-of-day for events.")
    print("  Time patterns will require supplementary sources (news scraping,")
    print("  IDF reports, or GDELT news media timestamps).")

    print("\n" + "═"*60)


# ─────────────────────────────────────────────
# CONFLICT EPISODE LABELS
# ─────────────────────────────────────────────
CONFLICT_EPISODES = [
    {"name": "Operation Cast Lead",        "start": "2008-12-27", "end": "2009-01-18", "actor": "Hamas"},
    {"name": "Operation Pillar of Defence","start": "2012-11-14", "end": "2012-11-21", "actor": "Hamas"},
    {"name": "Operation Protective Edge",  "start": "2014-07-08", "end": "2014-08-26", "actor": "Hamas"},
    {"name": "2019 May Escalation",        "start": "2019-05-03", "end": "2019-05-06", "actor": "PIJ/Hamas"},
    {"name": "Operation Guardian of Walls","start": "2021-05-10", "end": "2021-05-21", "actor": "Hamas"},
    {"name": "Operation Breaking Dawn",    "start": "2022-08-05", "end": "2022-08-07", "actor": "PIJ"},
    {"name": "Operation Shield & Arrow",   "start": "2023-05-09", "end": "2023-05-13", "actor": "PIJ"},
    {"name": "October 7 War (begins)",     "start": "2023-10-07", "end": "2025-12-31", "actor": "Hamas/Hezbollah/Houthis/Iran"},
    {"name": "Iran Direct Strike",         "start": "2024-04-13", "end": "2024-04-14", "actor": "Iran Direct"},
    {"name": "Iran Direct Strike 2",       "start": "2024-10-01", "end": "2024-10-02", "actor": "Iran Direct"},
]

def tag_episodes(df):
    """Add episode column to dataframe."""
    df["episode"] = "Inter-conflict"
    for ep in CONFLICT_EPISODES:
        mask = (df["event_date"] >= ep["start"]) & (df["event_date"] <= ep["end"])
        df.loc[mask, "episode"] = ep["name"]
    return df


# ─────────────────────────────────────────────
# RUN
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import os
    os.makedirs("data", exist_ok=True)

    print("UNDER FIRE — ACLED Data Pull")
    print("─" * 40)
    print("Checking credentials...")

    if ACLED_KEY == "YOUR_API_KEY_HERE":
        print("\n⚠  No API key set.")
        print("   Register free at: https://developer.acleddata.com/")
        print("   Then set ACLED_KEY and ACLED_EMAIL environment variables.")
        print("   Or edit this file directly.\n")

        # ── DEMO MODE: load from cache if exists ──
        if os.path.exists("data/raw_acled.csv"):
            print("Found cached data — loading for EDA demo...")
            df_raw = pd.read_csv("data/raw_acled.csv")
            df_raw["event_date"] = pd.to_datetime(df_raw["event_date"], errors="coerce")
            df_clean = clean_data(df_raw)
            df_clean = tag_episodes(df_clean)
            quick_eda(df_clean)
        else:
            print("No cached data found. Please set up API credentials to proceed.")
    else:
        # Live pull
        df_raw   = pull_data()
        df_clean = clean_data(df_raw)
        df_clean = tag_episodes(df_clean)
        quick_eda(df_clean)

    print("\nNext: run 02_eda_temporal.py")
