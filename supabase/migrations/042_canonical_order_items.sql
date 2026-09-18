CREATE TABLE IF NOT EXISTS canonical_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES canonical_orders(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2),
    line_total NUMERIC(12,2),
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_canonical_order_items_order ON canonical_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_canonical_order_items_tenant ON canonical_order_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_canonical_order_items_item ON canonical_order_items(tenant_id, item_name);
ALTER TABLE canonical_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY canonical_order_items_tenant_isolation ON canonical_order_items
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
GRANT ALL ON canonical_order_items TO service_role;
