"""Mkulima Places Intelligence — owned registry, not live OSM/Google.

Bootstrap places live in this worker. Farmer contributions land in DynamoDB.
Nearby search is haversine over the registry. PostGIS is the later store,
not a per-request Overpass call.
"""

from __future__ import annotations

import math
import re
from typing import Any

from market_intelligence import MARKETS, format_km, haversine_km

DEFAULT_RADIUS_KM = 25.0
ATTRIBUTION = (
    "Listed markets use OpenStreetMap and Ministry (KAMIS) references. "
    "A listed place is not a verified shop."
)

VERIFICATION_SCORE = {
    "FIELD_VERIFIED": 25,
    "PARTNER_CONFIRMED": 20,
    "COMMUNITY_CONFIRMED": 14,
    "DISCOVERED": 6,
    "STALE": 2,
    "CLOSED": 0,
}

FILTER_CATEGORIES = {
    "markets": ["markets"],
    "inputs": ["inputs"],
    "services": ["services", "support"],
    "buyers": ["collection", "cooperatives", "markets"],
}

SEED_INSTITUTIONS: list[dict[str, Any]] = [
    {
        "placeId": "githunguri-dairy-coop",
        "name": "Githunguri Dairy Farmers Co-operative",
        "category": "cooperatives",
        "subcategory": "dairy_cooperative",
        "categories": ["cooperatives", "collection"],
        "latitude": -1.057,
        "longitude": 36.778,
        "county": "Kiambu",
        "town": "Githunguri",
        "services": ["Milk collection", "Dairy cooperative"],
        "commodities": ["Dairy"],
        "sources": [{"kind": "MKULIMA_CURATED", "sourcePlaceId": "githunguri-dairy-coop"}],
        "verification": "DISCOVERED",
        "confidence": "medium",
    }
]

MARKET_GOODS = {
    "karatina": ["Tomato", "Irish potatoes", "Maize", "Tea"],
    "nyeri": ["Coffee", "Tea", "Dairy", "Maize"],
    "nanyuki": ["Maize", "Dairy", "Irish potatoes"],
    "kerugoya": ["Maize", "Rice", "Beans"],
    "ngurubani": ["Rice", "Maize", "Tomato"],
    "embu": ["Coffee", "Maize", "Macadamia"],
    "meru": ["Tea", "Coffee", "Maize"],
    "kangeta": ["Tea", "Maize"],
    "thika": ["Tomato", "Dairy", "Avocado"],
    "githunguri": ["Dairy", "Maize", "Avocado"],
    "kawangware": ["Maize", "Tomato", "Beans"],
    "wakulima-nbi": ["Maize", "Tomato", "Beans", "Irish potatoes"],
    "nakuru": ["Maize", "Dairy", "Irish potatoes"],
    "eldoret": ["Maize", "Dairy", "Wheat"],
    "kitale": ["Maize", "Dairy"],
    "kakamega": ["Maize", "Beans"],
    "kibuye": ["Maize", "Fish", "Beans"],
    "ahero": ["Maize", "Rice"],
    "ndanai": ["Tea", "Maize"],
    "kericho": ["Tea", "Dairy", "Maize"],
    "bungoma": ["Maize", "Beans", "Sugarcane"],
    "machakos": ["Tomato", "Beans", "Maize"],
    "kongowea": ["Tomato", "Maize", "Beans"],
    "cheptiret": ["Maize", "Dairy"],
    "kabati": ["Maize", "Banana"],
}


def seed_places() -> list[dict[str, Any]]:
    places: list[dict[str, Any]] = []
    for market in MARKETS:
        goods = MARKET_GOODS.get(market["id"], ["Maize"])
        dairy = "Dairy" in goods
        places.append(
            {
                "placeId": market["id"],
                "name": market["name"],
                "category": "markets",
                "subcategory": "marketplace",
                "categories": ["markets", "collection"] if dairy else ["markets"],
                "latitude": market["lat"],
                "longitude": market["lng"],
                "county": market["county"],
                "town": market["town"],
                "services": ["Produce market", "Milk trading"] if dairy else ["Produce market"],
                "commodities": goods,
                "sources": [
                    {"kind": "OSM_CURATED", "sourcePlaceId": market["id"]},
                    {"kind": "KAMIS", "sourcePlaceId": market["id"]},
                ],
                "verification": "DISCOVERED",
                "confidence": "medium",
            }
        )
    places.extend(SEED_INSTITUTIONS)
    return places


