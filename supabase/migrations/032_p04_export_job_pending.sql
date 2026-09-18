-- Phase 4 export jobs: pending must be explicit
ALTER TABLE account_export_jobs ALTER COLUMN status SET DEFAULT 'pending';
