-- AKARA: Billing Infrastructure — Migration 011
-- Run in Supabase SQL Editor AFTER migration 010.
-- Day 1 scaffold only — billing logic wired in Day 2.

BEGIN;

-- ── Tenant billing columns ────────────────────────────────────────────────────
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS plan
        TEXT NOT NULL DEFAULT 'free'
        CHECK (plan IN ('free', 'pro', 'business')),
    ADD COLUMN IF NOT EXISTS plan_status
        TEXT NOT NULL DEFAULT 'active'
        CHECK (plan_status IN ('active', 'trialing', 'past_due', 'cancelled')),
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS plan_overrides_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS feature_overrides JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_tenants_plan
    ON public.tenants (plan);

CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer
    ON public.tenants (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

-- ── Usage tracking (per tenant per calendar month) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_tracking (
    tenant_id           UUID    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    month               DATE    NOT NULL,
    copilot_calls       INT     NOT NULL DEFAULT 0,
    rows_imported       BIGINT  NOT NULL DEFAULT 0,
    uploads_count       INT     NOT NULL DEFAULT 0,
    debrief_count       INT     NOT NULL DEFAULT 0,
    uploads_today       INT     NOT NULL DEFAULT 0,
    undos_today         INT     NOT NULL DEFAULT 0,
    last_activity_date  DATE    NOT NULL DEFAULT CURRENT_DATE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, month)
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_tenant
    ON public.usage_tracking (tenant_id);

-- ── LLM cost log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.llm_cost_log (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    request_id      TEXT,
    feature         TEXT        NOT NULL
        CHECK (feature IN ('copilot', 'morning_brief', 'weekly_debrief', 'schema_discovery', 'other')),
    model           TEXT        NOT NULL,
    input_tokens    INT         NOT NULL DEFAULT 0,
    output_tokens   INT         NOT NULL DEFAULT 0,
    total_tokens    INT         GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    cost_usd        NUMERIC(10, 8) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_cost_log_tenant_created
    ON public.llm_cost_log (tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_llm_cost_log_feature
    ON public.llm_cost_log (feature, created_at);

-- ── Idempotency keys (storage wired Day 2) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    key             TEXT        PRIMARY KEY,
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    endpoint        TEXT        NOT NULL,
    response_status INT         NOT NULL,
    response_body   JSONB       NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_tenant
    ON public.idempotency_keys (tenant_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_tracking_select" ON public.usage_tracking;
CREATE POLICY "usage_tracking_select"
    ON public.usage_tracking FOR SELECT
    USING (tenant_id = public.get_my_tenant_id());

ALTER TABLE public.llm_cost_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "llm_cost_log_select" ON public.llm_cost_log;
CREATE POLICY "llm_cost_log_select"
    ON public.llm_cost_log FOR SELECT
    USING (tenant_id = public.get_my_tenant_id());

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "idempotency_keys_service_only" ON public.idempotency_keys;
CREATE POLICY "idempotency_keys_service_only"
    ON public.idempotency_keys FOR ALL
    USING (false);

COMMIT;
