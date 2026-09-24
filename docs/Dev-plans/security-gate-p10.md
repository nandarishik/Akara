# Phase 10 security gate (`security-gate-p10.md`)

Seeded from constitution §28 S-P10-001–005 / SECURITY.md Phase 10. **Do not edit** constitution AC tables.
Base SHA: `45ce4ad` (`PHASE9_SHA`).
DEV1: `phase/10-dev-1-intelligence-signals` @ `cc0b746`.
DEV2: `phase/10-dev-2-intelligence-signals` @ `805f0bc`.
Integration: `phase/10-intelligence-signals`. Date: 2026-09-24.

## Cloudflare

- **Guidance (start):** done (`security-scan-p10-cloudflare-guidance.txt`).
- **Full audit (end):** `C:\Users\Admin\security-audit-skill\akara\p10-run-1\` — **0 confirmed** high/critical; 5 `needs_validation` (live ops).

## Ops deferred

Apply 059–061, live Open-Meteo, rlsgrid two-tenant, Railway env, Zaptilo templates, dual §28 sign-off → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md).

## Tool run matrix (start)

| Tool | Artefact | Status |
|---|---|---|
| Bandit start | `security-scan-p10-bandit.txt` | Complete — 0 High (pre-existing Medium/Low) |
| pip-audit start | `security-scan-p10-pip-audit.txt` | Complete — clean |
| Semgrep start | `security-scan-p10-semgrep.json` | Complete — 0 registry findings |
| KeyHog | `security-scan-p10-keyhog.txt` | **Unverified** — TOOL_NOT_INSTALLED |
| Betterleaks | `security-scan-p10-betterleaks.txt` | **Partial** — CLI present; dir/git not run at start |
| Trivy fs | `security-scan-p10-trivy.txt` | written (lockfile class) |

## Tool run matrix (end)

| Tool | Artefact | Status vs start |
|---|---|---|
| Bandit end | `security-scan-p10-bandit-end.txt` | Complete — P10 paths 0 High / 0 Medium |
| pip-audit end | `security-scan-p10-pip-audit-end.txt` | Complete — clean (incl. statsforecast/pyod) |
| Semgrep end | `security-scan-p10-semgrep-end.json` | **Unverified** — TOOL_NOT_INSTALLED on PATH; start 0 findings |
| KeyHog end | `security-scan-p10-keyhog-end.txt` | **Unverified** — TOOL_NOT_INSTALLED |
| Betterleaks end | `security-scan-p10-betterleaks-end.txt` | **Partial** — help-only |
| Trivy end | `security-scan-p10-trivy-end.txt` | **Partial** — start hung on DB download; not re-run |

**0 new Critical/High** vs Phase 10 start baseline.

## Security gate table (§28 S-P10-001–005)

| Condition | Status |
|---|---|
| S-P10-001 Tenant isolation `forecasts` / `alert_anomalies` | **Partial** — RLS coded (`get_my_tenant_id()`); live rlsgrid **Unverified / deferred** |
| S-P10-002 Open-Meteo not interpolated into SQL | **Complete** (code) — `httpx` params + JSONB upsert; live Open-Meteo **Unverified / deferred** |
| S-P10-003 Worker endpoints require `X-Service-Key` | **Complete** — `/admin/reports/forecast-refresh` + `/alert-evaluation` use `_authorize`; 401 unit test |
| S-P10-004 LLM item names as data not instructions | **Complete** (code) — SYSTEM_PROMPT + adversarial `item_name` unit test; live LLM send **Unverified** |
| S-P10-005 No secrets in worker logs | **Complete** (code) — workers log tenant/skip/counts only; grep clean for `settings.*` secrets |
| JWT/RLS programme swap | **Partial** — SEC-P01-002 |

## Cursor security-review

`domain/intelligence/` + forecast/morning-brief/alert workers + v1 APIs + 059–061. **0 HIGH/CRITICAL**. Medium (preview plan gate, prefs admin PUT, cron plan/opt-out) fixed on integrate tip. Remaining: live rlsgrid, forecast plan-gate product decision.

## Dual sign-off

§28 S-P10-001–005 dual sign-off **not claimed** — live staging ops deferred.

## Blocking rule

New Crit/High vs Phase 10 start → STOP. Isolation leak → STOP. Live secret → STOP.
Cloudflare confirmed high/critical: **0**.
