# Ops deferred until after Phase 12 (coding-first programme)

**Purpose:** Catalogue dashboard / live-environment work so Phases 3–12 can land **code** on `main` without blocking on Supabase/Vercel/Railway/healthchecks/Sentry/DAST.

**Rule:** Do not invent green DoD for these rows. Execute after Phase 12 coding is on `main` (or earlier if operator asks). Deliver secrets **out of band** — never commit service roles or prod refs.

---

## Phase 3 — Environments / CI/CD

| ID | Item | Status |
|---|---|---|
| P03-OPS-001 | Supabase projects `akara-dev` / `akara-staging` / `akara-production` | Deferred |
| P03-OPS-002 | Apply migrations 001–029 to each Supabase project | Deferred |
| P03-OPS-003 | Production PITR (or OQ-P03-004 billing) | Deferred |
| P03-OPS-004 | Run `seed_dev_data.py` on akara-dev only | Deferred |
| P03-OPS-005 | Vercel `akara-web-dev` / staging / production + `VITE_*` | Deferred |
| P03-OPS-006 | healthchecks.io ×11 slugs + ping URL bases to DEV1 | Deferred |
| P03-OPS-007 | Sentry Performance FE/BE + OTEL endpoint to DEV1 | Deferred |
| P03-OPS-008 | Restore drill + `deployment_events` `restore_drill` row | Deferred |
| P03-OPS-009 | Razorpay staging `rzp_test_`; SendGrid From staging; WhatsApp staging sends off | Deferred |
| P03-OPS-010 | Live Airlock + rlsgrid (replace Unverified artefacts) | Deferred |
| P03-OPS-011 | Swazz on staging; GitHub env secret isolation audit | Deferred |
| P03-OPS-012 | Dual §28 sign-off for Phase 3 | Deferred |

**Code land:** `main` @ `852d315` (2026-09-20). Integration order preserved: DEV2 then DEV1 `d922de8`.

---

## Phase 4+ (append as each phase codes)

Rows for Phase 4 (`exports` bucket, apply 030–032, Swazz/ZAP on `/team` `/account` `/invite`, etc.) are added when Phase 4 coding starts.
