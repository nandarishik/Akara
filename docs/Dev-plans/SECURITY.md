# Akara security playbook — start of phase, end of phase, then update this file

**Canonical.** Every Cursor agent reads this file **before writing Phase N code** and **before claiming Phase N merge-ready**. After the phase lands, **update the Living log in this same file** with that phase’s new tools, artefacts, accepted findings, and leftover blockers. Do not invent scan results. Do not skip a missing tool.

Authority order: live code on the chosen SHA → this file (operational security) → the phase constitution §16/§21/§28 (immutable AC) → the DEV1/DEV2 manual → `Akara_futureplan.md` P-07.

Git topology is [`BRANCHING.md`](BRANCHING.md). Security does not change branch names. Cursor skills and rules are catalogued in [`HANDOVER.md`](HANDOVER.md) — detect uncatalogued tools, **ask first**, then add a row. Frontend craft and agent UI QA (Figma + Playwright MCP, localhost only, never production) are [`FRONTEND.md`](FRONTEND.md).

Repo root: `akara/`. Artefacts go in `docs/Phases/` and `docs/Dev-plans/` (manuals still say `docs/akara-phases/` / `docs/akara-dev-plans/`). Windows PowerShell: `;` not `&&`; `Tee-Object` not `tee`. Scanners are **CLI / CI / Docker**, not new runtime deps in `backend/pyproject.toml` unless that phase’s DEV plan explicitly allows a test extra.

---

## How Cursor uses this file

### At the beginning of Phase N

1. Read **Living log** (what is already true on current `main`).
2. Read **Layer catalog** so L1–L7 numbers are not mixed up.
3. Read **Phase N** in this file (start checklist + what this phase *adds*).
4. Read constitution §16/§21/§28 and the DEV2 (or DEV1) security WPs for Phase N.
5. Run the **start-of-phase scan set** for Phase N. Write artefacts. Seed `docs/Dev-plans/security-gate-pNN.md` from constitution §28 headers. Do **not** edit the constitution.
6. Cloudflare **guidance mode:** load [`.cursor/skills/security-audit/SKILL.md`](../../.cursor/skills/security-audit/SKILL.md) and this phase’s companions. Map trust boundaries for files this phase will touch. Do **not** run the six-phase full audit and do **not** write `findings.json` yet.
7. Only then implement product security owned by this workstream.

### At the end of Phase N

1. Re-run the **end-of-phase scan set**. Diff Critical/High against this phase’s start baseline (and against the previous phase’s gate file).
2. Fill `security-gate-pNN.md`. Every constitution §28 row is Complete / Partial / Missing / Accepted / Unverified / N/A.
3. Missing binary → non-empty artefact or gate row containing `TOOL_NOT_INSTALLED: <name>`. Never fake a pass.
4. New Critical/High vs start-of-phase baseline → **STOP**. Fix or document Accepted with a later-phase issue. Do not merge.
5. Isolation leak (Tenant A sees Tenant B) → **STOP**. Do not continue the phase.
6. Live secret in KeyHog/Gitleaks/Betterleaks → **STOP**, rotate, do not copy the secret into a new file.
7. Run Cloudflare **full audit** for this phase (profile and companions below). Confirmed **high/critical** that are new vs the previous gate → **STOP** (same rule as scanners). Copy IDs + one-line summaries into `security-gate-pNN.md`. Do not paste secrets or live-exploit steps into git.
8. **Update Living log** in this file (instructions at the bottom). That is part of Phase N, not optional docs.

### What this file is not

- Not a substitute for Bandit / KeyHog / Semgrep / pip-audit (or later Garak / ZAP / PyRIT).
- Not a substitute for Cloudflare `security-audit` (and Cloudflare is not a substitute for those scanners).
- Not permission to implement DEV1 exclusive security files on a DEV2 branch.
- Not permission to implement the JWT/RLS swap in Phase 1 (blocked; see Phase 1).
- Not permission to probe Railway, Vercel, production Supabase, or any live customer tenant.

---

## Cloudflare security-audit skill

Official source: [github.com/cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) (MIT). Installed at `.cursor/skills/security-audit/` (also user `~/.cursor/skills/security-audit/`). Cursor loads `SKILL.md` when the task is a security audit or review. **Read that SKILL.md before launching hunters.** This section only says *when* Akara runs it and *which companions* apply.

It is an **agent auditor** (recon → hunt → adversarial validate → `findings.json` → independent verify → report). It is **not** Bandit/Semgrep/KeyHog. Scanners stay mandatory. Cloudflare findings that fail independent verification stay `needs_validation` — never invent them as gate passes.

### Modes (from the skill — obey them)

