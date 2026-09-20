CREATE TABLE IF NOT EXISTS connector_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running','success','partial','failed')),
  rows_synced INTEGER DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  error_detail TEXT,
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_connector_sync_logs_connector ON connector_sync_logs(connector_id, started_at DESC);
ALTER TABLE connector_sync_logs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON connector_sync_logs TO service_role;
