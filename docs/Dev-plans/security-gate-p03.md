# Phase 3 security gate (`security-gate-p03.md`)

Seeded from constitution §28 / SECURITY.md Phase 3. **Do not edit** constitution AC tables.
Base SHA: `d79479c` (`P03_PHASE2_BASE_SHA`). DEV2 branch: `phase/03-dev-2-environments-cicd`.
Date: 2026-09-19.

## Cloudflare

- **Guidance (start):** companions `CLOUD-AND-DEPLOYMENT`, `SUPPLY-CHAIN-AND-RELEASE` loaded (guidance only). Trust boundaries for this phase: hermetic env secrets (E-01…E-04), deploy promotion (staging←main / prod←tag), `deployment_events` service-role only, no prod data in lower envs. No six-phase run; no `findings.json` at start.
- **Full audit (end):** `quick` → `C:\Users\Admin\security-audit-skill\akara\p03-run-1\` (pending end-of-phase on integration tip).

## Phase 2 Airlock / rlsgrid precondition

| Artefact | Status |
|---|---|
| `docs/Phases/security-scan-p02-airlock.txt` / `p03-airlock.txt` | **Unverified** — tool installed; no DB URL |
| `docs/Phases/security-scan-p02-rlsgrid.txt` / `p03-rlsgrid.txt` | **Unverified** — tool installed; no toml/DB |

**Staging green precondition:** when a disposable Postgres / staging DB URL is available, run live `airlock` + `rlsgrid` and replace Unverified artefacts **before** claiming staging DoD / §28 rlsgrid Complete. Until then keep Unverified; do not probe production.

## Tool run matrix (start)

| Tool | Artefact | Status |
|---|---|---|
| Bandit start | `security-scan-p03-bandit.txt` | Complete — **0 High** (skip B104,B608) |
| pip-audit start | `security-scan-p03-pip-audit.txt` | Complete — clean |
| Safety | `security-scan-p03-safety.txt` | TOOL_NOT_INSTALLED locally; CI Safety is DEV1 |
| Semgrep start | `security-scan-p03-semgrep.json` | Complete — **0 findings** |
| KeyHog | `security-scan-p03-keyhog.txt` | **Unverified** — TOOL_NOT_INSTALLED (deferred) |
| Betterleaks | `security-scan-p03-betterleaks.*` | Complete — scoped; same class of noise as P02 |
| Trivy fs | `security-scan-p03-trivy.txt` | Complete — lockfile HIGH (no CRITICAL); same class as P02 |
| Gitleaks | `security-scan-p03-gitleaks.txt` | TOOL_NOT_INSTALLED locally; CI L4 = DEV1 |
| Hadolint | `security-scan-p03-hadolint.txt` | TOOL_NOT_INSTALLED locally; CI = DEV1 |
| Airlock-RLS | `security-scan-p03-airlock.txt` | **Unverified** |
| rlsgrid | `security-scan-p03-rlsgrid.txt` | **Unverified** |

**Start verdict:** 0 new Bandit/Semgrep Critical/High vs Phase 2. Trivy lockfile HIGH pre-existing class — not treated as new Crit/High SAST baseline stop.

## Security gate table (§28)

| Condition | Verification | Status |
|---|---|---|
| L1 Bandit 0 high | `security-scan-p03-bandit.txt` | **Complete** (start) |
| L2 Safety 0 CVE | pip-audit clean; Safety CI pending | **Partial** — pip-audit OK; Safety CLI missing locally |
| L3 Semgrep 0 p/fastapi critical | `security-scan-p03-semgrep.json` | **Complete** (start) |
| L4 Gitleaks 0 secrets | DEV1 CI after merge | **Pending** integration |
| L5 Swazz 0 critical on staging | JOINT after staging | **Unverified** — no staging |
| L7 Trivy 0 CRITICAL image | Image/CI after Dockerfile path | **Pending** — fs scan 0 CRITICAL |
| L7 Hadolint 0 DL3+ | CI / local | **Unverified** — TOOL_NOT_INSTALLED |
| rlsgrid Phase 3 tenant tables (not `deployment_events`) | Live DB | **Unverified** — no DB |
| Razorpay `rzp_live_*` only in production | Deploy + dashboard | **Unverified** — BLOCKED no access |
| Staging secrets not in dev/CI | GitHub env scopes | **Unverified** — BLOCKED no access |
| `git grep akara-production` → 0 | Manual | **Partial** — backend `.env.example` + isolation test defaults (DEV1) |
| Restore drill `event_type=restore_drill` | Staging insert | **Missing** — BLOCKED no staging DB |
| `security_gate` vs CHECK | Frozen CHECK omits `security_gate` | **Unverified/Partial** — do not widen; completion file / `deploy`+`metadata.gate` |

## Blocking rule

Any **new** Critical/High vs Phase 3 start baseline **BLOCKS** merge. Isolation leak or live secret → STOP.
