# Phase 6 security gate (`security-gate-p06.md`)

Seeded from constitution §28.1–28.6 / SECURITY.md Phase 6. **Do not edit** constitution AC tables.
Base SHA: `55d63e7` (`origin/main`). DEV2: `phase/06-dev-2-canonical-cafe-data`. Date: 2026-09-20.

## Cloudflare

- **Guidance (start):** companions `DATA-ISOLATION-AND-LIFECYCLE`, `AI-AND-LLM` — trust boundaries: tenant-scoped café upload/quarantine, PII redaction before mapping LLM (DEV1), no JWT in export query string (DEV2). No `findings.json` at start.
- **Full audit (end):** pending on integration tip → `C:\Users\Admin\security-audit-skill\akara\p06-run-1\`.

## Ops deferred

Apply 039–047, `ENABLE_AI_MAPPING` staging, Swazz/ZAP `/data/imports/*`, live rlsgrid on `canonical_*` / quarantine → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md).

## Tool run matrix (start)

| Tool | Artefact | Status |
|---|---|---|
| Bandit start | `security-scan-p06-bandit.txt` | Complete — **0 High** (10 Medium pre-existing class) |
| pip-audit start | `security-scan-p06-pip-audit.txt` | Complete — clean |
| Semgrep start | `security-scan-p06-semgrep.json` | Complete — 0 findings |
| KeyHog | `security-scan-p06-keyhog.txt` | **Unverified** — TOOL_NOT_INSTALLED |
| Betterleaks | `security-scan-p06-betterleaks.*` | **Partial** — dir scan; no leaks in partial |
| Trivy fs | `security-scan-p06-trivy.txt` | Complete — lockfile HIGH pre-existing class (nanoid/react-router) |
| Live apply / rlsgrid / Swazz / AI-mapping staging | — | **Unverified** — deferred |
| PII-before-LLM (`test_pii_not_sent_to_llm`) | — | **Unverified** until DEV1 split merge |

## Security gate table (§28) — start seed

| Condition | Status |
|---|---|
| 28.1 Tenant isolation (canonical + quarantine + undo + worker claim) | **Unverified** — DEV1 after split |
| 28.2 File upload security (filename / ext / size / content / path) | **Unverified** — DEV1; DEV2 client ext check Partial when UI lands |
| 28.3 AI mapping PII handling | **Unverified** — DEV1 |
| 28.4 Import undo authorization | **Unverified** — DEV1; DEV2 reuses DELETE |
| 28.5 Validation engine (no SQL from cells) | **Unverified** — DEV1 |
| 28.6 FMCG backward compatibility | **Unverified** until JOINT post-merge |
| JWT/RLS programme swap | **Partial** — SEC-P01-002 |

## Dual sign-off

§28 dual sign-off **not claimed** — live staging ops deferred. Coding gate filled at end.

## Blocking rule

New Crit/High vs Phase 6 start → STOP. Isolation leak or live secret → STOP.
