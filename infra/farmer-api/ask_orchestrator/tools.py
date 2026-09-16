"""Controlled tool registry — Groq may request tools; only the backend executes them."""

from __future__ import annotations

from typing import Any, Callable

from knowledge import search_knowledge


ToolFn = Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]]


def execute_tools(
    tool_names: list[str],
    *,
    selective_context: dict[str, Any],
    question: str,
    farmer: dict[str, Any],
    client_context: dict[str, Any] | None,
) -> dict[str, Any]:
    """Run approved tools and return a tool_results map for the Groq prompt."""
    ctx = client_context if isinstance(client_context, dict) else {}
    results: dict[str, Any] = {}
    registry = _registry()
    for name in tool_names:
        fn = registry.get(name)
        if not fn:
            continue
        try:
            results[name] = fn(
                {
                    "question": question,
                    "selective": selective_context,
                    "farmer": farmer,
                    "client": ctx,
                },
                selective_context,
            )
        except Exception as exc:  # noqa: BLE001
            results[name] = {"ok": False, "error": str(exc)[:200]}
    return results


def tool_definitions_for_groq() -> list[dict[str, Any]]:
    """OpenAI-compatible tool schemas for application-controlled function calling."""
    return [
        {
            "type": "function",
            "function": {
                "name": "search_agricultural_knowledge",
                "description": "Search approved Kenyan agricultural guidance (KALRO, MoA, PCPB, FAO).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "sector": {"type": "string"},
                    },
                    "required": ["query"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_weather_forecast",
                "description": "Return the farm-place numerical forecast already loaded for this session.",
                "parameters": {"type": "object", "properties": {}},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_active_warnings",
                "description": "Return active preparedness watches and official warnings for the farm.",
                "parameters": {"type": "object", "properties": {}},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_activity_draft",
                "description": "Prepare a provisional activity draft for farmer confirmation. Does not save.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "kind": {"type": "string"},
                        "summary": {"type": "string"},
                    },
                    "required": ["kind", "summary"],
                },
            },
        },
    ]


def _registry() -> dict[str, ToolFn]:
    return {
        "get_farmer_context": _farmer,
        "get_farm_context": _farm,
        "get_enterprise_context": _enterprise,
        "get_weather_forecast": _weather,
        "get_active_warnings": _warnings,
        "get_market_prices": _markets,
        "find_nearby_markets": _places,
        "search_agricultural_knowledge": _knowledge,
        "get_activity_history": _activity,
        "create_activity_draft": _draft_activity,
        "create_profile_update_request": _profile_update,
        "report_pest_or_disease": _incident,
        "submit_impact_report": _impact,
        "escalate_to_officer": _escalate,
    }


def _farmer(args: dict, selective: dict) -> dict:
    return {"ok": True, "data": selective.get("farmer"), "preferences": selective.get("preferences")}


def _farm(args: dict, selective: dict) -> dict:
    return {"ok": True, "data": selective.get("selectedFarm"), "exposure": selective.get("exposure")}


def _enterprise(args: dict, selective: dict) -> dict:
    return {"ok": True, "data": selective.get("enterprise")}


def _weather(args: dict, selective: dict) -> dict:
    weather = selective.get("weather")
    if not weather:
        return {"ok": False, "error": "NO_FORECAST", "farmerLine": "No farm-place forecast is available yet. Mark the farm place and refresh."}
    return {
        "ok": True,
        "lane": "numerical_forecast",
        "data": weather,
        "disclaimer": weather.get("sourceDisclaimer") or "Model forecast — not an official KMD warning.",
    }


def _warnings(args: dict, selective: dict) -> dict:
    warnings = selective.get("warnings") or []
    return {
        "ok": True,
        "data": warnings,
        "disclaimer": "Only items with officialWarning=true are official authority warnings. Others are Mkulima preparedness watches.",
    }


def _markets(args: dict, selective: dict) -> dict:
    markets = selective.get("markets") or []
    if not markets:
        return {"ok": False, "error": "NO_PRICES", "farmerLine": "No nearby Ministry price is saved for this farm yet. I will not invent a KES amount."}
    return {"ok": True, "source": "KAMIS", "data": markets}


def _places(args: dict, selective: dict) -> dict:
    places = selective.get("places") or []
    return {"ok": True, "data": places, "disclaimer": "Listed places are not verified shops unless marked verified."}


def _knowledge(args: dict, selective: dict) -> dict:
    question = str(args.get("question") or "")
    sector = None
    ent = selective.get("enterprise") or {}
    if isinstance(ent, dict):
        sector = str(ent.get("sector") or "") or None
    hits = search_knowledge(question, sector, limit=4)
    return {
        "ok": True,
        "data": hits,
        "disclaimer": "Published guidance, not a farm visit. Prefer higher authority tiers. Never invent a pesticide from this text.",
    }


def _activity(args: dict, selective: dict) -> dict:
    return {"ok": True, "data": selective.get("recentActivity") or [], "verification": "mixed_provisional"}


def _draft_activity(args: dict, selective: dict) -> dict:
    return {
        "ok": True,
        "requiresConfirmation": True,
        "draft": {
            "kind": "activity",
            "summary": "Prepared from conversation — not saved until the farmer confirms.",
            "verification": "PROVISIONAL",
        },
    }


def _profile_update(args: dict, selective: dict) -> dict:
    return {
        "ok": True,
        "requiresConfirmation": True,
        "request": {
            "type": "profile_update_request",
            "note": "Will not overwrite verified records. Opens a provisional correction case.",
        },
    }


def _incident(args: dict, selective: dict) -> dict:
    return {
        "ok": True,
        "requiresConfirmation": True,
        "incident": {"status": "PROVISIONAL", "type": "pest_or_disease"},
    }


def _impact(args: dict, selective: dict) -> dict:
    return {
        "ok": True,
        "requiresConfirmation": True,
        "impact": {"status": "PROVISIONAL"},
    }


def _escalate(args: dict, selective: dict) -> dict:
    return {
        "ok": True,
        "escalation": {
            "required": True,
            "channel": "field_or_extension_officer",
            "farmerLine": "This needs a person who can visit or call you. I will not invent a treatment.",
        },
    }
