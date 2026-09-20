ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS blast_radius TEXT;
CREATE INDEX IF NOT EXISTS idx_audit_log_action_created ON audit_log(action, created_at DESC);
