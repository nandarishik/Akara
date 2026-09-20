-- Phase 5 superadmin roles + TOTP + impersonation metadata
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS superadmin_role TEXT
    CHECK (superadmin_role IN ('SUPER_ADMIN', 'SUPPORT', 'BILLING_OPS', 'CONTENT_OPS'));

UPDATE profiles SET superadmin_role = 'SUPER_ADMIN' WHERE role = 'superadmin' AND superadmin_role IS NULL;

CREATE TABLE IF NOT EXISTS superadmin_totp_secrets (
    user_id UUID PRIMARY KEY,
    encrypted_secret TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    last_used_at TIMESTAMPTZ
);

ALTER TABLE impersonation_sessions ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE impersonation_sessions ADD COLUMN IF NOT EXISTS client_ip TEXT;
ALTER TABLE impersonation_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE impersonation_sessions ADD COLUMN IF NOT EXISTS jwt_jti TEXT;
