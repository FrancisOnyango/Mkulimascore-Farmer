"""KAMIS market intelligence — server side only.

The farmer app must not call KAMIS. This worker fetches the public market
table, normalizes units, joins geocoded markets, and returns latest reported
prices with freshness. It is not a tick-by-tick exchange feed.
"""

from __future__ import annotations

import math
import re
import time
import urllib.request
from datetime import datetime, timezone
from typing import Any

_CACHE: dict[str, Any] = {"at": 0.0, "rows": []}
CACHE_SECONDS = 4 * 60 * 60

KAMIS_URL = "https://kamis.kilimo.go.ke/site/market?per_page=80"
KAMIS_SOURCE = "KAMIS"
SOURCE_LABEL = "Ministry of Agriculture (KAMIS)"
USER_AGENT = "MkulimaScore-MarketIngest/0.1 (server ingest; not a farmer client)"

# OSM / known marketplace coordinates. Aliases match KAMIS market names.
MARKETS: list[dict[str, Any]] = [
    {"id": "karatina", "name": "Karatina Market", "town": "Karatina", "county": "Nyeri", "lat": -0.4832, "lng": 37.1274, "aliases": ["karatina"]},
    {"id": "nyeri", "name": "Nyeri Open Market", "town": "Nyeri", "county": "Nyeri", "lat": -0.4167, "lng": 36.95, "aliases": ["nyeri"]},
    {"id": "nanyuki", "name": "Nanyuki Market", "town": "Nanyuki", "county": "Laikipia", "lat": 0.0167, "lng": 37.0728, "aliases": ["nanyuki"]},
    {"id": "kerugoya", "name": "Kerugoya Market", "town": "Kerugoya", "county": "Kirinyaga", "lat": -0.4989, "lng": 37.2803, "aliases": ["kerugoya"]},
    {"id": "ngurubani", "name": "Ngurubani Market", "town": "Ngurubani", "county": "Kirinyaga", "lat": -0.66, "lng": 37.28, "aliases": ["ngurubani"]},
    {"id": "embu", "name": "Embu Market", "town": "Embu", "county": "Embu", "lat": -0.531, "lng": 37.4506, "aliases": ["embu"]},
    {"id": "meru", "name": "Meru Municipal Market", "town": "Meru", "county": "Meru", "lat": 0.0463, "lng": 37.6559, "aliases": ["meru", "gakoromone"]},
    {"id": "kangeta", "name": "Kangeta Market", "town": "Kangeta", "county": "Meru", "lat": 0.3, "lng": 37.87, "aliases": ["kangeta"]},
    {"id": "thika", "name": "Thika Open Market", "town": "Thika", "county": "Kiambu", "lat": -1.0333, "lng": 37.0693, "aliases": ["thika"]},
    {"id": "githunguri", "name": "Githunguri Trading Centre", "town": "Kiambu", "county": "Kiambu", "lat": -1.057, "lng": 36.778, "aliases": ["githunguri"]},
    {"id": "kawangware", "name": "Kawangware Market", "town": "Nairobi", "county": "Nairobi", "lat": -1.278, "lng": 36.751, "aliases": ["kawangware"]},
    {"id": "wakulima-nbi", "name": "Wakulima Market", "town": "Nairobi", "county": "Nairobi", "lat": -1.2864, "lng": 36.8344, "aliases": ["wakulima", "wakulima market"]},
    {"id": "nakuru", "name": "Nakuru Municipal Market", "town": "Nakuru", "county": "Nakuru", "lat": -0.3031, "lng": 36.08, "aliases": ["nakuru"]},
    {"id": "eldoret", "name": "Eldoret Municipal Market", "town": "Eldoret", "county": "Uasin Gishu", "lat": 0.5143, "lng": 35.2698, "aliases": ["eldoret", "eldoret main"]},
    {"id": "kitale", "name": "Kitale Market", "town": "Kitale", "county": "Trans Nzoia", "lat": 1.0167, "lng": 35.0063, "aliases": ["kitale"]},
    {"id": "kakamega", "name": "Kakamega Town Market", "town": "Kakamega", "county": "Kakamega", "lat": 0.2827, "lng": 34.7519, "aliases": ["kakamega", "kakamega town"]},
    {"id": "kibuye", "name": "Kibuye Market", "town": "Kisumu", "county": "Kisumu", "lat": -0.0917, "lng": 34.768, "aliases": ["kibuye"]},
    {"id": "ahero", "name": "Ahero Market", "town": "Ahero", "county": "Kisumu", "lat": -0.174, "lng": 34.92, "aliases": ["ahero"]},
    {"id": "ndanai", "name": "Ndanai Market", "town": "Ndanai", "county": "Bomet", "lat": -0.85, "lng": 35.2, "aliases": ["ndanai"]},
    {"id": "kericho", "name": "Kericho Market", "town": "Kericho", "county": "Kericho", "lat": -0.367, "lng": 35.283, "aliases": ["kericho"]},
    {"id": "bungoma", "name": "Bungoma Market", "town": "Bungoma", "county": "Bungoma", "lat": 0.5635, "lng": 34.5606, "aliases": ["bungoma"]},
    {"id": "machakos", "name": "Machakos Market", "town": "Machakos", "county": "Machakos", "lat": -1.5177, "lng": 37.2634, "aliases": ["machakos"]},
    {"id": "kongowea", "name": "Kongowea Market", "town": "Mombasa", "county": "Mombasa", "lat": -4.0435, "lng": 39.6682, "aliases": ["kongowea"]},
    {"id": "cheptiret", "name": "Cheptiret Market", "town": "Cheptiret", "county": "Uasin Gishu", "lat": 0.43, "lng": 35.32, "aliases": ["cheptiret"]},
    {"id": "kabati", "name": "Kabati Market", "town": "Murang'a", "county": "Murang'a", "lat": -0.85, "lng": 37.05, "aliases": ["kabati"]},
]

