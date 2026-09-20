-- Rollback 032: drop active_sessions only

DROP POLICY IF EXISTS user_read_own_sessions ON public.active_sessions;
DROP TABLE IF EXISTS public.active_sessions;
