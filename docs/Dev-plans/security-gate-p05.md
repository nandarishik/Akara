# Phase 5 security gate (`security-gate-p05.md`)

Seeded from constitution §28.1–28.6 / SECURITY.md Phase 5. **Do not edit** constitution AC tables.
Base SHA: `73933d1` (`PREV_P04_SHA`). Integration: `phase/05-superadmin-billing` @ `a3990dd`.
DEV1: `3269d44`. DEV2 tip: `fc91701`. Date: 2026-09-20.

## Cloudflare

- **Guidance (start):** companions `WEB-PROTOCOL-AND-AUTH`, `DATA-ISOLATION-AND-LIFECYCLE` — done.
- **Full audit (end):** `quick` → `C:\Users\Admin\security-audit-skill\akara\p05-run-1\` — **0 confirmed** high/critical; 5 `needs_validation` (CF-P05-001..005). No new confirmed vs p04.

## Ops deferred

`REQUIRE_SUDO_TOTP` staging, `QUERY_READONLY_DB_URL`, apply 033–038, Swazz/ZAP, live rlsgrid → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md).

## Migration merge note

DEV1 alternate `030`/`031`/`032` filenames **removed** on integration; main Phase 4 `030_p04_roles_consent` / `031_p04_team_invites` / `032_p04_active_sessions` kept; P5 `033`–`038` taken from DEV1.

## Tool run matrix

| Tool | Artefact | Status |
|---|---|---|
| Bandit start/end | `security-scan-p05-bandit.txt` / `-end.txt` | Complete — **0 High** |
| pip-audit start/end | `security-scan-p05-pip-audit.txt` / `-end.txt` | Complete — clean |
| Semgrep start/end | `security-scan-p05-semgrep.json` / `-end.json` | Complete |
| KeyHog | `security-scan-p05-keyhog.txt` | **Unverified** — TOOL_NOT_INSTALLED |
| Betterleaks | `security-scan-p05-betterleaks.*` | **Partial** — CLI subcommand mismatch |
| Trivy fs | `security-scan-p05-trivy.txt` | Complete — lockfile HIGH pre-existing class |
| Live QUERY_READONLY / REQUIRE_SUDO_TOTP / Swazz | — | **Unverified** — deferred |

**End verdict:** 0 new Bandit Critical/High vs start. Cloudflare 0 confirmed.

## Security gate table (§28)

| Condition | Status |
|---|---|
| 28.1 TOTP / sudo / roles / impersonation JWT | **Complete** (code + `test_phase05_contracts` 6 passed); staging REQUIRE_SUDO_TOTP deferred |
| 28.2 Query dual-barrier / 1000 / 30s | **Partial** — code from DEV1; live URL deferred; UI copy Complete |
| 28.3 Invoice / webhooks / dunning / GSTIN | **Complete** (DEV1 code); live e2e deferred |
| 28.4 Audit append-only | **Complete** on live `audit_log` (Changed vs prose name) |
| 28.5 Tenant banner / end session | **Complete** (DEV2 UI) |
| 28.6 Dangerous dialogs / CSP / TOTP autocomplete | **Complete** (DEV2); nonce CSP Partial |
| JWT/RLS programme swap | **Partial** — SEC-P01-002 |

## Dual sign-off

§28 dual sign-off **not claimed** — live staging ops deferred. Coding gate ready when operator asks to PR.

## Blocking rule

New Crit/High vs Phase 5 start → STOP.
