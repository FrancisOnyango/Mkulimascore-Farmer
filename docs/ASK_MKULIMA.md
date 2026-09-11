# Ask Mkulima

Ask Mkulima is the farmer-facing assistant surface for explaining the Mkulima Passport.

## Current implementation

The mobile app includes:

- a persisted chat screen at `/ask`;
- SQLite-backed assistant message history;
- a demo assistant client for local/offline-safe responses;
- a production adapter for `POST /api/v1/farmer/ask-mkulima`;
- farmer-safe context projection before any remote request;
- client-side refusal for obvious restricted topics.

## Allowed

The assistant may explain:

- why a profile item needs updating;
- which record is useful to upload;
- what farm mapping means;
- why enterprise economics is incomplete;
- what is waiting to sync;
- what permission scopes mean;
- farmer-safe readiness status.

## Not allowed

The assistant must not:

- promise a loan;
- invent qualification;
- reveal model weights;
- reveal score thresholds;
- expose internal fraud rules;
- expose raw institutional schemas;
- receive mobile-bundled provider API keys.

## Production integration

The mobile app must call a MkulimaScore backend assistant endpoint. The backend should authenticate the farmer, derive ownership from session identity, rebuild or validate the farmer-safe context server-side, apply policy guardrails, call the selected model provider, and audit the response.

The APK must not call model providers directly.

## Mobile contract

The production mobile app calls:

- `GET /api/v1/farmer/ask-mkulima/health`
- `POST /api/v1/farmer/ask-mkulima`

Required request headers:

- `Authorization: Bearer <farmer access token>`
- `Content-Type: application/json`
- `Accept: application/json`
- `X-Request-ID: <uuid>`

Request body:

```json
{
  "question": "What should I do about today's weather?",
  "context": {
    "passport": {},
    "farms": [],
    "enterprises": [],
    "insights": [],
    "records": [],
    "openRequests": [],
    "consentSummaries": [],
    "financing": [],
    "weather": [],
    "climate": [],
    "markets": [],
    "alerts": [],
    "pendingOutboxCount": 0
  },
  "history": [],
  "requestId": "uuid",
  "audit": {
    "action": "ask_mkulima",
    "client": "mkulima-farmer",
    "schemaVersion": "v1"
  }
}
```

Response body:

```json
{
  "text": "Farmer-facing answer",
  "metadata": {
    "intent": "weather",
    "sources": [{ "label": "Farm weather forecast", "freshness": "Updated less than 1 hr ago" }],
    "recommendations": [],
    "followUps": [],
    "limitations": [],
    "localOnly": false,
    "confidence": "medium",
    "requestId": "uuid",
    "provider": "bedrock|openai|other",
    "model": "model-id",
    "latencyMs": 1200
  }
}
```

The backend should treat mobile context as helpful context, not authoritative truth. It should enforce ownership from the authenticated farmer session, redact sensitive fields, apply safety policy, and return source/freshness/limitation metadata with every answer.
