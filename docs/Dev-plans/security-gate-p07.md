# Phase 7 security gate (`security-gate-p07.md`)

Seeded from constitution §28 S1–S8 / SECURITY.md Phase 7. **Do not edit** constitution AC tables.
Base SHA: `2546a2f` (`PHASE6_SHA` / `origin/main` after Phase 6 land).
DEV1: `phase/07-dev-1-connector-sync-platform` (path-split from `74aa8eb`; **never merge tip**).
DEV2: `phase/07-dev-2-connector-sync-platform`. Date: 2026-09-20.

## Cloudflare

- **Guidance (start):** companions `WEB-PROTOCOL-AND-AUTH`, `DATA-ISOLATION-AND-LIFECYCLE`, `SUPPLY-CHAIN-AND-RELEASE` (agent updates) — in progress.
- **Full audit (end):** `quick` → `C:\Users\Admin\security-audit-skill\akara\p07-run-1\` — pending integration tip.

## Ops deferred

Apply 048–051, Vault/master key, Railway 5th service, partnership, Swazz/ZAP `/api/v1/connectors/*`, live rlsgrid, signed-update CA → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md).

## Tool run matrix

| Tool | Artefact | Status |
|---|---|---|
| Bandit start | `security-scan-p07-bandit.txt` | Complete — baseline recorded (pre-existing High class; compare end delta) |
| pip-audit start | `security-scan-p07-pip-audit.txt` | Complete — No known vulnerabilities found |
| Semgrep start | `security-scan-p07-semgrep.json` | Complete — 0 findings |
| KeyHog | `security-scan-p07-keyhog.txt` | **Unverified** — TOOL_NOT_INSTALLED |
| Betterleaks | `security-scan-p07-betterleaks.txt` | **Partial** — TOOL_NOT_INSTALLED stub |
| Trivy fs | `security-scan-p07-trivy.txt` | Complete / in progress — lockfile HIGH pre-existing class |
| Live Vault / partnership / DAST / HMAC staging | — | **Unverified** — deferred |
| Cursor `security-review` on `domain/connectors/` | — | Pending after DEV1 on integration tip |

## Security gate table (§28 S1–S8)

| Condition | Status |
|---|---|
| S1 Credential encryption AES-256-GCM + Vault master key | **Unverified / deferred** — code from DEV1; live Vault ops deferred |
| S2 Credential isolation from LLM | **Unverified** — grep/tests after DEV1 |
| S3 Network allowlist / ConnectorNetworkError | **Unverified** — DEV1 |
| S4 No credentials in logs (`_safe_log`) | **Unverified** — DEV1 |
| S5 Signed akara-connect updates | **Partial** — agent verify code on DEV2; CA/private key ops deferred |
| S6 Agent outbound-only + localhost Tally XML | **Partial** — DEV2 agent design; live Windows firewall Unverified |
| S7 Rate limiting | **Unverified** — DEV1 |
| S8 Tally push HMAC + 5-min skew | **Partial** — DEV2 `push_client` + tests; live staging deferred |
| JWT/RLS programme swap | **Partial** — SEC-P01-002 |

## Dual sign-off

§28 dual sign-off **not claimed** — live Vault/DAST/partnership deferred. Coding gate when integration tip green and operator asks to PR.

## Blocking rule

New Crit/High vs Phase 7 start → STOP. Isolation leak / live secret → STOP.
