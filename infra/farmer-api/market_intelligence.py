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
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
from datetime import datetime, timezone
from typing import Any

_CACHE: dict[str, Any] = {"at": 0.0, "rows": []}
CACHE_SECONDS = 6 * 60 * 60
INGEST_BUDGET_SECONDS = 18
PRODUCT_TIMEOUT_SECONDS = 10
PRODUCT_PAGE_SIZE = 24

KAMIS_URL = "https://kamis.kilimo.go.ke/site/market"
KAMIS_SOURCE = "KAMIS"
SOURCE_LABEL = "Ministry of Agriculture (KAMIS)"
USER_AGENT = "MkulimaScore-MarketIngest/0.1 (server ingest; not a farmer client)"

# Official KAMIS product IDs. The unfiltered table is maize-first and hides the rest.
KAMIS_PRODUCTS: list[tuple[int, str]] = [
    (1, "Maize"),
    (149, "Maize"),
    (133, "Dairy"),
    (153, "Dairy"),
    (70, "Dairy"),
    (61, "Tomato"),
    (163, "Irish potatoes"),
    (57, "Irish potatoes"),
    (59, "Sweet potatoes"),
    (246, "Beans"),
    (64, "Beans"),
    (29, "Beans"),
    (188, "Pigeon peas"),
    (189, "Cowpeas"),
    (10, "Green grams"),
    (158, "Onion"),
    (154, "Kale"),
    (58, "Cabbage"),
    (4, "Rice"),
    (3, "Wheat"),
    (142, "Avocado"),
    (147, "Mango"),
    (226, "Banana"),
    (255, "Banana"),
    (150, "Watermelon"),
    (151, "Pineapple"),
    (125, "Passion fruit"),
    (72, "Poultry"),
    (218, "Tea"),
    (219, "Coffee"),
    (228, "Macadamia"),
    (12, "Groundnuts"),
    (160, "Other"),
    (60, "Other"),
    (217, "Fertilizer"),
]

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
    "yellow maize": "Maize",
    "maize flour": "Maize",
    "maize bran": "Maize",
    "cow milk": "Dairy",
    "cow milk(at collection point)": "Dairy",
    "cow milk(processd)": "Dairy",
    "cow milk(processed)": "Dairy",
    "goat milk": "Dairy",
    "camel milk": "Camels",
    "tomato": "Tomato",
    "tomatoes": "Tomato",
    "tree tomato": "Tomato",
    "white irish potatoes": "Irish potatoes",
    "red irish potato": "Irish potatoes",
    "irish potatoes": "Irish potatoes",
    "sweet potatoes": "Sweet potatoes",
    "beans": "Beans",
    "mixed beans": "Beans",
    "beans red haricot": "Beans",
    "beans rosecoco": "Beans",
    "pigeon peas": "Pigeon peas",
    "cowpeas": "Cowpeas",
    "green grams": "Green grams",
    "ground nuts": "Groundnuts",
    "dry onions": "Onion",
    "spring onions": "Onion",
    "kales/sukuma wiki": "Kale",
    "kales": "Kale",
    "cabbages": "Cabbage",
    "carrots": "Other",
    "fresh peas": "Other",
    "rice": "Rice",
    "paddy rice": "Rice",
    "wheat": "Wheat",
    "avocado": "Avocado",
    "mangoes": "Mango",
    "banana": "Banana",
    "water melon": "Watermelon",
    "pineapples": "Pineapple",
    "passion fruits": "Passion fruit",
    "eggs": "Poultry",
    "tea": "Tea",
    "coffee": "Coffee",
    "macadamia seed": "Macadamia",
    "fertilizer": "Fertilizer",
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
    quotes: list[dict[str, Any]] = []
    for row in observations:
        market = match_geocoded_market(row)
        if not market:
            continue
        km = haversine_km(origin, {"latitude": market["lat"], "longitude": market["lng"]})
        if km > radius_km:
            continue
        quotes.append(quote_from_row(row, market, km, ingested_at, wanted))
    latest = latest_by_market_commodity(quotes)
    latest.sort(key=lambda item: (-item["_rank"], item["km"], item.get("commodity") or ""))
    produce = best_per_commodity(latest)
    for item in latest:
        item.pop("_rank", None)
    for item in produce:
        item.pop("_rank", None)
    priced = [item for item in produce if item.get("canonicalPrice") is not None]
    best = priced[0] if priced else None
    return {
        "status": "reported" if observations else fetch_status,
        "sourceLabel": SOURCE_LABEL,
        "disclaimer": "Latest reported market prices from the Ministry of Agriculture. Not a live exchange feed.",
        "ingestedAt": ingested_at,
        "observationCount": len(observations),
        "commodityCount": len({item.get("commodity") for item in produce if item.get("commodity")}),
        "nearby": latest[:24],
        "produce": produce[:20],
        "bestNearby": {
            "name": best["name"],
            "km": best["km"],
            "distanceLabel": best["distanceLabel"],
            "commodity": best.get("commodity"),
            "priceLabel": f"{best.get('commodity') or 'Produce'} KES {best['canonicalPrice']}/kg",
            "priceKind": best["priceKind"],
            "freshnessLabel": best["freshnessLabel"],
        } if best else None,
    }


