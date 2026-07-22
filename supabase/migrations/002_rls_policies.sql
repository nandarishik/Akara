-- ============================================================
-- AKARA: Row Level Security Policies
-- Migration 002
-- Run AFTER migration 001
-- ============================================================

-- ============================================================
-- Helper: get tenant_id for the current authenticated user
-- SECURITY DEFINER runs as the function owner (postgres),
-- bypassing RLS on profiles so it can always resolve tenant_id.
-- STABLE = result is constant within a single query execution.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- ============================================================
-- Helper: is the current user an admin of their tenant?
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    );
$$;

-- ============================================================
-- tenants
-- Users can only see/update their own tenant.
-- No INSERT via client — tenants are created by platform admin only.
-- ============================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_select_own"        ON public.tenants;
DROP POLICY IF EXISTS "tenants_update_own_admin"  ON public.tenants;

CREATE POLICY "tenants_select_own"
    ON public.tenants FOR SELECT
    USING (id = public.get_my_tenant_id());

CREATE POLICY "tenants_update_own_admin"
    ON public.tenants FOR UPDATE
    USING (id = public.get_my_tenant_id() AND public.is_admin());

-- ============================================================
-- profiles
-- Users see their own profile.
-- Admins see all profiles within their tenant.
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"    ON public.profiles;

CREATE POLICY "profiles_select_own"
    ON public.profiles FOR SELECT
    USING (
        id = auth.uid()
        OR (tenant_id = public.get_my_tenant_id() AND public.is_admin())
    );

CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "profiles_insert_own"
    ON public.profiles FOR INSERT
    WITH CHECK (id = auth.uid());

-- ============================================================
-- sales_data
-- All users within a tenant can SELECT their tenant's data.
-- Only admins can INSERT or DELETE (data import is admin-only).
-- No UPDATE — imported data is immutable; re-import if needed.
-- ============================================================
ALTER TABLE public.sales_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_data_select"       ON public.sales_data;
DROP POLICY IF EXISTS "sales_data_insert_admin" ON public.sales_data;
DROP POLICY IF EXISTS "sales_data_delete_admin" ON public.sales_data;

CREATE POLICY "sales_data_select"
    ON public.sales_data FOR SELECT
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "sales_data_insert_admin"
    ON public.sales_data FOR INSERT
    WITH CHECK (tenant_id = public.get_my_tenant_id() AND public.is_admin());

CREATE POLICY "sales_data_delete_admin"
    ON public.sales_data FOR DELETE
    USING (tenant_id = public.get_my_tenant_id() AND public.is_admin());

-- ============================================================
-- context_cache
-- All authenticated users in the tenant can read/write context cache.
-- ============================================================
ALTER TABLE public.context_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "context_cache_tenant_isolation" ON public.context_cache;

CREATE POLICY "context_cache_tenant_isolation"
    ON public.context_cache FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ============================================================
-- chat_history
-- Users see their own chat history.
-- Admins see all chat history within their tenant.
-- Users can insert their own messages only.
-- ============================================================
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_history_select"     ON public.chat_history;
DROP POLICY IF EXISTS "chat_history_insert_own" ON public.chat_history;

CREATE POLICY "chat_history_select"
    ON public.chat_history FOR SELECT
    USING (
        user_id = auth.uid()
        OR (tenant_id = public.get_my_tenant_id() AND public.is_admin())
    );

CREATE POLICY "chat_history_insert_own"
    ON public.chat_history FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND tenant_id = public.get_my_tenant_id()
    );

-- ============================================================
-- audit_log
-- Admins can read their tenant's audit log.
-- Inserts are done server-side with service_role key only.
-- ============================================================
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_admin_select" ON public.audit_log;

CREATE POLICY "audit_log_admin_select"
    ON public.audit_log FOR SELECT
    USING (tenant_id = public.get_my_tenant_id() AND public.is_admin());

-- ============================================================
-- generated_reports
-- All users in the tenant can view reports.
-- Insert/delete done server-side with service_role key.
-- ============================================================
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "generated_reports_tenant_isolation" ON public.generated_reports;

CREATE POLICY "generated_reports_tenant_isolation"
    ON public.generated_reports FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());
