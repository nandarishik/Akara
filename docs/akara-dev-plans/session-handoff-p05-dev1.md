# Phase 05 DEV1 session handoff

**Developer:** DEV1
**Branch:** `shrey-phase-implementations`
**Date:** 2026-09-18
**Phase 4 base SHA:** `b449b5f303add1822e29bed32a36b5e6e2e2e1d9`
**Live migration max at kickoff:** 028. This branch fills 029–032 (P3/P4 stop-ships) then P5 as 033–038.
**Status:** DEV1 superadmin/billing/entitlements APIs landed. Frontend (DEV2) not in this branch.

## Outcomes

- SuperadminRole + `require_role` + `SuperAdminCtx`; GET `/superadmin/sudo` includes `superadmin_role`
- TOTP setup/status + sudo `totp_code`; AES-GCM secrets; lockout 5/15min; `pyotp>=2.9.0`
- Impersonation TTL 30m JWT (`impersonated=true`); GET `/impersonate/active`; POST `/{session_id}/end`; GET `/account/impersonation-session`
- Query console: `QUERY_READONLY_DB_URL` only, 30s/1000 rows, 503 `QUERY_READONLY_UNCONFIGURED`
- Jobs API `/superadmin/jobs*`; `worker_run_log` / `worker_pause_config`; `run_with_log` / `is_paused`
- Feature-overrides PATCH; `resolve_limit` overrides then PLAN_LIMITS; catalog no longer preferred in `plan_guard.get_limit`
- Invoice unique `(tenant_id, billing_period_start)`; FY number `AKR-FYyyNN-NNNNN`; GSTIN checksum
- Dunning idempotency via `dunning_sent_log`

## Verification

- `pytest tests/ -q` → **500 passed, 23 skipped**

## Partial / Unverified

- TOTP QR is SVG text of otpauth URI (no extra QR library)
- GitHub/Railway secrets for `SUPERADMIN_TOTP_ENCRYPTION_KEY` not set from this machine
