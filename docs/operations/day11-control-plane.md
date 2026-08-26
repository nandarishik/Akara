# Day 11 Control Plane Operations

The `/superadmin/control-plane` screen is the operator entry point for Data Studio,
the Query Console, typed runbooks, AI policy, and transactional templates.

## Query Console

Use the allowlisted schema help before writing a query. Queries must be one `SELECT`
statement and are capped at 10 seconds and 10,000 rows. Comments, DDL/DML, `COPY`,
protected schemas, network/filesystem functions, and session-security manipulation
are rejected before execution. The backend uses `QUERY_READONLY_DB_URL` when set.

During rollout, an unavailable dedicated connection falls back to the existing
`execute_tenant_query` RPC. Fallback use is written to `query_executions.fallback_used`
and logged with the SQL hash. Configure the dedicated role before production use.

## Runbooks

All runbooks require a reason, typed parameters, an operation ID, a dry run, and an
audit record. The following are intentionally non-reversible: provider subscription
reconciliation, session revocation, invoice regeneration, and expired export purge.
They require exact confirmation text in addition to sudo.

## Content rollout

Customer delivery resolves a published database template or prompt first. Missing,
invalid, suppressed, unpublished, or unavailable content falls back to the checked-in
template/prompt. WhatsApp templates remain blocked until provider approval is `approved`.
Test sends accept only approved sandbox recipients (`@akara.test`, `+1555...`, or the
internal `test:` form) and create a delivery event marked `is_test`.

## PII and audit

Data Studio masks PII in list/detail responses. A reveal needs a reason and valid sudo;
the selected columns and actor metadata are recorded in `audit_log`. Exports use the
same allowlist, filters, masks, and a 10,000-row cap.
