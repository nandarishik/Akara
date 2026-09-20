CREATE TABLE IF NOT EXISTS canonical_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES canonical_locations(id),
    import_id UUID REFERENCES import_jobs(id),
    external_order_id TEXT,
    order_time TIMESTAMPTZ NOT NULL,
    channel TEXT CHECK (channel IN (
        'dine-in','takeaway','delivery','aggregator','online','other'
    )),
    covers INTEGER,
    table_no TEXT,
    waiter TEXT,
    payment_mode TEXT,
    total_amount NUMERIC(12,2) NOT NULL,
    tax_amount NUMERIC(12,2),
    discount_amount NUMERIC(12,2),
    currency TEXT DEFAULT 'INR',
    source_file_name TEXT,
    imported_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, external_order_id, import_id)
);
CREATE INDEX IF NOT EXISTS idx_canonical_orders_tenant_time ON canonical_orders(tenant_id, order_time);
CREATE INDEX IF NOT EXISTS idx_canonical_orders_import ON canonical_orders(import_id);
CREATE INDEX IF NOT EXISTS idx_canonical_orders_channel ON canonical_orders(tenant_id, channel);
CREATE INDEX IF NOT EXISTS idx_canonical_orders_location ON canonical_orders(location_id);
ALTER TABLE canonical_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY canonical_orders_tenant_isolation ON canonical_orders
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
GRANT ALL ON canonical_orders TO service_role;
