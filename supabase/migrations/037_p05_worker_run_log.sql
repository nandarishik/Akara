CREATE TABLE IF NOT EXISTS worker_run_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,
    tenant_id UUID,
    status TEXT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    finished_at TIMESTAMPTZ,
    details JSONB
);
CREATE INDEX IF NOT EXISTS idx_worker_run_log_job ON worker_run_log(job_name, started_at DESC);

CREATE TABLE IF NOT EXISTS worker_pause_config (
    job_name TEXT NOT NULL,
    tenant_id UUID,
    paused_until TIMESTAMPTZ,
    reason TEXT,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_pause_global
    ON worker_pause_config (job_name) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_pause_tenant
    ON worker_pause_config (job_name, tenant_id) WHERE tenant_id IS NOT NULL;
