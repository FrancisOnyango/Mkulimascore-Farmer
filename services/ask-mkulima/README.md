# Ask Mkulima Service

Backend service for the farmer-facing Ask Mkulima AI endpoint used by the mobile app.

The mobile app must never contain model-provider secrets. In production, deploy this service behind the authenticated MkulimaScore API origin and point the app at that origin with `EXPO_PUBLIC_API_BASE_URL`.

## Endpoints

- `GET /health`
- `GET /api/v1/farmer/ask-mkulima/health`
- `POST /api/v1/farmer/ask-mkulima`

## Local Development

```powershell
npm run ai:test
npm run ai:dev
```

Development mode accepts missing bearer tokens so the Expo app can be tested locally. `AI_PROVIDER=local` is the no-key/free mode. It does not call an external model; it uses a farmer-safe reasoning layer over the context sent by the app.

```powershell
$env:AUTH_MODE="development"
$env:AI_PROVIDER="local"
$env:PORT="8787"
npm run ai:dev
```

Then set:

```powershell
$env:EXPO_PUBLIC_APP_MODE="production"
$env:EXPO_PUBLIC_API_BASE_URL="http://localhost:8787"
```

## Production Environment

```text
AUTH_MODE=production
JWKS_URI=https://auth.example.com/.well-known/jwks.json
JWT_ISSUER=https://auth.example.com/
JWT_AUDIENCE=mkulima-farmer
AI_PROVIDER=openai
OPENAI_API_KEY=server-side-secret
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
AI_TIMEOUT_MS=15000
CORS_ORIGIN=https://your-approved-origin.example
```

Production authentication verifies RS256 JWTs against the configured JWKS. The assistant only receives farmer-safe context supplied by the mobile app and is instructed not to reveal scoring formulas, institution-only decision logic, fraud signals, or financing guarantees.
