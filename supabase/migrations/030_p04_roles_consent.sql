-- Phase 4 migration 030: owner role, consent_log ALTER, tenant/profile columns
-- Do NOT CREATE consent_log. Do NOT ADD display_name (already exists). Do NOT rename user→viewer.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'user', 'superadmin', 'owner'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_consent_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_terms_version TEXT;

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS pending_deletion_since TIMESTAMPTZ;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS max_seats INTEGER DEFAULT 5;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS onboarding_skipped BOOLEAN DEFAULT FALSE;

ALTER TABLE public.consent_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.consent_log ADD COLUMN IF NOT EXISTS consent_type TEXT;
ALTER TABLE public.consent_log ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.consent_log ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE public.consent_log ADD COLUMN IF NOT EXISTS privacy_version TEXT;
ALTER TABLE public.consent_log ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE public.consent_log ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE public.consent_log ADD COLUMN IF NOT EXISTS source TEXT;

CREATE INDEX IF NOT EXISTS idx_consent_log_tenant ON public.consent_log (tenant_id, accepted_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_log_user ON public.consent_log (user_id, accepted_at DESC);

-- Oldest admin per tenant → owner
WITH ranked AS (
  SELECT id, tenant_id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at ASC) AS rn
  FROM public.profiles
  WHERE role = 'admin'
)
UPDATE public.profiles SET role = 'owner'
WHERE id IN (SELECT id FROM ranked WHERE rn = 1);

ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_read_own_consent ON public.consent_log;
CREATE POLICY tenant_read_own_consent ON public.consent_log
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    OR user_id = auth.uid()
  );
