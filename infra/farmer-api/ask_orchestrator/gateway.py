"""Groq model gateway with structured farmer-safe output."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "language": {"type": "string"},
        "confidence": {"type": "string"},
        "basis": {"type": "array", "items": {"type": "string"}},
        "action_cards": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string"},
                    "label": {"type": "string"},
                },
                "required": ["type", "label"],
            },
        },
        "follow_up_question": {"type": "string"},
        "sources": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "freshness": {"type": "string"},
                    "limitation": {"type": "string"},
                },
                "required": ["label"],
            },
        },
        "requires_confirmation": {"type": "boolean"},
        "escalation": {
            "type": "object",
            "properties": {
                "required": {"type": "boolean"},
                "reason": {"type": ["string", "null"]},
            },
        },
    },
    "required": ["answer", "language", "confidence", "basis"],
}

SYSTEM = """You are Ask Mkulima, a farm-aware agricultural companion for Kenyan smallholders.

You receive SELECTIVE_CONTEXT and TOOL_RESULTS from MkulimaScore. Those are authoritative for this request.
Groq is the reasoning layer only — do not invent farm facts, prices, GPS places, pesticide names, doses, or official warnings.

Rules:
- Use only weather, prices, places, warnings and farm facts present in TOOL_RESULTS / SELECTIVE_CONTEXT.
- If a preparedness watch is present, say it is a Mkulima preparedness watch unless officialWarning is true.
- Never present model forecast watches as Official KMD or NDMA warnings.
- Never mention scores, points, risk bands, or loan approval.
- Never claim you saved or changed a verified record.
- Do not invent pesticide products, dosages or veterinary medicines.
- If LANGUAGE is sw, answer in plain Kenyan Kiswahili (keep official names).
- Be a warm neighbour: 2–6 short sentences in answer.
- Prefer citing TOOL_RESULTS knowledge sources by organisation name.
- Return ONLY valid JSON matching the schema. No markdown fences.
"""


VISION_SYSTEM = SYSTEM + """

When an image is attached:
- Treat findings as provisional only.
- Say a photo alone cannot confirm the cause.
- Ask for stage, how widespread, and whether animals/people are affected.
- Offer escalation to an officer when unsure.
- Never invent a pesticide from the photo.
"""


def call_structured(
    *,
    question: str,
    language: str,
    model_id: str,
    selective_context: dict[str, Any],
    tool_results: dict[str, Any],
    history: list[Any] | None,
    draft_text: str | None = None,
    image_data_url: str | None = None,
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    api_key = os.environ.get("GROQ_API_KEY") or os.environ.get("OPENAI_API_KEY") or ""
    base = (os.environ.get("GROQ_BASE_URL") or os.environ.get("OPENAI_BASE_URL") or "https://api.groq.com/openai/v1").rstrip("/")
    meta = {"provider": "local", "model": "mkulima-farmer-reasoner-v3", "rewritten": False}
    if not api_key:
        return None, meta

    # Compound / web research must not receive farmer identifiers.
    safe_context = _trim(selective_context)
    if "compound" in (model_id or "").lower():
        safe_context = {
            "questionFocus": (selective_context or {}).get("questionFocus"),
            "enterpriseSector": ((selective_context or {}).get("enterprise") or {}).get("sector"),
            "countyHint": ((selective_context or {}).get("selectedFarm") or {}).get("location"),
            "note": "No personal identifiers. Use only approved public agricultural sources.",
        }

    user_payload = {
        "question": (question or "")[:900],
        "language": "sw" if language == "sw" else "en",
        "selective_context": safe_context,
        "tool_results": _trim(tool_results),
        "local_draft": (draft_text or "")[:800],
    }

    system = VISION_SYSTEM if image_data_url else SYSTEM
    if image_data_url:
        user_content: Any = [
            {"type": "text", "text": json.dumps(user_payload, ensure_ascii=True)},
            {"type": "image_url", "image_url": {"url": image_data_url[:2_000_000]}},
        ]
    else:
        user_content = json.dumps(user_payload, ensure_ascii=True)

    messages = [
        {"role": "system", "content": system},
        *_history(history),
        {"role": "user", "content": user_content},
    ]

    body = {
        "model": model_id,
        "temperature": 0.3,
        "max_tokens": 700,
        "messages": messages,
        "response_format": {"type": "json_object"},
    }
    if "compound" in (model_id or "").lower():
        body.pop("response_format", None)
        messages[0] = {
            "role": "system",
            "content": SYSTEM + "\nReturn a single JSON object only. Do not send farmer personal identifiers to web tools.",
        }
        body["messages"] = messages
    if image_data_url:
        # Some vision models reject response_format
        body.pop("response_format", None)

    request = urllib.request.Request(
        f"{base}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "MkulimaAskOrchestrator/2.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=28) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:400]
        print(f"ASK_ORCH_HTTP {exc.code} {detail}")
        return None, meta
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        print(f"ASK_ORCH_ERR {type(exc).__name__} {exc}")
        return None, meta

    text = _extract(payload)
    parsed = _parse_json(text)
    if not parsed and image_data_url and text:
        # Vision may return prose — wrap provisionally
        parsed = {
            "answer": text.strip()[:900],
            "language": language,
            "confidence": "low",
            "basis": ["provisional_image_assessment"],
            "action_cards": [
                {"type": "escalate_to_officer", "label": "Ask an officer"},
                {"type": "report_pest_or_disease", "label": "Save provisional incident"},
            ],
            "follow_up_question": "How widespread is the problem on the farm?",
            "sources": [],
            "requires_confirmation": True,
            "escalation": {"required": True, "reason": "photo_uncertain"},
        }
    if not parsed:
        return None, meta
    meta.update({"provider": "groq", "model": model_id, "rewritten": True, "vision": bool(image_data_url)})
    return parsed, meta


def _history(history: list[Any] | None) -> list[dict[str, str]]:
    turns: list[dict[str, str]] = []
    for item in history or []:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or "").strip()[:280]
        if not text:
            continue
        role = "assistant" if item.get("role") == "assistant" else "user"
        turns.append({"role": role, "content": text})
    return turns[-6:]


def _extract(body: Any) -> str | None:
    if not isinstance(body, dict):
        return None
    choices = body.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message") if isinstance(choices[0], dict) else None
        content = (message or {}).get("content") if isinstance(message, dict) else None
        if isinstance(content, str) and content.strip():
            return content.strip()
        # Multimodal content parts
        if isinstance(content, list):
            chunks = []
            for part in content:
                if isinstance(part, dict) and isinstance(part.get("text"), str):
                    chunks.append(part["text"])
            if chunks:
                return " ".join(chunks).strip()
    return None


def _parse_json(text: str | None) -> dict[str, Any] | None:
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start < 0 or end <= start:
            return None
        try:
            data = json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError:
            return None
    return data if isinstance(data, dict) and isinstance(data.get("answer"), str) else None


def _trim(value: Any, depth: int = 0) -> Any:
    if depth > 4:
        return None
    if isinstance(value, dict):
        return {str(k)[:64]: _trim(v, depth + 1) for k, v in list(value.items())[:40]}
    if isinstance(value, list):
        return [_trim(item, depth + 1) for item in value[:12]]
    if isinstance(value, str):
        return value[:600]
    return value
