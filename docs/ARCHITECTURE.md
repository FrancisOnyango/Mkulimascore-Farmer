# Mkulima Farmer App — Full Architecture

## 1. Role in the MkulimaScore ecosystem

Mkulima is the farmer-facing surface of the Mkulima Passport. It is not a separate farmer database and not a farmer super-app.

The ecosystem is:

```text
MkulimaCollect  ── field/verified evidence ──┐
                                              │
Mkulima Farmer ─ farmer-reported updates ─────┼─> MkulimaScore Evidence + Ingestion Layer
                                              │
Partner systems ─ institutional evidence ─────┘
                                              ↓
                                      Canonical MkulimaScore
                                              ↓
                           Passport / Assessment / Facility / Outcome
                              ↓                               ↓
                     Farmer-safe projection          Institution platform
```

### Core principle

**All channels strengthen one canonical agricultural economic identity.**

The farmer app must never fork a separate version of the farmer.

---

## 2. Product proposition

The farmer value exchange is:

> Build your verified agricultural profile. Understand your farm and enterprise. Control when your information is used for financial assessment.

The app gives farmers value back from data they contribute:

1. farm profile and map context;
2. enterprise production history;
3. sales / cost / productivity insights;
4. farmer-readable geo/environmental context;
5. evidence vault;
6. profile/readiness actions;
7. consent and data-use transparency;
8. institution requests;
9. financing status only when supplied by an institution;
10. longitudinal progress.

The app does not expose proprietary scoring formulas, weights, lender thresholds, model coefficients or internal fraud logic.

---

## 3. Platform boundaries

### Read path

Farmer-facing reads should be projections from canonical MkulimaScore data.

Examples:

- `/farmer/passport`
- `/farmer/farms`
- `/farmer/enterprises`
- `/farmer/insights`
- `/farmer/records`
- `/farmer/requests`
- `/farmer/consents`
- `/farmer/financing`
- `/farmer/activity`

The server must apply purpose, ownership and consent rules before producing these views.

### Write path

Farmer-submitted updates are **not direct destructive edits** of verified canonical records.

Examples:

- new production entry;
- new cost record;
- uploaded statement;
- farm correction;
- buyer correction;
- new farm claim.

They enter the ingestion/provenance system with:

`source = FARMER_SELF_SERVICE`

and a field-level provenance such as:

`FARMER_REPORTED`.

This gives the platform a reviewable lineage:

```text
Farmer proposed value
      ↓
Raw submission
      ↓
Validation
      ↓
Evidence / comparison
      ↓
Accepted / reviewed / rejected
      ↓
Canonical view
```

Consent grant/revocation is different: it is itself an authoritative legal/user action and should be recorded immediately as a versioned audit event after re-authentication.

---

## 4. Client architecture

```text
Expo / React Native
        │
   Expo Router
        │
 ┌──────┼─────────────────────────┐
 │      │                         │
UI   Application               Domain
 │      │                         │
 │   use-cases               typed models
 │      │                         │
 └──────┴──────── repositories ───┘
                   │
            ┌──────┴───────┐
            │              │
          SQLite        Remote API
            │              │
      local cache       MkulimaScore
      outbox            Farmer API
```

### Local storage

Use SQLite for:

- cached farmer-safe projections;
- farmer input drafts;
- local evidence metadata;
- pending submissions/outbox;
- consent draft state;
- sync metadata;
- lightweight app configuration.

Do not use secure storage for large domain records.

### Secure storage

Use OS-backed secure storage only for small secrets:

- access/refresh tokens;
- local PIN-derived session key where needed;
- device/session identifiers when sensitive.

Never store M-PESA statement passwords as persistent normal app state.

---

## 5. Authentication

Recommended farmer authentication:

1. phone number;
2. OTP;
3. device session;
4. optional 4–6 digit local PIN or biometrics;
5. step-up re-authentication for sensitive actions such as consent changes and recovery.

Account recovery must bind back to the canonical MSID, not create another farmer.

Never make the phone number the farmer primary key.

---

## 6. Mkulima Passport domain

