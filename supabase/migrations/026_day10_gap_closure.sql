-- Day 10 gap closure: placement events, price migrations, ledger evidence

BEGIN;

CREATE TABLE IF NOT EXISTS public.placement_events (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slot_key    TEXT NOT NULL,
    event_type  TEXT NOT NULL CHECK (event_type IN ('impression', 'click')),
    user_id     UUID,
    tenant_id   UUID,
    metadata    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_placement_events_slot ON public.placement_events (slot_key, event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.plan_price_migrations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_code       TEXT NOT NULL REFERENCES public.plan_catalog(code),
    effective_at    TIMESTAMPTZ NOT NULL,
    status          TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'applied', 'cancelled')),
    monthly_price_minor BIGINT,
    annual_price_minor  BIGINT,
    created_by      UUID,
    applied_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plan_price_migrations_due
    ON public.plan_price_migrations (status, effective_at)
    WHERE status = 'scheduled';

ALTER TABLE public.billing_ledger_entries
    ADD COLUMN IF NOT EXISTS evidence_path TEXT;

ALTER TABLE public.placement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_price_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY placement_events_insert ON public.placement_events FOR INSERT WITH CHECK (true);
CREATE POLICY placement_events_read ON public.placement_events FOR SELECT USING (true);

COMMIT;
