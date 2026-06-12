"""
UNDER FIRE — Origin attribution for new alerts
===============================================
The historical dataset (data2.json era) carries an estimated `origin` label
(Hamas / Hezbollah / Houthis / Iran / Unknown). The RocketAlert.live API does
not provide this field, so newly ingested alerts are attributed here.

Method (validated against the 134,241 labelled historical alerts):
  1. Group alerts into salvo clusters (gap <= 15 min). 95% of historical
     clusters are single-origin, so attribution is per-cluster.
  2. Detect "Iran barrage days": >= 400 alerts/day outside the northern and
     Gaza-envelope areas, on/after 2024-04-13 (first ever Iranian attack).
     Single quiet days sandwiched inside a barrage window are bridged in.
     This reproduces all 43 historically labelled Iran days (100% recall,
     1 false-positive day).
  3. Per cluster:
       - on an Iran day: small pure-north salvos -> Hezbollah, small pure-Gaza
         salvos -> Hamas, everything else -> Iran
       - otherwise: majority-north -> Hezbollah, majority-Gaza -> Hamas,
         anything central/nationwide -> Houthis (from 2024-09-15, their first
         attack) or Hamas before that.

Agreement with the historical labels: 93.1% overall, 95.5% on the
post-June-2025 regime the live pipeline operates in. Labels produced here are
estimates, exactly like the historical ones.
"""

from collections import Counter, defaultdict
from datetime import datetime, timedelta

NORTH_AREAS = {
    "Confrontation Line", "Upper Galilee", "Center Galilee", "Lower Galilee",
    "Northern Golan", "Southern Golan", "HaAmakim", "Wadi Ara", "Menashe",
    "HaMifratz", "HaCarmel", "Beit Sha'an Valley",
}
GAZA_AREAS = {"Gaza Envelope", "Western Negev"}

FIRST_IRAN_ATTACK = "2024-04-13"
FIRST_HOUTHI_ATTACK = "2024-09-15"
IRAN_DAY_CENTRAL_THRESHOLD = 400
CLUSTER_GAP_SECONDS = 900


def _parse_ts(ts: str) -> datetime:
    return datetime.strptime(ts, "%Y-%m-%d %H:%M:%S")


def cluster_alerts(alerts):
    """Group chronologically sorted alerts into salvo clusters."""
    if not alerts:
        return []
    alerts = sorted(alerts, key=lambda a: a["timestamp"])
    clusters, current = [], [alerts[0]]
    for a in alerts[1:]:
        gap = (_parse_ts(a["timestamp"]) - _parse_ts(current[-1]["timestamp"]))
        if gap.total_seconds() <= CLUSTER_GAP_SECONDS:
            current.append(a)
        else:
            clusters.append(current)
            current = [a]
    clusters.append(current)
    return clusters


def detect_iran_days(all_alerts):
    """Return the set of dates classed as Iranian barrage days.

    `all_alerts` must contain enough history around the dates being
    attributed (the full master is fine and cheap).
    """
    central_per_day = defaultdict(int)
    for a in all_alerts:
        area = a.get("area_en", "")
        if area not in NORTH_AREAS and area not in GAZA_AREAS:
            central_per_day[a["timestamp"][:10]] += 1

    core = {d for d, n in central_per_day.items()
            if n >= IRAN_DAY_CENTRAL_THRESHOLD and d >= FIRST_IRAN_ATTACK}

    # bridge 1-2 quiet days that fall inside a barrage window
    bridged = set(core)
    for d in core:
        base = datetime.strptime(d, "%Y-%m-%d")
        for off in range(1, 3):
            cand = (base + timedelta(days=off)).strftime("%Y-%m-%d")
            if any((base + timedelta(days=off + j)).strftime("%Y-%m-%d") in core
                   for j in range(1, 3)):
                bridged.add(cand)
    return bridged


def attribute(new_alerts, iran_days):
    """Set `origin` in-place on each alert dict (keys: timestamp, area_en)."""
    for cluster in cluster_alerts(new_alerts):
        n = len(cluster)
        areas = Counter(a.get("area_en", "") for a in cluster)
        north = sum(v for k, v in areas.items() if k in NORTH_AREAS) / n
        gaza = sum(v for k, v in areas.items() if k in GAZA_AREAS) / n
        day = cluster[0]["timestamp"][:10]

        if day in iran_days:
            if north >= 0.8 and n < 30:
                origin = "Hezbollah"
            elif gaza >= 0.8 and n < 30:
                origin = "Hamas"
            else:
                origin = "Iran"
        elif north >= 0.5:
            origin = "Hezbollah"
        elif gaza >= 0.5:
            origin = "Hamas"
        elif day >= FIRST_HOUTHI_ATTACK:
            origin = "Houthis"
        else:
            origin = "Hamas"

        for a in cluster:
            a["origin"] = origin
    return new_alerts
