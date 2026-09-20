# Phase 4 security gate (`security-gate-p04.md`)

Seeded from constitution §28 / SECURITY.md Phase 4. **Do not edit** constitution AC tables.
Base SHA: `cdaded7` (`P04_PHASE3_BASE_SHA`). Integration: `phase/04-identity-tenancy-onboarding` @ `22219ae`.
DEV1: `b449b5f`. DEV2 tip merged: `ef6bb7a`. Date: 2026-09-20.

## Cloudflare

- **Guidance (start):** companions `WEB-PROTOCOL-AND-AUTH`, `DATA-ISOLATION-AND-LIFECYCLE` — done.
- **Full audit (end):** `quick` → `C:\Users\Admin\security-audit-skill\akara\p04-run-1\` — **0 confirmed** high/critical; 5 `needs_validation` (CF-P04-001..005: apply 030–032, exports bucket, Swazz `/team`/`/account`, ZAP `/invite`, live rlsgrid). No new confirmed vs p03.

## Ops deferred

Apply DB / exports bucket / Swazz / ZAP / live rlsgrid → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md). Do not invent green.

## Tool run matrix

| Tool | Artefact | Status |
|---|---|---|
| Bandit start/end | `security-scan-p04-bandit.txt` / `-end.txt` | Complete — **0 High** both |
| pip-audit start/end | `security-scan-p04-pip-audit.txt` / `-end.txt` | Complete — clean |
| Semgrep registry start/end | `security-scan-p04-semgrep.json` / `-end.json` | Complete — **0 findings** |
| Semgrep custom rule | `.semgrep/rules/no-unverified-member-access.yml`; `security-scan-p04-semgrep-custom-end.txt` | Complete — **exit 0**; 3 informational hits on post-verify `profiles` updates in `team.py` (DEV1-owned; tune separately) |
| KeyHog | `security-scan-p04-keyhog.txt` | **Unverified** — TOOL_NOT_INSTALLED |
| Betterleaks | `security-scan-p04-betterleaks.*` | Complete — scoped (start) |
| Trivy fs start/end | `security-scan-p04-trivy.txt` / `-end.txt` | Complete — 0 CRITICAL; lockfile HIGH pre-existing class |
| Airlock / rlsgrid live | `security-scan-p04-airlock.txt` / `-rlsgrid.txt` | **Unverified** — deferred |
| Swazz / ZAP staging | — | **Unverified** — deferred |

**End verdict:** 0 new Bandit/Semgrep Critical/High vs Phase 4 start. Cloudflare 0 confirmed.

## Security gate table (§28)

| Condition | Verification | Status |
|---|---|---|
| IDOR cross-tenant member 404 | DEV1 pytest (team/invite suite) | **Complete** — 35 related API tests passed on tip |
| Viewer cannot invite / change role | DEV1 pytest | **Complete** |
| Admin cannot delete workspace | DEV1 pytest | **Complete** |
| Invite replay / wrong email | DEV1 pytest | **Complete** |
| Concurrent session limit | DEV1 pytest | **Complete** |
| JWKS rotation retry | DEV1 pytest as available | **Partial** — covered where present in suite |
| DPDP export/wipe / verify_deletion | DEV1 pytest; live wipe deferred | **Partial** — code/tests; live DB deferred |
| Semgrep custom rule exit 0 | `semgrep --config .semgrep/rules/…` from repo root | **Complete** (exit 0) |
| consent_log on modal accept | DEV1 API + DEV2 `ConsentReacceptanceModal` | **Complete** (code) |
| rlsgrid 3 tables (030–032) | Live DB | **Unverified** — deferred |
| Swazz `/team/*` `/account/*`; ZAP `/invite/*` | Staging | **Unverified** — deferred |
| JWT/RLS swap | Source still `get_supabase_service_client` on customer routes | **Partial** — SEC-P01-002 Accepted; no surprise swap on DEV2 |

## Dual sign-off

§28 dual sign-off **not claimed** — live DAST / apply-migrations / rlsgrid deferred post–Phase 12. Coding gate satisfied for merge when operator asks.

## Blocking rule

Any **new** Critical/High vs Phase 4 start baseline **BLOCKS** merge. Isolation leak or live secret → STOP.
