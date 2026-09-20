# Phase 4 security gate (`security-gate-p04.md`)

Seeded from constitution §28 / SECURITY.md Phase 4. **Do not edit** constitution AC tables.
Base SHA: `cdaded7` (`P04_PHASE3_BASE_SHA`). DEV2: `phase/04-dev-2-identity-tenancy-onboarding`.
Date: 2026-09-20.

## Cloudflare

- **Guidance (start):** companions `WEB-PROTOCOL-AND-AUTH`, `DATA-ISOLATION-AND-LIFECYCLE` — guidance only.
- **Full audit (end):** `quick` → `C:\Users\Admin\security-audit-skill\akara\p04-run-1\` (pending integration tip).

## Ops deferred

Apply DB / exports bucket / Swazz / ZAP / live rlsgrid → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md). Do not invent green.

## Tool run matrix (start)

| Tool | Artefact | Status |
|---|---|---|
| Bandit | `security-scan-p04-bandit.txt` | pending start |
| pip-audit | `security-scan-p04-pip-audit.txt` | pending |
| Semgrep | `security-scan-p04-semgrep.json` | pending |
| KeyHog | `security-scan-p04-keyhog.txt` | TOOL_NOT_INSTALLED if missing |
| Betterleaks | scoped | pending |
| Trivy fs | `security-scan-p04-trivy.txt` | pending |
| Airlock/rlsgrid | — | **Unverified** / deferred |

## Security gate table (§28)

| Condition | Status |
|---|---|
| IDOR cross-tenant member 404 | Pending DEV1 pytest after merge |
| Viewer cannot invite / change role | Pending DEV1 pytest |
| Admin cannot delete workspace | Pending DEV1 |
| Invite replay / wrong email | Pending DEV1 |
| Concurrent session limit | Pending DEV1 |
| JWKS rotation retry | Pending DEV1 |
| DPDP export/wipe / verify_deletion | Pending DEV1 / deferred live |
| Semgrep custom rule exit 0 | Pending after DEV1 merge |
| consent_log on modal accept | Pending DEV1 + DEV2 UI |
| rlsgrid 3 tables | **Unverified** — deferred |
| Swazz / ZAP staging | **Unverified** — deferred |
| JWT/RLS swap | **Partial** if still service role — do not invent |

## Blocking rule

New Crit/High vs Phase 4 start → STOP. Isolation leak → STOP.
