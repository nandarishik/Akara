-- ============================================================
-- AKARA: Billing Infrastructure
-- Migration 011 — run AFTER 010_import_tracking
--
-- Day 1: table/column scaffolding.
-- Day 2: import_jobs, import_job_id on sales_data, atomic
--        usage RPCs, tenant_lifetime_debriefs view,
--        retention policy comment.
--
-- Apply to staging first. Verify RLS before production.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Tenant billing fields
-- ============================================================
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS plan
        TEXT NOT NULL DEFAULT 'free'
        CHECK (plan IN ('free', 'pro', 'business')),
    ADD COLUMN IF NOT EXISTS plan_status
        TEXT NOT NULL DEFAULT 'active'
        CHECK (plan_status IN ('active', 'trialing', 'past_due', 'cancelled')),
    ADD COLUMN IF NOT EXISTS trial_ends_at
        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS plan_overrides_at
        TIMESTAMPTZ,           -- when manual override was last applied
    ADD COLUMN IF NOT EXISTS stripe_customer_id
        TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id
        TEXT,
    ADD COLUMN IF NOT EXISTS feature_overrides
        JSONB NOT NULL DEFAULT '{}';
        -- e.g. {"scheme_leakage": true} — founder override per tenant

COMMENT ON COLUMN public.tenants.plan IS
    'free=30d retention | pro=365d | business=1095d';

CREATE INDEX IF NOT EXISTS idx_tenants_plan
    ON public.tenants (plan);
