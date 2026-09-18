-- Phase 4 active sessions (DEV2 stop-ship)
CREATE TABLE IF NOT EXISTS active_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_id TEXT NOT NULL,
    device_hint TEXT,
    ip_address TEXT,
    last_seen_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    revoked_at TIMESTAMPTZ,
    UNIQUE (user_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
