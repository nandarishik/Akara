# AKARA Migration Manifest — Phase 2

> **Last updated:** Sprint Phase 2, Day 3  
> **Location:** `supabase/migrations/`

## Applied migrations (001–010)

| # | File | Purpose |
|---|------|---------|
| 001 | `001_initial_schema.sql` | Core tables: tenants, profiles, sales_data |
| 002 | `002_rls_policies.sql` | RLS helpers: `get_my_tenant_id()`, `is_admin()` |
| 003 | `003_functions.sql` | Utility functions |
| 004 | `004_competitive_additions.sql` | secondary_sales_data, scheme_master |
| 005 | `005_execute_tenant_query.sql` | Tenant-scoped SQL RPC |
| 006 | `006_update_tenant_config_rpc.sql` | Tenant config update RPC |
| 007 | `007_conversations.sql` | Copilot conversation persistence |
| 008 | `008_user_preferences.sql` | User notification preferences |
| 009 | `009_scheme_leakage_fn.sql` | Scheme leakage detection |
| 010 | `010_import_tracking.sql` | `import_id` on sales/import tables |

## Phase 2 roadmap (011–025)

| # | File | Day | Purpose |
|---|------|-----|---------|
| 011 | `011_billing.sql` | **2** | Tenant billing fields; `import_jobs`; `import_job_id` on `sales_data`; `usage_tracking`; `llm_cost_log` (with `latency_ms`); `idempotency_keys`; `increment_usage` RPC; `get_current_usage` RPC; `tenant_lifetime_debriefs` view | **complete — ready to apply** |
| 012 | `012_onboarding.sql` | **3** | `profiles.has_completed_onboarding`; `marketing_emails`; `consent_log` | **complete — ready to apply** |
| 013+ | TBD | 4–22 | Stripe, superadmin, security, launch |

## Conventions

1. **Immutable numbering** — never renumber applied migrations; add forward-only corrections.
2. **Transaction boundaries** — wrap DDL in `BEGIN; ... COMMIT;` when safe.
3. **RLS** — every new tenant-scoped table must enable RLS before deploy.
4. **SECURITY DEFINER** — always `SET search_path = public`.
5. **Grants** — service_role for backend writes; authenticated users via RLS only.
6. **Audit fields** — prefer `created_at` / `updated_at` on new tables.
7. **Soft delete** — use `deleted_at` where specified in later days; not Day 1.

## Pre-migration checklist

- [ ] Backup staging database (Supabase Dashboard → Database → Backups)
- [ ] Record backup timestamp in operator log
- [ ] Apply on **staging** first
- [ ] Run RLS verification queries below
- [ ] Apply on production only after staging gate passes

## RLS verification (after 011)

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('usage_tracking', 'llm_cost_log', 'idempotency_keys');
-- Expected: 3 rows, all rowsecurity = true
```

## Pooler compatibility (GAP-7)

- Staging/production must set `SUPABASE_POOLER_URL` to transaction-mode pooler URI.
- Backend uses direct URL in development via `settings.effective_db_url`.
- Verify `/ready` returns `checks.supabase: ok` after pooler cutover.

## Tenant isolation test helpers

- Backend: use deterministic UUIDs in `tests/conftest.py` (tenant A ≠ tenant B).
- SQL: `tenant_id = public.get_my_tenant_id()` on all RLS policies.
- API: all routes resolve `TenantCtx` before querying data.

## Rollback policy

Migrations are **forward-only**. To undo a bad migration, create `NNN_fix_description.sql` — never edit applied files in place.
