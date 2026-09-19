# Phase 2 security gate (`security-gate-p02.md`)

Seeded from constitution §28 / SECURITY.md Phase 2. **Do not edit** constitution AC tables.
Base SHA: `255f937` (`P02_PHASE1_BASE_SHA`). Integration: `phase/02-modular-foundation` @ `51296e4`.
Date: 2026-09-19.

## Cloudflare

- **Guidance (start):** companions `WEB-PROTOCOL-AND-AUTH`, `SUPPLY-CHAIN-AND-RELEASE` — done.
- **Full audit (end):** `quick` → `C:\Users\Admin\security-audit-skill\akara\p02-run-1\` — **0 confirmed** high/critical; 2 `needs_validation` (Airlock/rlsgrid live DB).

## Tool run matrix

| Tool | Artefact | Status |
|---|---|---|
| Bandit start/end | `security-scan-p02-bandit.txt` / `-end.txt` | Complete — **0 High** both |
| pip-audit start/end | `security-scan-p02-pip-audit.txt` / `-end.txt` | Complete — clean (incl. import-linter) |
| Semgrep start/end | `security-scan-p02-semgrep.json` / `-end.json` | Complete — **0 findings** |
| KeyHog | `security-scan-p02-keyhog.txt` | **Unverified** — TOOL_NOT_INSTALLED (deferred) |
| Betterleaks | `security-scan-p02-betterleaks.*` | Complete — scoped |
| Trivy | `security-scan-p02-trivy.txt` | Complete — lockfile HIGH same class as prior Trivy |
| Airlock-RLS | `security-scan-p02-airlock.txt` | **Unverified** — CLI installed; no SUPABASE_DB_URL (Phase 3 baseline placeholder) |
| rlsgrid | `security-scan-p02-rlsgrid.txt` | **Unverified** — CLI installed; no rlsgrid.toml/DB |
| Disclosure | `security-scan-p02-disclosure.txt` | Complete — `POST /v1/copilot/chat` → 401 `{"ok":false,"code":"UNAUTHENTICATED",...}` no traceback |

**End verdict:** 0 new Bandit/Semgrep Critical/High vs start / Phase 1 day-one SAST.

## Security gate table (§28)

| Finding ID | Tool | Severity | Description | Status | Resolution |
|---|---|---|---|---|---|
| SEC-P02-001 | Airlock-RLS | — | First RLS audit before staging | **Unverified** | Tool installed; live DB pending — Phase 3 staging precondition |
| SEC-P02-002 | rlsgrid | — | First grid scan before staging | **Unverified** | Tool installed; toml/DB pending |
| SEC-P02-003 | Manual | INFO | Compat aliases keep unversioned routes | **ACCEPTED** | Remove Phase 5 |
| SEC-P01-002 | Bandit/design | MEDIUM | Service role in `tenant.py` | **ACCEPTED** | JWT swap blocked |

## Blocking rule

Any **new** Critical/High vs Phase 1 day-one baseline **BLOCKS** merge. Isolation leak → STOP.
