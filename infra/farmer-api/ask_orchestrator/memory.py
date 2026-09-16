"""Conversation memory — summarize rather than resend entire transcripts."""

from __future__ import annotations

from typing import Any


def summarize_history(history: list[Any] | None, limit_chars: int = 600) -> dict[str, Any]:
    turns = []
    for item in history or []:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        role = "assistant" if item.get("role") == "assistant" else "farmer"
        turns.append({"role": role, "text": text[:220]})
    recent = turns[-8:]
    summary_parts = []
    for turn in recent[-4:]:
        summary_parts.append(f"{turn['role']}: {turn['text']}")
    summary = " | ".join(summary_parts)
    if len(summary) > limit_chars:
        summary = summary[-limit_chars:]
    return {
        "recentTurns": recent,
        "summary": summary,
        "memoryTypes": {
            "session": "current conversation only",
            "provisional": "chat claims need confirmation before becoming farm records",
            "verified": "only field-verified facts are authoritative",
        },
    }


def detect_provisional_claim(question: str) -> dict[str, Any] | None:
    q = (question or "").lower()
    if "i planted" in q or "nilipanda" in q or "planted on" in q:
        return {
            "type": "provisional_farm_fact",
            "attribute": "planting_date",
            "prompt": "I can use that as a provisional planting date. Would you like me to submit it as a profile update?",
            "requiresConfirmation": True,
        }
    if "reply in kiswahili" in q or "jibu kwa kiswahili" in q or "speak swahili" in q:
        return {
            "type": "farmer_preference",
            "attribute": "language",
            "value": "sw",
            "prompt": "I will reply in Kiswahili.",
            "requiresConfirmation": False,
        }
    return None
