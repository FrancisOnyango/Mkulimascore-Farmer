"""Grounding and safety validator for Ask responses."""

from __future__ import annotations

from typing import Any

BLOCKED = (
    "score formula", "your score", "credit score", "pre-approved", "preapproved",
    "loan approved", "guaranteed loan", "you will get a loan", "nitapata mkopo",
    "i saved your", "i updated your farm", "i deleted",
)

CHEMICAL_CLAIM = (
    "spray with", "apply ml", "apply litres", "mix ", "dosage", "inject ",
    "use cypermethrin", "use lambda", "use glyphosate", "deworm with",
)


def validate_response(
    structured: dict[str, Any] | None,
    *,
    risk: str,
    tool_results: dict[str, Any],
    language: str,
    fallback_text: str,
    route_escalate: bool = False,
    escalation_reason: str | None = None,
) -> dict[str, Any]:
    if risk == "high":
        return _high_risk(language)

    answer = str((structured or {}).get("answer") or "").strip() or (fallback_text or "").strip()
    if not answer:
        answer = (
            "Sina jibu salama kwa sasa. Jaribu tena au uliza afisa wa ugani."
            if language == "sw"
            else "I do not have a safe answer yet. Try again or ask a county extension officer."
        )

    lowered = answer.lower()
    if any(term in lowered for term in BLOCKED) or any(term in lowered for term in CHEMICAL_CLAIM):
        return _high_risk(language)

    # Reject invented official warnings
    if "official kmd" in lowered and not _has_official_warning(tool_results):
        answer = answer.replace("Official KMD", "Mkulima preparedness watch").replace("official KMD", "Mkulima preparedness watch")

    confidence = str((structured or {}).get("confidence") or "medium")
    if confidence not in ("high", "medium", "low"):
        confidence = "medium"

    basis = [str(b) for b in ((structured or {}).get("basis") or []) if b][:6]
    if not basis:
        basis = _infer_basis(tool_results)

    sources = _sources(structured, tool_results)
    action_cards = [
        {"type": str(card.get("type") or "general"), "label": str(card.get("label") or "")}
        for card in ((structured or {}).get("action_cards") or [])
        if isinstance(card, dict) and card.get("label")
    ][:4]

    follow = str((structured or {}).get("follow_up_question") or "").strip()
    follow_ups = [follow] if follow else []
    if not follow_ups:
        follow_ups = ["How is the weather for my farm?", "What is the latest price near me?"]

    escalation = (structured or {}).get("escalation") if isinstance((structured or {}).get("escalation"), dict) else {}
    needs_escalation = route_escalate or bool(escalation.get("required"))
    if needs_escalation:
        action_cards.append({"type": "escalate_to_officer", "label": "Ask an officer" if language != "sw" else "Uliza afisa"})
        if language == "sw":
            answer = answer + " Hili linaweza kuhitaji afisa wa ugani au daktari wa mifugo."
        else:
            answer = answer + " This may need a county extension officer or veterinary officer."

    recommendations = []
    if (structured or {}).get("requires_confirmation"):
        recommendations.append("Nothing is saved until you confirm." if language != "sw" else "Hakuna kilichohifadhiwa hadi uthibitishe.")

    return {
        "answer": answer[:1200],
        "language": "sw" if language == "sw" else "en",
        "confidence": confidence,
        "basis": basis,
        "action_cards": action_cards,
        "follow_ups": follow_ups[:3],
        "sources": sources,
        "requires_confirmation": bool((structured or {}).get("requires_confirmation")),
        "escalation": {
            "required": needs_escalation,
            "reason": escalation.get("reason") or escalation_reason,
        },
        "recommendations": recommendations,
        "safe": True,
    }


def _high_risk(language: str) -> dict[str, Any]:
    if language == "sw":
        text = (
            "Sitataja dawa, kipimo, wala programu ya kunyunyizia. "
            "Nchini Kenya hiyo inafaa kulingana na usajili wa PCPB na lebo ya bidhaa, au daktari wa mifugo."
        )
    else:
        text = (
            "I will not name a pesticide, spray programme, chemical rate or veterinary dose. "
            "In Kenya that must match a current PCPB registered use and the product label, or a veterinary officer."
        )
    return {
        "answer": text,
        "language": language,
        "confidence": "high",
        "basis": ["safety_policy"],
        "action_cards": [{"type": "escalate_to_officer", "label": "Ask an officer" if language != "sw" else "Uliza afisa"}],
        "follow_ups": ["Where can I buy inputs near my farm?", "How is the weather for my farm?"],
        "sources": [],
        "requires_confirmation": False,
        "escalation": {"required": True, "reason": "high_risk_chemical_or_vet"},
        "recommendations": ["Do not act on a chemical or medicine from a chat answer."],
        "safe": True,
    }


def _has_official_warning(tool_results: dict[str, Any]) -> bool:
    block = tool_results.get("get_active_warnings") or {}
    for item in block.get("data") or []:
        if isinstance(item, dict) and item.get("officialWarning"):
            return True
    return False


def _infer_basis(tool_results: dict[str, Any]) -> list[str]:
    basis = []
    if tool_results.get("get_weather_forecast", {}).get("ok"):
        basis.append("weather_forecast")
    if tool_results.get("get_active_warnings", {}).get("data"):
        basis.append("active_warnings")
    if tool_results.get("get_market_prices", {}).get("ok"):
        basis.append("kamis_prices")
    if tool_results.get("search_agricultural_knowledge", {}).get("data"):
        basis.append("approved_guidance")
    if tool_results.get("get_farm_context", {}).get("ok"):
        basis.append("farm_profile")
    return basis or ["conversation"]


def _sources(structured: dict[str, Any] | None, tool_results: dict[str, Any]) -> list[dict[str, str]]:
    sources: list[dict[str, str]] = []
    for item in ((structured or {}).get("sources") or []):
        if isinstance(item, dict) and item.get("label"):
            sources.append({
                "label": str(item["label"]),
                "freshness": str(item.get("freshness") or ""),
                "limitation": str(item.get("limitation") or "Published or farm-saved context."),
            })
    knowledge = (tool_results.get("search_agricultural_knowledge") or {}).get("data") or []
    for hit in knowledge[:3]:
        if isinstance(hit, dict):
            sources.append({
                "label": f"{hit.get('sourceOrganisation') or 'Guidance'}: {hit.get('title') or 'note'}",
                "freshness": f"Tier {hit.get('authorityTier') or '?'}",
                "limitation": "Published guidance, not a farm visit.",
            })
    weather = tool_results.get("get_weather_forecast") or {}
    if weather.get("ok"):
        sources.append({
            "label": "Farm-place forecast",
            "freshness": str((weather.get("data") or {}).get("updatedAt") or "current request"),
            "limitation": weather.get("disclaimer") or "Forecasts can change.",
        })
    # Dedupe by label
    seen = set()
    unique = []
    for src in sources:
        key = src["label"]
        if key in seen:
            continue
        seen.add(key)
        unique.append(src)
    return unique[:6]
