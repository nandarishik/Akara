-- ============================================================
-- AKARA: Sprint Phase 2 Day 4 delta
-- Migration 014
-- Run AFTER 013_self_signup_profiles.sql
--
-- Adds:
--   • copilot_feedback (GAP 9)
--   • conversations.deleted_at + RPC filter (soft delete)
--   • import_jobs async worker columns (GAP 2)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Copilot feedback (thumbs up / down)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.copilot_feedback (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID        REFERENCES public.conversations(id) ON DELETE SET NULL,
    message_id      TEXT        NOT NULL,
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating          SMALLINT    NOT NULL CHECK (rating IN (1, -1)),
    comment         TEXT,
    question        TEXT        NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copilot_feedback_tenant_id
    ON public.copilot_feedback (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_copilot_feedback_rating
    ON public.copilot_feedback (tenant_id, rating, created_at DESC);

ALTER TABLE public.copilot_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "copilot_feedback_tenant_isolation" ON public.copilot_feedback;
CREATE POLICY "copilot_feedback_tenant_isolation"
    ON public.copilot_feedback FOR ALL
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());

GRANT SELECT, INSERT ON public.copilot_feedback TO service_role;

-- ============================================================
-- 2. Conversation soft delete
-- ============================================================
ALTER TABLE public.conversations
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversations_active_user
    ON public.conversations (user_id, updated_at DESC)
    WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.get_conversations_with_counts(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    title TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    message_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.title,
        c.created_at,
        c.updated_at,
        COALESCE(COUNT(ch.id), 0) AS message_count
    FROM public.conversations c
    LEFT JOIN public.chat_history ch ON ch.conversation_id = c.id
    WHERE c.user_id = p_user_id
      AND c.deleted_at IS NULL
    GROUP BY c.id, c.title, c.created_at, c.updated_at
    ORDER BY c.updated_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_conversations_with_counts(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_conversations_with_counts(UUID) TO service_role;

-- ============================================================
-- 3. Async import_jobs worker support
-- ============================================================
ALTER TABLE public.import_jobs
    ADD COLUMN IF NOT EXISTS storage_path   TEXT,
    ADD COLUMN IF NOT EXISTS worker_id      TEXT,
    ADD COLUMN IF NOT EXISTS heartbeat_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS retry_count    INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS error_message  TEXT,
    ADD COLUMN IF NOT EXISTS completed_at   TIMESTAMPTZ;

ALTER TABLE public.import_jobs
    ALTER COLUMN status SET DEFAULT 'queued';

-- Replace status check to allow async lifecycle
ALTER TABLE public.import_jobs
    DROP CONSTRAINT IF EXISTS import_jobs_status_check;

ALTER TABLE public.import_jobs
    ADD CONSTRAINT import_jobs_status_check
    CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'deleted'));

CREATE INDEX IF NOT EXISTS idx_import_jobs_queued
    ON public.import_jobs (status, created_at ASC)
    WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_import_jobs_processing
    ON public.import_jobs (status, heartbeat_at)
    WHERE status = 'processing';

COMMIT;
