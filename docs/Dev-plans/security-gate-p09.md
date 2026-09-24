# Phase 9 security gate (`security-gate-p09.md`)

Seeded from constitution §28 S1–S7 + L6 / SECURITY.md Phase 9. **Do not edit** constitution AC tables.
Base SHA: `b1b30f8` (`PHASE8_SHA`).
DEV1: `phase/09-dev-1-copilot-llm-platform` @ `8d90647` (path-split from `74aa8eb`; **never merge tip**).
DEV2: `phase/09-dev-2-copilot-llm-platform` @ `f5bb38e`.
Integration: `phase/09-copilot-llm-platform`. Date: 2026-09-24.

## Cloudflare

- **Guidance (start):** done (`security-scan-p09-cloudflare-guidance.txt`).
- **Full audit (end):** `quick` → `C:\Users\Admin\security-audit-skill\akara\p09-run-1\` — **0 confirmed** high/critical; 5 `needs_validation` (CF-P09-001..005).

## Ops deferred

Langfuse keys, fallback API keys, TEST_TENANT_JWT, Garak CI live, Promptfoo ≥75% staging, sqlglot A/B → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md).

## Tool run matrix

| Tool | Artefact | Status |
|---|---|---|
| Bandit start/end | `security-scan-p09-bandit.txt` / `-end.txt` | Complete — end **0 High** (8 Medium, low confidence) on copilot/llm/guard |
| pip-audit start/end | `security-scan-p09-pip-audit.txt` / `-end.txt` | Complete — clean (`uvx pip-audit`) |
| Semgrep start/end | `security-scan-p09-semgrep.json` / `-end.json` | End written via uvx |
| KeyHog | `security-scan-p09-keyhog.txt` / `-end.txt` | **Unverified** — TOOL_NOT_INSTALLED |
| Betterleaks | `security-scan-p09-betterleaks*` | **Partial** — TOOL_NOT_INSTALLED stub |
| Trivy fs | `security-scan-p09-trivy.txt` / `-end.txt` | lockfile HIGH pre-existing class |
| Garak / Promptfoo staging / Langfuse Legal | — | **Unverified** — deferred |
| Cursor `security-review` on `domain/copilot/` + `infra/llm/` | chat | Complete — **0 HIGH**; 1 Medium (sqlglot skipping regex) **fixed** on tip (`validate_sql` always) |

**End verdict:** 0 new Bandit Critical/High vs start on Phase 9 surfaces. Cloudflare 0 confirmed. sqlglot **optional** (not in pyproject); regex always on.

## Security gate table (§28 S1–S7 + L6)

| Condition | Status |
|---|---|
| S1 Prompt injection controls | **Partial** — user text in user role; 2000 cap; Garak deferred |
| S2 SQL guard completeness (sqlglot stream+non-stream) | **Partial** — `guard_sql` + `validate_sql` on executor (both paths); A/B deferred; sqlglot optional |
| S3 No secrets in prompts | **Partial** — semantic_layer stub has no secrets; live grep Unverified |
| S4 Langfuse PII (UUID tenant_id only) | **Unverified / deferred** — SDK not wired |
| S5 Cache key includes tenant_id | **Unverified** — LiteLLM cache not adopted in this shell |
| S6 API key security | **Unverified** — ops |
| S7 Garak synthetic only | **Partial** — `garak.yml` + `garak_config.yaml` synthetic; live deferred |
| L6 Garak probes pass | **Unverified** — deferred |
| L6 Promptfoo ≥75% | **Partial** — harness + 50 questions + `check_gate`; staging run deferred |
| JWT/RLS programme swap | **Partial** — SEC-P01-002 |

## Dual sign-off

§28 / L6 dual sign-off **not claimed** — live staging ops deferred.

## Blocking rule

New Crit/High vs Phase 9 start → STOP. Garak `promptinject`/`dan` VULNERABLE or `leakreplay` HIGH when run → STOP.
