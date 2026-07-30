-- ============================================================
-- 022_tenant_companion_data.sql
-- Companion/auxiliary import rows (wastage, shifts, referrals, etc.)
-- for cross-file copilot questions.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.tenant_companion_data (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    source_file  TEXT NOT NULL,
    dataset_type TEXT NOT NULL,
    record_date  DATE,
    party_name   TEXT,
    product_name TEXT,
    amount       NUMERIC(15, 2),
    quantity     NUMERIC(12, 3),
    raw_data     JSONB NOT NULL DEFAULT '{}',
    import_id    UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companion_tenant_type_date
    ON public.tenant_companion_data (tenant_id, dataset_type, record_date);

CREATE INDEX IF NOT EXISTS idx_companion_tenant_id
    ON public.tenant_companion_data (tenant_id);

ALTER TABLE public.tenant_companion_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companion_tenant_isolation" ON public.tenant_companion_data;
CREATE POLICY "companion_tenant_isolation"
    ON public.tenant_companion_data FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_companion_data TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.tenant_companion_data_id_seq TO service_role;

COMMENT ON TABLE public.tenant_companion_data IS
    'Auxiliary CSV/XLSX imports: wastage, shifts, settlements, referrals, vendor purchases, etc.';

COMMIT;