def nearby_places(
    lat: float,
    lng: float,
    commodity: str | None = None,
    place_filter: str | None = None,
    radius_km: float = DEFAULT_RADIUS_KM,
    extras: list[dict[str, Any]] | None = None,
    limit: int = 24,
) -> dict[str, Any]:
    origin = {"latitude": lat, "longitude": lng}
    wanted = (commodity or "").strip()
    registry = merge_places(seed_places(), extras or [])
    ranked: list[dict[str, Any]] = []
    for place in registry:
        if place.get("verification") == "CLOSED":
            continue
        if not matches_filter(place, place_filter):
            continue
        km = haversine_km(origin, {"latitude": float(place["latitude"]), "longitude": float(place["longitude"])})
        if km > radius_km:
            continue
        ranked.append(score_place(place, km, wanted, radius_km))
    ranked.sort(key=lambda item: (-item["relevance"], item["km"]))
    for index, item in enumerate(ranked):
        item["recommended"] = bool(item.get("recommended") and index < 6)
    nearby = ranked[:limit]
    return {
        "status": "ok",
        "sourceLabel": "Mkulima Places",
        "disclaimer": ATTRIBUTION,
        "radiusKm": radius_km,
        "origin": {"latitude": lat, "longitude": lng},
        "places": nearby,
        "recommended": [item for item in nearby if item.get("recommended")][:3],
    }


def score_place(place: dict[str, Any], km: float, wanted: str, radius_km: float) -> dict[str, Any]:
    goods = [str(item).lower() for item in place.get("commodities") or []]
    category = place.get("category") or "markets"
    chain = 6
    matched = False
    if wanted and wanted.lower() in goods:
        chain, matched = 30, True
    elif category == "inputs" and wanted:
        chain, matched = 16, True
    elif category in ("cooperatives", "collection"):
        chain = 12 if wanted else 8
    verify = VERIFICATION_SCORE.get(str(place.get("verification") or "DISCOVERED"), 6)
    distance = max(0.0, 20 * (1 - km / max(radius_km, 1)))
    service = 10 if wanted and wanted.lower() in " ".join(place.get("services") or []).lower() else 3
    relevance = chain + verify + distance + 4 + service + 3
    verification = str(place.get("verification") or "DISCOVERED")
    item = {
        **place,
        "km": round(km, 1),
        "distanceLabel": format_km(km),
        "relevance": round(relevance),
        "recommended": matched and relevance >= 48,
        "recommendedLine": f"Useful for your {wanted.lower()}" if matched and wanted else None,
        "verificationLabel": verification_label(verification),
    }
    return item


def matches_filter(place: dict[str, Any], place_filter: str | None) -> bool:
    wanted = FILTER_CATEGORIES.get((place_filter or "").lower())
    if not wanted:
        return True
    owned = {place.get("category"), *(place.get("categories") or [])}
    return any(item in owned for item in wanted)


def merge_places(seed: list[dict[str, Any]], extras: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    for place in seed:
        by_id[str(place["placeId"])] = dict(place)
    for extra in extras:
        place_id = str(extra.get("placeId") or extra.get("id") or "")
        if not place_id:
            continue
        current = by_id.get(place_id)
        if not current:
            by_id[place_id] = dict(extra)
            continue
        current["services"] = unique([*(current.get("services") or []), *(extra.get("services") or [])])
        current["commodities"] = unique([*(current.get("commodities") or []), *(extra.get("commodities") or [])])
        by_id[place_id] = current
    return list(by_id.values())


def find_duplicate(name: str, lat: float, lng: float, extras: list[dict[str, Any]]) -> dict[str, Any] | None:
    target = re.sub(r"\s+", " ", name).strip().lower()
    origin = {"latitude": lat, "longitude": lng}
    for place in merge_places(seed_places(), extras):
        km = haversine_km(origin, {"latitude": float(place["latitude"]), "longitude": float(place["longitude"])})
        label = re.sub(r"\s+", " ", str(place.get("name") or "")).strip().lower()
        if km <= 0.15 and label == target:
            return place
    return None


def verification_label(status: str) -> str:
    if status == "FIELD_VERIFIED":
        return "Verified location"
    if status == "PARTNER_CONFIRMED":
        return "Confirmed by a partner"
    if status == "COMMUNITY_CONFIRMED":
        return "Farmers have confirmed this place"
    if status == "STALE":
        return "May be out of date"
    if status == "CLOSED":
        return "Reported closed"
    return "Listed place — not yet verified"


def unique(values: list[Any]) -> list[Any]:
    seen: set[str] = set()
    out: list[Any] = []
    for value in values:
        key = str(value)
        if key in seen:
            continue
        seen.add(key)
        out.append(value)
    return out


if __name__ == "__main__":
    report = nearby_places(-0.4167, 36.95, commodity="Maize")
    print(report["status"], len(report["places"]))
    for item in report["places"][:5]:
        print(item["name"], item["distanceLabel"], item["category"], item["verificationLabel"])
