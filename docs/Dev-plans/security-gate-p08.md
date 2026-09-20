# Phase 8 security gate (`security-gate-p08.md`)

Seeded from constitution §28 S1–S5 / SECURITY.md Phase 8. **Do not edit** constitution AC tables.
Base SHA: `716fc97` (`PHASE7_SHA` / `origin/main` after Phase 7 land).
DEV1: `phase/08-dev-1-semantic-metrics-dashboard` (path-split from `74aa8eb`; **never merge tip**).
DEV2: `phase/08-dev-2-semantic-metrics-dashboard`. Date: 2026-09-20.

## Cloudflare

- **Guidance (start):** companions `DATA-ISOLATION-AND-LIFECYCLE`, `WEB-PROTOCOL-AND-AUTH` — pending write.
- **Full audit (end):** `quick` → `C:\Users\Admin\security-audit-skill\akara\p08-run-1\` — pending integration tip.

## Ops deferred

Apply 052–055, staging flags, MV refresh, Cube (if adopted), two-tenant live test, Swazz/ZAP, A/B → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md).

## Tool run matrix

| Tool | Artefact | Status |
|---|---|---|
| Bandit start | `security-scan-p08-bandit.txt` | Start pending |
| pip-audit start | `security-scan-p08-pip-audit.txt` | Start pending |
| Semgrep start | `security-scan-p08-semgrep.json` | Start pending |
| KeyHog | `security-scan-p08-keyhog.txt` | **Unverified** — TOOL_NOT_INSTALLED if missing |
| Betterleaks | `security-scan-p08-betterleaks.txt` | Start pending |
| Trivy fs | `security-scan-p08-trivy.txt` | Start pending |
| Live Cube / two-tenant / DAST | — | **Unverified** — deferred |
| Cursor `security-review` on `domain/kpi/` | — | Pending after DEV1 on integration tip |

## Security gate table (§28 S1–S5)

| Condition | Status |
|---|---|
| S1 Tenant data isolation (tenant_id on metrics + MV + expenses RLS) | **Unverified / deferred** — code from DEV1; live two-tenant deferred |
| S2 Metric versioning append-only | **Unverified** — DEV1 |
| S3 Evidence server-derived only | **Partial** — DEV2 display-only; server from DEV1 |
| S4 Cube.js security (if adopted) | **N/A pending** — mark N/A if POC not adopted; else deferred ops |
| S5 Sensitive financial data / TenantDB / audit | **Unverified** — DEV1 |
| JWT/RLS programme swap | **Partial** — SEC-P01-002 |

## Dual sign-off

§28 dual sign-off **not claimed** — live staging ops deferred.

## Blocking rule

New Crit/High vs Phase 8 start → STOP.
