CREATE TABLE IF NOT EXISTS canonical_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel_name TEXT NOT NULL,
    channel_type TEXT NOT NULL CHECK (channel_type IN (
        'dine-in','takeaway','delivery','aggregator','online','other'
    )),
    commission_rate NUMERIC(6,2),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, channel_name)
);
CREATE INDEX IF NOT EXISTS idx_canonical_channels_tenant ON canonical_channels(tenant_id);
ALTER TABLE canonical_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY canonical_channels_tenant_isolation ON canonical_channels
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
GRANT ALL ON canonical_channels TO service_role;
