-- Day 6: Zero-code threshold alerts + trigger audit log

CREATE TABLE IF NOT EXISTS public.tenant_alerts (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    metric          TEXT        NOT NULL CHECK (metric IN (
        'secondary_sales_total',
        'primary_sales_total',
        'outstanding_amount',
        'beat_adherence_pct'
    )),
    condition       TEXT        NOT NULL CHECK (condition IN ('below', 'above', 'equals')),
    threshold       NUMERIC     NOT NULL,
    dimension       TEXT,
    delivery        TEXT[]      NOT NULL DEFAULT '{email}',
    cooldown_hours  INT         NOT NULL DEFAULT 24,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    last_triggered  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_alerts_tenant_active
    ON public.tenant_alerts (tenant_id, is_active);

CREATE TABLE IF NOT EXISTS public.alert_trigger_events (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    alert_id        UUID        NOT NULL REFERENCES public.tenant_alerts(id) ON DELETE CASCADE,
    metric_value    NUMERIC     NOT NULL,
    threshold       NUMERIC     NOT NULL,
    channel         TEXT        NOT NULL DEFAULT 'email',
    status          TEXT        NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
    trigger_day     DATE        NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (alert_id, trigger_day)
);

CREATE INDEX IF NOT EXISTS idx_alert_trigger_events_tenant
    ON public.alert_trigger_events (tenant_id, created_at DESC);

ALTER TABLE public.tenant_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_trigger_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_alerts_select ON public.tenant_alerts;
DROP POLICY IF EXISTS tenant_alerts_insert ON public.tenant_alerts;
DROP POLICY IF EXISTS tenant_alerts_update ON public.tenant_alerts;
DROP POLICY IF EXISTS tenant_alerts_delete ON public.tenant_alerts;

CREATE POLICY tenant_alerts_select ON public.tenant_alerts
    FOR SELECT USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY tenant_alerts_insert ON public.tenant_alerts
    FOR INSERT WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE POLICY tenant_alerts_update ON public.tenant_alerts
    FOR UPDATE USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY tenant_alerts_delete ON public.tenant_alerts
    FOR DELETE USING (tenant_id = public.get_my_tenant_id());

DROP POLICY IF EXISTS alert_trigger_events_select ON public.alert_trigger_events;
CREATE POLICY alert_trigger_events_select ON public.alert_trigger_events
    FOR SELECT USING (tenant_id = public.get_my_tenant_id());
