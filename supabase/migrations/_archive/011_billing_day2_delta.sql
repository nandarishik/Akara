-- ============================================================
-- AKARA: 011_billing DAY 2 DELTA
-- Run this in Supabase SQL Editor AFTER the Day 1 scaffold
-- (tenants columns + usage_tracking + llm_cost_log + idempotency_keys).
--
-- Safe to re-run — uses IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================

BEGIN;

-- ── Extra tenant index (Day 2) ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tenants_plan_status
    ON public.tenants (plan_status);

COMMENT ON COLUMN public.tenants.plan IS
    'free=30d retention | pro=365d | business=1095d';

-- ── Import jobs (required by POST /data/import + undo) ───────────────────────
CREATE TABLE IF NOT EXISTS public.import_jobs (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    source_type     TEXT        NOT NULL DEFAULT 'primary'
        CHECK (source_type IN ('primary', 'secondary', 'scheme', 'api', 'tally')),
    filename        TEXT,
    rows_inserted   INT         NOT NULL DEFAULT 0,
    rows_skipped    INT         NOT NULL DEFAULT 0,
    status          TEXT        NOT NULL DEFAULT 'completed'
        CHECK (status IN ('completed', 'failed', 'deleted')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_tenant_id
    ON public.import_jobs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status
    ON public.import_jobs (tenant_id, status);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_jobs_tenant_isolation" ON public.import_jobs;
CREATE POLICY "import_jobs_tenant_isolation"
    ON public.import_jobs FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.import_jobs TO service_role;

-- ── Link sales_data rows to import jobs (for undo) ───────────────────────────
ALTER TABLE public.sales_data
    ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES public.import_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_data_import_job_id
    ON public.sales_data (import_job_id)
    WHERE import_job_id IS NOT NULL;

-- ── usage_tracking: service_role grants + policy (Day 2) ─────────────────────
CREATE INDEX IF NOT EXISTS idx_usage_tracking_month
    ON public.usage_tracking (month DESC);

DROP POLICY IF EXISTS "usage_tracking_select" ON public.usage_tracking;
DROP POLICY IF EXISTS "usage_tracking_tenant_isolation" ON public.usage_tracking;
CREATE POLICY "usage_tracking_tenant_isolation"
    ON public.usage_tracking FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.usage_tracking TO service_role;

-- ── Lifetime debrief view ────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.tenant_lifetime_debriefs AS
SELECT
    tenant_id,
    COALESCE(SUM(debrief_count), 0) AS total_debriefs
FROM public.usage_tracking
GROUP BY tenant_id;

GRANT SELECT ON public.tenant_lifetime_debriefs TO service_role;

-- ── increment_usage RPC (required after copilot/import) ──────────────────────
CREATE OR REPLACE FUNCTION public.increment_usage(
    p_tenant_id     UUID,
    p_field         TEXT,
    p_amount        INT DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_month DATE := DATE_TRUNC(
        'month',
        (NOW() AT TIME ZONE 'Asia/Kolkata')
    )::DATE;
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_allowed_fields TEXT[] := ARRAY[
        'copilot_calls', 'rows_imported', 'uploads_count',
        'debrief_count', 'uploads_today', 'undos_today'
    ];
BEGIN
    IF p_field != ALL(v_allowed_fields) THEN
        RAISE EXCEPTION 'increment_usage: invalid field name "%"', p_field;
    END IF;

    INSERT INTO public.usage_tracking (tenant_id, month, last_activity_date)
    VALUES (p_tenant_id, v_month, v_today)
    ON CONFLICT (tenant_id, month) DO NOTHING;

    EXECUTE format(
        'UPDATE public.usage_tracking
         SET %I = %I + $1,
             last_activity_date = $2,
             updated_at = NOW()
         WHERE tenant_id = $3 AND month = $4',
        p_field, p_field
    ) USING p_amount, v_today, p_tenant_id, v_month;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_usage(UUID, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_usage(UUID, TEXT, INT) TO service_role;

-- ── get_current_usage RPC (required BEFORE import/copilot — this was crashing) ─
CREATE OR REPLACE FUNCTION public.get_current_usage(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_month DATE := DATE_TRUNC(
        'month',
        (NOW() AT TIME ZONE 'Asia/Kolkata')
    )::DATE;
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'copilot_calls',    COALESCE(copilot_calls, 0),
        'rows_imported',    COALESCE(rows_imported, 0),
        'uploads_count',    COALESCE(uploads_count, 0),
        'debrief_count',    COALESCE(debrief_count, 0),
        'uploads_today',    CASE
                                WHEN last_activity_date = v_today
                                THEN COALESCE(uploads_today, 0)
                                ELSE 0
                            END,
        'undos_today',      CASE
                                WHEN last_activity_date = v_today
                                THEN COALESCE(undos_today, 0)
                                ELSE 0
                            END
    )
    INTO v_result
    FROM public.usage_tracking
    WHERE tenant_id = p_tenant_id AND month = v_month;

    RETURN COALESCE(v_result, '{
        "copilot_calls":  0,
        "rows_imported":  0,
        "uploads_count":  0,
        "debrief_count":  0,
        "uploads_today":  0,
        "undos_today":    0
    }'::JSONB);
END;
$$;

REVOKE ALL ON FUNCTION public.get_current_usage(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_usage(UUID) TO service_role;

-- ── llm_cost_log Day 2 extras ────────────────────────────────────────────────
ALTER TABLE public.llm_cost_log
    ADD COLUMN IF NOT EXISTS latency_ms INT;

CREATE INDEX IF NOT EXISTS idx_llm_cost_tenant_id
    ON public.llm_cost_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_llm_cost_tenant_month
    ON public.llm_cost_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_cost_feature
    ON public.llm_cost_log (tenant_id, feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_cost_model
    ON public.llm_cost_log (model, created_at DESC);

DROP POLICY IF EXISTS "llm_cost_log_select" ON public.llm_cost_log;
DROP POLICY IF EXISTS "llm_cost_log_admin_select" ON public.llm_cost_log;
CREATE POLICY "llm_cost_log_admin_select"
    ON public.llm_cost_log FOR SELECT
    USING (tenant_id = public.get_my_tenant_id() AND public.is_admin());

GRANT INSERT, SELECT ON public.llm_cost_log TO service_role;

-- ── idempotency_keys service_role grant ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at
    ON public.idempotency_keys (expires_at);

GRANT SELECT, INSERT ON public.idempotency_keys TO service_role;

COMMIT;

-- Verify (should return 2 rows, 1 row, 1 row):
-- SELECT proname FROM pg_proc WHERE proname IN ('get_current_usage', 'increment_usage');
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'import_jobs';
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'sales_data' AND column_name = 'import_job_id';
