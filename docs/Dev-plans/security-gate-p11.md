# Phase 11 security gate (`security-gate-p11.md`)

Filled from constitution §28 S-P11-001–005 / SECURITY.md Phase 11. **Do not edit** constitution AC tables.
Base SHA: `8cbb542` (`PHASE10_SHA`).
DEV1: `phase/11-dev-1-decision-engine` @ `54812a3`.
DEV2: `phase/11-dev-2-decision-engine` @ `e70f471`.
Integration: `phase/11-decision-engine` (DEV1 then DEV2 + isolation `4549b40`). Date: 2026-09-24.

## Cloudflare

- **Guidance (start):** done (`security-scan-p11-cloudflare-guidance.txt`). Companions: `AI-AND-LLM.md`, `DATA-ISOLATION-AND-LIFECYCLE.md`.
- **Full audit (end):** `C:\Users\Admin\security-audit-skill\akara\p11-run-1\` — **0 confirmed** high/critical; 5 needs_validation (CF-P11-001–005). Prompt injection alone not a finding.

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

| Tool | Artefact | Status |
|---|---|---|
| Bandit end | `security-scan-p11-bandit-end.txt` | Complete — 0 High (same Medium/Low pre-existing; 0 new High vs start) |
| pip-audit end | `security-scan-p11-pip-audit-end.txt` | Complete — clean |
| Semgrep end | `security-scan-p11-semgrep-end.json` | **Unverified** — TOOL_NOT_INSTALLED: semgrep |
| KeyHog end | `security-scan-p11-keyhog-end.txt` | **Unverified** — TOOL_NOT_INSTALLED: keyhog |
| Betterleaks end | `security-scan-p11-betterleaks-end.txt` | Complete on P11 paths — no leaks found |
| Trivy fs end | `security-scan-p11-trivy-end.txt` | **Partial** — offline; lockfile Highs (nltk / react-router / nanoid) pre-existing, not P11 deps |

## Security gate table (§28 S-P11-001–005)

| Condition | Status |
|---|---|
| S-P11-001 Tenant A accept Tenant B rec → 404 | **Partial** — in-memory repo + API 404 (`test_cross_tenant_404`); live rlsgrid Unverified / D2-P11-OPS-003 |
| S-P11-002 Adversarial `item_name` → normal café rec; no SQL | **Partial** — pytest-native (`test_injection_item_name_is_data`); DeepTeam live deferred |
| S-P11-003 GST rec contains `Consult your CA` | **Complete** (code) — playbook + Decision agent + security test |
| S-P11-004 Extra LLM keys `auto_apply` / `execute_sql` → ValidationError | **Complete** (code) — `extra='forbid'` |
| S-P11-005 `expected_impact_max` capped at 500000 + note | **Complete** (code) — `apply_impact_cap` / `MAX_EXPECTED_IMPACT_INR` |
| JWT/RLS programme swap | **Partial** — SEC-P01-002 |

## Cursor security-review

`domain/intelligence/` agents + playbooks + `actions.py` + `062`. **0 HIGH** after tip fixes: `collect_for_tenant` `.eq("tenant_id")` on tenant-owned tables; 062 UPDATE requires admin/owner (matches API `is_admin`).

## Dual sign-off

§28 S-P11-001–005 dual sign-off **not claimed** — live staging ops deferred.

## Blocking rule

0 new Critical/High vs Phase 11 start Bandit/pip-audit. Isolation leak in wired collector **fixed** on tip. Live secret: none on P11 paths. Cloudflare confirmed high/critical: **0**.