```text
Farmer / MSID
 ├─ Identity
 ├─ Consent
 ├─ Affiliations
 ├─ Farms
 │   ├─ Geometry
 │   └─ Enterprises
 │       ├─ Production cycles
 │       ├─ Observations
 │       ├─ Sales
 │       ├─ Expenses
 │       └─ Evidence
 ├─ Assessments (farmer-safe projection only)
 ├─ Facilities
 ├─ Outcomes
 └─ Audit / activity
```

The farmer UI shows a safe subset, not the raw institutional schema.

---

## 7. Insight architecture

Insights must be generated on the server from allowed canonical evidence and returned as farmer-safe cards.

### Farm insights

- measured vs reported area;
- mapping status;
- infrastructure record status;
- land-use summary;
- evidence freshness.

### Enterprise insights

- production trend;
- season/cycle comparison;
- sales history;
- buyer concentration;
- cost history;
- margin estimate where sufficient inputs exist;
- productivity indicators specific to sector.

### Geo insights

Examples when technically validated:

- rainfall context;
- rainfall anomaly;
- vegetation trend;
- drought/flood context;
- season comparison;
- water/environment context.

Farmer copy should translate technical EO variables into understandable statements. Do not display a technical metric merely because it exists.

Every insight should include:

- title;
- value;
- explanation;
- source label;
- observation period;
- freshness;
- uncertainty/caveat where needed.

### Financial readiness

Do not display the lender risk score by default.

Display:

- ready for assessment;
- needs attention;
- not ready;
- missing recent evidence;
- stale data;
- requested actions.

Readiness must not imply loan approval.

---

## 8. Evidence vault

Evidence is a first-class entity.

Farmer can contribute:

- cooperative delivery statements;
- buyer receipts;
- input receipts;
- veterinary records;
- production records;
- sales records;
- farm photos;
- approved financial documents.

Upload architecture:

```text
App
 ↓ request authorization
Farmer API
 ↓ temporary upload authorization
Private S3
 ↓ finalize metadata
Evidence ingestion
 ↓
Validation / review / verification
```

No public S3 objects. No long-lived AWS credentials in the app.

---

## 9. Consent centre

Consent is a major product differentiator.

Farmer must be able to see:

- institution;
- purpose;
- scopes;
- granted date;
- expiry;
- current status;
- revocation path;
- consent request history.

Suggested scopes:

- identity;
- farm;
- enterprise/production;
- cooperative/buyer records;
- approved financial evidence;
- assessment outputs;
- outcome reporting.

Do not hide a broad data grant behind one generic checkbox.

---

## 10. Institution requests

Institutions may request new evidence only when there is an authorized purpose.

Flow:

```text
Institution
  ↓ request
MkulimaScore
  ↓ farmer-safe request
Mkulima app
  ↓ upload / action
Ingestion
  ↓
Evidence validation
  ↓
Assessment refresh / institution workflow
```

A request should show **who**, **what**, **why** and **due date**.

---

## 11. Offline behavior

The farmer app needs lighter offline functionality than MkulimaCollect, but it should still:

- show the last-known Passport;
- show farms;
- show recent insights;
- show records;
- accept simple production updates;
- accept new evidence;
- queue changes;
- retry automatically or manually.

The app should never show a failed network request as lost farmer work.

---

## 12. Sync contract

The local outbox contains immutable operation IDs.

Example:

```json
{
  "operation_id": "uuid",
  "operation_type": "FARMER_PRODUCTION_SUBMITTED",
  "source": "FARMER_SELF_SERVICE",
  "payload": {},
  "created_at": "..."
}
```

Server mutation requests must be idempotent.

Recommended endpoint:

`POST /api/v1/farmer/submissions`

with `Idempotency-Key`.

Server returns:

- operation accepted;
- needs review;
- needs correction;
- conflict;
- server reference.

---

## 13. Data correction model

A farmer must be able to challenge/correct profile data.

A correction request contains:

- entity;
- field;
- current displayed value;
- farmer-proposed value;
- reason;
- evidence;
- timestamp.

Verified records are not silently overwritten.

This preserves trust and provenance.

---

## 14. Financing module

Only show:

- financing request/application status;
- institution;
- facility amount;
- tenor;
- next payment;
- outstanding amount;
- outcome;

