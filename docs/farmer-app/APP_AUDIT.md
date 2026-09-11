# Mkulima Farmer App — Repository Audit

**Date:** 11 September 2026  
**Scope:** Existing Expo farmer app at the Mkulima workspace root (`mkulima-farmer`)  
**Mode of inspection:** Source, docs, env, navigation, SQLite, API adapters, and screens. No redesign was started before this audit.

This workspace is the farmer-facing Expo application. It is not a monorepo containing the full MkulimaScore institutional backend. Backend support is inferred from client contracts, README, and env configuration.

---

## 1. What already exists

### Platform and build

| Item | Finding |
| --- | --- |
| Framework | Expo SDK 57, React Native 0.86, React 19, Expo Router |
| Package | `com.mkulimascore.farmer` |
| Entry | `expo-router/entry` |
| TypeScript | Strict, path alias `@/*` → `src/*` |
| EAS | development / preview / production profiles; preview APK forces `EXPO_PUBLIC_APP_MODE=demo` |
| Native | Android project present; Reanimated/Worklets excluded from Android autolinking |
| CI | `.github/workflows/build-preview-android.yml` |
| Local env | `.env.local` currently points at **staging** (`EXPO_PUBLIC_APP_MODE=staging`, `https://staging-api.mkulimascore.com`) |

### Architecture (strong foundation)

```
Expo Router screens
    → AppDataContext (refresh, offline, weather/markets, Ask Mkulima)
    → FarmerAppService (write use-cases)
    → SQLite (cache + drafts + outbox)
    → Farmer API adapter (demo simulated / live POST /api/v1/farmer/submissions)
```

This matches the documented read/write split: farmer writes are queued as provenance-aware operations (`FARMER_SELF_SERVICE` / `FARMER_REPORTED`) and do not mutate canonical underwriting state.

### Navigation

**Tabs (5):** Home · My Farm · Insights · Records · Profile

**Auth:** Welcome → Phone → OTP (or staging email/password)

**Stacks/modals:** Add hub, production, sale, cost, record, correction, farm detail, enterprise detail, insight kinds, passport, Ask Mkulima, financing, notifications, settings, consents, activity timeline, sync, institution request.

### Local database (`src/db/database.ts`)

SQLite database `mkulima-farmer.db` with JSON-document tables:

- `passport`, `farms`, `enterprises`, `insights`, `evidence`, `requests`, `consents`
- `activity`, `financing`, `notifications`
- `weather`, `climate`, `markets`, `personalized_alerts`
- `ask_mkulima_messages`
- `production_submissions`, `farmer_submissions`
- `outbox` with idempotency keys and dependency IDs
- `app_metadata` (settings, form drafts, seed flag)

On first launch the DB **always seeds** a synthetic demo farmer: **Mary Wanjiku**, Githunguri, Kiambu — dairy, maize, avocado, coffee, tea, poultry — plus demo weather, climate, markets, alerts, consents, and a Demo SACCO request.

### Authentication

- Tokens stored in `expo-secure-store` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`).
- Demo: any 9+ digit phone + 4+ digit OTP → local session token, MSID `MS-KE-DEMO-004829`.
- Non-demo: institutional `POST /api/v1/auth/login/access-token` (username/password). Phone OTP is **not** wired to a live farmer OTP API.
- After OTP/password, the app jumps straight to Home. There is **no** consent, identity, farm, enterprise, or SACCO self-onboarding.

### Offline and sync

Working and worth preserving:

- Network-aware refresh
- Outbox queue with PENDING / SYNCING / SYNCED / RETRY / FAILED / CONFLICT
- Form drafts survive interruption
- Offline banner: “Showing saved data”
- Evidence upload states and retry
- AppState + 5-minute refresh
- Demo sync simulates acceptance; live mode posts to `/api/v1/farmer/submissions`

### Live integrations (honest)

| Capability | Reality |
| --- | --- |
| Weather | **Real** Open-Meteo forecast when a farm has lat/lng. Cached in SQLite. Farmer-safe activity notes (no fertilizer prescriptions). |
| Markets | **Does not fabricate live prices.** Demo returns empty live payload; UI may still show seeded “cached” demo ranges. Live tries `/api/v1/farmer/markets` and labels unavailable. |
| Climate / EO | Demo-seeded only. Not a live EO pipeline. |
| Ask Mkulima | Local farmer-safe assistant in demo; production adapter expects `/api/v1/farmer/ask-mkulima`. |
| Notifications | Local handler + optional severe-weather registration. Demo notifications are seeded. |

### UI / design system

Existing primitives: `AppShell`, `Card`, `PrimaryButton` (primary/secondary/danger), `Typography` (H1–Caption/Eyebrow), `StatusPill`, `FarmerUX` (status panel, section, row), `EmptyState`, `Skeleton`, `InsightCard`, `LiveFarmMap`, `OutboxCard`, `ReadinessChecklist`, `ActionTile`, `MetricCard`, `DataRow`.

Theme already uses agricultural greens (`#17643B`, `#0D2F21`), cream-adjacent canvas, soil/warm accents. Android adaptive icon background is `#F5F3EA`.

