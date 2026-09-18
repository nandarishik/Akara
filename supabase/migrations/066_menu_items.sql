CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gst_category TEXT,
  delivery_commission_pct NUMERIC
);
GRANT ALL ON menu_items TO service_role;
