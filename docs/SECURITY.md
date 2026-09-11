# Farmer App Security & Privacy Requirements

## High-risk actions

Require fresh/step-up authentication for:

- granting institution access;
- revoking consent;
- changing verified phone/account identity;
- account recovery;
- sharing a Passport externally;
- authorizing sensitive financial evidence processing.

## Device

- store tokens in SecureStore;
- no secrets in SQLite;
- no production API key in mobile bundle;
- session revocation;
- remote invalidation after lost phone;
- configurable local data retention.

## Evidence

- private storage only;
- short-lived signed upload;
- MIME and size validation;
- hash/integrity where appropriate;
- never log document contents.

## API

- HTTPS;
- short-lived JWT/session;
- ownership derived server-side;
- never authorize by client-supplied MSID;
- idempotency;
- rate limits;
- audit.

## Analytics

Forbidden:

- National ID;
- complete phone number;
- raw financial statements;
- access token;
- consent document;
- M-PESA password.

## AI

AI receives a farmer-safe context projection, not raw institutional model inputs.

It may explain records and actions.

It may not guarantee financing or reveal proprietary score mechanics.
