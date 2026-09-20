CREATE TABLE IF NOT EXISTS canonical_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES canonical_locations(id),
    import_id UUID REFERENCES import_jobs(id),
    item_name TEXT NOT NULL,
    sku TEXT,
    quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
    unit TEXT,
    reorder_point NUMERIC(12,3),
    cost_per_unit NUMERIC(12,2),
    supplier_name TEXT,
    category TEXT,
    last_updated TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, location_id, item_name)
);
CREATE INDEX IF NOT EXISTS idx_canonical_inventory_tenant ON canonical_inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_canonical_inventory_reorder
    ON canonical_inventory(tenant_id) WHERE reorder_point IS NOT NULL AND quantity <= reorder_point;
ALTER TABLE canonical_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY canonical_inventory_tenant_isolation ON canonical_inventory
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
GRANT ALL ON canonical_inventory TO service_role;
