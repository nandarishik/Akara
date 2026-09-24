# Phase 11 security gate (`security-gate-p11.md`)

Seeded from constitution §28 S-P11-001–005 / SECURITY.md Phase 11. **Do not edit** constitution AC tables.
Base SHA: `8cbb542` (`PHASE10_SHA`).
DEV2: `phase/11-dev-2-decision-engine`.
DEV1: `phase/11-dev-1-decision-engine` (path-split + complete; not yet cut at seed).
Integration: `phase/11-decision-engine` (not yet cut at seed). Date: 2026-09-24.

## Cloudflare

- **Guidance (start):** done (`security-scan-p11-cloudflare-guidance.txt`). Companions: `AI-AND-LLM.md`, `DATA-ISOLATION-AND-LIFECYCLE.md`.
- **Full audit (end):** pending on integration tip → `C:\Users\Admin\security-audit-skill\akara\p11-run-1\`.

## Ops deferred

Apply 062–066, Railway env, live rlsgrid two-tenant accept → 404, staging soak, DeepTeam live / Langfuse, dual §28 sign-off → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md).

## Tool run matrix (start)

| Tool | Artefact | Status |
|---|---|---|
| Bandit start | `security-scan-p11-bandit.txt` | Complete — 0 High (pre-existing Medium/Low; scoped to app/) |
| pip-audit start | `security-scan-p11-pip-audit.txt` | Complete — clean |
| Semgrep start | `security-scan-p11-semgrep.json` | **Unverified** — TOOL_NOT_INSTALLED |
| KeyHog | `security-scan-p11-keyhog.txt` | **Unverified** — TOOL_NOT_INSTALLED |
| Betterleaks | `security-scan-p11-betterleaks.txt` | **Partial** — CLI present; help-only |
| Trivy fs | `security-scan-p11-trivy.txt` | **Partial** — offline lockfile; no vuln DB |

## Tool run matrix (end)

Filled after integration.

## Security gate table (§28 S-P11-001–005)

| Condition | Status |
|---|---|
| S-P11-001 Tenant A accept Tenant B rec → 404 | **Pending** — code on DEV1; live rlsgrid Unverified / deferred |
| S-P11-002 Adversarial `item_name` → normal café rec; no SQL | **Pending** — pytest-native on DEV1; DeepTeam live deferred |
| S-P11-003 GST rec contains `Consult your CA` | **Pending** — DEV1 playbook |
| S-P11-004 Extra LLM keys `auto_apply` / `execute_sql` → ValidationError | **Pending** — DEV1 `extra='forbid'` |
| S-P11-005 `expected_impact_max` capped at 500000 + note | **Pending** — DEV1 impact cap |
| JWT/RLS programme swap | **Partial** — SEC-P01-002 |

## Cursor security-review

Pending on integration: `domain/intelligence/` agents + playbooks + `actions.py`.

## Dual sign-off

§28 S-P11-001–005 dual sign-off **not claimed** — live staging ops deferred.

## Blocking rule

New Crit/High vs Phase 11 start → STOP. Isolation leak → STOP. Live secret → STOP.
Cloudflare confirmed high/critical: pending end audit.
