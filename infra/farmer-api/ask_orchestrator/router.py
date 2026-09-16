"""Intent, risk and Groq model routing — model names are never shown to farmers."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any


HIGH_RISK = (
    "pesticide", "insecticide", "herbicide", "fungicide", "spray programme",
    "chemical spray", "acaricide", "antibiotic", "inject", "dosage", "wormer",
    "dewormer", "vet medicine", "veterinary medicine", "poison", "anthrax",
    "rabies", "how much spray", "what chemical",
)

ESCALATION = (
    "animal died", "livestock death", "outbreak", "flooding now", "evacuate",
    "poisoned", "chemical on skin", "child drank", "vomiting blood",
)

PHOTO = ("photo", "picture", "image", "picha", "looks like", "what is wrong with")
WEATHER = ("weather", "rain", "spray tomorrow", "plant tomorrow", "mvua", "joto", "forecast")
MARKET = ("price", "market", "sell", "bei", "kamis")
WARNING = ("warning", "alert", "tahadhari", "onyo", "flood", "drought watch")
WEB_LIVE = ("today's news", "current outbreak kenya", "latest kamis", "what did kmd say today")


@dataclass
class RouteDecision:
    intent: str
    risk: str  # low | medium | high
    model_role: str  # fast | reasoning | vision | compound
    model_id: str
    needs_tools: list[str]
    escalate: bool
    escalation_reason: str | None


def route_question(question: str, *, has_attachment: bool = False) -> RouteDecision:
    q = (question or "").lower().strip()
    risk = "high" if any(t in q for t in HIGH_RISK) else ("medium" if _medium(q) else "low")
    escalate = any(t in q for t in ESCALATION)
    escalation_reason = "life_or_outbreak_signal" if escalate else None

    tools: list[str] = ["get_farmer_context", "get_farm_context"]
    intent = "general"
    role = "reasoning"

    if has_attachment or any(t in q for t in PHOTO):
        intent = "diagnosis"
        role = "vision"
        tools += ["search_agricultural_knowledge", "get_enterprise_context"]
    elif any(t in q for t in WARNING):
        intent = "alerts"
        tools += ["get_active_warnings", "get_weather_forecast", "get_farm_context"]
    elif any(t in q for t in WEATHER):
        intent = "weather"
        tools += ["get_weather_forecast", "get_active_warnings", "search_agricultural_knowledge", "get_enterprise_context"]
    elif any(t in q for t in MARKET):
        intent = "markets"
        tools += ["get_market_prices", "find_nearby_markets"]
    elif _needs_agronomy(q):
        intent = "agronomy"
        tools += ["get_enterprise_context", "get_activity_history", "search_agricultural_knowledge", "get_weather_forecast"]
        role = "reasoning"
    elif _simple_nav(q):
        intent = "passport" if "passport" in q or "profile" in q else "chat"
        role = "fast"
        tools += ["get_farmer_context"]
    elif any(t in q for t in WEB_LIVE):
        intent = "current_info"
        role = "compound"
        tools += ["search_agricultural_knowledge"]
    else:
        tools += ["search_agricultural_knowledge", "get_enterprise_context"]

    if risk == "high":
        tools = ["get_farmer_context", "search_agricultural_knowledge"]
        role = "fast"

    return RouteDecision(
        intent=intent,
        risk=risk,
        model_role=role,
        model_id=model_for_role(role),
        needs_tools=list(dict.fromkeys(tools)),
        escalate=escalate,
        escalation_reason=escalation_reason,
    )


def model_for_role(role: str) -> str:
    """Configurable model IDs — farmers never see these names."""
    if role == "fast":
        return os.environ.get("GROQ_MODEL_FAST") or os.environ.get("GROQ_MODEL") or "llama-3.1-8b-instant"
    if role == "vision":
        return os.environ.get("GROQ_MODEL_VISION") or "qwen/qwen3.6-27b"
    if role == "compound":
        return os.environ.get("GROQ_MODEL_COMPOUND") or "groq/compound"
    return os.environ.get("GROQ_MODEL_REASONING") or os.environ.get("GROQ_MODEL") or "openai/gpt-oss-120b"


def _medium(q: str) -> bool:
    return any(t in q for t in ("disease", "blight", "should i plant", "fertilizer", "yellowing", "wilting"))


def _needs_agronomy(q: str) -> bool:
    return any(t in q for t in (
        "top-dress", "top dress", "topdress", "plant", "harvest", "feed", "milk",
        "fertiliz", "wean", "calv", "spray tomorrow", "when should", "should i",
    ))


def _simple_nav(q: str) -> bool:
    return bool(re.match(r"^(hi|hello|habari|jambo|mambo|thanks|asante|hey)\b", q)) or any(
        t in q for t in ("my passport", "what is missing", "sync", "waiting to send")
    )