### Docs already in repo

`docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, `docs/PRODUCT_SPEC.md`, `docs/SECURITY.md`, `docs/ASK_MKULIMA.md`, `docs/BUILD_AND_RELEASE.md`, plus root product/architecture markdown. Proposed farmer APIs under `/api/v1/farmer/*` are documented as **not yet deployed** on the live API.

---

## 2. What is strong

1. **Correct product boundary.** Farmer writes enter an ingestion/outbox path. The app does not pretend to write canonical scores.
2. **Offline-first skeleton is real**, not a mock: SQLite, drafts, outbox, retry, offline copy.
3. **Secure token storage** is correctly separated from SQLite.
4. **Weather is genuine** (Open-Meteo) and copy is cautious.
5. **Market adapter refuses to invent live prices.**
6. **Consent centre, correction requests, evidence vault, and institution requests** already exist as farmer-safe concepts.
7. **Financing disclaimer** is present: institutions decide; Mkulima does not guarantee a loan.
8. **No institutional 0–1000 score** is shown. Good.
9. **Accessibility beginnings:** 44px+ targets on many controls, labels on tabs, notification button, empty-state actions.
10. **Maps exist** (`react-native-maps`) with polygon support and a calm “not mapped” fallback on farm detail.
11. **Ask Mkulima is bounded** (explain records; do not promise credit). It should stay optional, not become the product.
12. **Demo data is clearly fictional** (Mary Wanjiku) and documented as such.

---

## 3. What is weak

### Product / journey

- **Self-onboarding does not exist.** A new farmer cannot create a Mkulima Passport, farm, or enterprise. After sign-in they land on a pre-seeded demo life.
- **Welcome copy is corporate** (“Farmer intelligence, built with you”) and leaks architecture (“MSID remains the canonical identity”).
- **Phone auth is Kenya-weak:** no country selector, no +254 default, production mode becomes email/password and talks about mapping to MSID.
- **No informed consent screen** and no versioned consent write during onboarding.
- **No farm/enterprise creation UI** — only updates against existing records.
- **No SACCO/cooperative link-request flow** (only viewing seeded consents).
- **Activity is a buried timeline**, not a farm diary. Recommended primary nav is Home / My Farm / Activity / Insights / Profile.
- **Home is a dashboard:** greeting, finance-tinged profile panel, Today, My Farm, Market & Weather, Opportunities, Farm Timeline, Ask Mkulima strip. Too many cards; “Finance readiness” is too prominent.
- **Insights is an institutional intelligence console:** dark hero with four metrics, “Mkulima recommends”, opportunity badge counts, category grid. Feels like a super-app / analytics product.
- **My Farm uses a % complete progress bar.** Spec forbids gamified scores unless a real metric exists.
- **Passport also uses % complete** and exposes MSID as a primary label.
- **Production capture is generic** (one quantity + buyer). Dairy morning/evening rapid entry is missing.
- **Verification language is mixed.** Some screens say “Farmer reported”; others still say UNVERIFIED-adjacent “Needs mapping”, “Missing”, or show raw status enums (`active`, `queued`).
- **Sync screen still talks about “ingestion boundary” and “MkulimaScore APIs”.**

### Design

- Caption is **12px muted grey** — poor outdoors.
- Status is often **color-only pills**.
- Logo JPEG is used as a large hero on welcome, phone, OTP, and profile — institutional, not farm-owned.
- Insights hero is a **dark oversized card** with a 2×2 metric grid.
- Profile menu uses cryptic two-letter markers (`ID`, `RD`, `PM`).
- Strings are **almost entirely hardcoded**. `src/constants/strings.ts` covers little more than settings.

### Data honesty

- First launch always seeds rich demo weather, prices, vegetation, and SACCO activity. A self-onboarded farmer would inherit Mary’s world unless we separate demo sign-in from new-farmer onboarding.
- Climate/EO cards in demo look like live satellite products.

### Backend

- Farmer-mobile OTP, farmer bootstrap, consent create, farm/enterprise create, and institution-link request endpoints are **not implemented in this client** (and README says `/api/v1/farmer/*` is not live).
- Live login is staff/account password, not farmer OTP.
- Farmer identity mapping is env-injected (`EXPO_PUBLIC_BACKEND_FARMER_MSID`), not resolved from phone.

---

## 4. What should be preserved

- SQLite schema + outbox + idempotency
- `FarmerAppService` write path (production, sale, cost, correction, evidence, consent revoke)
- SecureStore token handling
- Demo vs live API adapters (`createFarmerApi`, `createAuthService`)
- Open-Meteo weather + conservative field notes
- Market “unavailable / cached” honesty
- Consent list + revocation queue
- Correction request model (no silent overwrite)
- `LiveFarmMap` and unmapped-farm copy
- Financing disclaimer and refusal to show 0–1000 scores
- Ask Mkulima as an optional helper (do not promote it on every surface)
- Form drafts
- Existing evidence/record detail and request screens
- Brand greens and warm neutrals (refine, do not replace)
- Low-data mode and language setting hooks
- Startup error boundary

---

## 5. What needs redesign (UI / UX, not a rewrite)

| Area | Direction |
| --- | --- |
| Welcome | Farm-owned value: “Your farm. Your records. Your Mkulima Passport.” Get started / Sign in. |
| Phone / OTP | Kenya-first phone + OTP. Hide staff password behind an explicit account-login path. |
| Onboarding | Consent → essential identity → simple farm → enterprise tiles → optional SACCO → meaningful completion. Progressive profiling. |
| Home | Priority-module system. Greeting + place/enterprises. One status. Weather or enterprise action. Profile strength in words. Recent activity. No 12-card dashboard. |
| Tabs | Home / My Farm / **Activity** / Insights / Profile. Records remain available from Farm and Profile. |
| Activity | Farm diary + rapid add. Enterprise-aware types. Subtle “Added by you”. |
| My Farm | Overview, enterprises, land, records, verification. Descriptive profile strength, not a percentage score. |
| Enterprise | Value-chain summaries (dairy / crop / poultry), not identical generic forms. |
| Insights | Farm, Weather, Market, Financial readiness — only with real data. Remove hero metric grid and recommendation theatre. |
| Passport | Signature identity object. Sections, not a completeness game. |
| Sync | “Saved / Syncing / Synced / Needs attention.” Never HTTP or ingestion jargon. |
| Profile | Identity, Passport, institutions, permissions, language, help, logout. Help answers farmer questions. |
| Language | Externalize strings. English first. Do not auto-translate. |

---

## 6. What needs backend support

Required for true self-onboarding and live sync (client can queue locally meanwhile):

1. Phone registration + OTP request/verify
2. Duplicate/existing-account resolution by phone (no PII leak)
3. Farmer create + MSID assignment
4. Versioned consent create (version + timestamp)
5. Farm create (point location, optional area/tenure)
6. Enterprise create (sector + few fields)
7. Institution link **request** (pending until confirmed)
8. `POST /api/v1/farmer/submissions` live and idempotent (already targeted)
9. Farmer-safe reads: bootstrap, passport, farms, enterprises, insights, records, consents, activity
10. Evidence upload authorize/finalize
11. Consent grant/revoke with step-up where required
12. Markets endpoint only when provenance exists; otherwise 204/unavailable
13. Push token registration (optional, low-noise)

High-risk identity conflicts should route to manual review, not silent new MSIDs.

---

## 7. What should be removed or demoted

- Finance-readiness as the Home hero
- Insights “Personalized intelligence” dark hero and opportunity badge counts
- “Mkulima recommends” unless backed by a real, safe insight
- Percentage profile-completion bars
- Cryptic profile markers (`ID`, `RD`, …)
- Architecture language in farmer UI (MSID-as-primary-copy, ingestion layer, canonical identity)
- Ask Mkulima as a persistent Home billboard (keep in Profile / optional)
- Seeded climate/market/alerts appearing as live truth for new farmers
- Staff email/password as the default farmer sign-in

Do **not** remove: evidence vault, consents, corrections, sync engine, weather adapter, Ask Mkulima itself.

---

## 8. Performance concerns

- `AppDataProvider.refresh` loads **every** table and fetches weather **per farm** plus markets on every refresh (app start, foreground, 5-minute interval). Fine for 1–2 farms; will hurt on slow radios.
- Home, Insights, and My Farm are long `ScrollView`s, not virtualized lists.
- Ask Mkulima refresh dependency array is large; asking rebuilds a wide snapshot.
- Branding asset is a JPEG logo reused at large sizes.
- Reanimated is excluded on Android — keep it that way; do not add heavy animation libraries.
- JSON-blob SQLite rows are simple and acceptable; avoid adding ORM weight.

---

## 9. Accessibility concerns

- Caption 12px / `#64736A` fails outdoor readability.
- Many statuses rely on pill color.
- `StatusPill` text is 11px.
- Insights farm chips lack `accessibilityLabel` / selected state (Farm tab does this better).
- Profile menu markers are not meaningful to screen readers (titles help, markers do not).
- Contrast on Insights dark hero mini-values (12px white) is cramped.
- No dynamic-type testing observed.
- Color-only progress bars.

---

## 10. Offline concerns

**Good:** cached passport/farms/records, queued writes, drafts, offline banner, sync retry.

**Gaps:**

- New-farmer onboarding is not designed as an offline-capable write path yet (no local farm/enterprise create).
- Sync UI still uses technical language.
- Weather/market refresh failures are silent (good) but Home may still show stale demo climate as if current.
- No farmer-facing “Saved on this phone / Will sync when you’re online” on every write — production save alert mentions “ingestion layer”.
- 5-minute refresh will keep trying live weather when connectivity is flaky; should be more network-aware.

---

## 11. Security and privacy (current)

**Good:** SecureStore tokens; no model API keys in the bundle; ownership intended to be server-derived; evidence local URIs not uploaded with long-lived AWS keys.

**Watch:**

- Staging `.env.local` is present in the workspace (no secrets observed; public env only).
- Production auth currently sends password over the existing token endpoint (staff bridge). Farmer OTP must not reuse this as the long-term farmer UX.
- SQLite holds PII (name, masked phone, farm coordinates, documents metadata). Device lock + logout must remain clear.
- Location permissions are already declared; do not add background location or contacts.
- Consent revoke currently queues locally without step-up re-auth (documented as required for production).

---

## 12. Screen-by-screen snapshot

| Screen | Verdict |
| --- | --- |
| Welcome | Usable but institutional. Needs Get started / Sign in and farm-owned copy. |
| Phone / OTP | Works in demo. Staging/live is staff login. Leaks MSID/API language. |
| Home | Functional, too dense, finance-forward. Keep greeting + farm context. |
| My Farm | Useful map + enterprises; too many cards and a % bar. |
| Farm detail | Strong. Preserve map, reported vs measured, correction path. Soften mapping alarm. |
| Enterprise detail | Good structure; still generic across sectors. |
| Insights | Overbuilt. Keep weather/market/readiness destinations; cut dashboard chrome. |
| Records | Solid evidence vault. Keep, but not as a fifth tab. |
| Activity | Timeline only. Elevate to diary + add. |
| Passport | Right idea; too much % and MSID-forward. |
| Profile | Complete menu, cryptic markers, logo-as-avatar. |
| Consents | Keep. Farmer-friendlier status words. |
| Financing | Keep as secondary. Checklist is hardcoded demo. |
| Sync | Keep engine; rewrite copy. |
| Add flows | Simple and good. Add rapid dairy and enterprise-specific types. |
| Ask / Settings / Notifications | Keep; do not expand into a super-app. |

---

## 13. Controlled-pass plan (after this audit)

1. **Pass 1 — Audit** (this document)
2. **Pass 2 — Design system:** warmer canvas, outdoor type, verification + sync language, Input, shared strings
3. **Pass 3 — Self-onboarding:** new-farmer path without destroying demo sign-in
4. **Pass 4 — Home:** priority modules, calm, contextual
5. **Pass 5 — My Farm / enterprises:** farmer-owned record, no % game
6. **Pass 6 — Activity recording:** tab + rapid entry
7. **Pass 7 — Passport / profile**
8. **Pass 8 — Insights restraint** (weather/market honesty)
9. **Pass 9 — Offline/sync UX copy and write confirmations**
10. **Pass 10 — Backend queue contracts for onboarding events**
11. **Pass 11 — Accessibility and performance**
12. **Pass 12 — Visual polish**

**Non-negotiable:** do not discard SQLite, sync, weather, consents, evidence, or the demo sign-in path. Do not invent live prices, scores, or institutions.

---

## 14. Audit conclusion

The existing app is a **usable production-oriented foundation**, not unusable greenfield. The data layer and provenance model are the most valuable assets. The farmer experience is still that of a **demo Passport viewer for Mary Wanjiku**, not a self-serve farm record.

The transformation should make sophisticated evidence feel like:

> This is my farm. These are my records. This was added by me. This was confirmed. This is what matters today. I control who I share with.

…without turning Mkulima into a generic agricultural super-app.
