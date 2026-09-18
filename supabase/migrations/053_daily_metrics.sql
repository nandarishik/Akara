CREATE TABLE IF NOT EXISTS daily_metrics (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  metric_key TEXT NOT NULL,
  value NUMERIC,
  PRIMARY KEY (tenant_id, metric_date, metric_key)
);
GRANT ALL ON daily_metrics TO service_role;
