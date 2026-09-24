# Phase 10 security gate (`security-gate-p10.md`)

Seeded from constitution §28 S-P10-001–005 / SECURITY.md Phase 10. **Do not edit** constitution AC tables.
Base SHA: `45ce4ad` (`PHASE9_SHA`).
DEV1: `phase/10-dev-1-intelligence-signals` (path-split from `74aa8eb` then complete exclusive; **never merge tip**).
DEV2: `phase/10-dev-2-intelligence-signals`.
Integration: `phase/10-intelligence-signals`. Date: 2026-09-24.

## Cloudflare

- **Guidance (start):** done (`security-scan-p10-cloudflare-guidance.txt`).
- **Full audit (end):** pending on integration tip → `p10-run-1`.

## Ops deferred

Apply 059–061, live Open-Meteo, rlsgrid two-tenant, Railway env, Zaptilo templates, dual §28 sign-off → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md).

## Tool run matrix (start)

| Tool | Artefact | Status |
|---|---|---|
| Bandit start | `security-scan-p10-bandit.txt` | Complete — 0 High (pre-existing Medium/Low) |
| pip-audit start | `security-scan-p10-pip-audit.txt` | Complete — clean |
| Semgrep start | `security-scan-p10-semgrep.json` | Complete — written |
| KeyHog | `security-scan-p10-keyhog.txt` | **Unverified** — TOOL_NOT_INSTALLED |
| Betterleaks | `security-scan-p10-betterleaks.txt` | **Partial** — CLI present; dir/git not run at start |
| Trivy fs | `security-scan-p10-trivy.txt` | written (lockfile class) |

## Security gate table (§28 S-P10-001–005)

| Condition | Status |
|---|---|
| S-P10-001 Tenant isolation `forecasts` / `alert_anomalies` | **Partial** at start — tables not on base; RLS to be coded on DEV1; live rlsgrid **Unverified / deferred** |
| S-P10-002 Open-Meteo not interpolated into SQL | **Partial** at start — weather_service not on base; coded as parameterised + JSONB |
| S-P10-003 Worker endpoints require `X-Service-Key` | **Partial** at start — morning-brief already gated; forecast-refresh / alert-evaluation to add |
| S-P10-004 LLM item names as data not instructions | **Partial** at start — morning-brief prompt + adversarial test on DEV1 |
| S-P10-005 No secrets in worker logs | **Partial** at start — structlog must not log `settings.*` secrets |
| JWT/RLS programme swap | **Partial** — SEC-P01-002 |

## Dual sign-off

§28 S-P10-001–005 dual sign-off **not claimed** — live staging ops deferred.

## Blocking rule

New Crit/High vs Phase 10 start → STOP. Isolation leak → STOP. Live secret → STOP.
