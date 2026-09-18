CREATE TABLE IF NOT EXISTS alert_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  score NUMERIC,
  details JSONB
);
GRANT ALL ON alert_anomalies TO service_role;
