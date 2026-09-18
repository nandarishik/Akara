CREATE TABLE IF NOT EXISTS dashboard_layouts (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  layout JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
GRANT ALL ON dashboard_layouts TO service_role;
