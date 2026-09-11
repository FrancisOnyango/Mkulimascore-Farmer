# Mkulima Farmer App — Product Specification

## North-star experience

A farmer opens Mkulima and sees a living agricultural economic identity, not a lender score.

The product turns contributed information into immediate farmer value:

- **My Passport** — verified agricultural identity.
- **My Farm** — mapped farm and enterprise record.
- **Insights** — farm, enterprise, geo and readiness intelligence.
- **Records** — evidence vault.
- **Permissions** — who can use what and why.
- **Requests** — institution evidence actions.
- **Activity** — transparent history.

## Primary navigation

1. Home
2. My Farm
3. Insights
4. Records
5. Profile

### Global add actions

- Add production
- Add sale
- Add cost
- Upload record
- Request profile correction

## Home

Must show:

- greeting;
- Mkulima Passport identity;
- readiness status;
- sync state;
- quick actions;
- primary farm;
- one institution request;
- recent insights.

Do not display institutional risk band by default.

## Mkulima Passport

Farmer-safe fields:

- display name;
- masked phone;
- MSID/reference;
- location;
- identity verification;
- affiliations;
- farm list;
- enterprises;
- evidence status;
- data freshness;
- permitted financing status.

## My Farm

Each farm shows:

- name/location;
- reported area;
- measured area;
- mapping state;
- enterprise list;
- water/irrigation summary;
- record status;
- correction path.

## Enterprise

Each enterprise shows sector-specific summary.

Farmer should see trends rather than raw questionnaire complexity.

## Insights

### Farm
- mapping status;
- area;
- record freshness;
- infrastructure summary.

### Enterprise
- production trend;
- period comparison;
- buyer concentration;
- cost history;
- margin estimate only with sufficient data.

### Geo
- rainfall context;
- vegetation trend;
- climate/environment context.

### Financial readiness
- ready / needs attention / not ready;
- stale or missing records;
- requested actions.

## Records

Evidence vault categories:

- Production
- Sales
- Payments
- Cooperative
- Inputs
- Veterinary
- Farm
- Financial
- Identity

Statuses:

- received;
- processing;
- verified;
- needs review;
- replacement requested.

## Institution Requests

A request contains:

- institution;
- reason;
- item requested;
- due date;
- permission relationship;
- complete action.

## Permissions

A grant contains:

- institution;
- purpose;
- scopes;
- issue/grant date;
- expiry;
- status;
- revoke/request-revoke.

## Activity

Show:

- evidence verified;
- production updated;
- consent changed;
- farm correction;
- institution request;
- financing status;
- facility outcome.

## Notifications

No spam.

Priority notifications:

1. action required;
2. evidence result;
3. consent;
4. financing status;
5. data freshness.

## Incentive design

The app should clearly link contributed data to farmer value.

Examples:

- “Add your latest milk statement to update production insights and financing readiness.”
- “Map your farm to unlock farm-area verification and location-based insights.”
- “Add production costs to build your enterprise economics view.”

No points/gamification required.

## Progressive insight unlocking

Available insights may be shown as:

- Farm map ✓
- Production trend ✓
- Geo context ✓
- Financing readiness ✓
- Enterprise economics — needs cost records

This creates an understandable reason to contribute more data.

## Accessibility

- high contrast;
- 44px+ touch targets;
- readable in bright light;
- plain language;
- screen reader labels;
- no color-only status semantics.

## Language

English first.

Prepare Kiswahili from day one by externalizing all strings. Additional languages later.

## Non-goals

Do not turn MVP into:

- marketplace;
- fertilizer store;
- generic weather app;
- social network;
- instant-loan marketplace;
- advertising platform;
- generalized agronomy chatbot.

Stay focused on agricultural evidence and economic intelligence.
