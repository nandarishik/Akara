# Phase 1 security gate (`security-gate-p01.md`)

Seeded from constitution §28 headers. **Do not edit** `docs/Phases/phase_01_truth_baseline.md` AC tables.
Day-one baseline SHA: `caac39f` (+ DEV2 cycle-fix `6403ad3` for pytest collection). Branch: `phase/01-dev-2-truth-baseline`.
Date: 2026-09-19.

## Cloudflare guidance (Phase 1 Start)

- Loaded `.cursor/skills/security-audit/SKILL.md` in **guidance** mode only (no `findings.json`).
- Companions: `DATA-ISOLATION-AND-LIFECYCLE.md`, `AI-AND-LLM.md`.
- Trust boundaries for this workstream: `answer_stream` vs `answer()` guardrails; SQLTool `:tenant_id` bind; runbook execute stub warning; no JWT/RLS swap.
- Status: **Cloudflare guidance: done (no findings.json)**.

## Tool run matrix (day-one)

| Tool | Layer | Artefact / result | Status |
|---|---|---|---|
| Bandit `-ll` on `backend/app` | L2 | `docs/Phases/security-scan-day1-bandit.txt` | Complete — 0 High; 10 Medium (B104/B608). Excluded `.venv`. |
| pip-audit | L3 | `docs/Phases/security-scan-day1-pip-audit.txt` | Complete — no known vulnerabilities |
| KeyHog `--git-history` | L1 | `docs/Phases/security-scan-day1-keyhog.txt` | **Unverified** — `TOOL_NOT_INSTALLED: keyhog` (Rust binary; no cargo/PyPI) |
| Semgrep `p/python` `p/fastapi` `p/sql-injection` | L2 | `docs/Phases/security-scan-day1-semgrep.json` | Complete — **0 findings** on this SHA with registry rules (no login). `sql_tool.py` string replace still present; track as SEC-P01-001 baseline for Option D merge. |
| Betterleaks | L1 | — | **Unverified** — tool not installed: betterleaks |
| Skylos | L2 | — | **Unverified** — tool not installed: skylos |
| OpenTaint | L2 | — | **Unverified** — tool not installed: opentaint |
| Trivy fs | L3 | — | **Unverified** — tool not installed: trivy |
| tenant-guard | L4 | — | **Unverified** — after isolation tests (WP-D2-004); binary missing |
| rlsautotest / airlock-rls / rlsgrid | L4 | — | **N/A Phase 1** — no migrations / no staging |

## Security gate table (§28)

| Finding ID | Tool | Severity | File:Line | Description | Status | Resolution |
|---|---|---|---|---|---|---|
| SEC-P01-001 | Semgrep / source review | HIGH (expected baseline) | `sql_tool.py` `_bind_params` | SQL string concatenation / replace after guard (`:tenant_id` → quoted UUID) | **Baseline on main** | DEV1 Option D on `5ce6c10` (UUID assert + regex). Re-check after WP-D2-008. Semgrep registry returned 0 hits this run — do not invent; still track for Option D. |
| SEC-P01-002 | Bandit / design | MEDIUM (constitution) | `tenant.py` service role client | Service role key usage bypasses RLS | **ACCEPTED** | Intentional until JWT/RLS swap (blocked ADR-006 / FIX-06 test-only). Current Bandit `-ll` did not emit B106 on settings attribute — still accept by design. |
| SEC-P01-003 | Bandit | Medium | `marketing.py` / `onboarding.py` B104 | Bind all interfaces | Accepted day-one | Deploy bind address; out of Phase 1 DEV2 exclusive paths |
| SEC-P01-004 | Bandit | Medium | `channel_queries.py` / `fallback_queries.py` / `planner.py` B608 | Hardcoded SQL f-strings with `:tenant_id` placeholders | Accepted day-one | Planner/static SQL templates; not new vs main. Phase 2+ parameterization programme. |
| SEC-P01-005 | KeyHog | — | — | History secret scan | Unverified | Install KeyHog binary; re-run before claiming L1 Complete |

## Blocking rule

Any **new** Critical/High vs this day-one baseline **BLOCKS** merge. Isolation leak (Tenant A reads Tenant B) → **STOP**.

## Per-PR rescan (WP-D2-007)

Date: 2026-09-19 after DEV2 code on `phase/01-dev-2-truth-baseline`.

| Tool | Day-one | After DEV2 | Delta |
|---|---|---|---|
| Bandit High | 0 | 0 | **0 new Critical/High** |
| Semgrep findings | 0 | 0 (registry, no login) | **0 new Critical/High** |
| pip-audit | no known vulns | no known vulns | **0 new Critical/High** |
| KeyHog staged | Unverified | Unverified | tool not installed |
| Betterleaks / Skylos / OpenTaint / Trivy | Unverified | Unverified | tools not installed |
| `semgrep p/sql-injection sql_tool.py` | 0 | 0 | not worse |

**Verdict: 0 new Critical/High vs day-one.** Proceed to integration merge.
