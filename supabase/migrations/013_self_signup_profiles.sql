-- ============================================================
-- 013_self_signup_profiles.sql
-- Sprint Phase 2 — Day 3 hotfix: public self-signup flow
--
-- Self-serve signup (SignUpPage) creates auth.users WITHOUT tenant_id
-- in metadata. Tenant is provisioned later via POST /onboarding/setup.
--
-- Migration 003's handle_new_user() required tenant_id NOT NULL, which
-- caused Supabase signUp to fail with a generic database error.
-- ============================================================

-- 1. Allow profiles without a tenant until onboarding step 1 completes.
ALTER TABLE public.profiles
  ALTER COLUMN tenant_id DROP NOT NULL;

COMMENT ON COLUMN public.profiles.tenant_id IS
  'NULL for self-signup users until POST /onboarding/setup creates their tenant. '
  'Always set for invited team members (tenant_id passed in user_metadata).';

-- 2. Update trigger: create profile on signup even when tenant_id is absent.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_role      TEXT;
BEGIN
  v_tenant_id := NULL;
  IF NEW.raw_user_meta_data ? 'tenant_id'
     AND NULLIF(NEW.raw_user_meta_data->>'tenant_id', '') IS NOT NULL THEN
    v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
  END IF;

  -- Invited users keep metadata role; self-signup owners default to admin.
  v_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'role', ''),
    CASE WHEN v_tenant_id IS NULL THEN 'admin' ELSE 'user' END
  );

  INSERT INTO public.profiles (id, tenant_id, role, display_name)
  VALUES (
    NEW.id,
    v_tenant_id,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
