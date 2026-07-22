-- ============================================================
-- AKARA: update_tenant_config RPC
-- Migration 006 — run AFTER 005
--
-- Called by PATCH /admin/tenants/{tenant_id}/config.
-- Merges the patch JSON into the existing config column using ||
-- so existing keys (industry, currency, etc.) are NOT overwritten
-- unless explicitly included in the patch.
--
-- Example call:
--   PATCH /admin/tenants/<id>/config   body: {"language": "te"}
--   Result: config = old_config || {"language": "te"}
--
-- Security:
--   SECURITY DEFINER — runs as function owner (superuser).
--   Restricted to service_role only.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_tenant_config(
    p_tenant_id UUID,
    p_patch     JSONB
)
RETURNS SETOF public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    UPDATE public.tenants
    SET    config = config || p_patch,
           updated_at = NOW()
    WHERE  id = p_tenant_id
    RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.update_tenant_config(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_tenant_config(UUID, JSONB) TO service_role;
