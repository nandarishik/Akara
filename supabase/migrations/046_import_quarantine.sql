CREATE TABLE IF NOT EXISTS import_quarantine (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    import_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    failure_type TEXT NOT NULL CHECK (failure_type IN (
        'missing_required','type_mismatch','out_of_range','duplicate','total_mismatch','unknown'
    )),
    failure_reason TEXT,
    canonical_field TEXT,
    raw_row JSONB,
    resolved BOOLEAN DEFAULT FALSE NOT NULL,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_import_quarantine_unresolved
    ON import_quarantine(import_id) WHERE resolved = FALSE;
ALTER TABLE import_quarantine ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_quarantine_tenant_isolation ON import_quarantine
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
GRANT ALL ON import_quarantine TO service_role;
