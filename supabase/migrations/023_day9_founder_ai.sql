-- 023_day9_founder_ai.sql — founder brief runs + broadcast history

BEGIN;

CREATE TABLE IF NOT EXISTS public.founder_brief_runs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_text    TEXT NOT NULL,
    generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivery_status TEXT NOT NULL DEFAULT 'generated',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.broadcast_history (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject       TEXT NOT NULL,
    channels      JSONB NOT NULL DEFAULT '[]',
    tenant_count  INT NOT NULL DEFAULT 0,
    sent_count    INT NOT NULL DEFAULT 0,
    plan_filter   TEXT,
    status_filter TEXT,
    actor_id      UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.revenue_snapshots (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    mrr_inr       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    arr_inr       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tenant_count  INT NOT NULL DEFAULT 0,
    llm_cost_usd  NUMERIC(12, 6) NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (snapshot_date)
);

ALTER TABLE public.founder_brief_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_snapshots ENABLE ROW LEVEL SECURITY;

COMMIT;
