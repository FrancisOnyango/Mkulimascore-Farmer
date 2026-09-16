"""Ask orchestrator entry — context → tools → Groq → validator."""

from __future__ import annotations

from typing import Any

from .context_builder import build_selective_context
from .gateway import call_structured
from .memory import detect_provisional_claim, summarize_history
from .router import route_question
from .safety import validate_response
from .tools import execute_tools


def run_ask(
    *,
    farmer: dict[str, Any],
    question: str,
    client_context: dict[str, Any] | None = None,
    history: list[Any] | None = None,
    language: str = "en",
    draft_text: str | None = None,
    has_attachment: bool = False,
    image_data_url: str | None = None,
) -> dict[str, Any]:
    route = route_question(question, has_attachment=has_attachment or bool(image_data_url))
    memory = summarize_history(history)
    selective = build_selective_context(farmer, question, client_context, route.needs_tools)
    selective["conversationMemory"] = memory

    provisional = detect_provisional_claim(question)
    if provisional and provisional.get("type") == "farmer_preference":
        language = str(provisional.get("value") or language)

    tool_results = execute_tools(
        route.needs_tools,
        selective_context=selective,
        question=question,
        farmer=farmer,
        client_context=client_context,
    )

    if route.risk == "high" and not image_data_url:
        validated = validate_response(
            None,
            risk="high",
            tool_results=tool_results,
            language=language,
            fallback_text=draft_text or "",
            route_escalate=True,
            escalation_reason="high_risk_policy",
        )
        return _pack(validated, route, tool_results, selective, provider="policy", model="safety-v1")

    structured, llm_meta = call_structured(
        question=question,
        language=language,
        model_id=route.model_id,
        selective_context=selective,
        tool_results=tool_results,
        history=history,
        draft_text=draft_text,
        image_data_url=image_data_url,
    )

    # If Groq failed, build a grounded local answer from tools
    if not structured:
        structured = _local_structured(question, language, selective, tool_results, draft_text, provisional)

    if provisional and provisional.get("requiresConfirmation"):
        structured = {
            **structured,
            "answer": f"{structured.get('answer', '').strip()} {provisional.get('prompt', '')}".strip(),
            "requires_confirmation": True,
            "action_cards": list(structured.get("action_cards") or []) + [
                {"type": "create_profile_update_request", "label": "Submit as profile update"}
            ],
        }

    validated = validate_response(
        structured,
        risk=route.risk,
        tool_results=tool_results,
        language=language,
        fallback_text=draft_text or str(structured.get("answer") or ""),
        route_escalate=route.escalate,
        escalation_reason=route.escalation_reason,
    )
    return _pack(
        validated,
        route,
        tool_results,
        selective,
        provider=str(llm_meta.get("provider") or "local"),
        model=str(llm_meta.get("model") or "mkulima-farmer-reasoner-v3"),
    )


def _local_structured(
    question: str,
    language: str,
    selective: dict[str, Any],
    tool_results: dict[str, Any],
    draft_text: str | None,
    provisional: dict[str, Any] | None,
) -> dict[str, Any]:
    parts: list[str] = []
    weather = (tool_results.get("get_weather_forecast") or {}).get("data")
    if weather:
        parts.append(
            f"At your farm place it looks {weather.get('condition')}, about {weather.get('rainProbabilityPct')}% chance of rain. "
            f"{weather.get('fieldActivityNote') or ''}".strip()
        )
    knowledge = (tool_results.get("search_agricultural_knowledge") or {}).get("data") or []
    if knowledge and isinstance(knowledge[0], dict):
        parts.append(str(knowledge[0].get("farmerLine") or knowledge[0].get("title") or ""))
    markets = (tool_results.get("get_market_prices") or {}).get("data") or []
    if markets and isinstance(markets[0], dict):
        m0 = markets[0]
        parts.append(f"Nearby reported price: {m0.get('commodity')} {m0.get('observedPrice')} ({m0.get('sourceLabel') or 'KAMIS'}).")
    warnings = (tool_results.get("get_active_warnings") or {}).get("data") or []
    if warnings and isinstance(warnings[0], dict):
        w0 = warnings[0]
        label = "Official warning" if w0.get("officialWarning") else "Preparedness watch"
        parts.append(f"{label}: {w0.get('title')}.")
    if draft_text:
        parts.append(draft_text)
    if not parts:
        parts.append(
            "Ninaweza kusaidia kuhusu shamba, hali ya hewa, bei na mwongozo ulioidhinishwa — niambie unachohitaji."
            if language == "sw"
            else "I can help with your farm, weather, prices and approved guidance — tell me what you need."
        )
    answer = " ".join(p for p in parts if p).strip()
    if provisional and provisional.get("prompt"):
        answer = f"{answer} {provisional['prompt']}"
    return {
        "answer": answer,
        "language": language,
        "confidence": "medium" if weather or knowledge or markets else "low",
        "basis": ["tool_grounded_local"],
        "action_cards": [],
        "follow_up_question": "How is the weather for my farm?" if language != "sw" else "Hali ya hewa ya shamba iko vipi?",
        "sources": [],
        "requires_confirmation": bool(provisional and provisional.get("requiresConfirmation")),
        "escalation": {"required": False, "reason": None},
    }


def _pack(
    validated: dict[str, Any],
    route,
    tool_results: dict[str, Any],
    selective: dict[str, Any],
    *,
    provider: str,
    model: str,
) -> dict[str, Any]:
    intent = route.intent if route.intent not in ("agronomy", "diagnosis", "current_info") else "general"
    if route.intent == "agronomy":
        intent = "general"
    if route.intent == "diagnosis":
        intent = "general"
    if route.intent == "current_info":
        intent = "general"
    return {
        "text": validated["answer"],
        "metadata": {
            "intent": intent,
            "sources": validated.get("sources") or [],
            "recommendations": validated.get("recommendations") or [],
            "followUps": validated.get("follow_ups") or [],
            "limitations": [
                "This uses farmer-safe records and approved tools. It is not a farm visit, a price promise, or a loan decision.",
                "Photo or chat claims stay provisional until confirmed or field-verified.",
            ],
            "localOnly": provider == "local" or provider == "policy",
            "confidence": validated.get("confidence") or "medium",
            "provider": provider,
            "model": model,  # ops only — UI should not surface model names to farmers
            "basis": validated.get("basis") or [],
            "actionCards": validated.get("action_cards") or [],
            "requiresConfirmation": validated.get("requires_confirmation"),
            "escalation": validated.get("escalation"),
            "toolsUsed": selective.get("toolsUsed") or list(tool_results.keys()),
            "orchestrator": "ask_orchestrator_v1",
            "modelRole": route.model_role,
            "risk": route.risk,
        },
    }
