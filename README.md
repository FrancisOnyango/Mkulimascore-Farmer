# Mkulima — Farmer-facing MkulimaScore app

Mkulima is the farmer-facing expression of the Mkulima Passport: a trusted agricultural economic identity that lets a farmer see, strengthen and permission the records that power MkulimaScore.

## Product promise

**Build your verified agricultural profile. Understand your farm and enterprise. Control when your information is used for financial assessment.**

The app intentionally does **not** expose proprietary MkulimaScore model weights, score formulas, risk thresholds, exposure formulas or internal fraud rules.

## Core experiences

- Mkulima Passport
- Farms and enterprises
- Farmer-facing farm / geo / enterprise insights
- Evidence vault
- Financing-readiness actions (not a lender score)
- Institution evidence requests
- Consent centre
- Activity history
- Ask Mkulima farmer-safe assistant
- Farmer-submitted production updates
- Offline queue and retry-safe sync abstraction
- Low-data friendly design
- English-first architecture prepared for Kiswahili

## Architecture principle

The farmer app has two different data paths:

**Read path:** canonical farmer-safe projections from MkulimaScore.

**Write path:** farmer-submitted data enters the MkulimaScore ingestion/provenance layer as `FARMER_REPORTED`, not direct destructive mutation of verified canonical records.

See `docs/ARCHITECTURE.md`.

Ask Mkulima is documented in `docs/ASK_MKULIMA.md`. The mobile app includes a demo assistant and a production backend adapter, but it does not bundle model provider API keys.

## Run

```bash
npm install
npx expo install --fix
npm run typecheck
npm start
```

For Android preview builds, use the included GitHub Actions workflow or EAS preview profile.

## Modes

`EXPO_PUBLIC_APP_MODE=demo` seeds synthetic demo data and keeps sync local/simulated.

For the live MkulimaScore backend, set:

```bash
EXPO_PUBLIC_APP_MODE=live-demo
EXPO_PUBLIC_API_BASE_URL=https://api.mkulimascore.com
EXPO_PUBLIC_BACKEND_FARMER_ID=<numeric farmer id from MkulimaScore>
EXPO_PUBLIC_BACKEND_FARMER_MSID=<farmer MSID>
```

The current live backend exposes account login at `/api/v1/auth/login/access-token` and farmer feature writes at `/api/v1/features/farmer`. The proposed farmer-mobile endpoints under `/api/v1/farmer/*` are documented but are not yet deployed on the live API.

## Synthetic demo profile

The bundled demo uses fictional records for **Mary Wanjiku**, a synthetic dairy + maize farmer in Kiambu. It contains no real farmer PII.

## Status

This source package is a production-oriented application foundation with working local demo/offline flows, live backend login, live backend health checks and a sync bridge for farmer-submitted feature updates. Production launch still requires dedicated `/api/v1/farmer/*` backend endpoints, farmer identity mapping, institution consent contracts, geo-insight backend projections, security review and end-to-end staging tests.
