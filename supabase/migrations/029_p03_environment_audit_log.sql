-- Phase 3 deployment_events (DEV2 stop-ship so 029_rollback.sql matches)
CREATE TABLE IF NOT EXISTS deployment_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    environment TEXT NOT NULL CHECK (environment IN ('staging', 'production')),
    event_type TEXT NOT NULL CHECK (event_type IN ('deploy', 'rollback', 'migration', 'restore_drill')),
    git_sha TEXT NOT NULL,
    actor TEXT NOT NULL,
    service_name TEXT,
    status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed')),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deployment_events_env_created
    ON deployment_events(environment, created_at DESC);
