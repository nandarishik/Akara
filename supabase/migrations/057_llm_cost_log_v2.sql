CREATE TABLE IF NOT EXISTS llm_cost_log_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT ALL ON llm_cost_log_v2 TO service_role;
