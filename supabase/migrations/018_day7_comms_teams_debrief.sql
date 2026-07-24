-- Day 7: communications, team invites, debrief, activation, delivery logs

-- ---------------------------------------------------------------------------
-- Profile / tenant extensions
-- ---------------------------------------------------------------------------
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id);

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS phone_number TEXT,
    ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS membership_status TEXT NOT NULL DEFAULT 'active'
        CHECK (membership_status IN ('active', 'suspended', 'seat_locked'));

UPDATE public.profiles
SET preferences = COALESCE(preferences, '{}'::jsonb) || '{"morning_brief_enabled": true}'::jsonb
WHERE preferences IS NULL OR preferences = '{}'::jsonb;

-- Backfill owner from earliest admin per tenant
UPDATE public.tenants t
SET owner_user_id = sub.owner_id
FROM (
    SELECT DISTINCT ON (p.tenant_id) p.tenant_id, p.id AS owner_id
    FROM public.profiles p
    WHERE p.tenant_id IS NOT NULL AND p.role = 'admin'
    ORDER BY p.tenant_id, p.created_at ASC
) sub
WHERE t.id = sub.tenant_id AND t.owner_user_id IS NULL;

-- ---------------------------------------------------------------------------
-- Team invites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_invites (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email_normalized TEXT NOT NULL,
    role             TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    status           TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
    reserves_seat    BOOLEAN NOT NULL DEFAULT TRUE,
    invite_token     TEXT NOT NULL DEFAULT replace(uuid_generate_v4()::text, '-', ''),
    invited_by       UUID NOT NULL REFERENCES auth.users(id),
    accepted_by      UUID REFERENCES auth.users(id),
    expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at      TIMESTAMPTZ,
    cancelled_at     TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_team_invites_pending_email
    ON public.team_invites (tenant_id, email_normalized)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_team_invites_tenant_status
    ON public.team_invites (tenant_id, status);

-- ---------------------------------------------------------------------------
-- Activation funnel
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_events (
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event        TEXT NOT NULL,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, event)
);

CREATE INDEX IF NOT EXISTS idx_user_events_event ON public.user_events (event);

CREATE TABLE IF NOT EXISTS public.activation_send_ledger (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stage      TEXT NOT NULL,
    sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, stage)
);

-- ---------------------------------------------------------------------------
-- Delivery logs (email + WhatsApp)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_logs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id    UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    channel      TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
    template     TEXT NOT NULL,
    status       TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
    provider_id  TEXT,
    error_message TEXT,
    metadata     JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_tenant_created
    ON public.delivery_logs (tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Account export / deletion queue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_export_jobs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id   UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    status      TEXT NOT NULL DEFAULT 'completed'
        CHECK (status IN ('pending', 'completed', 'failed')),
    storage_path TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.account_deletion_queue (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id   UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    status      TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'failed')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Debrief archive index
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_generated_reports_tenant_type_created
    ON public.generated_reports (tenant_id, report_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletion_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_invites_tenant ON public.team_invites;
CREATE POLICY team_invites_tenant ON public.team_invites
    FOR ALL USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS user_events_own ON public.user_events;
CREATE POLICY user_events_own ON public.user_events
    FOR ALL USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS delivery_logs_tenant ON public.delivery_logs;
CREATE POLICY delivery_logs_tenant ON public.delivery_logs
    FOR SELECT USING (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS account_export_own ON public.account_export_jobs;
CREATE POLICY account_export_own ON public.account_export_jobs
    FOR ALL USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Seat reservation RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_occupied_seats(p_tenant_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
AS $$
    SELECT (
        SELECT COUNT(*)::INT FROM public.profiles
        WHERE tenant_id = p_tenant_id
          AND membership_status IN ('active', 'suspended')
    ) + (
        SELECT COUNT(*)::INT FROM public.team_invites
        WHERE tenant_id = p_tenant_id
          AND status = 'pending'
          AND reserves_seat = TRUE
          AND expires_at > NOW()
    );
$$;

CREATE OR REPLACE FUNCTION public.reserve_team_invite(
    p_tenant_id UUID,
    p_email TEXT,
    p_role TEXT,
    p_invited_by UUID,
    p_seat_limit INT
)
RETURNS TABLE (
    invite_id UUID,
    occupied INT,
    seat_limit INT,
    remaining INT,
    existing BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT := lower(trim(p_email));
    v_occupied INT;
    v_existing UUID;
    v_new_id UUID;
BEGIN
    UPDATE public.team_invites
    SET status = 'expired', reserves_seat = FALSE
    WHERE tenant_id = p_tenant_id
      AND status = 'pending'
      AND expires_at <= NOW();

    SELECT id INTO v_existing
    FROM public.team_invites
    WHERE tenant_id = p_tenant_id
      AND email_normalized = v_email
      AND status = 'pending'
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
        v_occupied := public.count_occupied_seats(p_tenant_id);
        RETURN QUERY SELECT v_existing, v_occupied, p_seat_limit,
            GREATEST(0, p_seat_limit - v_occupied), TRUE;
        RETURN;
    END IF;

    v_occupied := public.count_occupied_seats(p_tenant_id);
    IF v_occupied >= p_seat_limit THEN
        RAISE EXCEPTION 'seat_limit_reached';
    END IF;

    INSERT INTO public.team_invites (
        tenant_id, email_normalized, role, invited_by, expires_at
    ) VALUES (
        p_tenant_id, v_email, p_role, p_invited_by, NOW() + INTERVAL '7 days'
    )
    RETURNING id INTO v_new_id;

    v_occupied := public.count_occupied_seats(p_tenant_id);
    RETURN QUERY SELECT v_new_id, v_occupied, p_seat_limit,
        GREATEST(0, p_seat_limit - v_occupied), FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_occupied_seats(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_team_invite(UUID, TEXT, TEXT, UUID, INT) TO service_role;
