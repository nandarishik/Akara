-- Day 8: Superadmin secure foundation (17.1, 17.3, 17.4, GAP 11)

-- Superadmin role
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'user', 'superadmin'));

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin'
    );
END;
$$;

-- Tenant internal notes + optimistic locking
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS internal_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- cron_runs (17.3)
CREATE TABLE IF NOT EXISTS public.cron_runs (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_name   TEXT        NOT NULL,
    status      TEXT        NOT NULL CHECK (status IN ('ok', 'failed', 'partial')),
    details     JSONB       NOT NULL DEFAULT '{}',
    started_at  TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cron_runs_task_finished
    ON public.cron_runs (task_name, finished_at DESC);

-- global_settings (17.4)
CREATE TABLE IF NOT EXISTS public.global_settings (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.global_settings (key, value) VALUES
    ('system_banner', 'null'::jsonb),
    ('maintenance_mode', 'false'::jsonb),
    ('signup_open', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Sudo sessions (GAP 11)
CREATE TABLE IF NOT EXISTS public.sudo_sessions (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    issued_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address TEXT,
    user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sudo_sessions_user_expires
    ON public.sudo_sessions (user_id, expires_at DESC);

-- Impersonation sessions
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    superadmin_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    target_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_impersonation_superadmin
    ON public.impersonation_sessions (superadmin_id, expires_at DESC);

-- Audit log extensions
ALTER TABLE public.audit_log
    ADD COLUMN IF NOT EXISTS operation_id UUID,
    ADD COLUMN IF NOT EXISTS before_state JSONB,
    ADD COLUMN IF NOT EXISTS after_state JSONB,
    ADD COLUMN IF NOT EXISTS reason TEXT,
    ADD COLUMN IF NOT EXISTS user_agent TEXT,
    ADD COLUMN IF NOT EXISTS actor_email TEXT,
    ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_operation_id ON public.audit_log (operation_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON public.audit_log (actor_id);

-- Immutability: block updates/deletes on audit_log (service role bypasses via superuser)
CREATE OR REPLACE FUNCTION public.audit_log_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_no_update ON public.audit_log;
CREATE TRIGGER audit_log_no_update
    BEFORE UPDATE OR DELETE ON public.audit_log
    FOR EACH ROW EXECUTE FUNCTION public.audit_log_immutable();

ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sudo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Backend service role accesses these tables; no client policies.
