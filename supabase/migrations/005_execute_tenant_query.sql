-- ============================================================
-- AKARA: execute_tenant_query RPC
-- Migration 005 — run AFTER 001, 002, 003, 004
--
-- Called by backend/app/sql/executor.py on every copilot question.
-- Without this function every POST /copilot/chat returns a 500.
--
-- Security:
--   SECURITY DEFINER — runs as the function owner (superuser), not the caller.
--   Restricted to service_role only via REVOKE/GRANT.
--   SQLGuard in executor.py enforces SELECT-only before this is ever called.
-- ============================================================

CREATE OR REPLACE FUNCTION public.execute_tenant_query(
    p_query  TEXT,
    p_params JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', p_query)
    INTO v_result;
    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_tenant_query(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_tenant_query(TEXT, JSONB) TO service_role;
