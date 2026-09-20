# Phase 6 security gate (`security-gate-p06.md`)

Seeded from constitution §28.1–28.6 / SECURITY.md Phase 6. **Do not edit** constitution AC tables.
Base SHA: `55d63e7` (`origin/main`). Integration: `phase/06-canonical-cafe-data` @ `a3fadbb`.
DEV1: `phase/06-dev-1-canonical-cafe-data` @ `d0defea` (path-split from `74aa8eb`; **never merge tip**).
DEV2 tip: `0cda7a5`. Date: 2026-09-20.

## Cloudflare

- **Guidance (start):** companions `DATA-ISOLATION-AND-LIFECYCLE`, `AI-AND-LLM` — done.
- **Full audit (end):** `quick` → `C:\Users\Admin\security-audit-skill\akara\p06-run-1\` — **0 confirmed** high/critical; 5 `needs_validation` (CF-P06-001..005). No new confirmed vs p05.

## Ops deferred

Apply 039–047, `ENABLE_AI_MAPPING` staging, Swazz/ZAP `/data/imports/*`, live rlsgrid → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md).

## Tool run matrix

| Tool | Artefact | Status |
|---|---|---|
| Bandit start/end | `security-scan-p06-bandit.txt` / `-end.txt` | Complete — **0 High** both |
| pip-audit start/end | `security-scan-p06-pip-audit.txt` / `-end.txt` | Complete — clean |
| Semgrep start/end | `security-scan-p06-semgrep.json` / `-end.json` | Complete — 0 findings |
| KeyHog | `security-scan-p06-keyhog.txt` / `-end.txt` | **Unverified** — TOOL_NOT_INSTALLED |
| Betterleaks | `security-scan-p06-betterleaks.*` | **Partial** — no leaks in partial dir scan |
| Trivy fs | `security-scan-p06-trivy.txt` | Complete — lockfile HIGH pre-existing class |
| Live apply / rlsgrid / Swazz / AI-mapping staging | — | **Unverified** — deferred |
| `test_phase06_cafe` | pytest | Complete — **4 passed** (shell; PII named module Partial) |

**End verdict:** 0 new Bandit Critical/High vs start. Cloudflare 0 confirmed.

## Security gate table (§28)

| Condition | Status |
|---|---|
| 28.1 Tenant isolation (canonical + quarantine + undo + worker claim) | **Partial** — migrations + code from DEV1; live rlsgrid deferred |
| 28.2 File upload security | **Partial** — DEV1 path/ext; DEV2 client ext check Complete |
| 28.3 AI mapping PII handling | **Partial** — `cafe/pii.py` present; full `test_pii_not_sent_to_llm` Unverified (shell tests) |
| 28.4 Import undo authorization | **Partial** — DELETE reused; live quota deferred |
| 28.5 Validation engine (no SQL from cells) | **Partial** — validator package present |
| 28.6 FMCG backward compatibility | **Partial** — FMCG UI kept; JOINT pytest sample green for cafe shell |
| JWT/RLS programme swap | **Partial** — SEC-P01-002 |

## Dual sign-off

§28 dual sign-off **not claimed** — live staging ops deferred. Coding gate ready when operator asks to PR.

## Blocking rule

New Crit/High vs Phase 6 start → STOP.
