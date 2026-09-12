"""Grounded Ask Mkulima rewrite over Groq, or xAI if Groq is not set.

The phone already builds farmer-safe facts. This module only rewrites those
facts into short Kenyan English. If the live model is missing or fails, the
draft stays. Farm context is sent only for this request; it is not stored.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

XAI_API_KEY = os.environ.get("XAI_API_KEY") or ""
GROQ_API_KEY = os.environ.get("GROQ_API_KEY") or os.environ.get("OPENAI_API_KEY") or ""

if GROQ_API_KEY:
    LLM_API_KEY = GROQ_API_KEY
    LLM_BASE_URL = (
        os.environ.get("GROQ_BASE_URL")
        or os.environ.get("OPENAI_BASE_URL")
        or "https://api.groq.com/openai/v1"
    ).rstrip("/")
    LLM_MODEL = os.environ.get("GROQ_MODEL") or os.environ.get("OPENAI_MODEL") or "groq/compound-mini"
    LLM_PROVIDER = "groq"
elif XAI_API_KEY:
    LLM_API_KEY = XAI_API_KEY
    LLM_BASE_URL = (os.environ.get("XAI_BASE_URL") or "https://api.x.ai/v1").rstrip("/")
    LLM_MODEL = os.environ.get("XAI_MODEL") or "grok-4.6"
    LLM_PROVIDER = "xai"
else:
    LLM_API_KEY = ""
    LLM_BASE_URL = ""
    LLM_MODEL = "mkulima-farmer-reasoner-v3"
    LLM_PROVIDER = "local"

SYSTEM_PROMPT = """You are Ask Mkulima, a farm-records companion for Kenyan smallholders.

This is a continuing chat. Read the recent turns. Stay in the same voice.
If the farmer is following up, answer that follow-up. You may nod to what they just asked, in one short clause.
Do not repeat the previous answer. Do not greet again if you already answered once.

Write 2 to 4 short sentences in plain Kenyan English.
Talk like a neighbour who has looked at the farm book, not like a bank or a scientist.

Use ONLY the facts in DRAFT. Recent turns are for voice and follow-up only.
If a previous turn mentions a fact that is not in DRAFT, ignore that fact.
Do not add weather, prices, yields, scores, dates, or advice that is not in DRAFT.
If a fact is missing, say so in one short line.
Never promise a loan. Never mention a score. Never say approved, guaranteed, or pre-qualified.
Never mention NDVI, models, APIs, confidence, formulas, or limitations.
Do not use bullet lists, headings, or the words Source, Limitations, or Confidence.
End with one practical next step that is already in the draft.
Return only the answer the farmer should read."""

BLOCKED = (
    "score formula",
    "your score",
    "credit score",
    "pre-approved",
    "preapproved",
    "loan approved",
    "guaranteed loan",
    "you will get a loan",
    "nitapata mkopo",
)


def provider_info() -> dict[str, str]:
    if LLM_API_KEY:
        return {
            "status": "healthy",
            "service": "ask-mkulima",
            "provider": LLM_PROVIDER,
            "model": LLM_MODEL,
            "policy": "farmer-safe-v1",
        }
    return {
        "status": "healthy",
        "service": "ask-mkulima",
        "provider": "local",
        "model": "mkulima-farmer-reasoner-v3",
        "policy": "farmer-safe-v1",
    }


def rewrite_answer(
    question: str,
    draft_text: str,
    draft: dict[str, Any] | None = None,
    history: list[Any] | None = None,
) -> tuple[str, dict[str, Any]]:
    """Return (text, meta). Always returns a usable farmer answer."""
    clean_draft = (draft_text or "").strip()
    meta = {
        "provider": "local",
        "model": "mkulima-farmer-reasoner-v3",
        "rewritten": False,
    }
    if not LLM_API_KEY or not clean_draft:
        return clean_draft, meta

    rewritten = _call_llm(question, clean_draft, draft, history)
    if rewritten and _safe_rewrite(rewritten):
        meta.update({"provider": LLM_PROVIDER, "model": LLM_MODEL, "rewritten": True})
        return rewritten, meta
    return clean_draft, meta


def _recent_turns(history: list[Any] | None) -> list[dict[str, str]]:
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


def _call_llm(question: str, draft_text: str, draft: dict[str, Any] | None, history: list[Any] | None) -> str | None:
    user = json.dumps(
        {
            "question": question[:800],
            "draft": {
                "text": draft_text[:1200],
                "intent": (draft or {}).get("intent"),
                "next": ((draft or {}).get("recommendations") or [])[:2],
            },
        },
        ensure_ascii=True,
    )
    turns = _recent_turns(history)
    if LLM_PROVIDER == "xai":
        payload = {
            "model": LLM_MODEL,
            "store": False,
            "temperature": 0.3,
            "max_output_tokens": 280,
            "input": [{"role": "system", "content": SYSTEM_PROMPT}, *turns, {"role": "user", "content": user}],
        }
        path = "/responses"
    else:
        payload = {
            "model": LLM_MODEL,
            "temperature": 0.3,
            "max_tokens": 280,
            "messages": [{"role": "system", "content": SYSTEM_PROMPT}, *turns, {"role": "user", "content": user}],
        }
        path = "/chat/completions"
    request = urllib.request.Request(
        f"{LLM_BASE_URL}{path}",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {LLM_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "MkulimaAsk/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=18) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:400]
        print(f"ASK_LLM_HTTP {exc.code} {detail}")
        return None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        print(f"ASK_LLM_ERR {type(exc).__name__} {exc}")
        return None
    text = _extract_text(body)
    if not text:
        print("ASK_LLM_EMPTY")
    return text


def _extract_text(body: Any) -> str | None:
    if not isinstance(body, dict):
        return None
    choices = body.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message") if isinstance(choices[0], dict) else None
        text = (message or {}).get("content") if isinstance(message, dict) else None
        if isinstance(text, str) and text.strip():
            return text.strip()
    output = body.get("output")
    if isinstance(output, list):
        chunks: list[str] = []
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get("content")
            if isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and isinstance(part.get("text"), str):
                        chunks.append(part["text"])
            elif isinstance(item.get("text"), str):
                chunks.append(item["text"])
        if chunks:
            return " ".join(chunk.strip() for chunk in chunks if chunk.strip())
    text = body.get("output_text")
    if isinstance(text, str) and text.strip():
        return text.strip()
    return None


def _safe_rewrite(text: str) -> bool:
    if not text or len(text) > 900:
        return False
    lowered = text.lower()
    if any(term in lowered for term in BLOCKED):
        return False
    if "```" in text or text.lstrip().startswith("#"):
        return False
    return True
