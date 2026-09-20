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

**Code land:** `main` @ `852d315` / Living tip `cdaded7` (2026-09-20). Integration order preserved: DEV2 then DEV1 `d922de8`.

---

## Phase 4 — Identity / tenancy / onboarding

| ID | Item | Status |
|---|---|---|
| D2-P04-005 | Apply migrations 030–032 to `akara-dev` | Deferred |
| D2-P04-006 | Apply migrations 030–032 to `akara-staging` | Deferred |
| D2-P04-026 | Private Supabase `exports` bucket (staging + prod), 100MB, `application/json` | Deferred |
| P04-OPS-JOINT-001 | Staging smoke: invite email → accept → sessions → export/delete | Deferred |
| P04-OPS-JOINT-002 | Swazz CRITICAL=0 on `/team/*` and `/account/*` | Deferred |
| P04-OPS-JOINT-003 | OWASP ZAP high=0 on `/invite/*` | Deferred |
| P04-OPS-JOINT-004 | Live rlsgrid on Phase 4 tables (consent_log / team_invites / active_sessions) | Deferred |
| P04-OPS-JOINT-005 | Dual §28 security-gate sign-off | Deferred |
| P04-OPS-JOINT-006 | SendGrid invite / export-ready / deletion templates | Deferred |

---

## Phase 5 — Superadmin / billing / entitlements

| ID | Item | Status |
|---|---|---|
| D2-P05-OPS-001 | Apply migrations 033–038 to `akara-dev` / `akara-staging` | Deferred |
| D2-P05-OPS-002 | Provision `QUERY_READONLY_DB_URL` (readonly PG role; never service role) | Deferred |
| D2-P05-OPS-003 | Set `REQUIRE_SUDO_TOTP=true` on staging; store `SUPERADMIN_TOTP_ENCRYPTION_KEY` out of band | Deferred |
| D2-P05-OPS-004 | Staging smoke: TOTP setup → sudo → impersonate → tenant banner → end session | Deferred |
| D2-P05-OPS-005 | Staging: query console dual-barrier write fail; 1000-row / 30s | Deferred |
| D2-P05-OPS-006 | Swazz / ZAP scoped to `/superadmin/*` (+ billing webhook JOINT) | Deferred |
| D2-P05-OPS-007 | Live rlsgrid on new P5 tables; dual §28 sign-off | Deferred |
| D2-P05-OPS-008 | Razorpay webhook completeness + GST PDF e2e on staging | Deferred |

---

## Phase 6 — Canonical café data

| ID | Item | Status |
|---|---|---|
| D2-P06-OPS-001 | Apply migrations 039–047 to `akara-dev` / `akara-staging` | Deferred |
| D2-P06-OPS-002 | Staging `ENABLE_AI_MAPPING=true` + LLM keys out of band | Deferred |
| D2-P06-OPS-003 | Staging smoke: café upload → mapping confirm → progress → recon → quarantine | Deferred |
| D2-P06-OPS-004 | Live rlsgrid on `canonical_*` + `import_quarantine` | Deferred |
| D2-P06-OPS-005 | Swazz/ZAP scoped to `/data/imports/*` and café upload | Deferred |
| D2-P06-OPS-006 | Dual §28 sign-off | Deferred |

**Code base at kickoff:** `main` @ `55d63e7`. DEV1 must be path-split from `74aa8eb` (039–047 only) before integrate.

---

## Later phases

Append rows when Phases 7–12 coding starts.
