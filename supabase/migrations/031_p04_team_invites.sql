-- Phase 4 migration 031: additive team_invites columns (table already exists)
-- Do NOT CREATE TABLE team_invites. Do NOT drop reserve_team_invite / uq_team_invites_pending_email.

ALTER TABLE public.team_invites ADD COLUMN IF NOT EXISTS token TEXT;
ALTER TABLE public.team_invites ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
ALTER TABLE public.team_invites ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE public.team_invites ADD COLUMN IF NOT EXISTS revoked_by UUID;

UPDATE public.team_invites SET token = invite_token WHERE token IS NULL;
UPDATE public.team_invites SET token_expires_at = expires_at WHERE token_expires_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_team_invites_token ON public.team_invites (token) WHERE token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_invites_token_pending
  ON public.team_invites (token)
  WHERE accepted_at IS NULL AND revoked_at IS NULL AND status = 'pending';

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
