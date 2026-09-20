CREATE TABLE IF NOT EXISTS metric_targets (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  threshold NUMERIC,
  PRIMARY KEY (tenant_id, metric_key)
);
ALTER TABLE metric_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY metric_targets_tenant_isolation ON metric_targets
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
GRANT ALL ON metric_targets TO service_role;
