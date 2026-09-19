# Phase 3 security gate (`security-gate-p03.md`)

Seeded from constitution §28 / SECURITY.md Phase 3. **Do not edit** constitution AC tables.
Base SHA: `d79479c` (`P03_PHASE2_BASE_SHA`). Integration: `phase/03-environments-cicd` @ `0dc2067`.
Date: 2026-09-19.

## Cloudflare

- **Guidance (start):** companions `CLOUD-AND-DEPLOYMENT`, `SUPPLY-CHAIN-AND-RELEASE` — done.
- **Full audit (end):** `quick` → `C:\Users\Admin\security-audit-skill\akara\p03-run-1\` — **0 confirmed** high/critical; 4 `needs_validation` (Airlock/rlsgrid, dashboards, restore drill, `akara-production` grep Partial).

## Phase 2 Airlock / rlsgrid precondition

| Artefact | Status |
|---|---|
| `security-scan-p02/p03-airlock.txt` | **Unverified** — no disposable DB |
| `security-scan-p02/p03-rlsgrid.txt` | **Unverified** — no toml/DB |

Live run remains **staging green precondition**. Do not invent green.

## Tool run matrix

| Tool | Artefact | Status |
|---|---|---|
| Bandit start/end | `security-scan-p03-bandit.txt` / `-end.txt` | Complete — **0 High** both |
| pip-audit start/end | `security-scan-p03-pip-audit.txt` / `-end.txt` | Complete — clean (incl. OTel/schedule after merge) |
| Safety | `security-scan-p03-safety.txt` + CI | Local TOOL_NOT_INSTALLED; DEV1 CI `security-static` owns Safety |
| Semgrep start/end | `security-scan-p03-semgrep.json` / `-end.json` | Complete — **0 findings** |
| KeyHog | `security-scan-p03-keyhog.txt` | **Unverified** — TOOL_NOT_INSTALLED |
| Betterleaks | `security-scan-p03-betterleaks.*` | Complete — scoped |
| Trivy fs | `security-scan-p03-trivy.txt` | Complete — 0 CRITICAL; lockfile HIGH pre-existing class |
| Gitleaks / Hadolint / Swazz / image Trivy | CI after surfaces exist | Pending live CI / staging |
| Airlock / rlsgrid | p03 carry | **Unverified** |

**End verdict:** 0 new Bandit/Semgrep Critical/High vs Phase 3 start. Cloudflare 0 confirmed.

## Security gate table (§28)

| Condition | Verification | Status |
|---|---|---|
| L1 Bandit 0 high | start/end artefacts | **Complete** |
| L2 Safety 0 CVE | pip-audit clean; Safety in CI | **Partial** — local Safety missing; pip-audit OK |
| L3 Semgrep 0 p/fastapi critical | start/end JSON | **Complete** |
| L4 Gitleaks 0 secrets | CI `security-static` | **Partial** — YAML present; not yet run on this tip in GHA |
| L5 Swazz 0 critical on staging | JOINT | **Unverified** — no staging |
| L7 Trivy 0 CRITICAL image | CI `security-container` | **Partial** — fs 0 CRITICAL; image path pending CI |
| L7 Hadolint 0 DL3+ | CI / local | **Unverified** — TOOL_NOT_INSTALLED locally; job in CI |
| rlsgrid Phase 3 tenant tables (not `deployment_events`) | Live DB | **Unverified** — no DB; `deployment_events` intentionally no tenant RLS |
| Razorpay `rzp_live_*` only in production | deploy-staging guard in `ci.yml` | **Partial** — guard in source; dashboard verify BLOCKED |
| Staging secrets not in dev/CI | Manual GitHub scopes | **Unverified** — BLOCKED no access |
| `git grep akara-production` → 0 | Manual | **Partial** — hits in `backend/.env.example` + isolation test defaults |
| Restore drill `event_type=restore_drill` | Staging insert | **Missing** — BLOCKED; runbook present |
| `security_gate` vs CHECK | Frozen CHECK omits `security_gate` | **Unverified/Partial** — do not widen; use completion note / `deploy`+`metadata.gate` |

## Dual sign-off

§28 dual sign-off **not claimed** — dashboard/staging surfaces BLOCKED; JOINT DoD incomplete. DEV2 repo + integration merge order verified.

## Blocking rule

Any **new** Critical/High vs Phase 3 start baseline **BLOCKS** merge. Isolation leak or live secret → STOP.
