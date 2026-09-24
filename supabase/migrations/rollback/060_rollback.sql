DROP TABLE IF EXISTS public.alert_anomalies;
ALTER TABLE public.alert_trigger_events DROP COLUMN IF EXISTS escalation_level;
ALTER TABLE public.tenant_alerts DROP COLUMN IF EXISTS anomaly_detection;
ALTER TABLE public.tenant_alerts DROP COLUMN IF EXISTS channel_in_app;
ALTER TABLE public.tenant_alerts DROP COLUMN IF EXISTS channel_whatsapp;
ALTER TABLE public.tenant_alerts DROP COLUMN IF EXISTS channel_email;
ALTER TABLE public.tenant_alerts DROP CONSTRAINT IF EXISTS tenant_alerts_escalation_check;
ALTER TABLE public.tenant_alerts DROP COLUMN IF EXISTS escalation_level;
ALTER TABLE public.tenant_alerts DROP COLUMN IF EXISTS metric_name;
