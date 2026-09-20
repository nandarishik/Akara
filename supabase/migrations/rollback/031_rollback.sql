-- Rollback 031: drop NEW columns only. Forbidden: DROP TABLE team_invites.

DROP INDEX IF EXISTS idx_team_invites_token_pending;
DROP INDEX IF EXISTS uq_team_invites_token;

ALTER TABLE public.team_invites DROP COLUMN IF EXISTS token;
ALTER TABLE public.team_invites DROP COLUMN IF EXISTS token_expires_at;
ALTER TABLE public.team_invites DROP COLUMN IF EXISTS revoked_at;
ALTER TABLE public.team_invites DROP COLUMN IF EXISTS revoked_by;
