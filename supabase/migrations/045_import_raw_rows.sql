CREATE TABLE IF NOT EXISTS import_raw_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    raw_row JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (import_id, row_number)
);
GRANT ALL ON import_raw_rows TO service_role;
