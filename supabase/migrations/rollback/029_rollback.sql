-- Phase 3 rollback for deployment_events (forward: DEV2 029_p03_environment_audit_log.sql)
DROP INDEX IF EXISTS idx_deployment_events_env_created;
DROP TABLE IF EXISTS deployment_events;
