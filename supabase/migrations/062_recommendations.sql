CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  playbook_key TEXT,
  title TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','watching','dismissed','done')),
  confidence NUMERIC,
  impact_estimate NUMERIC,
  decision_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recommendations_tenant ON recommendations(tenant_id, status);
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON recommendations TO service_role;
