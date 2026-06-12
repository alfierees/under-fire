"""
UNDER FIRE — Aggregate verification
====================================
Regenerates the 7 aggregates from the master in-memory and compares them
against the committed data/processed/*.json, with a small tolerance on
floats. Used to prove process_data.py reproduces the original site data.

Run:  python3 scripts/verify_aggregates.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import process_data as pd  # noqa: E402

TOL = 0.002  # absolute tolerance on floats (probabilities rounded to 4dp)

# Known intentional differences from the original committed files.
# peak_day_count in the original held the NATIONAL total on the area's peak
# day (generation bug); the field is unused by the site, and process_data.py
# now emits the area's own count.
IGNORE_KEYS = {"peak_day_count", "peak_day"}


def diff(a, b, path="$", errors=None):
    if errors is None:
        errors = []
    if len(errors) > 20:
        return errors
    if isinstance(a, dict) and isinstance(b, dict):
        for k in a.keys() | b.keys():
            if k in IGNORE_KEYS:
                continue
            if k not in a:
                errors.append(f"{path}.{k}: missing in regenerated")
            elif k not in b:
                errors.append(f"{path}.{k}: extra in regenerated")
            else:
                diff(a[k], b[k], f"{path}.{k}", errors)
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            errors.append(f"{path}: length {len(a)} vs {len(b)}")
        for i, (x, y) in enumerate(zip(a, b)):
            diff(x, y, f"{path}[{i}]", errors)
    elif isinstance(a, (int, float)) and isinstance(b, (int, float)) \
            and not isinstance(a, bool) and not isinstance(b, bool):
        if abs(a - b) > TOL:
            errors.append(f"{path}: {a} != {b}")
    elif a != b:
        errors.append(f"{path}: {a!r} != {b!r}")
    return errors


def check_peak_days(rows, committed):
    """peak_day can legitimately tie; verify by count instead of date."""
    from collections import Counter, defaultdict
    by_area = defaultdict(Counter)
    for r in rows:
        by_area[r["area_en"]][r["date"]] += 1
    errors = []
    for entry in committed:
        days = by_area[entry["area"]]
        if days[entry["peak_day"]] != max(days.values()):
            errors.append(
                f"areas_summary {entry['area']}: committed peak_day "
                f"{entry['peak_day']} is not a maximal day")
    return errors


def main():
    rows = pd.load_master()
    failed = False
    for name, gen in pd.GENERATORS.items():
        committed_path = pd.OUT / f"{name}.json"
        with open(committed_path, encoding="utf-8") as f:
            committed = json.load(f)
        regenerated = gen(rows)
        errors = diff(committed, regenerated, name)
        if name == "areas_summary":
            errors += check_peak_days(rows, committed)
        if errors:
            failed = True
            print(f"FAIL {name}: {len(errors)}+ differences")
            for e in errors[:8]:
                print(f"   {e}")
        else:
            print(f"OK   {name}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
