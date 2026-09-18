CREATE TABLE IF NOT EXISTS connector_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);
CREATE INDEX idx_connector_api_keys_tenant_id ON connector_api_keys(tenant_id);
ALTER TABLE connector_api_keys ENABLE ROW LEVEL SECURITY;
GRANT ALL ON connector_api_keys TO service_role;
