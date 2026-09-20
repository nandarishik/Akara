# Phase 9 security gate (`security-gate-p09.md`)

Seeded from constitution §28 S1–S7 + L6 / SECURITY.md Phase 9. **Do not edit** constitution AC tables.
Base SHA: `b1b30f8` (`PHASE8_SHA` / `origin/main` after Phase 8 land).
DEV1: `phase/09-dev-1-copilot-llm-platform` (path-split from `74aa8eb`; **never merge tip**).
DEV2: `phase/09-dev-2-copilot-llm-platform`. Date: 2026-09-20.

## Cloudflare

- **Guidance (start):** companions LLM/auth/data-isolation — pending write.
- **Full audit (end):** `quick` → `C:\Users\Admin\security-audit-skill\akara\p09-run-1\` — pending integration tip.

## Ops deferred

Langfuse keys, fallback API keys, TEST_TENANT_JWT, Garak CI live, Promptfoo ≥75% staging, sqlglot A/B → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md).

## Tool run matrix

| Tool | Artefact | Status |
|---|---|---|
| Bandit start | `security-scan-p09-bandit.txt` | Start pending |
| pip-audit start | `security-scan-p09-pip-audit.txt` | Start pending |
| Semgrep start | `security-scan-p09-semgrep.json` | Start pending |
| KeyHog | `security-scan-p09-keyhog.txt` | **Unverified** — TOOL_NOT_INSTALLED if missing |
| Betterleaks | `security-scan-p09-betterleaks.txt` | Start pending |
| Trivy fs | `security-scan-p09-trivy.txt` | Start pending |
| Garak / Promptfoo staging / Langfuse Legal | — | **Unverified** — deferred |
| Cursor `security-review` on `domain/copilot/` + `infra/llm/` | — | Pending after DEV1 on integration tip |

## Security gate table (§28 S1–S7 + L6)

| Condition | Status |
|---|---|
| S1 Prompt injection controls | **Unverified** — DEV1; Garak deferred |
| S2 SQL guard completeness (sqlglot stream+non-stream) | **Unverified** — DEV1; A/B deferred |
| S3 No secrets in prompts | **Unverified** — DEV1 |
| S4 Langfuse PII (UUID tenant_id only) | **Unverified / deferred** |
| S5 Cache key includes tenant_id | **Unverified** — DEV1 |
| S6 API key security | **Unverified** — ops |
| S7 Garak synthetic only | **Unverified** — deferred |
| L6 Garak probes pass | **Unverified** — deferred |
| L6 Promptfoo ≥75% | **Unverified** — deferred (harness on DEV2) |
| JWT/RLS programme swap | **Partial** — SEC-P01-002 |

## Dual sign-off

§28 dual sign-off **not claimed** — live staging ops deferred.

## Blocking rule

New Crit/High vs Phase 9 start → STOP. Garak `promptinject`/`dan` VULNERABLE or `leakreplay` HIGH when run → STOP.
