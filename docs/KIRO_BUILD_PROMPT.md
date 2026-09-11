# Kiro continuation prompt — Mkulima Farmer

You are implementing the MkulimaScore farmer-facing application.

Read, in order:

1. `docs/ARCHITECTURE.md`
2. `docs/PRODUCT_SPEC.md`
3. `docs/API_CONTRACT.md`
4. `docs/SECURITY.md`
5. `docs/BUILD_AND_RELEASE.md`

Treat these as binding architecture.

The current app is an Android-first Expo SDK 57 farmer application with local SQLite demo/offline flows.

## Non-negotiable

- Do not create a second canonical farmer database.
- Read canonical farmer-safe projections from MkulimaScore.
- Farmer writes go through ingestion/provenance as `FARMER_SELF_SERVICE`.
- Do not directly overwrite verified records.
- Do not expose scoring formulas, weights, thresholds, exposure formulas or fraud rules.
- Do not guarantee financing.
- Use the existing MkulimaScore authentication and backend when available; do not invent a parallel identity system.
- Keep demo adapters clearly separated from production.
- Never silently fall back to demo mode in production.
- Keep repository private.
- Use synthetic fixtures only until staging integration is approved.

## Immediate tasks

1. Run `npm install` and `npx expo install --fix`.
2. Run `npx expo-doctor@latest`.
3. Fix only legitimate SDK compatibility issues.
4. Run `npm run typecheck`.
5. Build a standalone preview APK that launches Mkulima directly without Metro.
6. Test on a physical Android device.
7. Verify offline production update survives app termination.
8. Verify evidence capture survives app termination.
9. Do not connect to production.
10. Inspect the existing MkulimaScore backend before implementing the production API adapter beyond the documented contract.

## Staging integration order

1. auth/bootstrap;
2. Passport read;
3. farms/enterprises read;
4. insights read;
5. production submission through ingestion;
6. evidence presigned upload;
7. consent;
8. requests;
9. activity;
10. financing view.

Stop before production deployment and report test results.