| Mode | When in Akara | What you do |
|---|---|---|
| **Guidance** | Start of every phase; questions; triage of one bug | Load skill + relevant companions. No six-phase run. No output directory. |
| **Full audit** | End of every phase on `phase/NN-<slug>` after scanners; Phase 12 also `deep` | All six phases. Write reports **outside** the repo (default below). |

If the user only asked “is this file safe?”, stay in guidance mode.

### Execution safety (Akara-hard)

The skill forbids executing target code unless an OS sandbox has: no external network, allowlisted env, read-only target, writes only to assigned `scratch/`, CPU/memory/time limits. **This Windows workspace does not provide that sandbox.** Therefore:

- Source inspection and existing pytest/ruff **are** allowed (those are our tests, not target-controlled fuzzers spawned by the hunter).
- Do **not** run hunter-built exploit harnesses, browsers, or fixtures that talk to the network.
- Do **not** hit staging/production/OpenRouter/Razorpay live.
- Any candidate that needs runtime proof → `needs_validation` with the exact missing fact. Do not promote it to `confirmed` by guessing.
- Dummy tenants only. No real customer data.
- The audit **describes** the smallest source fix; it does **not** patch production files unless the operator asked for the fix after the report.

### Output location

Default: `C:\Users\Admin\security-audit-skill\akara\pNN-run-<N>\` (outside git).

In-repo only if the whole directory is gitignored: `akara/.security-audit/` (already in `.gitignore`). Never commit `findings.json` payloads that could contain secret-shaped strings.

Into git (gate file only): finding id, verdict (`confirmed` / `needs_validation` / `rejected`), severity if confirmed, file:line, one-line boundary failure. No exploit scripts.

### Profiles

| Profile | Akara use |
|---|---|
| `quick` | Phases 1–11 end-of-phase default. Scope = that phase’s exclusive paths + shared files this workstream touched. One hunter wave. |
| `standard` | If Phase N added auth, SQL, RLS, or LLM sinks and `quick` left large `needs_validation`. |
| `deep` | Phase 12 launch audit (whole repo except out-of-scope binaries). |

Scope Phase N to the DEV-plan exclusive paths. Record everything else `out_of_scope`, not `covered`.

### Companion files (Akara map)

Skip `MEMORY-SAFETY-AND-BINARY.md` (no native/kernel target). Skip `DESKTOP-MOBILE-AND-LOCAL-IPC.md` except Phase 7/12 `akara-connect`.

| Phase | Must load |
|---:|---|
| 1 | `DATA-ISOLATION-AND-LIFECYCLE.md`, `AI-AND-LLM.md`, `WEB-PROTOCOL-AND-AUTH.md`, `ATTACK-CLASSES.md` |
| 2 | `WEB-PROTOCOL-AND-AUTH.md`, `SUPPLY-CHAIN-AND-RELEASE.md` |
| 3 | `CLOUD-AND-DEPLOYMENT.md`, `SUPPLY-CHAIN-AND-RELEASE.md` |
| 4 | `WEB-PROTOCOL-AND-AUTH.md`, `DATA-ISOLATION-AND-LIFECYCLE.md` |
| 5 | `WEB-PROTOCOL-AND-AUTH.md`, `DATA-ISOLATION-AND-LIFECYCLE.md` |
| 6 | `DATA-ISOLATION-AND-LIFECYCLE.md`, `AI-AND-LLM.md` |
| 7 | `PROTOCOLS-RPC-AND-MESSAGING.md`, `CLOUD-AND-DEPLOYMENT.md`, `DESKTOP-MOBILE-AND-LOCAL-IPC.md` (agent), `DATA-ISOLATION-AND-LIFECYCLE.md` |
| 8 | `DATA-ISOLATION-AND-LIFECYCLE.md` |
| 9 | `AI-AND-LLM.md` (primary), `WEB-PROTOCOL-AND-AUTH.md` |
| 10 | `AI-AND-LLM.md`, `DATA-ISOLATION-AND-LIFECYCLE.md`, `RESOURCE-EXHAUSTION-AND-AVAILABILITY.md` |
| 11 | `AI-AND-LLM.md`, `DATA-ISOLATION-AND-LIFECYCLE.md` |
| 12 | All companions except memory-safety |

Akara-specific bars the skill already agrees with:

- Cross-tenant read/write is **high** (skill: “fully defeats an explicit security control”).
- Prompt injection **alone** is not a finding (`AI-AND-LLM.md`). Need a code-level boundary failure (SQL, other tenant, tool with extra authority).
- A missing second layer when Layer A already blocks is a hardening note, not a vuln (matches Phase 1 “SQLGuard gap” vs isolation tests).
- Service-role in `tenant.py` is **ACCEPTED** (SEC-P01-002) until JWT swap; do not re-open it as a new confirmed finding every phase unless the reachable impact changed.

### Gate interaction

1. Scanners first (start and end).
2. Cloudflare full audit on the integration tree.
3. New `confirmed` high/critical → same STOP as new Semgrep HIGH.
4. `needs_validation` → gate row Unverified + validation plan; not a merge blocker unless the constitution already required that check (e.g. Phase 1 isolation leak is still STOP from pytest, not from Cloudflare).
5. Update Living log with the run directory path.

Node.js is required only to run `validate-findings.cjs` / `validate-coverage-ledger.cjs` in the skill folder during full audit.

---

## Living log (update at every phase end)

| Field | Value |
|---|---|
| **Current phase in progress** | none — Phase 4 **code** ready on `phase/04-identity-tenancy-onboarding` @ `0626cee` (not yet on `main`); ops JOINT DoD deferred to `ops-deferred-after-p12.md`; next cut is Phase 5 from post-P4 `main` |
| **Last phase merged to `main`** | 3 — Environments/CI/CD (`852d315`; merge tip `0dc2067` = DEV2 then DEV1 `d922de8`) |
| **Security baseline SHA** | Phase 4 integration tip `0626cee` (DEV1 `b449b5f` + DEV2) |
| **Next gate file to create** | `docs/Dev-plans/security-gate-p05.md` (at Phase 5 start) |
| **Open programme blockers** | JWT/RLS swap not done (still Partial / SEC-P01-002). SQLGuard no `tenant_id` predicate. KeyHog still deferred on Windows. Airlock/rlsgrid live DB Unverified. Phase 3–4 dashboard/staging/DAST/apply ops deferred post–Phase 12 (`ops-deferred-after-p12.md`). |
| **Accepted findings still live** | SEC-P01-002 service role. SEC-P01-003/004 Bandit Medium. **SEC-P02-003** compat aliases (remove Phase 5). |

### Artefact index (append a row when a file is written)

| Phase | File | Status |
|---|---|---|
| 1 | `docs/Phases/security-scan-day1-bandit.txt` | written |
| 1 | `docs/Phases/security-scan-day1-pip-audit.txt` | written |
| 1 | `docs/Phases/security-scan-day1-keyhog.txt` | written (`TOOL_NOT_INSTALLED`) |
| 1 | `docs/Phases/security-scan-day1-semgrep.json` | written (0 registry findings) |
| 1 | `docs/Dev-plans/security-gate-p01.md` | written |
| 1 | Cloudflare audit run dir (`C:\Users\Admin\security-audit-skill\akara\p01-run-1\` / `p01-run-2`) | guidance + full quick (0 confirmed) |
| 1 | `docs/Dev-plans/session-handoff-p01-dev2.md` | written |
| 2 | `docs/Phases/security-scan-p02-*` | written (start + end + airlock/rlsgrid Unverified + disclosure) |
| 2 | `docs/Dev-plans/security-gate-p02.md` | written |
| 2 | Cloudflare (`C:\Users\Admin\security-audit-skill\akara\p02-run-1\`) | full quick — 0 confirmed |
| 2 | `docs/Dev-plans/session-handoff-p02-dev2.md` | written |
| 2 | `backend/.importlinter` + `docs/Phases/p02-import-violations.txt` | written |
| 2 | `docs/Phases/stripe-deletion-map.md` / `fmcg-to-cafe-domain.md` | written |
| 3 | `docs/Phases/security-scan-p03-*` | written (start + end Bandit/pip-audit/Semgrep; KeyHog/Safety/Hadolint/Gitleaks stubs; airlock/rlsgrid Unverified) |
| 3 | `docs/Dev-plans/security-gate-p03.md` | written |
| 3 | Cloudflare (`C:\Users\Admin\security-audit-skill\akara\p03-run-1\`) | full quick — 0 confirmed; 4 needs_validation |
| 3 | `docs/Dev-plans/session-handoff-p03-dev2.md` | written |
| 3 | CI jobs on tip | `security-static`, `security-dast`, `security-container`, `env-isolation-check`, `deploy-staging`, `deploy-production` (+ existing backend/frontend/e2e/migrations) |
| 3 | Restore drill | runbook `docs/operations/backup-restore.md`; live insert **failed/BLOCKED** (no staging DB) |
| 3 | Landed on `main` | `852d315` (2026-09-20) — code land; ops Partial → `ops-deferred-after-p12.md` |
| 4 | `docs/Phases/security-scan-p04-*` | written (start + end Bandit/pip-audit/Semgrep/Trivy; custom Semgrep; KeyHog stub; airlock/rlsgrid Unverified) |
| 4 | `docs/Dev-plans/security-gate-p04.md` | written |
| 4 | Cloudflare (`C:\Users\Admin\security-audit-skill\akara\p04-run-1\`) | full quick — 0 confirmed; 5 needs_validation |
| 4 | `docs/Dev-plans/session-handoff-p04-dev2.md` | written |
| 4 | Custom Semgrep | `.semgrep/rules/no-unverified-member-access.yml` (DEV1); exit 0 on tip |
| 4 | JWT/RLS | **Partial** — service role remains (SEC-P01-002); no swap on DEV2 |
| 4 | Ops deferred | apply 030–032, exports bucket, Swazz/ZAP, live rlsgrid → `ops-deferred-after-p12.md` |
| 4 | Integration tip | `0626cee` (DEV1 `b449b5f` then DEV2 + end docs); **not on `main` until operator asks** |

---

## Layer catalog (two numbering schemes — do not mix)

Phase 1 constitutions number **secrets → SAST → deps → RLS** as L1–L4. Phase 3+ and the futureplan often number **SAST → CVE → Semgrep → secrets → DAST → LLM → container/RLS** as L1–L7. When a constitution and this file disagree on the letter, **the constitution’s gate table for that phase wins**. This catalog is the programme map.

| Programme layer | Meaning | Tools (introduced) | First required |
|---|---|---|---|
| **Secrets (P1-L1 / P3-L4)** | Credentials in git or staged files | Betterleaks (pre-commit), KeyHog staged + history; Gitleaks in CI from Phase 3 | Phase 1 day-one (KeyHog history); Phase 3 CI (Gitleaks) |
| **SAST (P1-L2 / P3-L1)** | Python/API unsafety | Bandit, Semgrep (`p/python`, `p/fastapi`, `p/sql-injection`), Skylos, OpenTaint | Phase 1 (four required artefacts: Bandit + Semgrep; Skylos/OpenTaint Unverified if missing) |
| **Dependencies (P1-L3 / P3-L2)** | CVE in Python/JS/images (fs) | pip-audit; Safety in Phase 3 CI (live code prefers pip-audit — record both); npm audit Phase 12 | Phase 1 pip-audit; Phase 3 Safety in CI |
| **RLS / tenancy (P1-L4 / P3-L7)** | Cross-tenant reads | tenant-guard, rlsautotest, Airlock-RLS, rlsgrid | tenant-guard after Phase 1 isolation tests; Airlock + rlsgrid first **run** Phase 2 (before staging); rlsgrid in CI Phase 3+ |
| **DAST (P3-L5)** | Live API attack surface | Swazz fuzz, OWASP ZAP, APISecurityEngine (weekly report), Chaos Kitten (weekly report) | Phase 3 staging; Phase 4 path-scoped Swazz/ZAP; Phase 12 ZAP full active (blocking Critical) |
| **Container / image (P3-L7)** | Docker/OS CVEs | Trivy fs (Phase 1), Trivy+Grype image (Phase 3), Hadolint | Phase 1 `trivy fs .` if installed; Phase 3 image+Hadolint gates |
| **LLM (P9-L6)** | Prompt injection, jailbreak, SQL-from-LLM | Garak, Promptfoo (≥75%), sqlglot guard (Phase 9), PyRIT (Phase 12), DeepTeam (Phase 11–12) | Phase 9 Garak+Promptfoo; Phase 11 DeepTeam scenarios; Phase 12 PyRIT+DeepTeam blocking |
| **Agent audit** | Boundary hunting with independent verification | Cloudflare `security-audit` skill (guidance at start, full audit at end) | Every phase; does not replace scanners |

**Phase 1 required four scanners (must produce a file or `TOOL_NOT_INSTALLED`):** Bandit, pip-audit, KeyHog, Semgrep. CLI install, not `pyproject.toml`.

---

## Universal start / end commands

Copy into the phase gate file. From `akara/` (PowerShell):

```powershell
# Secrets
keyhog scan --git-history . 2>&1 | Tee-Object docs/Phases/security-scan-pNN-keyhog.txt
keyhog scan --git-staged .
betterleaks

