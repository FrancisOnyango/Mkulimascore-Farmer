# Build and Release

## Development

```bash
npm install
npx expo install --fix
npm run typecheck
npm start
```

## Preview APK

Use EAS preview or the included GitHub Actions workflow.

A preview build must launch Mkulima directly. It must not be a dev-client-only launcher requiring Metro.

## Staging

Set:

- `EXPO_PUBLIC_APP_MODE=staging`
- `EXPO_PUBLIC_API_BASE_URL=https://staging-api.mkulimascore.com`

Never use real farmer PII in development fixtures.

## Production

Production prerequisites:

- existing MkulimaScore auth integrated;
- farmer API contracts implemented;
- private evidence upload;
- staging end-to-end test;
- consent/security review;
- incident monitoring;
- Play signing;
- production feature flags.

## Physical-device acceptance

1. launch;
2. open Passport;
3. airplane mode;
4. add production;
5. add photo record;
6. kill app;
7. reopen;
8. updates remain;
9. reconnect;
10. sync;
11. operation reaches staging ingestion;
12. server recognizes idempotency;
13. farmer-safe projection refreshes.
