# Phase 5 security gate (`security-gate-p05.md`)

Seeded from constitution §28.1–28.6 / SECURITY.md Phase 5. **Do not edit** constitution AC tables.
Base SHA: `73933d1` (`PREV_P04_SHA`). DEV2: `phase/05-dev-2-superadmin-billing`.
Date: 2026-09-20.

## Cloudflare

- **Guidance (start):** companions `WEB-PROTOCOL-AND-AUTH`, `DATA-ISOLATION-AND-LIFECYCLE` — guidance only.
- **Full audit (end):** `quick` → `C:\Users\Admin\security-audit-skill\akara\p05-run-1\` (pending integration tip).

## Ops deferred

`REQUIRE_SUDO_TOTP` staging, `QUERY_READONLY_DB_URL`, apply 033–038, Swazz/ZAP, live rlsgrid → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md). Do not invent green.

## Notes

- Constitution prose `superadmin_audit_log` → live table **`audit_log`** (Changed).
- JWT/RLS programme swap remains **Partial** (SEC-P01-002). Impersonation JWT + TOTP are Phase 5 DEV1 — not the customer-route swap.

## Tool run matrix (start)

| Tool | Artefact | Status |
|---|---|---|
| Bandit | `security-scan-p05-bandit.txt` | pending start |
| pip-audit | `security-scan-p05-pip-audit.txt` | pending |
| Semgrep | `security-scan-p05-semgrep.json` | pending |
| KeyHog | `security-scan-p05-keyhog.txt` | TOOL_NOT_INSTALLED if missing |
| Betterleaks | scoped | pending |
| Trivy fs | `security-scan-p05-trivy.txt` | pending |
| Live QUERY_READONLY / REQUIRE_SUDO_TOTP | — | **Unverified** / deferred |
| Swazz/ZAP / rlsgrid | — | **Unverified** / deferred |

## Security gate table (§28)

| Condition | Status |
|---|---|
| 28.1 TOTP encrypted / lockout / sudo TTL / role boundaries / impersonation JWT | Pending DEV1 after merge |
| 28.2 Query dual-barrier / 1000 / 30s / PII | Pending DEV1; live URL deferred |
| 28.3 Invoice unique / webhooks / dunning / GSTIN | Pending DEV1 |
| 28.4 Audit append-only (`audit_log`) | Pending DEV1 |
| 28.5 Tenant banner / end session / empty when inactive | Pending DEV2 UI |
| 28.6 Dangerous dialogs / reason / CSP / TOTP autocomplete | Pending DEV2 |
| JWT/RLS programme swap | **Partial** — do not invent |

## Blocking rule

New Crit/High vs Phase 5 start → STOP. Isolation leak → STOP.
