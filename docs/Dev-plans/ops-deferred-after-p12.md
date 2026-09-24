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

**Code base at kickoff:** `main` @ `55d63e7`. DEV1 path-split from `74aa8eb` (039–047 only). Code landed on `main` @ `8540e44` / Living note `2546a2f`.

---

## Phase 7 — Connector sync platform

| ID | Item | Status |
|---|---|---|
| D2-P07-OPS-001 | Apply migrations 048–051 to `akara-dev` / `akara-staging` | Deferred |
| D2-P07-OPS-002 | Provision AES master key / Vault; `CONNECTORS_ENABLED=true` on staging; `CONNECTOR_TALLY_PUSH_SECRET` out of band | Deferred |
| D2-P07-OPS-003 | Deploy 5th Railway service from `railway.connector_sync.json` (record conflict with Phase 3 4-service cap) | Deferred |
| D2-P07-OPS-004 | Staging smoke: wizard → test → sync → logs; agent HMAC push → `canonical_orders` | Deferred |
| D2-P07-OPS-005 | Petpooja partnership sandbox→prod; UrbanPiper Gamma (stub stays gated until approved) | Deferred |
| D2-P07-OPS-006 | Swazz/ZAP scoped to `/api/v1/connectors/*`; live rlsgrid on connector tables | Deferred |
| D2-P07-OPS-007 | Signed update CA / private key ops (S5); dual §28 S1–S8 sign-off | Deferred |

**Code base at kickoff:** `main` @ `2546a2f` (`PHASE6_SHA`). DEV1 path-split from `74aa8eb` (048–051 only). Code landed on `main` @ `8cbc1d1` / Living note `716fc97`.

---

## Phase 8 — Semantic metrics & café dashboard

| ID | Item | Status |
|---|---|---|
| D2-P08-OPS-001 | Apply migrations 052–055 to `akara-dev` / `akara-staging` | Deferred |
| D2-P08-OPS-002 | Staging `CAFE_METRICS_V2=true` + `NEW_DASHBOARD` / `VITE_NEW_DASHBOARD` for smoke | Deferred |
| D2-P08-OPS-003 | MV refresh after import/connector sync verified on staging | Deferred |
| D2-P08-OPS-004 | Cube.js Railway / internal-only deploy **only if** POC adopted; else mark S4 N/A | Deferred |
| D2-P08-OPS-005 | Two-tenant API test live: A cannot see B revenue | Deferred |
| D2-P08-OPS-006 | Swazz/ZAP scoped to `/kpi/*` and `/metrics`; live rlsgrid on new tables | Deferred |
| D2-P08-OPS-007 | 10% A/B then GA; dual §28 S1–S5 sign-off | Deferred |

**Code base at kickoff:** `main` @ `716fc97` (`PHASE7_SHA`). DEV1 must be path-split from `74aa8eb` (052–055 only; scrub 056+) before integrate. Code landed on `main` @ `af26c85` / Living note `b1b30f8`.

---

## Phase 9 — Copilot LLM platform

| ID | Item | Status |
|---|---|---|
| D2-P09-OPS-001 | Apply migrations 056–058 to `akara-dev` / `akara-staging` | Deferred |
| D2-P09-OPS-002 | Provision Langfuse Cloud keys + Railway `LANGFUSE_*`; Legal/DPDP note before prod traces | Deferred |
| D2-P09-OPS-003 | Provision `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` fallbacks; flip LiteLLM flags on staging | Deferred |
| D2-P09-OPS-004 | `TEST_TENANT_JWT` secret for Promptfoo CI; first staging `make run-cafe-benchmark` ≥75% | Deferred |
| D2-P09-OPS-005 | Garak CI against synthetic model; block on `promptinject`/`dan` VULNERABLE or `leakreplay` HIGH | Deferred |
| D2-P09-OPS-006 | sqlglot A/B 10% then cutover; retire regex guard at 9d | Deferred |
| D2-P09-OPS-007 | Weekly eval worker + dual §28 S1–S7 / L6 sign-off | Deferred |

**Code base at kickoff:** `main` @ `b1b30f8` (`PHASE8_SHA`). DEV1 must be path-split from `74aa8eb` (056–058 only; scrub 059+) before integrate. Code landed on `main` @ `909290b` / Living note `746a829`.

---

## Phase 10 — Intelligence signals

| ID | Item | Status |
|---|---|---|
| D2-P10-OPS-001 | Apply migrations 059–061 to `akara-dev` / `akara-staging` | Deferred |
| D2-P10-OPS-002 | Railway env: `OPEN_METEO_BASE_URL`, `FORECAST_MIN_DAYS`, `FORECAST_HORIZON`, `ANOMALY_*`, `ALERT_*`, `WORKER_*`, Zaptilo template IDs | Deferred |
| D2-P10-OPS-003 | Live Open-Meteo from Railway intelligence worker | Deferred |
| D2-P10-OPS-004 | Live rlsgrid two-tenant on `forecasts` / `alert_anomalies` | Deferred |
| D2-P10-OPS-005 | Swazz/ZAP scoped to `/alerts`, `/forecasts`, `/morning-brief/preview`, `/admin/reports/*` | Deferred |
| D2-P10-OPS-006 | Dual §28 S-P10-001–005 sign-off | Deferred |

**Code base at kickoff:** `main` @ `45ce4ad` (`PHASE9_SHA`). DEV1 must be path-split from `74aa8eb` (059–061 only; scrub 062+ / Phase 11 agents) then completed (stacked P10 is shells). Code landed on `main` @ `0cb97a5` / Living note `61a4d7b` / pin `8cbb542`.

---

## Phase 11 — Decision engine

| ID | Item | Status |
|---|---|---|
| D2-P11-OPS-001 | Apply migrations 062–066 to `akara-dev` / `akara-staging` | Deferred |
| D2-P11-OPS-002 | Railway env: `DECISION_ENGINE_ENABLED`, `DECISION_ENGINE_MODEL`, `DECISION_ENGINE_MAX_RECS_PER_TENANT=10`, `CONFIDENCE_*`, `MAX_EXPECTED_IMPACT_INR=500000`, commission defaults | Deferred |
| D2-P11-OPS-003 | Live rlsgrid two-tenant on `recommendations` (accept → 404) | Deferred |
| D2-P11-OPS-004 | Staging soak of decision engine + outcome clock | Deferred |
| D2-P11-OPS-005 | DeepTeam live / Langfuse spans (package absent — do not add) | Deferred |
| D2-P11-OPS-006 | Dual §28 S-P11-001–005 sign-off | Deferred |

**Code base at kickoff:** `main` @ `8cbb542` (`PHASE10_SHA`). DEV1 must be path-split from `74aa8eb` (062–066 + agents/playbooks only; scrub 067+ / Phase 12) then completed (stacked P11 is shells).

---

## Later phases

Append rows when Phase 12 coding starts.