CREATE INDEX IF NOT EXISTS idx_tenants_plan_status
    ON public.tenants (plan_status);
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer
    ON public.tenants (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

-- ============================================================
-- 2. Import jobs — one row per upload/sync job
--    Needed by DELETE /data/imports/{id} (undo) endpoint.
-- ============================================================
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

-- ============================================================
-- 3. Add import_job_id to sales_data
--    Links each row to the import that created it (for undo).
-- ============================================================
ALTER TABLE public.sales_data
    ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES public.import_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_data_import_job_id
    ON public.sales_data (import_job_id)
    WHERE import_job_id IS NOT NULL;

-- ============================================================
-- 4. Usage tracking (per tenant per IST calendar month)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usage_tracking (
    tenant_id           UUID    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    -- Always first day of the month in IST:
    --   (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE truncated to month start
    month               DATE    NOT NULL,

    -- Monthly counters (reset when month changes)
    copilot_calls       INT     NOT NULL DEFAULT 0,
    rows_imported       BIGINT  NOT NULL DEFAULT 0,
    uploads_count       INT     NOT NULL DEFAULT 0,
    debrief_count       INT     NOT NULL DEFAULT 0,   -- lifetime total for Free plan gate

    -- Daily counters (reset when IST date changes — see last_activity_date)
    uploads_today       INT     NOT NULL DEFAULT 0,
    undos_today         INT     NOT NULL DEFAULT 0,
    last_activity_date  DATE    NOT NULL DEFAULT CURRENT_DATE,

    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (tenant_id, month)
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_tenant_id
    ON public.usage_tracking (tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_month
    ON public.usage_tracking (month DESC);

-- RLS: tenants see only their own usage row
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_tracking_tenant_isolation" ON public.usage_tracking;
CREATE POLICY "usage_tracking_tenant_isolation"
    ON public.usage_tracking FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

-- Service role can read/write without RLS restriction (for backend usage guards)
GRANT SELECT, INSERT, UPDATE ON public.usage_tracking TO service_role;

-- ============================================================
-- 5. Lifetime debrief count view (for Free plan gate)
-- ============================================================
CREATE OR REPLACE VIEW public.tenant_lifetime_debriefs AS
SELECT
    tenant_id,
    COALESCE(SUM(debrief_count), 0) AS total_debriefs
FROM public.usage_tracking
GROUP BY tenant_id;

GRANT SELECT ON public.tenant_lifetime_debriefs TO service_role;

-- ============================================================
-- 6. increment_usage RPC — called after every guarded action
--    SECURITY DEFINER so backend service role can call it
--    without needing direct table grants from the anon key.
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_usage(
    p_tenant_id     UUID,
    p_field         TEXT,   -- 'copilot_calls' | 'rows_imported' | 'uploads_count'
                            -- | 'debrief_count' | 'uploads_today' | 'undos_today'
    p_amount        INT DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- IST month start: truncate (NOW() AT TIME ZONE 'Asia/Kolkata') to first of month
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
    -- Validate field name to prevent SQL injection (belt-and-suspenders)
    IF p_field != ALL(v_allowed_fields) THEN
        RAISE EXCEPTION 'increment_usage: invalid field name "%"', p_field;
    END IF;

    -- Upsert the month row (INSERT if missing, else no-op)
    INSERT INTO public.usage_tracking (tenant_id, month, last_activity_date)
    VALUES (p_tenant_id, v_month, v_today)
    ON CONFLICT (tenant_id, month) DO NOTHING;

    -- Atomic increment + always refresh last_activity_date so daily
    -- reset logic in get_current_usage can compare against today
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

-- ============================================================
-- 7. get_current_usage RPC — called by PlanGuard + billing endpoint
--    Daily counters auto-reset to 0 when last_activity_date != today.
-- ============================================================
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
        -- Daily counters: return 0 if last_activity_date != today (auto-reset semantics)
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

    -- Return zeroed object when tenant has no usage row yet
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

-- ============================================================
-- 8. LLM cost log — one row per API call
-- ============================================================
CREATE TABLE IF NOT EXISTS public.llm_cost_log (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    request_id      TEXT,                               -- X-Request-ID from the API call
    feature         TEXT        NOT NULL                -- 'copilot' | 'morning_brief' | 'weekly_debrief' | 'schema_discovery'
        CHECK (feature IN ('copilot', 'morning_brief', 'weekly_debrief', 'schema_discovery', 'other')),
    model           TEXT        NOT NULL,               -- openrouter model string
    input_tokens    INT         NOT NULL DEFAULT 0,
    output_tokens   INT         NOT NULL DEFAULT 0,
    total_tokens    INT         GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    cost_usd        NUMERIC(10, 8) NOT NULL DEFAULT 0,  -- calculated by backend from model rate table
    latency_ms      INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_cost_tenant_id
    ON public.llm_cost_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_llm_cost_tenant_month
    ON public.llm_cost_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_cost_feature
    ON public.llm_cost_log (tenant_id, feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_cost_model
    ON public.llm_cost_log (model, created_at DESC);

-- RLS: admins can see their tenant's LLM costs; users cannot
ALTER TABLE public.llm_cost_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "llm_cost_log_admin_select" ON public.llm_cost_log;
CREATE POLICY "llm_cost_log_admin_select"
    ON public.llm_cost_log FOR SELECT
    USING (tenant_id = public.get_my_tenant_id() AND public.is_admin());

-- Service role writes cost records (no INSERT via client)
GRANT INSERT, SELECT ON public.llm_cost_log TO service_role;

-- ============================================================
-- 9. Idempotency keys table (for mutations)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    key             TEXT        PRIMARY KEY,            -- UUID v4 from Idempotency-Key header
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    endpoint        TEXT        NOT NULL,               -- e.g. 'POST /billing/checkout'
    response_status INT         NOT NULL,
    response_body   JSONB       NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at
    ON public.idempotency_keys (expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_tenant_id
    ON public.idempotency_keys (tenant_id);

-- No client access — backend service role only
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.idempotency_keys TO service_role;

-- ============================================================
-- 10. Verification queries (run after applying)
-- ============================================================
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'tenants'
--   AND column_name IN ('plan','plan_status','trial_ends_at','stripe_customer_id','feature_overrides');
-- Expected: 5 rows
--
-- SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public'
--   AND tablename IN ('usage_tracking','llm_cost_log','idempotency_keys','import_jobs')
--   AND rowsecurity = true;
-- Expected: 4
--
-- SELECT COUNT(*) FROM pg_proc WHERE proname IN ('increment_usage','get_current_usage');
-- Expected: 2
--
-- SELECT COUNT(*) FROM information_schema.views
-- WHERE table_schema = 'public' AND table_name = 'tenant_lifetime_debriefs';
-- Expected: 1

COMMIT;
