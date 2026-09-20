# Phase 8 security gate (`security-gate-p08.md`)

Seeded from constitution §28 S1–S5 / SECURITY.md Phase 8. **Do not edit** constitution AC tables.
Base SHA: `716fc97` (`PHASE7_SHA` / `origin/main` after Phase 7 land).
DEV1: `phase/08-dev-1-semantic-metrics-dashboard` @ `49f1b93` (path-split from `74aa8eb`; **never merge tip**).
DEV2: `phase/08-dev-2-semantic-metrics-dashboard` @ `aca65ef`.
Integration: `phase/08-semantic-metrics-dashboard` @ `da49afb`. Date: 2026-09-20.

## Cloudflare

- **Guidance (start):** companions `DATA-ISOLATION-AND-LIFECYCLE`, `WEB-PROTOCOL-AND-AUTH` — done (`security-scan-p08-cloudflare-guidance.txt`).
- **Full audit (end):** `quick` → `C:\Users\Admin\security-audit-skill\akara\p08-run-1\` — **0 confirmed** high/critical; 5 `needs_validation` (CF-P08-001..005).

## Ops deferred

Apply 052–055, staging flags, MV refresh, Cube (N/A — not adopted), two-tenant live test, Swazz/ZAP, A/B → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md).

## Tool run matrix

| Tool | Artefact | Status |
|---|---|---|
| Bandit start/end | `security-scan-p08-bandit.txt` / `-end.txt` | Complete — end **0 High** on kpi/metrics (1 Low) |
| pip-audit start/end | `security-scan-p08-pip-audit.txt` / `-end.txt` | Complete — clean |
| Semgrep start/end | `security-scan-p08-semgrep.json` / `-end.json` | Complete — 0 findings |
| KeyHog | `security-scan-p08-keyhog.txt` / `-end.txt` | **Unverified** — TOOL_NOT_INSTALLED |
| Betterleaks | `security-scan-p08-betterleaks*` | **Partial** — TOOL_NOT_INSTALLED stub |
| Trivy fs | `security-scan-p08-trivy.txt` / `-end.txt` | Complete — lockfile HIGH pre-existing class (nanoid/react-router); not Phase 8 surface |
| Live Cube / two-tenant / DAST | — | **Unverified** — deferred; Cube **not adopted** |
| Cursor `security-review` on `domain/kpi/` | chat | Complete — **0 HIGH**; 1 Medium latent (global flag without `require_feature` before GA) |

**End verdict:** 0 new Bandit Critical/High vs start on Phase 8 surfaces. Cloudflare 0 confirmed. Cube S4 **N/A**.

## Security gate table (§28 S1–S5)

| Condition | Status |
|---|---|
| S1 Tenant data isolation (tenant_id on metrics + MV + expenses RLS) | **Partial** — RLS on 053–055; shell passes `tenant_id`; live two-tenant deferred |
| S2 Metric versioning append-only | **Partial** — `metric_definitions.version` present; full append-only SQL Partial shell |
| S3 Evidence server-derived only | **Complete** (code) — DEV2 display-only; server emits `MetricEvidencePayload` |
| S4 Cube.js security (if adopted) | **N/A** — Cube POC **not adopted**; no Cube deploy / browser calls |
| S5 Sensitive financial data / TenantDB / audit | **Partial** — routes auth+tenant gated; null shell today; feature entitlement + live audit deferred |
| JWT/RLS programme swap | **Partial** — SEC-P01-002 |

## Dual sign-off

§28 dual sign-off **not claimed** — live staging ops deferred.

## Blocking rule

New Crit/High vs Phase 8 start → STOP. Isolation leak / live secret → STOP.
