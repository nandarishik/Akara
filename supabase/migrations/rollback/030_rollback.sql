-- Rollback 030: drop NEW columns only. Forbidden: DROP TABLE consent_log.

UPDATE public.profiles SET role = 'admin' WHERE role = 'owner';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'user', 'superadmin'));

ALTER TABLE public.profiles DROP COLUMN IF EXISTS last_consent_at;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS consent_terms_version;

ALTER TABLE public.tenants DROP COLUMN IF EXISTS pending_deletion_since;
ALTER TABLE public.tenants DROP COLUMN IF EXISTS max_seats;
ALTER TABLE public.tenants DROP COLUMN IF EXISTS onboarding_skipped;

DROP INDEX IF EXISTS idx_consent_log_tenant;
DROP INDEX IF EXISTS idx_consent_log_user;
DROP POLICY IF EXISTS tenant_read_own_consent ON public.consent_log;

ALTER TABLE public.consent_log DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.consent_log DROP COLUMN IF EXISTS consent_type;
ALTER TABLE public.consent_log DROP COLUMN IF EXISTS accepted_at;
ALTER TABLE public.consent_log DROP COLUMN IF EXISTS terms_version;
ALTER TABLE public.consent_log DROP COLUMN IF EXISTS privacy_version;
ALTER TABLE public.consent_log DROP COLUMN IF EXISTS ip_address;
ALTER TABLE public.consent_log DROP COLUMN IF EXISTS user_agent;
ALTER TABLE public.consent_log DROP COLUMN IF EXISTS source;
