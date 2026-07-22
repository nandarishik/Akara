-- ============================================================
-- AKARA: get_scheme_leakage RPC
-- Migration 009 — run AFTER 008
--
-- Joins scheme_master vs secondary_sales_data to find distributors
-- whose claimed_amount exceeds their actual secondary offtake.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_scheme_leakage(p_tenant_id UUID)
RETURNS TABLE (
    party_name      TEXT,
    scheme_name     TEXT,
    product_name    TEXT,
    claimed_amount  NUMERIC,
    actual_offtake  NUMERIC,
    leakage_amount  NUMERIC,
    scheme_start    DATE,
    scheme_end      DATE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH aggregated AS (
        SELECT
            sm.party_name                                                    AS party_name,
            sm.scheme_name                                                   AS scheme_name,
            sm.product_name                                                  AS product_name,
            sm.claimed_amount                                                AS claimed_amount,
            COALESCE(SUM(ss.total_amount), 0::NUMERIC)                       AS actual_offtake,
            sm.scheme_start                                                  AS scheme_start,
            sm.scheme_end                                                    AS scheme_end
        FROM public.scheme_master sm
        LEFT JOIN public.secondary_sales_data ss
               ON  ss.tenant_id    = sm.tenant_id
               AND ss.party_name   = sm.party_name
               AND ss.product_name = sm.product_name
               AND sm.scheme_start IS NOT NULL
               AND sm.scheme_end   IS NOT NULL
               AND ss.invoice_date BETWEEN sm.scheme_start AND sm.scheme_end
        WHERE sm.tenant_id      = p_tenant_id
          AND sm.claimed_amount > 0
        GROUP BY
            sm.party_name,
            sm.scheme_name,
            sm.product_name,
            sm.claimed_amount,
            sm.scheme_start,
            sm.scheme_end
    )
    SELECT
        a.party_name,
        a.scheme_name,
        a.product_name,
        a.claimed_amount,
        a.actual_offtake,
        GREATEST(a.claimed_amount - a.actual_offtake, 0::NUMERIC) AS leakage_amount,
        a.scheme_start,
        a.scheme_end
    FROM aggregated a
    WHERE a.claimed_amount > a.actual_offtake
    ORDER BY leakage_amount DESC NULLS LAST;
END;
$$;
