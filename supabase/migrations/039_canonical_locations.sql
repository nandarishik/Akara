CREATE TABLE IF NOT EXISTS canonical_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state_code TEXT,
    gstin TEXT,
    fssai_number TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, location_name)
);
CREATE INDEX IF NOT EXISTS idx_canonical_locations_tenant ON canonical_locations(tenant_id);
ALTER TABLE canonical_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY canonical_locations_tenant_isolation ON canonical_locations
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
GRANT ALL ON canonical_locations TO service_role;