COMMODITY_MAP = {
    "dry maize": "Maize",
    "white maize": "Maize",
    "green maize": "Maize",
    "maize flour": "Maize",
    "maize bran": "Maize",
    "cow milk": "Dairy",
    "cow milk(at collection point)": "Dairy",
    "cow milk(processd)": "Dairy",
    "cow milk(processed)": "Dairy",
    "tomato": "Tomato",
    "tomatoes": "Tomato",
    "white irish potatoes": "Irish potatoes",
    "irish potatoes": "Irish potatoes",
    "beans": "Beans",
    "mixed beans": "Beans",
    "tea": "Tea",
    "coffee": "Coffee",
    "avocado": "Avocado",
    "macadamia seed": "Macadamia",
}


def nearby_intelligence(
    lat: float,
    lng: float,
    commodity: str | None = None,
    radius_km: float = 80,
    cache_get=None,
    cache_put=None,
) -> dict[str, Any]:
    ingested_at = utcnow()
    observations, fetch_status = ingest_kamis(cache_get=cache_get, cache_put=cache_put)
    origin = {"latitude": lat, "longitude": lng}
    wanted = canonicalize_commodity(commodity) if commodity else None
    options: list[dict[str, Any]] = []
    for market in MARKETS:
        km = haversine_km(origin, {"latitude": market["lat"], "longitude": market["lng"]})
        if km > radius_km:
            continue
        match = latest_for_market(observations, market, wanted)
        freshness = freshness_for((match or {}).get("observed_at"))
        wholesale = (match or {}).get("wholesale_kes_per_kg")
        retail = (match or {}).get("retail_kes_per_kg")
        price_kind = "wholesale" if wholesale is not None else ("retail" if retail is not None else None)
        shown = wholesale if wholesale is not None else retail
        relevance = rank(km, wanted, match, freshness["score"])
        item = {
            "marketId": market["id"],
            "name": market["name"],
            "town": market["town"],
            "county": (match or {}).get("county") or market["county"],
            "latitude": market["lat"],
            "longitude": market["lng"],
            "km": round(km, 1),
            "distanceLabel": format_km(km),
            "commodity": ((match or {}).get("commodity") if match else wanted) or None,
            "sourceCommodity": (match or {}).get("source_commodity"),
            "classification": (match or {}).get("classification"),
            "wholesaleKesPerKg": wholesale,
            "retailKesPerKg": retail,
            "sourceQuote": (match or {}).get("source_quote"),
            "canonicalUnit": "kg",
            "canonicalPrice": shown,
            "priceKind": price_kind,
            "observedAt": (match or {}).get("observed_at"),
            "ingestedAt": ingested_at,
            "freshness": freshness["state"],
            "freshnessLabel": freshness["label"],
            "confidence": "OFFICIAL_REPORTED" if match else "LOCATION_ONLY",
            "source": KAMIS_SOURCE if match else None,
            "sourceLabel": SOURCE_LABEL if match else "Mapped market place",
        }
        item["_rank"] = rank(km, wanted, match, freshness["score"])
        options.append(item)
    options.sort(key=lambda row: (-row["_rank"], row["km"]))
    for row in options:
        row.pop("_rank", None)
    priced = [item for item in options if item.get("canonicalPrice") is not None]
    best = priced[0] if priced else None
    return {
        "status": "reported" if observations else fetch_status,
        "sourceLabel": SOURCE_LABEL,
        "disclaimer": "Latest reported market prices from the Ministry of Agriculture. Not a live exchange feed.",
        "ingestedAt": ingested_at,
        "observationCount": len(observations),
        "nearby": options[:6],
        "bestNearby": {
            "name": best["name"],
            "km": best["km"],
            "distanceLabel": best["distanceLabel"],
            "priceLabel": f"KES {best['canonicalPrice']}/kg",
            "priceKind": best["priceKind"],
            "freshnessLabel": best["freshnessLabel"],
        } if best else None,
    }


