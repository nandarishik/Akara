CREATE TABLE IF NOT EXISTS metric_targets (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  threshold NUMERIC,
  PRIMARY KEY (tenant_id, metric_key)
);
GRANT ALL ON metric_targets TO service_role;
