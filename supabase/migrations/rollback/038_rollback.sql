DROP INDEX IF EXISTS idx_audit_log_action_created;
ALTER TABLE audit_log DROP COLUMN IF EXISTS blast_radius;
