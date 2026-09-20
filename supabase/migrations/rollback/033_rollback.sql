ALTER TABLE impersonation_sessions DROP COLUMN IF EXISTS jwt_jti;
ALTER TABLE impersonation_sessions DROP COLUMN IF EXISTS user_agent;
ALTER TABLE impersonation_sessions DROP COLUMN IF EXISTS client_ip;
ALTER TABLE impersonation_sessions DROP COLUMN IF EXISTS reason;
DROP TABLE IF EXISTS superadmin_totp_secrets;
ALTER TABLE profiles DROP COLUMN IF EXISTS superadmin_role;
