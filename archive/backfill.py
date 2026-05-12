"""
UNDER FIRE — Historical Backfill
==================================
One-time script to pull historical Tzeva Adom data going back N days.
Run manually or triggered by GitHub Actions with --days parameter.

Usage:
    python scripts/backfill.py --days 365
    python scripts/backfill.py --from 2023-10-07 --to 2024-12-31
"""

import argparse
import time
from datetime import datetime, timedelta
from pathlib import Path
import sys

# Reuse scraper functions
sys.path.insert(0, str(Path(__file__).parent))
from oref_scraper import (
    fetch_history, load_data, save_data,
    merge_new_alerts, log
)


def backfill(start_date: datetime, end_date: datetime, chunk_days=30):
    """Fetch history in chunks to avoid overwhelming the API."""
    store = load_data()
    before = store["total_count"]

    current = start_date
    while current < end_date:
        chunk_end = min(current + timedelta(days=chunk_days), end_date)
        log(f"Fetching: {current.strftime('%Y-%m-%d')} → {chunk_end.strftime('%Y-%m-%d')}")

        raw = fetch_history(current, chunk_end)
        if isinstance(raw, list) and raw:
            added = merge_new_alerts(store, raw)
            log(f"  → {added} new alerts (total: {store['total_count']})")
            save_data(store)
        else:
            log(f"  → No data for this period")

        current = chunk_end + timedelta(days=1)
        time.sleep(2)  # be polite — 2s between API calls

    total_new = store["total_count"] - before
    log(f"\n✓ Backfill complete. Added {total_new} alerts. Total: {store['total_count']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--days",  type=int, default=0,  help="Days of history from today")
    parser.add_argument("--from",  dest="from_date", default=None, help="Start date YYYY-MM-DD")
    parser.add_argument("--to",    dest="to_date",   default=None, help="End date YYYY-MM-DD")
    args = parser.parse_args()

    now = datetime.now()

    if args.days > 0:
        start = now - timedelta(days=args.days)
        end   = now
    elif args.from_date and args.to_date:
        start = datetime.strptime(args.from_date, "%Y-%m-%d")
        end   = datetime.strptime(args.to_date,   "%Y-%m-%d")
    else:
        # Default: last 365 days
        start = now - timedelta(days=365)
        end   = now

    log(f"Backfill: {start.strftime('%Y-%m-%d')} → {end.strftime('%Y-%m-%d')}")
    backfill(start, end)
