CREATE TABLE IF NOT EXISTS daily_metrics (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  metric_key TEXT NOT NULL,
  value NUMERIC,
  PRIMARY KEY (tenant_id, metric_date, metric_key)
);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_tenant_date ON daily_metrics(tenant_id, metric_date);
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_metrics_tenant_isolation ON daily_metrics
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
GRANT ALL ON daily_metrics TO service_role;
