-- 024_broadcast_schedule.sql — scheduled broadcasts + body persistence

BEGIN;

ALTER TABLE public.broadcast_history
    ADD COLUMN IF NOT EXISTS body_html TEXT,
    ADD COLUMN IF NOT EXISTS whatsapp_body TEXT,
    ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent';

CREATE INDEX IF NOT EXISTS idx_broadcast_history_scheduled
    ON public.broadcast_history (scheduled_at)
    WHERE status = 'scheduled';

COMMIT;