def ingest_kamis(cache_get=None, cache_put=None) -> tuple[list[dict[str, Any]], str]:
    now = time.time()
    if _CACHE["rows"] and now - float(_CACHE["at"]) < CACHE_SECONDS:
        return list(_CACHE["rows"]), "reported"
    if cache_get:
        cached = cache_get()
        if cached and cached.get("rows") and now - float(cached.get("at") or 0) < CACHE_SECONDS:
            _CACHE["rows"] = cached["rows"]
            _CACHE["at"] = cached["at"]
            return list(cached["rows"]), "reported"
    request = urllib.request.Request(KAMIS_URL, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    try:
        with urllib.request.urlopen(request, timeout=28) as response:
            html = response.read().decode("utf-8", "replace")
            print(f"KAMIS_FETCH status={response.status} bytes={len(html)}")
    except Exception as exc:
        print(f"KAMIS_FETCH_ERROR {type(exc).__name__}: {exc}")
        if _CACHE["rows"]:
            return list(_CACHE["rows"]), "reported"
        if cache_get:
            cached = cache_get()
            if cached and cached.get("rows"):
                return list(cached["rows"]), "reported"
        return [], "unavailable"
    rows = parse_kamis_table(html)
    print(f"KAMIS_PARSE rows={len(rows)}")
    if rows:
        _CACHE["rows"] = rows
        _CACHE["at"] = now
        if cache_put:
            cache_put({"rows": rows, "at": now, "ingestedAt": utcnow()})
    return rows, "reported" if rows else "unavailable"


def parse_kamis_table(html: str) -> list[dict[str, Any]]:
    pattern = re.compile(
        r"<tr>\s*<td>([^<]*)</td><td>([^<]*)</td><td>([^<]*)</td><td>([^<]*)</td>"
        r"<td>([^<]*)</td><td>([^<]*)</td><td>([^<]*)</td><td>([^<]*)</td>"
        r"<td>([^<]*)</td><td>([^<]*)</td>",
        re.I,
    )
    observations: list[dict[str, Any]] = []
    for match in pattern.finditer(html):
        commodity, classification, _grade, _sex, market, wholesale, retail, volume, county, date = [part.strip() for part in match.groups()]
        if commodity.lower() == "commodity":
            continue
        wholesale_kg, wholesale_quote = normalize_price(wholesale)
        retail_kg, retail_quote = normalize_price(retail)
        observations.append({
            "source_commodity": commodity,
            "commodity": canonicalize_commodity(commodity) or canonicalize_commodity(classification) or commodity,
            "classification": classification if classification not in ("-", "") else None,
            "market": market,
            "county": county,
            "wholesale_kes_per_kg": wholesale_kg,
            "retail_kes_per_kg": retail_kg,
            "source_quote": wholesale_quote or retail_quote,
            "source_unit": "source quote retained",
            "supply_volume": parse_number(volume),
            "observed_at": date if re.match(r"\d{4}-\d{2}-\d{2}", date) else None,
            "source": KAMIS_SOURCE,
        })
    return observations


def latest_for_market(observations: list[dict[str, Any]], market: dict[str, Any], wanted: str | None):
    names = {market["name"].lower(), market["town"].lower(), *[alias.lower() for alias in market["aliases"]]}
    matches = []
    for row in observations:
        hay = f"{row['market']} {row.get('county') or ''}".lower()
        if not any(name in hay or hay in name for name in names):
            continue
        if wanted and row["commodity"] != wanted and (row.get("source_commodity") or "").lower().find(wanted.lower()) < 0:
            # keep a weaker match only if no commodity filter hit later
            if canonicalize_commodity(row.get("source_commodity")) != wanted:
                continue
        matches.append(row)
    if not matches and wanted:
        matches = [row for row in observations if any(name in f"{row['market']}".lower() for name in names)]
    matches.sort(key=lambda row: row.get("observed_at") or "", reverse=True)
    return matches[0] if matches else None


def normalize_price(raw: str) -> tuple[float | None, str | None]:
    text = re.sub(r"\s+", "", raw or "")
    if not text or text in ("-", "–"):
        return None, None
    number = parse_number(text)
    if number is None:
        return None, raw.strip() or None
    bag = re.search(r"/(\d+(?:\.\d+)?)kg", text, re.I)
    if bag:
        kilos = float(bag.group(1))
        if kilos > 0:
            return round(number / kilos, 2), raw.strip()
    return round(number, 2), raw.strip()


def parse_number(raw: str) -> float | None:
    match = re.search(r"(\d[\d,]*(?:\.\d+)?)", raw or "")
    if not match:
        return None
    return float(match.group(1).replace(",", ""))


def canonicalize_commodity(value: str | None) -> str | None:
    if not value:
        return None
    key = re.sub(r"\s+", " ", value).strip().lower()
    if key in COMMODITY_MAP:
        return COMMODITY_MAP[key]
    for source, canonical in COMMODITY_MAP.items():
        if source in key or key in source:
            return canonical
    return value.strip().title()


def freshness_for(observed_at: str | None) -> dict[str, Any]:
    if not observed_at:
        return {"state": "NONE", "label": "No reported price yet", "score": 0}
    try:
        observed = datetime.strptime(observed_at[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return {"state": "UNKNOWN", "label": "Date unknown", "score": 4}
    days = max(0, (datetime.now(timezone.utc) - observed).days)
    if days <= 1:
        return {"state": "FRESH", "label": "Updated yesterday" if days == 1 else "Updated today", "score": 28}
    if days <= 7:
        return {"state": "AGING", "label": "Latest reported", "score": 14}
    return {"state": "STALE", "label": f"Reported {days} days ago", "score": 4}


def rank(km: float, wanted: str | None, match: dict[str, Any] | None, freshness_score: int) -> float:
    distance = max(0.0, 40 - km)
    match_score = 36 if match and (not wanted or match.get("commodity") == wanted) else 8
    price_score = freshness_score if match and (match.get("wholesale_kes_per_kg") is not None or match.get("retail_kes_per_kg") is not None) else 0
    return match_score + distance + price_score


def haversine_km(a: dict[str, float], b: dict[str, float]) -> float:
    r = 6371
    dlat = math.radians(b["latitude"] - a["latitude"])
    dlng = math.radians(b["longitude"] - a["longitude"])
    lat1 = math.radians(a["latitude"])
    lat2 = math.radians(b["latitude"])
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def format_km(km: float) -> str:
    if km < 1:
        return f"{round(km * 1000)} m"
    return f"{km:.1f} km" if km < 10 else f"{round(km)} km"


def utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    report = nearby_intelligence(-0.4167, 36.95, "Maize")
    print(report["status"], report["observationCount"], report.get("bestNearby"))
    for item in report["nearby"][:5]:
        print(item["name"], item["distanceLabel"], item.get("canonicalPrice"), item.get("freshnessLabel"), item.get("sourceQuote"))
