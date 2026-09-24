CREATE TABLE IF NOT EXISTS llm_cost_log_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_llm_cost_log_v2_tenant ON llm_cost_log_v2(tenant_id);
ALTER TABLE llm_cost_log_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY llm_cost_log_v2_tenant_isolation ON llm_cost_log_v2
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
GRANT ALL ON llm_cost_log_v2 TO service_role;
