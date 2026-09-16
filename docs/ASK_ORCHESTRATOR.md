# Ask Mkulima — cloud-grounded architecture (Groq retained)

Groq is the **reasoning and response layer**. MkulimaScore’s backend supplies farmer context, agricultural knowledge, live tools and controlled actions.

```text
Farmer → Ask API → Intent/safety router → Context builder + Knowledge + Live tools
                 → Groq (structured JSON) → Safety validator → App
```

## Package

`infra/farmer-api/ask_orchestrator/`

| Module | Role |
| --- | --- |
| `router.py` | Intent, risk, model role (`fast` / `reasoning` / `vision` / `compound`) |
| `context_builder.py` | Selective farm context — never dumps the whole passport |
| `tools.py` | Controlled tool registry (weather, warnings, KAMIS, knowledge, drafts, escalation) |
| `gateway.py` | Groq structured JSON output |
| `safety.py` | Blocks scores, invented chemicals, fake official warnings |
| `memory.py` | Conversation summary + provisional claim detection |
| `actions.py` | Confirm → provisional CORRECTION / ACTIVITY / INCIDENT / IMPACT / escalation + outbox |
| `ops.py` | Prompt version, evaluation starters, expert review queue |
| `orchestrate.py` | End-to-end pipeline |

## Model routing (env)

| Variable | Default | Use |
| --- | --- | --- |
| `GROQ_MODEL_FAST` | `llama-3.1-8b-instant` | Greetings / navigation |
| `GROQ_MODEL_REASONING` | `openai/gpt-oss-120b` | Agronomic reasoning |
| `GROQ_MODEL_VISION` | `meta-llama/llama-4-scout-17b-16e-instruct` | Photo questions |
| `GROQ_MODEL_COMPOUND` | `groq/compound` | Approved live web research only |
| `GROQ_API_KEY` | — | Backend only |

Farmers never see model names. Deprecations: see [Groq deprecations](https://console.groq.com/docs/deprecations). Tool calling: [local tools](https://console.groq.com/docs/tool-use/local-tool-calling). Structured outputs: [docs](https://console.groq.com/docs/structured-outputs).

## API

| Method | Path |
| --- | --- |
| POST | `/api/v1/farmer/ask-mkulima` (orchestrated; optional `imageDataUrl` / `attachmentId`) |
| POST | `/api/v1/ask/sessions` |
| GET | `/api/v1/ask/sessions/{id}` |
| POST | `/api/v1/ask/messages` |
| POST | `/api/v1/ask/messages/{id}/feedback` |
| POST | `/api/v1/ask/actions/{id}/confirm` |
| POST | `/api/v1/ask/attachments` |
| POST | `/api/v1/ask/escalations` |
| GET | `/api/v1/ops/ask/version` |
| GET | `/api/v1/ops/ask/evaluation` |
| POST | `/api/v1/ops/ask/review` |

## Safety

- No pesticide names / doses / vet medicines from chat.
- No scores, risk bands or loan promises.
- Model watches ≠ Official KMD/NDMA warnings.
- Provisional planting dates require confirmation.
- Feedback is reviewed before evaluation use.
- Photo assessments stay provisional; a photo alone cannot confirm a diagnosis.

## Offline

Phone keeps DemoAsk fallback, downloaded knowledge pack and farm summary. Live weather/prices/warnings require connectivity; offline replies say so via `localOnly`.

## Knowledge

Hybrid retrieval via `knowledge.py` (Postgres FTS + optional pgvector when configured; bundled Kenya corpus otherwise). Prioritize KALRO / MoA / KEPHIS / PCPB / KMD / NDMA / FAO ([KALRO](https://keep.kalro.org/), [KAMIS](https://kamis.kilimo.go.ke/)).

## Phases

1. **Done:** orchestrator, selective context, tools, structured Groq, safety, action cards, session/escalation APIs, offline fallback.
2. **Done:** confirmation workflows write provisional entities + outbox (never overwrite verified records).
3. **Done:** vision assessment hooks (`imageDataUrl`), Compound routing, in-app photo + TTS read-aloud.
4. **Done:** ops endpoints for prompt version, evaluation catalog, expert review queue.
5. **Later ops:** EventBridge weather ingest into Ask tools, full CAP official warnings, Whisper STT, evaluation dashboard UI.
