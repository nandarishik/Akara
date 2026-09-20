-- Phase 4 migration 032: active_sessions (new table)

CREATE TABLE IF NOT EXISTS public.active_sessions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL,
  session_id   TEXT NOT NULL UNIQUE,
  tenant_id    UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_hint  TEXT,
  ip_address   INET,
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON public.active_sessions (user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_active_sessions_tenant ON public.active_sessions (tenant_id);

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_read_own_sessions ON public.active_sessions;
CREATE POLICY user_read_own_sessions ON public.active_sessions
  FOR SELECT USING (user_id = auth.uid());
