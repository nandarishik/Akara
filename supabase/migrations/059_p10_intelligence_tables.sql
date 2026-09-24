-- Phase 10: forecasts, weather_cache, worker_runs

CREATE TABLE IF NOT EXISTS public.forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    location_id UUID,
    item_id TEXT NOT NULL,
    forecast_date DATE NOT NULL,
    predicted_revenue NUMERIC(12,2) NOT NULL,
    confidence_interval_low NUMERIC(12,2) NOT NULL,
    confidence_interval_high NUMERIC(12,2) NOT NULL,
    model_used TEXT NOT NULL DEFAULT 'AutoARIMA',
    model_version TEXT,
    training_days INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, location_id, item_id, forecast_date)
);
CREATE INDEX IF NOT EXISTS idx_forecasts_tenant_date ON public.forecasts (tenant_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_forecasts_item ON public.forecasts (tenant_id, item_id);

ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS forecasts_tenant_isolation ON public.forecasts;
CREATE POLICY forecasts_tenant_isolation ON public.forecasts
    USING (tenant_id = public.get_my_tenant_id());
GRANT ALL ON public.forecasts TO service_role;

CREATE TABLE IF NOT EXISTS public.weather_cache (
    city_slug TEXT NOT NULL,
    cache_date DATE NOT NULL,
    temp_max_c NUMERIC(6,2),
    precipitation_mm NUMERIC(8,2),
    weather_code INTEGER,
    raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (city_slug, cache_date)
);
ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.weather_cache TO service_role;

CREATE TABLE IF NOT EXISTS public.worker_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_name TEXT NOT NULL CHECK (worker_name ~ '^[a-z_]+$'),
    tenant_id UUID,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'dead_letter')),
    tenants_processed INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    retry_attempt INTEGER DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_worker_runs_name ON public.worker_runs (worker_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_runs_status ON public.worker_runs (status);
ALTER TABLE public.worker_runs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.worker_runs TO service_role;
