-- AKARA: Import Tracking — Migration 010
-- Run in Supabase SQL Editor BEFORE deploying backend changes.

ALTER TABLE public.sales_data
    ADD COLUMN IF NOT EXISTS import_id UUID;

ALTER TABLE public.secondary_sales_data
    ADD COLUMN IF NOT EXISTS import_id UUID;

ALTER TABLE public.scheme_master
    ADD COLUMN IF NOT EXISTS import_id UUID;

CREATE INDEX IF NOT EXISTS idx_sales_data_import_id
    ON public.sales_data (tenant_id, import_id)
    WHERE import_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_secondary_sales_data_import_id
    ON public.secondary_sales_data (tenant_id, import_id)
    WHERE import_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheme_master_import_id
    ON public.scheme_master (tenant_id, import_id)
    WHERE import_id IS NOT NULL;