# SAST
bandit -r backend/ -ll 2>&1 | Tee-Object docs/Phases/security-scan-pNN-bandit.txt
semgrep --config p/python --config p/fastapi --config p/sql-injection backend/ --json | Tee-Object docs/Phases/security-scan-pNN-semgrep.json
skylos scan backend/
opentaint analyze backend/

# Dependencies / fs
pip-audit 2>&1 | Tee-Object docs/Phases/security-scan-pNN-pip-audit.txt
trivy fs . 2>&1 | Tee-Object docs/Phases/security-scan-pNN-trivy.txt
```

Phase 1 filenames stay `security-scan-day1-*` as in the constitution. From Phase 2 use `security-scan-pNN-*`.

Compare Semgrep HIGH/CRITICAL counts to the previous gate. `sql_tool.py` finding count must not increase vs Phase 1 day-one after Option D (P01-R052).

---

## Phase 1 — Truth Baseline (adds L1–L4 catalog; no CI yet)

**Adds:** day-one scan artefacts; stream `run_all_guardrails`; SQLTool isolation tests; SQL bind Option D (DEV1); runbook honesty warning. **Does not add:** JWT/RLS swap, SQLGuard `tenant_id` edit, migrations, frontend, pyproject scanner deps, staging.

### Start

- [ ] Confirm HEAD is current `origin/main` (`caac39f` until Phase 1 lands) per `BRANCHING.md`.
- [ ] Install CLI: `uv tool install bandit`; `uv tool install pip-audit`; `uv tool install semgrep`; `pip install keyhog` (or `uv tool install keyhog`).
- [ ] Run day-one four: KeyHog `--git-history`, Bandit, pip-audit, Semgrep JSON → `docs/Phases/security-scan-day1-*`.
- [ ] Run Betterleaks / Skylos / OpenTaint / Trivy / tenant-guard if present, else Unverified.
- [ ] `rlsautotest`, `airlock-rls`, `rlsgrid` = **N/A Phase 1** (no migrations, no staging).
- [ ] CREATE `docs/Dev-plans/security-gate-p01.md` with §28 headers. Seed:
  - **SEC-P01-001** Semgrep HIGH `sql_tool.py` concat — expected on main until DEV1 Option D merges; then re-check; must not worsen.
  - **SEC-P01-002** Bandit MEDIUM `tenant.py` service role — **ACCEPTED** (intentional; JWT swap blocked).
- [ ] Product security this workstream: stream guardrails, isolation tests, runbook warning. Do not swap JWT. Do not edit `guard.py` / `tenant.py` / `copilot.py`.
- [ ] Cloudflare **guidance mode**: read `.cursor/skills/security-audit/SKILL.md` plus `DATA-ISOLATION-AND-LIFECYCLE.md` and `AI-AND-LLM.md`. Map stream vs non-stream and tenant SQL boundaries. No full audit yet.

### End

- [ ] Isolation class `TestSQLToolTenantIsolation` green without tokens. Leak → STOP.
- [ ] Stream yields `⚠️ Note:` on failed guardrails. Guardrail >100ms on 500-token fixture → STOP (then log-only; record Changed).
- [ ] Per-PR scan set vs day-one: **0 new Critical/High**.
- [ ] Gate file filled. Handoff records Bug 6 Partial (tests yes, JWT swap no) and SQLGuard gap as Phase 2 candidate.
- [ ] Cloudflare **full audit** `quick` scoped to Phase 1 DEV2 paths + `agent.py` `answer_stream`. Output under `C:\Users\Admin\security-audit-skill\akara\p01-run-1\`. New confirmed high/critical → STOP. Summaries only in the gate file.
- [ ] Update Living log: Phase 1 artefacts, accepted SEC-P01-002, leftover JWT/RLS + SQLGuard, Cloudflare run path.

---

## Phase 2 — Modular Foundation (first Airlock-RLS + rlsgrid; error-envelope disclosure)

**Adds:** Airlock-RLS + rlsgrid **first run** (new RLS baseline for Phase 3); pip-audit of new `import-linter`; error responses must not leak stack traces / SQL / paths.

### Start

- [ ] Phase 1 gate + `security-scan-day1-*` exist on the SHA you cut from.
- [ ] Re-run universal scan set as `security-scan-p02-*`. Compare to Phase 1. New Crit/High → STOP.
- [ ] CREATE `docs/Dev-plans/security-gate-p02.md`. Seed SEC-P02-001 Airlock, SEC-P02-002 rlsgrid, SEC-P02-003 compat aliases **ACCEPTED** (Phase 5 removal).

### End

- [ ] `curl` invalid token on `/v1/copilot/chat` → `{"ok":false,"code":"UNAUTHENTICATED",...}` with **no** traceback.
- [ ] `airlock-rls check` and `rlsgrid scan` outputs exist (or `TOOL_NOT_INSTALLED`). These results **become the Phase 3 RLS baseline**.
- [ ] `pip-audit` clean for `import-linter`.
- [ ] Update Living log with Airlock/rlsgrid paths and SEC-P02-003 accepted.

---

## Phase 3 — Environments, CI/CD (security becomes every-PR CI; L5 DAST + image)

**Adds:** GitHub Actions `security-static` (Bandit, Safety, Semgrep, Gitleaks); Swazz on `api/` changes; Trivy+Grype on Dockerfile; Hadolint; rlsgrid on migrations; secret **isolation** across GitHub/Railway/Supabase envs; restore drill. Weekly report-only: APISecurityEngine, Chaos Kitten.

**Label note:** constitution §21 calls Bandit L1 and Gitleaks L4. Keep those names in `security-gate-p03.md`.

Status (2026-09-20): **Code landed on `main` @ `873d19a` / tip includes `852d315`.** Integration order: DEV2 first, then DEV1 `d922de8` (`0dc2067`). Repo + CI YAML + scanners done. Dashboard/staging JOINT rows → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md).

### Start

- [x] Phase 2 Airlock/rlsgrid baseline exists (Unverified placeholders).
- [ ] Confirm no production Supabase URL in source: `git grep akara-production` → 0. (**Partial** — test/.env.example defaults)
- [x] Seed gate from constitution §28 table (Bandit 0 high, Safety 0 CVE, Semgrep 0 p/fastapi critical, Gitleaks 0, Swazz 0 critical on staging, Trivy 0 CRITICAL image, Hadolint 0 DL3, rlsgrid Phase 3 tables, Razorpay `rzp_live_*` only in production, staging secrets not in dev/CI, restore drill).

### End

- [x] Every §28 row checked (many Partial/Unverified/Missing — see gate file). `security_gate` event_type vs CHECK mismatch recorded; do not widen CHECK.
- [x] Workers still use service role — sequential in combined process; do not add concurrent shared-state workers (DEV1 combined cron workers).
- [x] Update Living log: CI job names, restore-drill evidence (BLOCKED), Airlock/rlsgrid Unverified, Cloudflare p03-run-1.

---

## Phase 4 — Identity, tenancy, onboarding (IDOR, sessions, DPDP, custom Semgrep)

**Adds:** `get_team_member_verified` 404-not-403; role/self/owner guards; session revoke + `revoked_at` 401; HMAC invite tokens; DPDP export/delete scoped to `tenant_id`; custom Semgrep `.semgrep/rules/no-unverified-member-access.yml`; Swazz on `/team/*` `/account/*`; ZAP on `/invite/*`; RLS on new tables. **DEV1 creates the Semgrep rule file only — do not invent a new GHA workflow** unless Phase 3 already loads `.semgrep/rules/`.

**Still blocked unless this phase’s DEV1 SHA actually ships it:** futureplan JWT/RLS swap (ADR-006 listed Phase 4). If `5ce6c10`-style service role remains after merge, record Partial — do not implement a surprise swap on DEV2.

### Start

- [x] Re-run universal scans `security-scan-p04-*`.
- [x] Seed `security-gate-p04.md` from constitution §28 (IDOR pytest, privilege tests, invite replay/wrong-email, session limit, JWKS retry, DPDP export/wipe, `verify_deletion` Sentry, Semgrep custom rule exit 0, consent_log, rlsgrid 3 new tables, Swazz/ZAP staging).

### End

- [x] `semgrep --config .semgrep/rules/ backend/app/api/` exits 0.
- [x] Privilege/IDOR/DPDP API tests on tip (35 passed subset); live DPDP/Swazz/rlsgrid deferred.
- [x] Update Living log: Semgrep rule path, JWT/RLS remains Partial; Cloudflare p04-run-1.

---

## Phase 5 — Superadmin, billing (TOTP, sudo, query console, impersonation, GST)

**Adds:** sudo TOTP (encrypted AES-256-GCM, 5/15min lockout); sudo TTL server-side; 10 dangerous ops require sudo; impersonation **separate** 30-min JWT (cannot hit superadmin routes); query console on `QUERY_READONLY_DB_URL` (not service role) + SQLGuard + PG role dual barrier, 1000-row / 30s timeout, PII mask, audit every query; append-only `superadmin_audit_log`; webhook completeness; GSTIN checksum; CSP `frame-ancestors: 'none'` on `/superadmin/*`.

### Start

- [ ] `REQUIRE_SUDO_TOTP` plan for staging. Never commit TOTP secrets.
- [ ] Seed `security-gate-p05.md` from §28.1–28.6 checkboxes.

### End

- [ ] Dual-barrier write attempt on query console fails.
- [ ] Impersonation cannot access superadmin or other tenants.
- [ ] Audit log has no DELETE/UPDATE path for tenants.
- [ ] Update Living log: sudo/TOTP, readonly DB URL pattern (no secrets), remaining billing webhook gaps.

---

## Phase 6 — Canonical café data (upload, PII-to-LLM, quarantine)

**Adds:** RLS on `canonical_orders` / items / `import_quarantine`; worker cannot claim another tenant’s job; upload path `{tenant_id}/{import_id}/`; extension+content validation; PII redactor **before** mapping LLM; sanitised column names in prompts; no SQL from import values; undo tenant-scoped.

**DEV1 SHA:** do **not** merge stacked `74aa8eb`. Split Phase 6 first (`BRANCHING.md`).

### Start

- [ ] Seed `security-gate-p06.md` from §28.1–28.6.
- [ ] Confirm PII redactor tests will exist (`test_pii_not_sent_to_llm.py`).

### End

- [ ] Filename traversal rejected. Non-CSV/XLSX rejected. LLM never sees raw email/phone/GSTIN.
- [ ] Validation engine executes **no** SQL from raw cells.
- [ ] Update Living log: new tables with RLS, PII-redactor artefact.

---

## Phase 7 — Connectors (credential encryption, network allowlist, signed agent)

**Adds (HIGH):** AES-256-GCM connector creds; never in LLM prompts; `allowed_domains`; `_safe_log` redaction; signed akara-connect updates; agent outbound-only; HMAC `POST /connectors/tally/push` + 5-min replay window; sync rate limits. Run Cursor `security-review` on `domain/connectors/` (HIGH must die).

### Start

- [ ] Seed `security-gate-p07.md` S1–S8.
- [ ] No connector secrets in fixtures. Master key only in Railway/Vault.

### End

- [ ] Grep prompts/logs for credential patterns → 0.
- [ ] HMAC push rejects stale timestamps.
- [ ] Update Living log: encryption at rest, allowlist, HMAC header name.

---

## Phase 8 — Semantic metrics (tenant KPI isolation, Cube.js)

**Adds:** every metric query `tenant_id`; RLS on `expenses`; append-only `metric_versions`; evidence layer server-derived; Cube.js not public, `SECURITY_CONTEXT` tenant, `CUBEJS_DEV_MODE=false` in prod; KPI access audit log. Cursor `security-review` on `domain/kpi/`.

### Start / end

- [ ] Two-tenant API test: A cannot see B revenue.
- [ ] If Cube.js not adopted, mark S4 N/A with reason — do not invent a Cube deployment.
- [ ] Update Living log: KPI tenant filter proof, Cube.js yes/no.

---

## Phase 9 — Copilot LLM platform (introduces L6)

**Adds:** Garak probes (`promptinject`, `dan`, `encoding`, `leakreplay`, `latentinjection`, `xss`) on copilot/llm/prompts paths; Promptfoo ≥75% golden; **sqlglot** SQL guard (50-case unit + stream and non-stream); user text never interpolated into system prompt; max 2,000 char user message; Langfuse traces = UUID `tenant_id` only + email masking; LiteLLM cache key **must** include `tenant_id`; no credentials in prompts (cross-check Phase 7). Cursor `security-review` still on `domain/copilot/` + `infra/llm/` alongside Garak.

Garak `promptinject`/`dan` VULNERABLE or `leakreplay` HIGH → merge blocked.

### Start / end

- [ ] Seed `security-gate-p09.md` L6 + S1–S5.
- [ ] Guard on **both** stream and non-stream (Phase 1 stream warning is not a substitute for sqlglot).
- [ ] Update Living log: Garak report path, Promptfoo %, sqlglot on/off, Langfuse PII policy.

---

## Phase 10 — Intelligence signals (forecast/alert RLS, weather SQL, prompt-as-data)

**Adds:** RLS `forecasts` + `alert_anomalies` (live helper `get_my_tenant_id()` / `profiles`, **not** `user_profiles`); Open-Meteo values parameterised (JSONB stored, never interpolated); worker routes require `X-Service-Key`; morning-brief item names framed as **data not instructions**; no secrets in worker logs.

### Start / end

- [ ] Seed `security-gate-p10.md` S-P10-001–005.
- [ ] Malicious `item_name` injection test for morning brief.
- [ ] Update Living log: new RLS tables, service-key routes.

---

## Phase 11 — Decision engine (recommendations as financial advice)

**Adds:** RLS + API 404 on cross-tenant accept; DeepTeam / pytest-native injection via POS `item_name`; GST disclaimer “Consult your CA”; Pydantic `extra='forbid'` on LLM JSON (reject `auto_apply` / `execute_sql`); cap `expected_impact_max` (₹5 lakh/month Phase 11).

### Start / end

- [ ] Seed `security-gate-p11.md` S-P11-001–005.
- [ ] Cross-tenant accept → 404. Injection → normal rec or filtered. Extra fields → not stored.
- [ ] Update Living log: DeepTeam/pytest security file path, impact cap constant.

---

## Phase 12 — Production hardening (all layers, blocking launch)

**Adds / re-runs at maximum:** S-P12-001 every `tenant_id` table `rowsecurity=true`; S-P12-002 KeyHog full history 0 findings (or rotate+rescan); S-P12-003 ZAP 0 Critical; S-P12-004 PyRIT 5 categories × 5 turns all BLOCKED; S-P12-005 DeepTeam cross-tenant decision engine; S-P12-006 frontend bundle grep (`rzp_live`, service role, OpenRouter) — anon key + URL are OK; S-P12-007 Razorpay webhook unsigned → 400. Also pip-audit + npm audit 0 critical; Bandit 0 high; reports under `backend/tests/security/reports/`. Prefer CLI/Docker; test extra for bandit/pip-audit only if required.

Do **not** add Semgrep/Trivy/OpenAPI-CI/LiteLLM/connectors in Phase 12 unless they already exist from earlier phases (P12-R176).

### Start / end

- [ ] Seed `security-gate-p12.md` from S-P12-001–007 + constitution launch-gate security rows.
- [ ] Any rlsgrid leak: fix immediately; do not reopen LG-011 until clean.
- [ ] Cursor `security-review` last backend step before launch.
- [ ] Update Living log: launch blocked or cleared; report paths; remaining Accepted risks.

---

## Product-security backlog (not scanners)

Carry these until a phase actually closes them. Tick in Living log when done.

| ID | Item | Planned | Phase 1 rule |
|---|---|---|---|
| BUG-03 | Stream path `run_all_guardrails` + `⚠️ Note:` | 1 | DEV2 implements |
| BUG-05 | SQL bind Option D; full asyncpg later | 1 then 2 | DEV1 Phase 1; Semgrep must not worsen |
| BUG-06 tests | SQLTool isolation in CI | 1 | DEV2; leak = STOP |
| BUG-06 JWT/RLS | Anon key + JWT on customer routes | futureplan “Phase 1”; ADR-006 Phase 4 | **Neither workstream in Phase 1** |
| SQLGuard tenant_id | Predicate in `guard.py` | 2+ candidate | Do not edit in Phase 1 |
| Error envelope | No traceback in HTTP body | 2 | |
| CI scanners | Bandit/Safety/Semgrep/Gitleaks every PR | 3 | |
| IDOR / DPDP / sessions | Team/account/invite | 4 | |
| Sudo TOTP / impersonation / readonly SQL | Superadmin | 5 | |
| Upload + PII redactor | Café import | 6 | |
| Connector crypto / HMAC / allowlist | Connectors | 7 | |
| KPI tenant isolation | Dashboard | 8 | |
| sqlglot + Garak + Promptfoo + Langfuse PII | Copilot platform | 9 | |
| Forecast RLS + prompt-as-data | Intelligence | 10 | |
| Recs RLS + DeepTeam + extra=forbid | Decision engine | 11 | |
| Full launch re-audit | Hardening | 12 | |

---

## Stop conditions (any phase)

- Isolation test shows Tenant B rows for Tenant A.
- Secret scanner prints a live credential.
- New Critical/High vs **this phase’s start** baseline (and vs previous gate).
- Cloudflare full audit: new `confirmed` high/critical vs previous gate.
- Phase 9+ Garak VULNERABLE on `promptinject`/`dan`, or Promptfoo <75% when that gate is in force.
- Phase 12 KeyHog findings, ZAP Critical, PyRIT SUCCEEDED, rlsgrid leak, unsigned webhook 200.
- Inventing scan output, skipping `TOOL_NOT_INSTALLED`, or adding scanners to runtime `pyproject.toml` against the DEV plan.

---

## How to update this file at phase end (mandatory)

Edit **only** these parts of `SECURITY.md` after Phase N is tested on `phase/NN-<slug>`:

1. **Living log table** — set current phase to N+1 (or “12 complete”); set last merged SHA; refresh open blockers.
2. **Artefact index** — mark written files `written` and add new paths (`security-scan-pNN-*`, Garak, ZAP, PyRIT, …).
3. **That phase’s Start/End checkboxes** — leave the prose; add a one-line `Status (YYYY-MM-DD): Complete on <sha>` under the phase heading.
4. **Accepted findings** — append `SEC-PNN-###` with tool, severity, file, reason, expiry phase.
5. **Cloudflare run** — path to `pNN-run-*`, counts of confirmed / needs_validation / rejected, and whether validators passed.
6. Do **not** delete a previous phase’s requirements. Later phases re-run them.

Commit message: `docs: record Phase N security baseline in SECURITY.md`.

---

## Path mapping

| Manuals say | This repo |
|---|---|
| `docs/akara-phases/security-scan-*` | `docs/Phases/security-scan-*` |
| `docs/akara-dev-plans/security-gate-pNN.md` | `docs/Dev-plans/security-gate-pNN.md` |
| `docs/akara-phases/phase_NN_*.md` | `docs/Phases/phase_NN_*.md` |
