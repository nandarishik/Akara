CREATE TABLE IF NOT EXISTS connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connector_type TEXT NOT NULL CHECK (connector_type IN ('petpooja','tally','google_sheets','urban_piper')),
  source_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','error','disconnected')),
  credentials_encrypted TEXT,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT CHECK (last_sync_status IN ('success','partial','failed')),
  rows_synced_last_run INTEGER DEFAULT 0,
  last_error TEXT,
  next_scheduled_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_connectors_tenant ON connectors(tenant_id);
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY connectors_tenant_isolation ON connectors
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
GRANT ALL ON connectors TO service_role;
