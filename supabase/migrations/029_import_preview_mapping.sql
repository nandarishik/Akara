-- ============================================================
-- 029_import_preview_mapping.sql
-- Assisted CSV onboarding (superadmin-first): stateful-minimal preview.
--
-- 1. Extend import_jobs status lifecycle with 'preview' (a parsed-but-not-
--    committed upload whose bytes are stashed in the imports bucket) and
--    'cancelled' (already written by POST /data/import/jobs/{id}/cancel but
--    previously missing from the CHECK constraint — latent bug fix).
-- 2. Add import_jobs.import_mapping JSONB to persist the confirmed
--    source→canonical column mapping between preview and commit (and as an
--    audit trail of how each file shape was mapped).
--
-- Forward-only. No data backfill required (new column is nullable).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Status lifecycle: add 'preview' and 'cancelled'
-- ------------------------------------------------------------
ALTER TABLE public.import_jobs
    DROP CONSTRAINT IF EXISTS import_jobs_status_check;

ALTER TABLE public.import_jobs
    ADD CONSTRAINT import_jobs_status_check
    CHECK (status IN (
        'queued', 'processing', 'completed', 'failed',
        'deleted', 'cancelled', 'preview'
    ));

-- ------------------------------------------------------------
-- 2. Confirmed column mapping (normalized_source → canonical field)
-- ------------------------------------------------------------
ALTER TABLE public.import_jobs
    ADD COLUMN IF NOT EXISTS import_mapping JSONB;

-- Partial index to find open previews for a tenant (onboarding UI).
CREATE INDEX IF NOT EXISTS idx_import_jobs_preview
    ON public.import_jobs (tenant_id, created_at DESC)
    WHERE status = 'preview';

COMMIT;
