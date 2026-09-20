CREATE TABLE IF NOT EXISTS canonical_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES canonical_locations(id),
    import_id UUID REFERENCES import_jobs(id),
    expense_date DATE NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'food_cost','labour','rent','utilities','marketing','maintenance',
        'packaging','aggregator_commission','other'
    )),
    amount NUMERIC(12,2) NOT NULL,
    vendor TEXT,
    notes TEXT,
    source_file_name TEXT,
    imported_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_canonical_expenses_tenant_date ON canonical_expenses(tenant_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_canonical_expenses_import ON canonical_expenses(import_id);
ALTER TABLE canonical_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY canonical_expenses_tenant_isolation ON canonical_expenses
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
GRANT ALL ON canonical_expenses TO service_role;
