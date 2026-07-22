# How to Apply Migrations

The Supabase CLI is not required. Apply each migration manually:

1. Go to [supabase.com](https://supabase.com) → your project → **SQL Editor**
2. Paste and run each file in order:
   - `001_initial_schema.sql` — creates all 7 tables + indexes
   - `002_rls_policies.sql` — enables RLS + creates all policies
   - `003_functions.sql` — creates trigger + database functions

Run them **one at a time**, in order. Each should complete with no errors.

## Verification queries (run after all 3 migrations)

```sql
-- 1. Verify all 7 tables exist with RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'tenants', 'profiles', 'sales_data',
    'context_cache', 'chat_history', 'audit_log', 'generated_reports'
  );
-- Expected: 7 rows, all with rowsecurity = true

-- 2. Verify all helper functions + trigger function exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_my_tenant_id', 'is_admin',
    'handle_new_user', 'set_updated_at',
    'get_kpi_summary', 'get_top_products', 'get_zone_breakdown'
  );
-- Expected: 7 rows

-- 3. Verify the auth trigger exists
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
-- Expected: 1 row

-- 4. Verify indexes
SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';
-- Expected: >= 18
```