def ingest_kamis(cache_get=None, cache_put=None) -> tuple[list[dict[str, Any]], str]:
    now = time.time()
    if cache_is_usable(_CACHE["rows"], _CACHE["at"], now):
        return list(_CACHE["rows"]), "reported"
    if cache_get:
        cached = cache_get()
        if cached and cache_is_usable(cached.get("rows") or [], cached.get("at") or 0, now):
            _CACHE["rows"] = cached["rows"]
            _CACHE["at"] = cached["at"]
            return list(cached["rows"]), "reported"
    rows = fetch_kamis_products()
    print(f"KAMIS_PARSE rows={len(rows)} commodities={len({row.get('commodity') for row in rows})}")
    if rows:
        _CACHE["rows"] = rows
        _CACHE["at"] = now
        if cache_put:
            cache_put({"rows": rows, "at": now, "ingestedAt": utcnow()})
        return rows, "reported"
    if _CACHE["rows"]:
        return list(_CACHE["rows"]), "reported"
    if cache_get:
        cached = cache_get()
        if cached and cached.get("rows"):
            return list(cached["rows"]), "reported"
    return [], "unavailable"


def fetch_kamis_products() -> list[dict[str, Any]]:
    deadline = time.time() + INGEST_BUDGET_SECONDS
    rows: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str, str]] = set()
    pool = ThreadPoolExecutor(max_workers=6)
    pending = {
        pool.submit(fetch_kamis_product, product_id, label): (product_id, label)
        for product_id, label in KAMIS_PRODUCTS
    }
    try:
        while pending and time.time() < deadline:
            done, leftover = wait(set(pending), timeout=max(0.2, deadline - time.time()), return_when=FIRST_COMPLETED)
            if not done:
                break
            for future in done:
                product_id, label = pending.pop(future)
                try:
                    batch = future.result()
                except Exception as exc:
                    print(f"KAMIS_PRODUCT_ERROR id={product_id} {type(exc).__name__}: {exc}")
                    continue
                print(f"KAMIS_PRODUCT id={product_id} label={label} rows={len(batch)}")
                for row in batch:
                    key = (
                        str(row.get("source_commodity") or ""),
                        str(row.get("market") or ""),
                        str(row.get("observed_at") or ""),
                        str(row.get("source_quote") or ""),
                    )
                    if key in seen:
                        continue
                    seen.add(key)
                    rows.append(row)
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
    return rows


def cache_is_usable(rows: list[dict[str, Any]], cached_at: float, now: float) -> bool:
    if not rows:
        return False
    commodities = {str(row.get("commodity") or "") for row in rows if row.get("commodity")}
    if len(commodities) < 4:
        return False
    return now - float(cached_at or 0) < CACHE_SECONDS


