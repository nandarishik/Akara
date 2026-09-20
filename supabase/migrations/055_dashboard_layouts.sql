CREATE TABLE IF NOT EXISTS dashboard_layouts (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  layout JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY dashboard_layouts_tenant_isolation ON dashboard_layouts
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
GRANT ALL ON dashboard_layouts TO service_role;
