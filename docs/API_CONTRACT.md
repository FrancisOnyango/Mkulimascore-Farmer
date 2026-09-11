# Farmer API Contract — Proposed

These are target contracts to map onto the existing MkulimaScore backend. Do not create duplicate canonical models if equivalent endpoints already exist.

## Read APIs

### GET /api/v1/farmer/bootstrap

Returns:

- authenticated farmer identity;
- MSID;
- feature flags;
- supported app version;
- active permissions summary;
- open requests;
- data freshness summary.

### GET /api/v1/farmer/passport

Farmer-safe projection only.

### GET /api/v1/farmer/farms
### GET /api/v1/farmer/farms/{farm_id}
### GET /api/v1/farmer/enterprises
### GET /api/v1/farmer/enterprises/{enterprise_id}
### GET /api/v1/farmer/insights?kind=farm|enterprise|geo|financial
### GET /api/v1/farmer/records
### GET /api/v1/farmer/requests
### GET /api/v1/farmer/permissions
### GET /api/v1/farmer/activity
### GET /api/v1/farmer/financing

### POST /api/v1/farmer/ask-mkulima

Receives a farmer question plus a farmer-safe context projection. The client must not send raw institutional schemas, model features, scoring weights, internal fraud signals, full documents, or secrets.

Headers:

`Authorization: Bearer ...`

`X-Request-ID: <uuid>`

### GET /api/v1/farmer/ask-mkulima/health

Returns AI service readiness for the authenticated farmer session.

Response:

```json
{
  "status": "healthy",
  "service": "ask-mkulima",
  "provider": "openai-compatible",
  "model": "gpt-4.1-mini",
  "policy": "farmer-safe-v1"
}
```

Response:

```json
{
  "text": "Farmer-safe assistant response",
  "metadata": {
    "intent": "weather",
    "sources": [
      {
        "label": "Farm weather context",
        "freshness": "Updated less than 1 hr ago",
        "limitation": "Forecasts can change."
      }
    ],
    "recommendations": [],
    "followUps": ["What should I avoid today?"],
    "limitations": [
      "This is informational guidance, not an agronomic inspection, price guarantee, credit decision, or proof that a record is verified."
    ],
    "localOnly": false,
    "confidence": "medium",
    "requestId": "uuid",
    "provider": "openai-compatible",
    "model": "gpt-4.1-mini",
    "latencyMs": 840
  }
}
```

The assistant may explain profile freshness, records to upload, farm mapping, permission scopes, readiness state and sync status.

The assistant must not promise financing, invent qualification, reveal score formulas, reveal lender thresholds, or expose institution-only decision logic.

All endpoints must derive the farmer scope from authenticated identity. Do not accept arbitrary MSID query parameters as authorization.

## Write APIs

### POST /api/v1/farmer/submissions

All farmer-proposed profile/production/cost/correction operations pass through ingestion.

Headers:

`Authorization: Bearer ...`

`Idempotency-Key: <uuid>`

Payload:

```json
{
  "operation_id": "uuid",
  "operation_type": "FARMER_PRODUCTION_SUBMITTED",
  "source": "FARMER_SELF_SERVICE",
  "payload": {}
}
```

Response:

```json
{
  "operationId": "uuid",
  "status": "ACCEPTED",
  "serverReference": "..."
}
```

Other statuses:

- NEEDS_REVIEW
- NEEDS_CORRECTION
- CONFLICT

### POST /api/v1/farmer/evidence/upload-authorize

Returns short-lived private upload authorization.

### POST /api/v1/farmer/evidence/finalize

Creates the evidence receipt/ingestion record after upload.

### POST /api/v1/farmer/corrections

Creates a correction case rather than overwriting verified records.

## Consent APIs

Consent is not treated as a generic profile submission.

### POST /api/v1/farmer/permissions/{request_id}/grant
### POST /api/v1/farmer/permissions/{grant_id}/revoke

Require step-up authentication where policy requires.

Create immutable/versioned audit event.

## Push

### POST /api/v1/farmer/devices/push-token

Registers a device token to the authenticated farmer identity.

## Required backend protections

- farmer ownership checks;
- purpose/consent checks;
- idempotency;
- rate limiting;
- schema validation;
- file validation;
- correlation IDs;
- audit events;
- minimum supported app version;
- no score-model details in farmer payloads.
