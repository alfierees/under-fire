#!/usr/bin/env python3
"""
Build data/processed/area_polygons.json — one dissolved polygon per Home Front
Command alert area, for the Area Vulnerability choropleth map.

Source: tzevaadom.co.il static data (the Red Alert app's polygon set).
  - polygons.json : { cityId: [[lat,lon], ...] }  (one closed ring per city)
  - cities.json   : { cities: { name: {id, area, ...} }, areas: { id: {en, he} } }

Each city's `area` integer maps to an English area name that matches our 30
area_en values verbatim. We group every city ring by area name, dissolve them
into one (multi)polygon with shapely, simplify lightly, and emit GeoJSON with
coordinates in [lon, lat] order (GeoJSON / Leaflet convention).

Alert counts are NOT baked in — the map joins these static shapes against the
live areas_summary.json at runtime so the choropleth updates with the pipeline.

This is a one-off / rarely-run build (areas don't change). Run locally; the
output JSON is committed. Needs shapely (not available in the stdlib-only CI).

Run:  python3 scripts/build_area_polygons.py
"""
import json
import urllib.request
from collections import defaultdict
from pathlib import Path

SOURCES = {
    "polygons.json": "https://www.tzevaadom.co.il/static/polygons.json",
    "cities.json": "https://www.tzevaadom.co.il/static/cities.json",
}


def load_source(name):
    """Read data/raw/<name>, fetching it from tzevaadom.co.il if missing
    (data/raw is gitignored, so a clean checkout has no copy)."""
    path = RAW / name
    if not path.exists():
        RAW.mkdir(parents=True, exist_ok=True)
        print(f"fetching {SOURCES[name]} …")
        req = urllib.request.Request(SOURCES[name], headers={"User-Agent": "under-fire-build"})
        with urllib.request.urlopen(req, timeout=30) as r:
            path.write_bytes(r.read())
    return json.loads(path.read_text())

from shapely.geometry import Polygon, MultiPolygon, MultiPoint, mapping
from shapely.ops import unary_union, voronoi_diagram
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data/raw"
OUT = ROOT / "data/processed/area_polygons.json"
SIMPLIFY_TOL = 0.0015  # ~150 m; smooths internal jitter, keeps the silhouette
# morphological closing on the national footprint, to fill the gaps between
# towns so the clipped tessellation covers Israel as one solid shape
CLOSE = 0.06
MIN_PART_AREA = 0.0004  # drop sub-km noise, keep small real clusters (e.g. Eilat)


def solidify(geom):
    """Drop interior holes and tiny island fragments so the footprint reads as
    one continuous landmass."""
    parts = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
    kept = [Polygon(p.exterior) for p in parts if p.area >= MIN_PART_AREA]
    return unary_union(kept) if kept else geom

# our canonical 30 area names (must match areas_summary.json / area_en)
EXPECTED = {
    "Gaza Envelope", "Lakhish", "Western Lakhish", "Western Negev",
    "Central Negev", "Southern Negev", "Arabah", "Eilat", "Shfela (Lowlands)",
    "Shfelat Yehuda", "Jerusalem", "Judea", "Dead Sea", "Samaria", "Sharon",
    "Yarkon", "Dan", "HaAmakim", "Menashe", "Wadi Ara", "HaCarmel",
    "HaMifratz", "Center Galilee", "Lower Galilee", "Upper Galilee",
    "Confrontation Line", "Southern Golan", "Northern Golan", "Bika'a",
    "Beit Sha'an Valley",
}


def main():
    polygons = load_source("polygons.json")
    cities = load_source("cities.json")
    areas = cities["areas"]

    # national footprint = union of every city polygon, then "closed" (buffer
    # out, then back in) so the gaps between towns fill into one solid Israel.
    city_polys = []
    for ring in polygons.values():
        if len(ring) < 3:
            continue
        p = Polygon([(lon, lat) for lat, lon in ring])  # -> [lon, lat]
        if not p.is_valid:
            p = p.buffer(0)
        if p.is_valid and not p.is_empty:
            city_polys.append(p)
    footprint = solidify(unary_union(city_polys).buffer(CLOSE).buffer(-CLOSE * 0.85))

    # one Voronoi seed per city (cities.json carries lat/lng + area for all),
    # so every point of the country is coloured by its nearest town's region.
    seeds, seed_area = [], []
    seen = set()
    for c in cities["cities"].values():
        a = areas.get(str(c.get("area")))
        lat, lng = c.get("lat"), c.get("lng")
        if not a or lat is None or lng is None:
            continue
        key = (round(lng, 5), round(lat, 5))
        if key in seen:
            continue
        seen.add(key)
        seeds.append((lng, lat))
        seed_area.append(a["en"])

    pts = MultiPoint(seeds)
    cells = list(voronoi_diagram(pts, envelope=footprint).geoms)

    # match each Voronoi cell back to the seed it contains, then clip to Israel
    tree = STRtree(MultiPoint(seeds).geoms)
    area_pieces = defaultdict(list)
    for cell in cells:
        hit = tree.query(cell, predicate="contains")
        if len(hit) == 0:
            continue
        clipped = cell.intersection(footprint)
        if clipped.is_empty:
            continue
        area_pieces[seed_area[hit[0]]].append(clipped)

    features = []
    for area_en in sorted(area_pieces):
        merged = unary_union(area_pieces[area_en]).simplify(SIMPLIFY_TOL, preserve_topology=True)
        features.append({
            "type": "Feature",
            "properties": {"area": area_en},
            "geometry": mapping(merged),
        })

    fc = {"type": "FeatureCollection",
          "meta": {"source": "tzevaadom.co.il static polygons",
                   "build_date": cities.get("@BUILD_DATE")},
          "features": features}
    OUT.write_text(json.dumps(fc, separators=(",", ":")))

    got = {f["properties"]["area"] for f in features}
    print(f"areas: {len(features)}  seeds: {len(seeds)}  cells: {len(cells)}")
    print(f"size: {OUT.stat().st_size // 1024} KB")
    missing = EXPECTED - got
    extra = got - EXPECTED
    if missing:
        print(f"  WARNING missing areas: {missing}")
    if extra:
        print(f"  note: extra areas not in our 30: {extra}")
    if not missing and not extra:
        print("  all 30 areas matched exactly")


if __name__ == "__main__":
    main()
