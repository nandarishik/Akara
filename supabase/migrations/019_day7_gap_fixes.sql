-- Day 7 gap fixes: suppression + debrief delivery idempotency

CREATE TABLE IF NOT EXISTS public.email_suppressions (
    email_normalized TEXT PRIMARY KEY,
    reason           TEXT NOT NULL DEFAULT 'unsubscribe',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.debrief_delivery_ledger (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel    TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
    sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, week_start, user_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_debrief_delivery_tenant_week
    ON public.debrief_delivery_ledger (tenant_id, week_start);

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debrief_delivery_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS debrief_delivery_tenant ON public.debrief_delivery_ledger;
CREATE POLICY debrief_delivery_tenant ON public.debrief_delivery_ledger
    FOR SELECT USING (tenant_id = public.get_my_tenant_id());
