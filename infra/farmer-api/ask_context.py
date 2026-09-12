"""Controlled Farmer Context Packet for Ask Mkulima.

Do not dump the farmer's entire history. Retrieve only what the question needs.
Farmer facts stay SELF_REPORTED until a later verified claim replaces them.
"""

from __future__ import annotations

from typing import Any

HIGH_RISK = (
    "pesticide",
    "insecticide",
    "herbicide",
    "fungicide",
    "spray programme",
    "chemical spray",
    "acaricide",
    "antibiotic",
    "inject",
    "dosage",
    "wormer",
    "dewormer",
    "vet medicine",
    "veterinary medicine",
    "poison",
    "anthrax",
    "rabies",
)

MEDIUM_RISK = (
    "disease",
    "blight",
    "should i plant",
    "plant tomorrow",
    "fertilizer rate",
    "how is my maize looking",
)


def classify_risk(question: str) -> str:
    q = (question or "").lower()
    if any(term in q for term in HIGH_RISK):
        return "high"
    if any(term in q for term in MEDIUM_RISK):
        return "medium"
    return "low"


def high_risk_answer(question: str) -> dict[str, Any]:
    q = (question or "").lower()
    if any(term in q for term in ("vet", "inject", "antibiotic", "wormer", "deworm", "anthrax", "rabies")):
        text = (
            "I will not recommend a veterinary medicine or a dose. "
            "If an animal is in pain, off feed, or suddenly weak, contact a veterinary officer. "
            "I can help you find a listed animal service near the farm if one is saved."
        )
    else:
        text = (
            "I will not name a pesticide, spray programme, or chemical rate. "
            "In Kenya that has to match a current PCPB registered use and the product label. "
            "I do not have that register in this request."
        )
    return {
        "intent": "general",
        "text": text,
        "recommendations": ["Do not act on a chemical or medicine from a chat answer."],
        "followUps": ["Where can I buy inputs near my farm?", "How is the weather for my farm?"],
        "sources": [],
        "risk": "high",
    }


def build_packet(farmer: dict[str, Any], question: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    q = (question or "").lower()
    ctx = context if isinstance(context, dict) else {}
    packet = ctx.get("packet") if isinstance(ctx.get("packet"), dict) else {}
    if packet.get("farmer") or packet.get("farms"):
        packet = {**packet, "risk": packet.get("risk") or classify_risk(q)}
        return packet

    profile = farmer.get("profile") if isinstance(farmer.get("profile"), dict) else {}
    farms = _as_dicts(ctx.get("farms"))[:2]
    enterprises = _as_dicts(ctx.get("enterprises"))[:4]
    weather = _as_dicts(ctx.get("weather"))[:1]
    markets = _as_dicts(ctx.get("markets"))[:8]
    places = _as_dicts(ctx.get("places"))[:5]
    tools = ["get_farmer_context"]
    facts: list[dict[str, Any]] = []

    farm = farms[0] if farms else {}
    if farm:
        tools.append("get_farm")
        facts.append(_fact("farm.place", str(farm.get("location") or farm.get("name") or ""), "FARMER_APP", "SELF_REPORTED"))
    if enterprises:
        tools.append("get_enterprise")
        first = enterprises[0]
        facts.append(_fact(
            "enterprise.primary",
            f"{first.get('name')} {first.get('productionValue')} {first.get('productionMetric')}".strip(),
            "FARMER_APP",
            "SELF_REPORTED",
        ))
    if _needs(q, ("weather", "rain", "plant", "forecast")) and weather:
        tools.append("get_weather")
        item = weather[0]
        facts.append(_fact("weather.forecast", str(item.get("condition") or ""), "OPEN_METEO", "FORECAST"))
    if _needs(q, ("price", "market", "sell", "bei")) and markets:
        tools.append("get_market_prices")
    if _needs(q, ("where", "nearby", "agrovet", "vet", "sell", "buy")) and places:
        tools.append("get_nearby_places")

    return {
        "farmer": {
            "msid": farmer.get("msid") or profile.get("msid"),
            "name": str(profile.get("displayName") or "").split(" ")[0] or None,
            "language": "en",
        },
        "location": {"place": farm.get("location") or profile.get("location") or "your farm place"},
        "farms": farms,
        "enterprises": enterprises,
        "toolsUsed": tools,
        "facts": facts,
        "weatherLine": (weather[0].get("condition") if weather else None),
        "marketLines": [f"{item.get('commodity')} {item.get('observedPrice')} at {item.get('marketScope')}" for item in markets if item.get("commodity")],
        "placeLines": [f"{item.get('name')} {item.get('distanceLabel') or ''}".strip() for item in places if item.get("name")],
        "risk": classify_risk(q),
    }


def _fact(attribute: str, value: str, source: str, verification: str) -> dict[str, Any]:
    return {
        "attribute": attribute,
        "value": value,
        "source": source,
        "verification": verification,
        "confidence": "PROVISIONAL" if verification == "SELF_REPORTED" else "SUPPORTED",
        "farmerLine": f"Based on what you added: {value}" if verification == "SELF_REPORTED" else value,
    }


def _needs(question: str, terms: tuple[str, ...]) -> bool:
    return any(term in question for term in terms)


def _as_dicts(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]
