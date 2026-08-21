-- ============================================================
-- 028_connect_infrastructure.sql
-- Connections, mapping memory, and sync log for Akara Connect.
-- No per-customer tables. OAuth credential encryption is out of scope;
-- credentials_enc is a placeholder column only.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- connections
-- One data source per tenant (tally agent, csv, future cloud).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connections (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    source_type      TEXT NOT NULL
        CHECK (source_type IN ('tally', 'zoho_books', 'shopify', 'csv_upload')),
    display_name     TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'error', 'disconnected')),
    credentials_enc  TEXT,
    sync_cursor      JSONB NOT NULL DEFAULT '{}',
    last_sync_at     TIMESTAMPTZ,
    last_error       TEXT,
    error_count      INT NOT NULL DEFAULT 0,
    agent_token_hash TEXT,
    metadata         JSONB NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS connections_tenant_id_idx ON public.connections (tenant_id);
CREATE INDEX IF NOT EXISTS connections_status_idx ON public.connections (status);

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connections_tenant_isolation ON public.connections;
CREATE POLICY connections_tenant_isolation ON public.connections
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.connections TO service_role;

DROP TRIGGER IF EXISTS connections_updated_at ON public.connections;
CREATE TRIGGER connections_updated_at
    BEFORE UPDATE ON public.connections
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.connections IS
    'Tenant data-source connections (Tally agent, CSV, future OAuth).';

-- ------------------------------------------------------------
-- mapping_memory
-- Confirmed CSV header → canonical column maps, keyed by fingerprint.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mapping_memory (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    fingerprint_hash TEXT NOT NULL,
    column_mapping   JSONB NOT NULL,
    source_hint      TEXT NOT NULL DEFAULT '',
    profile_id       TEXT,
    use_count        INT NOT NULL DEFAULT 1,
    confirmed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mapping_memory_tenant_fp_idx
    ON public.mapping_memory (tenant_id, fingerprint_hash);

ALTER TABLE public.mapping_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mapping_memory_tenant_isolation ON public.mapping_memory;
CREATE POLICY mapping_memory_tenant_isolation ON public.mapping_memory
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mapping_memory TO service_role;

COMMENT ON TABLE public.mapping_memory IS
    'Persisted confirmed column mappings per tenant + header fingerprint.';

CREATE OR REPLACE FUNCTION public.upsert_mapping_memory(
    p_tenant_id UUID,
    p_fingerprint TEXT,
    p_column_mapping JSONB,
    p_source_hint TEXT DEFAULT '',
    p_profile_id TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.mapping_memory (
        tenant_id, fingerprint_hash, column_mapping, source_hint, profile_id,
        use_count, confirmed_at, last_used_at
    )
    VALUES (
        p_tenant_id, p_fingerprint, p_column_mapping, p_source_hint, p_profile_id,
        1, now(), now()
    )
    ON CONFLICT (tenant_id, fingerprint_hash) DO UPDATE
        SET column_mapping = EXCLUDED.column_mapping,
            source_hint = COALESCE(NULLIF(EXCLUDED.source_hint, ''), mapping_memory.source_hint),
            profile_id = COALESCE(EXCLUDED.profile_id, mapping_memory.profile_id),
            use_count = mapping_memory.use_count + 1,
            last_used_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_mapping_memory(UUID, TEXT, JSONB, TEXT, TEXT) TO service_role;

-- ------------------------------------------------------------
-- sync_log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
    tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at      TIMESTAMPTZ,
    rows_synced   INT NOT NULL DEFAULT 0,
    rows_skipped  INT NOT NULL DEFAULT 0,
    rows_rejected INT NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'success', 'partial', 'failed')),
    error         TEXT,
    cursor_before JSONB NOT NULL DEFAULT '{}',
    cursor_after  JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS sync_log_connection_id_idx ON public.sync_log (connection_id);
CREATE INDEX IF NOT EXISTS sync_log_tenant_id_idx ON public.sync_log (tenant_id);
CREATE INDEX IF NOT EXISTS sync_log_started_at_idx ON public.sync_log (started_at DESC);

ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_log_tenant_isolation ON public.sync_log;
CREATE POLICY sync_log_tenant_isolation ON public.sync_log
    FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_log TO service_role;

COMMENT ON TABLE public.sync_log IS
    'Per-run audit of Connect / agent sync batches.';

COMMIT;