when the information originates from an authorized institution or trusted facility record.

Never fabricate eligibility or pre-approved amounts.

---

## 15. Ask Mkulima / AI boundary

AI is optional, not required for MVP.

Allowed:

- explain what a profile item means;
- explain why an update is requested;
- summarize farmer-safe records;
- help navigate evidence;
- translate or simplify language.

Not allowed:

- guarantee loan approval;
- invent credit eligibility;
- reveal score weights;
- hallucinate agronomic facts as if observed;
- infer sensitive facts that are not present.

The assistant should use farmer-safe projections, not raw institutional decision features.

---

## 16. Security

Threat model:

- stolen farmer phone;
- SIM swap;
- OTP interception;
- session token theft;
- public evidence URL leakage;
- unauthorized institution access;
- cross-farmer access;
- consent replay;
- forged correction request;
- malicious file;
- duplicate retry;
- manipulated offline payload;
- old application version.

Controls:

- server-side ownership/authorization;
- revocable short-lived sessions;
- step-up authentication for sensitive changes;
- tenant/purpose checks;
- private evidence storage;
- idempotency;
- upload size/type validation;
- audit events;
- no sensitive telemetry;
- minimum app version enforcement.

---

## 17. Privacy

Farmer experience must embody:

- data minimization;
- understandable purpose;
- permission visibility;
- correction;
- consent lifecycle;
- controlled sharing;
- auditability.

No ads. No sale of farmer personal data. No generic marketplace dependency for the core product.

---

## 18. Notifications

Useful categories:

- evidence verified;
- evidence needs replacement;
- institution request;
- consent expiring;
- financing status updated;
- production record stale;
- profile action required.

Notifications must deep-link into the relevant farmer-safe screen.

Avoid engagement spam.

---

## 19. Low-data mode

Required:

- image compression appropriate to document type;
- lazy loading;
- no autoplay video;
- simple charts;
- cached profile;
- resumable evidence upload;
- network-aware refresh;
- user-visible queued state.

---

## 20. Sector intelligence

The app UI is generic but insights are sector-aware.

Examples:

### Dairy
- milk/day trend;
- litres/lactating cow;
- delivery consistency;
- buyer concentration;
- feed cost history.

### Coffee
- season delivery;
- factory/cooperative history;
- seasonal payment pattern;
- historical yield;
- input costs.

### Tea
- green leaf delivery history;
- factory/buying centre;
- monthly/bonus payment pattern.

### Poultry
- batch/flock size;
- mortality;
- eggs/day or broiler cycle;
- feed cost;
- sales cycle.

The farmer-facing app does not need to expose all raw fields at once; it exposes useful farmer outcomes.

---

## 21. Deployment

### Android
GitHub source → CI/EAS → preview APK → controlled pilot → production AAB → Google Play.

### Backend
Same AWS MkulimaScore infrastructure.

Recommended public API hostname:

`api.mkulimascore.com`

with staging equivalent.

### App environments

- demo;
- staging;
- production.

Production build must never fall back silently to demo authentication or mock APIs.

---

## 22. Observability

Track privacy-safe operational metrics:

- successful logins;
- OTP failure;
- app crash;
- screen/API latency;
- sync failure;
- evidence upload failure;
- request completion;
- consent completion;
- insight view;
- production update submission.

Never send full National IDs, financial documents or access tokens into analytics.

---

## 23. Release gates

### Gate 1 — local product
All core screens, SQLite, outbox, evidence capture.

### Gate 2 — physical Android
Installable preview APK; offline update survives app kill.

### Gate 3 — staging integration
Real auth, real Passport reads, staged farmer writes, evidence S3.

### Gate 4 — consent/security review
Sensitive workflow review.

### Gate 5 — pilot
Small farmer cohort + selected institution.

### Gate 6 — production
Play Store/AAB, monitoring, incident response, support.

---

## 24. Definition of world-class

The app is successful when the farmer can say:

> “I can see what is known about my farm, I get useful intelligence from it, I know what I can improve, and I understand who can use my information.”

while the institution can trust that farmer-submitted information remains provenance-aware and does not weaken the canonical evidence system.
