# Phase 4 DEV2 session handoff

Branch (DEV2): `phase/04-dev-2-identity-tenancy-onboarding`  
Integration: `phase/04-identity-tenancy-onboarding` (not cut yet)  
Date: 2026-09-20

## Kickoff

| Field | Value |
|---|---|
| `P04_PHASE3_BASE_SHA` | `cdaded79ddfaa592bfe582735a847cef9f2aa0a3` (`origin/main` after Phase 3 code land) |
| DEV1 Phase 4 SHA | `b449b5f` (merge **first** on integration) |
| Integration branch | `phase/04-identity-tenancy-onboarding` |
| Merge order | **DEV1 first**, then DEV2 (default) |

## PC checks (WP-D2-000)

| PC | Result |
|---|---|
| Base = post-P3 main | PASS — `cdaded7` |
| Max migration | PASS — `029`; no forward 030–032 at kickoff |
| Present App.tsx, Settings, Team, Onboarding, ConsentModal, api.ts, auth-utils, teamInvite | PASS |
| Ops deferred doc | PASS — `ops-deferred-after-p12.md` |

## Deferred ops

All D2-P04-005/006/026 + JOINT staging/DAST → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md).

## D2-P04 status (updated as WPs land)

| WP | Status |
|---|---|
| 001–004 migrations + rollbacks | pending |
| 005–006 apply DB | **DEFERRED** |
| 007–024 frontend + tests | pending |
| 025 test_dpdp_flows | DEV1 — skip |
| 026 exports bucket | **DEFERRED** |
| 027 backend/.env.example | DEV1 — skip; frontend `VITE_MAX_SESSION_HINT` only |
| 028 getting-started | pending |

## CI / ownership reminder

DEV2 never edits backend Python, `ci.yml`, Semgrep, or `backend/.env.example`.

## HEAD

DEV2 HEAD: (set at end)

## PR

Do not PR to main until operator asks.
