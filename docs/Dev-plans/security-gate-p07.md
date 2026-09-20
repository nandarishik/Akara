# Phase 7 security gate (`security-gate-p07.md`)

Seeded from constitution §28 S1–S8 / SECURITY.md Phase 7. **Do not edit** constitution AC tables.
Base SHA: `2546a2f` (`PHASE6_SHA`).
DEV1: `phase/07-dev-1-connector-sync-platform` @ `e904e74` (path-split from `74aa8eb`; **never merge tip**).
Integration: `phase/07-connector-sync-platform` @ `71536ed`.
DEV2: `phase/07-dev-2-connector-sync-platform` @ `04ee3fd`. Date: 2026-09-20.

## Cloudflare

- **Guidance (start):** companions `WEB-PROTOCOL-AND-AUTH`, `DATA-ISOLATION-AND-LIFECYCLE`, `SUPPLY-CHAIN-AND-RELEASE` — done (`security-scan-p07-cloudflare-guidance.txt`).
- **Full audit (end):** `quick` → `C:\Users\Admin\security-audit-skill\akara\p07-run-1\` — **0 confirmed** high/critical; 5 `needs_validation` (CF-P07-001..005).

## Ops deferred

Apply 048–051, Vault/master key, Railway 5th service, partnership, Swazz/ZAP `/api/v1/connectors/*`, live rlsgrid, signed-update CA → [`ops-deferred-after-p12.md`](ops-deferred-after-p12.md).

## Tool run matrix

| Tool | Artefact | Status |
|---|---|---|
| Bandit start/end | `security-scan-p07-bandit.txt` / `-end.txt` | Complete — end **0 High** on connectors + agent |
| pip-audit start/end | `security-scan-p07-pip-audit.txt` / `-end.txt` | Complete — clean |
| Semgrep start/end | `security-scan-p07-semgrep.json` / `-end.json` | Complete — 0 findings |
| KeyHog | `security-scan-p07-keyhog.txt` / `-end.txt` | **Unverified** — TOOL_NOT_INSTALLED |
| Betterleaks | `security-scan-p07-betterleaks*` | **Partial** — TOOL_NOT_INSTALLED stub |
| Trivy fs | `security-scan-p07-trivy.txt` | Complete — lockfile HIGH pre-existing class |
| Live Vault / partnership / DAST / staging HMAC | — | **Unverified** — deferred |
| Cursor `security-review` on `domain/connectors/` | chat | Complete — 2 HIGH on ungated/unverified push **fixed** (HMAC+skew+gate); remaining MEDIUM = Partial CredentialService / key binding / update crypto dep |

**End verdict:** 0 new Bandit Critical/High vs start on Phase 7 surfaces. Cloudflare 0 confirmed.

## Security gate table (§28 S1–S8)

| Condition | Status |
|---|---|
| S1 Credential encryption AES-256-GCM + Vault master key | **Partial** — stub CredentialService; live Vault deferred; do not set `CONNECTORS_ENABLED=true` in prod until real crypto |
| S2 Credential isolation from LLM | **Partial** — no connector creds in prompts on tip; full grep test Unverified |
| S3 Network allowlist / ConnectorNetworkError | **Partial** — type present; full connector HTTP clients deferred |
| S4 No credentials in logs (`_safe_log`) | **Partial** — deferred with full sync path |
| S5 Signed akara-connect updates | **Partial** — updater HTTPS + verify code; CA/private key ops deferred; pin `cryptography` before shipping auto-update |
| S6 Agent outbound-only + localhost Tally XML | **Complete** (code) — live Windows firewall Unverified |
| S7 Rate limiting | **Partial** — slowapi on management + push; global concurrent budget deferred |
| S8 Tally push HMAC + 5-min skew | **Complete** (code) — verify + skew + gate; key→tenant binding + staging smoke deferred |
| JWT/RLS programme swap | **Partial** — SEC-P01-002 |

## Dual sign-off

§28 dual sign-off **not claimed** — live Vault/DAST/partnership deferred. Coding gate ready when operator asks to PR.

## Blocking rule

New Crit/High vs Phase 7 start → STOP. Isolation leak / live secret → STOP.
