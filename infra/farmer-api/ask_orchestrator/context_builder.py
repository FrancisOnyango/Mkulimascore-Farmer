"""Selective farmer context — never dump the entire passport into every prompt."""

from __future__ import annotations

from typing import Any


def build_selective_context(
    farmer: dict[str, Any],
    question: str,
    client_context: dict[str, Any] | None,
    route_tools: list[str],
) -> dict[str, Any]:
    ctx = client_context if isinstance(client_context, dict) else {}
    packet = ctx.get("packet") if isinstance(ctx.get("packet"), dict) else {}
    profile = farmer.get("profile") if isinstance(farmer.get("profile"), dict) else {}

    farms = _list(ctx.get("farms") or packet.get("farms"))[:2]
    enterprises = _list(ctx.get("enterprises") or packet.get("enterprises"))[:4]
    weather = _list(ctx.get("weather"))[:1]
    markets = _list(ctx.get("markets"))[:6]
    places = _list(ctx.get("places"))[:5]
    activity = _list(ctx.get("activity") or ctx.get("records"))[:6]
    alerts = _list(ctx.get("alerts"))[:4]
    farm = farms[0] if farms else {}
    enterprise = next((e for e in enterprises if e.get("primary")), enterprises[0] if enterprises else {})

    selected: dict[str, Any] = {
        "farmer": {
            "preferredName": str(profile.get("displayName") or packet.get("farmer", {}).get("name") or "").split(" ")[0] or None,
            "language": (packet.get("farmer") or {}).get("language") or ctx.get("language") or "en",
            "msid": farmer.get("msid") or profile.get("msid"),
        },
        "selectedFarm": _farm_slice(farm) if farm else None,
        "facts": [],
        "toolsUsed": [],
        "provenanceNote": "Farmer-added facts are provisional until field-verified.",
    }

    if "get_farmer_context" in route_tools:
        selected["toolsUsed"].append("get_farmer_context")
        selected["preferences"] = {
            "language": selected["farmer"]["language"],
            "severeWeatherAlerts": None,
        }

    if "get_farm_context" in route_tools and farm:
        selected["toolsUsed"].append("get_farm_context")
        selected["facts"].append(_fact("farm.place", farm.get("location") or farm.get("name"), "SELF_REPORTED"))
        if farm.get("exposure"):
            selected["exposure"] = farm.get("exposure")
            selected["facts"].append(_fact("farm.exposure", "farmer-reported exposure flags", "SELF_REPORTED"))

    if "get_enterprise_context" in route_tools and enterprise:
        selected["toolsUsed"].append("get_enterprise_context")
        selected["enterprise"] = {
            "id": enterprise.get("id"),
            "name": enterprise.get("name"),
            "sector": enterprise.get("sector"),
            "summary": enterprise.get("summary"),
            "productionMetric": enterprise.get("productionMetric"),
            "productionValue": enterprise.get("productionValue"),
            "primary": bool(enterprise.get("primary")),
            "verification": "SELF_REPORTED",
        }
        selected["facts"].append(_fact(
            "enterprise.primary",
            f"{enterprise.get('sector')} · {enterprise.get('productionValue')} {enterprise.get('productionMetric')}",
            "SELF_REPORTED",
        ))

    if "get_weather_forecast" in route_tools and weather:
        selected["toolsUsed"].append("get_weather_forecast")
        w = weather[0]
        selected["weather"] = {
            "condition": w.get("condition"),
            "rainProbabilityPct": w.get("rainProbabilityPct"),
            "rainMm": w.get("rainMm"),
            "temperatureHighC": w.get("temperatureHighC"),
            "temperatureLowC": w.get("temperatureLowC"),
            "fieldActivityNote": w.get("fieldActivityNote"),
            "updatedAt": w.get("updatedAt"),
            "freshness": w.get("freshness"),
            "forecastCellId": w.get("forecastCellId"),
            "sourceDisclaimer": w.get("sourceDisclaimer") or "Model forecast — not an official warning.",
            "features": w.get("features"),
        }
        selected["facts"].append(_fact("weather.forecast", w.get("condition"), "FORECAST"))

    if "get_active_warnings" in route_tools:
        selected["toolsUsed"].append("get_active_warnings")
        selected["warnings"] = [_warning_slice(a) for a in alerts]
        # Client may also send earlyWarnings under context
        ews = _list(ctx.get("earlyWarnings") or ctx.get("weatherAlerts"))
        if ews:
            selected["warnings"] = selected.get("warnings") or []
            selected["warnings"].extend(_warning_slice(a) for a in ews[:4])

    if "get_market_prices" in route_tools or "find_nearby_markets" in route_tools:
        selected["toolsUsed"].append("get_market_prices")
        selected["markets"] = [
            {
                "commodity": m.get("commodity"),
                "observedPrice": m.get("observedPrice"),
                "marketScope": m.get("marketScope"),
                "sourceLabel": m.get("sourceLabel") or "KAMIS",
                "updatedAt": m.get("updatedAt") or m.get("fetchedAt"),
                "dataStatus": m.get("dataStatus"),
            }
            for m in markets
            if m.get("commodity")
        ]

    if "find_nearby_markets" in route_tools and places:
        selected["toolsUsed"].append("find_nearby_markets")
        selected["places"] = [
            {
                "name": p.get("name"),
                "category": p.get("category"),
                "distanceLabel": p.get("distanceLabel"),
                "verified": p.get("verification") == "verified" or p.get("verified") is True,
            }
            for p in places
            if p.get("name")
        ]

    if "get_activity_history" in route_tools and activity:
        selected["toolsUsed"].append("get_activity_history")
        selected["recentActivity"] = [
            {
                "title": a.get("title") or a.get("category"),
                "detail": a.get("detail") or a.get("summary"),
                "occurredAt": a.get("occurredAt") or a.get("documentDate") or a.get("createdAt"),
                "verification": a.get("verification") or "SELF_REPORTED",
            }
            for a in activity[:5]
        ]

    # Never include national ID, scores, financing decisions, or full consent payloads.
    selected["excluded"] = ["nationalId", "score", "riskBand", "lenderDecision", "fullConsentGrants"]
    selected["questionFocus"] = _focus(question)
    return selected


