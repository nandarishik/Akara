ALTER TABLE public.import_jobs
  ADD COLUMN IF NOT EXISTS source_file_hash TEXT,
  ADD COLUMN IF NOT EXISTS import_type TEXT DEFAULT 'fmcg',
  ADD COLUMN IF NOT EXISTS column_mapping JSONB,
  ADD COLUMN IF NOT EXISTS batch_size INT DEFAULT 500,
  ADD COLUMN IF NOT EXISTS total_batches INT,
  ADD COLUMN IF NOT EXISTS last_completed_batch INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quarantine_row_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canonical_row_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reconciliation_totals JSONB,
  ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT,
  ADD COLUMN IF NOT EXISTS reconciliation_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS undone_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_mapping_used BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_mapping_confidence NUMERIC(3,2);
ALTER TABLE public.import_jobs DROP CONSTRAINT IF EXISTS import_jobs_status_check;
ALTER TABLE public.import_jobs ADD CONSTRAINT import_jobs_status_check
  CHECK (status IN (
    'queued','processing','completed','failed','deleted','cancelled',
    'mapping_proposed','mapping_confirmed','mapping_timeout','skipped','undone'
  ));
ALTER TABLE public.import_jobs DROP CONSTRAINT IF EXISTS import_jobs_source_type_check;
ALTER TABLE public.import_jobs ADD CONSTRAINT import_jobs_source_type_check
  CHECK (source_type IN (
    'primary','secondary','scheme','api','tally',
    'cafe_orders','cafe_expenses','cafe_inventory'
  ));
ALTER TABLE public.import_jobs DROP CONSTRAINT IF EXISTS import_jobs_import_type_check;
ALTER TABLE public.import_jobs ADD CONSTRAINT import_jobs_import_type_check
  CHECK (import_type IN (
    'fmcg','fmcg_secondary','fmcg_scheme',
    'cafe_orders','cafe_expenses','cafe_inventory'
  ));
