-- Phase 10: café alert columns + alert_anomalies

ALTER TABLE public.tenant_alerts DROP CONSTRAINT IF EXISTS tenant_alerts_metric_check;
ALTER TABLE public.tenant_alerts
    ADD CONSTRAINT tenant_alerts_metric_check CHECK (metric IN (
        'secondary_sales_total',
        'primary_sales_total',
        'outstanding_amount',
        'beat_adherence_pct',
        'revenue_below_threshold',
        'food_cost_above_threshold',
        'orders_below_expected',
        'item_not_selling',
        'anomaly'
    ));

ALTER TABLE public.tenant_alerts ADD COLUMN IF NOT EXISTS metric_name TEXT;
ALTER TABLE public.tenant_alerts ADD COLUMN IF NOT EXISTS escalation_level TEXT NOT NULL DEFAULT 'daily_digest';
ALTER TABLE public.tenant_alerts DROP CONSTRAINT IF EXISTS tenant_alerts_escalation_check;
ALTER TABLE public.tenant_alerts
    ADD CONSTRAINT tenant_alerts_escalation_check
    CHECK (escalation_level IN ('immediate', 'daily_digest', 'weekly_trend'));
ALTER TABLE public.tenant_alerts ADD COLUMN IF NOT EXISTS channel_email BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.tenant_alerts ADD COLUMN IF NOT EXISTS channel_whatsapp BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.tenant_alerts ADD COLUMN IF NOT EXISTS channel_in_app BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.tenant_alerts ADD COLUMN IF NOT EXISTS anomaly_detection BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.alert_trigger_events ADD COLUMN IF NOT EXISTS escalation_level TEXT;

CREATE TABLE IF NOT EXISTS public.alert_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    location_id UUID,
    metric_name TEXT NOT NULL,
    detected_at DATE NOT NULL,
    score NUMERIC(8,4) NOT NULL,
    is_outlier BOOLEAN NOT NULL DEFAULT FALSE,
    series_days INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, location_id, metric_name, detected_at)
);
CREATE INDEX IF NOT EXISTS idx_alert_anomalies_tenant ON public.alert_anomalies (tenant_id, detected_at DESC);
ALTER TABLE public.alert_anomalies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anomalies_tenant_isolation ON public.alert_anomalies;
CREATE POLICY anomalies_tenant_isolation ON public.alert_anomalies
    USING (tenant_id = public.get_my_tenant_id());
GRANT ALL ON public.alert_anomalies TO service_role;