def fetch_kamis_product(product_id: int, label: str) -> list[dict[str, Any]]:
    url = f"{KAMIS_URL}?product={product_id}&per_page={PRODUCT_PAGE_SIZE}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with urllib.request.urlopen(request, timeout=PRODUCT_TIMEOUT_SECONDS) as response:
        html = response.read().decode("utf-8", "replace")
        print(f"KAMIS_FETCH product={product_id} status={response.status} bytes={len(html)}")
    rows = parse_kamis_table(html)
    for row in rows:
        if not row.get("commodity") or row.get("commodity") == row.get("source_commodity"):
            row["commodity"] = canonicalize_commodity(row.get("source_commodity")) or label
    return rows


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


def match_geocoded_market(row: dict[str, Any]) -> dict[str, Any] | None:
    hay = f"{row.get('market') or ''} {row.get('county') or ''}".lower()
    for market in MARKETS:
        names = {market["name"].lower(), market["town"].lower(), *[alias.lower() for alias in market["aliases"]]}
        if any(name in hay or hay in name for name in names):
            return market
    return None


def quote_from_row(row: dict[str, Any], market: dict[str, Any], km: float, ingested_at: str, wanted: str | None) -> dict[str, Any]:
    freshness = freshness_for(row.get("observed_at"))
    wholesale = row.get("wholesale_kes_per_kg")
    retail = row.get("retail_kes_per_kg")
    shown = wholesale if wholesale is not None else retail
    price_kind = "wholesale" if wholesale is not None else ("retail" if retail is not None else None)
    item = {
        "marketId": market["id"],
        "name": market["name"],
        "town": market["town"],
        "county": row.get("county") or market["county"],
        "latitude": market["lat"],
        "longitude": market["lng"],
        "km": round(km, 1),
        "distanceLabel": format_km(km),
        "commodity": row.get("commodity"),
        "sourceCommodity": row.get("source_commodity"),
        "classification": row.get("classification"),
        "wholesaleKesPerKg": wholesale,
        "retailKesPerKg": retail,
        "sourceQuote": row.get("source_quote"),
        "canonicalUnit": "kg",
        "canonicalPrice": shown,
        "priceKind": price_kind,
        "observedAt": row.get("observed_at"),
        "ingestedAt": ingested_at,
        "freshness": freshness["state"],
        "freshnessLabel": freshness["label"],
        "confidence": "OFFICIAL_REPORTED",
        "source": KAMIS_SOURCE,
        "sourceLabel": SOURCE_LABEL,
        "_rank": rank(km, wanted, row, freshness["score"]),
    }
    return item


def latest_by_market_commodity(quotes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    latest: dict[tuple[str, str], dict[str, Any]] = {}
    for item in quotes:
        key = (str(item.get("marketId") or ""), str(item.get("commodity") or item.get("sourceCommodity") or ""))
        current = latest.get(key)
        if not current or (item.get("observedAt") or "") > (current.get("observedAt") or ""):
            latest[key] = item
    return list(latest.values())


def best_per_commodity(quotes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    best: dict[str, dict[str, Any]] = {}
    for item in quotes:
        commodity = str(item.get("commodity") or "")
        if not commodity or item.get("canonicalPrice") is None:
            continue
        current = best.get(commodity)
        if not current or item.get("_rank", 0) > current.get("_rank", 0):
            best[commodity] = dict(item)
    return sorted(best.values(), key=lambda row: (-row.get("_rank", 0), row["km"]))


def latest_for_market(observations: list[dict[str, Any]], market: dict[str, Any], wanted: str | None):
    names = {market["name"].lower(), market["town"].lower(), *[alias.lower() for alias in market["aliases"]]}
    matches = []
    for row in observations:
        hay = f"{row['market']} {row.get('county') or ''}".lower()
        if not any(name in hay or hay in name for name in names):
            continue
        if wanted and row["commodity"] != wanted and (row.get("source_commodity") or "").lower().find(wanted.lower()) < 0:
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
    report = nearby_intelligence(-0.4167, 36.95)
    print(report["status"], report["observationCount"], report.get("commodityCount"), report.get("bestNearby"))
    for item in report.get("produce") or []:
        print(item.get("commodity"), item["name"], item["distanceLabel"], item.get("canonicalPrice"), item.get("freshnessLabel"))
