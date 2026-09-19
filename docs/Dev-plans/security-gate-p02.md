# Phase 2 security gate (`security-gate-p02.md`)

Seeded from constitution §28 / SECURITY.md Phase 2. **Do not edit** constitution AC tables.
Base SHA: `255f937` (`P02_PHASE1_BASE_SHA`). Branch: `phase/02-dev-2-modular-foundation`.
Date: 2026-09-19.

## Cloudflare guidance (Phase 2 Start)

- Load `.cursor/skills/security-audit/SKILL.md` in **guidance** mode only.
- Companions: `WEB-PROTOCOL-AND-AUTH.md`, `SUPPLY-CHAIN-AND-RELEASE.md`.
- Trust boundaries this phase: `/v1` + compat aliases (DEV1); ErrorEnvelope disclosure; import-linter supply chain; first Airlock-RLS / rlsgrid baseline (end).
- Status: **Cloudflare guidance: done (no findings.json yet)**.

## Tool run matrix (start-of-phase → `security-scan-p02-*`)

| Tool | Artefact | Status |
|---|---|---|
| Bandit | `docs/Phases/security-scan-p02-bandit.txt` | Complete — 0 High; 10 Medium (same class as day-one) |
| pip-audit | `docs/Phases/security-scan-p02-pip-audit.txt` | Complete — no known vulnerabilities |
| Semgrep | `docs/Phases/security-scan-p02-semgrep.json` | Complete — see start scan count |
| KeyHog | `docs/Phases/security-scan-p02-keyhog.txt` | **Unverified** — `TOOL_NOT_INSTALLED: keyhog` (deferred) |
| Betterleaks | `docs/Phases/security-scan-p02-betterleaks.txt` + `.json` | Complete — scoped; no new live committed secrets |
| Trivy | `docs/Phases/security-scan-p02-trivy.txt` | Complete — HIGH in lockfiles same class as Phase 1 Trivy (not new Crit vs Bandit/Semgrep day-one baseline) |
| Airlock-RLS | `docs/Phases/security-scan-p02-airlock.txt` | end-of-phase |
| rlsgrid | `docs/Phases/security-scan-p02-rlsgrid.txt` | end-of-phase |

**Start verdict:** 0 new Bandit/Semgrep Critical/High vs Phase 1 day-one. Proceed.

## Security gate table (§28)

| Finding ID | Tool | Severity | Description | Status | Resolution |
|---|---|---|---|---|---|
| SEC-P02-001 | Airlock-RLS | — | First RLS audit before staging | **PENDING** | Run `airlock-rls check` at end; becomes Phase 3 baseline |
| SEC-P02-002 | rlsgrid | — | First grid scan before staging | **PENDING** | Run `rlsgrid scan` at end |
| SEC-P02-003 | Manual | INFO | Compat aliases keep unversioned routes | **ACCEPTED** | Remove aliases Phase 5 |
| SEC-P01-002 | Bandit/design | MEDIUM | Service role in `tenant.py` | **ACCEPTED** (carry) | JWT swap blocked |

## Blocking rule

Any **new** Critical/High vs Phase 1 day-one baseline **BLOCKS** merge.
