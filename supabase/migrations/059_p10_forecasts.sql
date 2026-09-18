CREATE TABLE IF NOT EXISTS forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  forecast_date DATE NOT NULL,
  value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS weather_cache (
  city TEXT NOT NULL,
  forecast_date DATE NOT NULL,
  payload JSONB,
  PRIMARY KEY (city, forecast_date)
);
CREATE TABLE IF NOT EXISTS worker_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT,
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  finished_at TIMESTAMPTZ
);
GRANT ALL ON forecasts, weather_cache, worker_runs TO service_role;