def _farm_slice(farm: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": farm.get("id"),
        "name": farm.get("name"),
        "location": farm.get("location"),
        "latitude": farm.get("latitude"),
        "longitude": farm.get("longitude"),
        "mapped": bool(farm.get("mapped")),
        "area": farm.get("measuredArea") or farm.get("reportedArea"),
        "areaUnit": farm.get("areaUnit"),
        "verification": farm.get("verification") or "reported",
        "exposure": farm.get("exposure"),
    }


def _warning_slice(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": item.get("id"),
        "title": item.get("title"),
        "level": item.get("level") or item.get("severity"),
        "message": item.get("plainLanguageMessage") or item.get("detail"),
        "officialWarning": bool(item.get("officialWarning")),
        "alertOrigin": item.get("alertOrigin") or ("official_warning" if item.get("officialWarning") else "model_derived_watch"),
        "sourceLabel": item.get("sourceLabel"),
    }


def _fact(attr: str, value: Any, verification: str) -> dict[str, Any]:
    return {
        "attribute": attr,
        "value": value,
        "verification": verification,
        "confidence": "PROVISIONAL" if verification == "SELF_REPORTED" else "SUPPORTED",
    }


def _focus(question: str) -> str:
    q = (question or "").lower()
    if any(t in q for t in ("top-dress", "fertiliz", "urea", "can ")):
        return "nutrition_timing"
    if any(t in q for t in ("spray", "pest", "disease")):
        return "crop_protection_timing"
    if any(t in q for t in ("rain", "weather", "plant")):
        return "weather_sensitive_decision"
    if any(t in q for t in ("price", "sell", "market")):
        return "market_decision"
    return "general_farm_help"


def _list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]
