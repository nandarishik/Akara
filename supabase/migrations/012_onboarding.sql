-- ============================================================
-- 012_onboarding.sql
-- Sprint Phase 2 — Day 3: Onboarding & Marketing tables
--
-- Adds:
--   • profiles.has_completed_onboarding  boolean column
--   • marketing_emails                   public email-capture (Slot C)
--   • consent_log                        DPDP / GDPR consent evidence
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. profiles — add has_completed_onboarding
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.has_completed_onboarding IS
  'Set to true when the user clicks "Go to my dashboard" on Onboarding step 3. '
  'ProtectedRoute uses this to redirect first-time users back to /onboarding.';

-- ─────────────────────────────────────────────────────────────
-- 2. marketing_emails — landing-page email-capture (Slot C)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketing_emails (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email               TEXT        NOT NULL,
  name                TEXT,
  source              TEXT,                        -- e.g. 'landing_footer', 'landing_hero'
  ip_hash             TEXT,                        -- SHA-256 of IP; never store raw IP
  honeypot_triggered  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique on email so duplicate submissions silently upsert / conflict-ignore.
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_emails_email
  ON public.marketing_emails (email);

COMMENT ON TABLE public.marketing_emails IS
  'Email addresses captured from the landing-page footer (Slot C). '
  'No auth required. Honeypot field is checked server-side; triggered rows are '
  'kept for analysis but never exported for marketing use.';

-- RLS: disable entirely; only service-role writes/reads allowed.
ALTER TABLE public.marketing_emails DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 3. consent_log — DPDP Act 2023 / GDPR consent evidence
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consent_log (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- Version strings match the "last updated" dates of the live documents.
  version_tos     TEXT        NOT NULL,            -- e.g. '2025-01-01'
  version_privacy TEXT        NOT NULL,            -- e.g. '2025-01-01'
  -- Explicit AI-processing consent (DPDP Act 2023 s.7 — separate consent required)
  ai_processing   BOOLEAN     NOT NULL DEFAULT FALSE,
  ip_hash         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_log_user_id
  ON public.consent_log (user_id);

COMMENT ON TABLE public.consent_log IS
  'Immutable record of each user''s consent at signup time. '
  'version_tos and version_privacy record which version of each document was '
  'accepted. ai_processing records the separate DPDP Act 2023 consent. '
  'Rows must never be updated or deleted.';

-- RLS: authenticated users may read their own consent rows.
ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own consent" ON public.consent_log;
CREATE POLICY "Users read own consent"
  ON public.consent_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service-role may insert (done from onboarding.py backend).
-- No INSERT policy for anon/authenticated intentionally.
