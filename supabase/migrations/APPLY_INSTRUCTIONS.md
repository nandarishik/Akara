# How to Apply Migrations

The Supabase CLI is not required. Apply each migration manually:

1. Go to [supabase.com](https://supabase.com) → your project → **SQL Editor**
2. Paste and run each file in order:
   - `001_initial_schema.sql` — creates all 7 tables + indexes
   - `002_rls_policies.sql` — enables RLS + creates all policies
   - `003_functions.sql` — creates trigger + database functions
   - `004_competitive_additions.sql` — secondary sales, scheme master, outstanding columns
   - `005_execute_tenant_query.sql` — RLS-safe query executor RPC (required for copilot)
   - `006_update_tenant_config_rpc.sql` — tenant config merge-update RPC
   - `007_conversations.sql` — conversations table for chat history
   - `008_user_preferences.sql` — preferences JSONB column on profiles
   - `009_scheme_leakage_fn.sql` — scheme leakage analytics function

Run them **one at a time**, in order. Each should complete with no errors.

## Verification queries (run after all migrations)

```sql
-- 1. Verify all tables exist with RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Verify key functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_my_tenant_id', 'is_admin',
    'handle_new_user', 'set_updated_at',
    'get_kpi_summary', 'get_top_products', 'get_zone_breakdown',
    'execute_tenant_query', 'update_tenant_config', 'get_scheme_leakage'
  )
ORDER BY routine_name;

-- 3. Verify the auth trigger exists
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
-- Expected: 1 row
```
