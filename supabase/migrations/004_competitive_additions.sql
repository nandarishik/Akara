-- ============================================================
-- AKARA: Competitive Additions
-- Migration 004 — run AFTER 001, 002, 003
--
-- 1. outstanding_amount column on sales_data
-- 2. secondary_sales_data table  (DMS offtake)
-- 3. scheme_master table         (distributor scheme claims)
-- 4. RLS policies for 2 + 3
-- 5. get_route_performance()
-- 6. get_outstanding_parties()
-- 7. get_scheme_leakage()
-- ============================================================


-- ============================================================
-- 1. outstanding_amount on sales_data
-- ============================================================
ALTER TABLE public.sales_data
    ADD COLUMN IF NOT EXISTS outstanding_amount NUMERIC(15, 2);

CREATE INDEX IF NOT EXISTS idx_sales_data_outstanding
    ON public.sales_data (tenant_id, outstanding_amount);


-- ============================================================
-- 2. secondary_sales_data
-- ============================================================
CREATE TABLE IF NOT EXISTS public.secondary_sales_data (
    id               BIGSERIAL    PRIMARY KEY,
    tenant_id        UUID         NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_date     DATE         NOT NULL,
    invoice_number   TEXT,
    party_name       TEXT,
    party_city       TEXT,
    party_zone       TEXT,
    route            TEXT,
    product_name     TEXT,
    product_group    TEXT,
    product_category TEXT,
    quantity         NUMERIC(12, 3),
    gross_amount     NUMERIC(15, 2),
    discount_amount  NUMERIC(15, 2),
    net_amount       NUMERIC(15, 2),
    total_amount     NUMERIC(15, 2),
    data_source      TEXT,
    raw_data         JSONB,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_secondary_sales_tenant_id
    ON public.secondary_sales_data (tenant_id);
CREATE INDEX IF NOT EXISTS idx_secondary_sales_invoice_date
    ON public.secondary_sales_data (invoice_date);
CREATE INDEX IF NOT EXISTS idx_secondary_sales_party_name
    ON public.secondary_sales_data (party_name);
CREATE INDEX IF NOT EXISTS idx_secondary_sales_tenant_date
    ON public.secondary_sales_data (tenant_id, invoice_date);


-- ============================================================
-- 3. scheme_master
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scheme_master (
    id               BIGSERIAL    PRIMARY KEY,
    tenant_id        UUID         NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    scheme_name      TEXT         NOT NULL,
    party_name       TEXT         NOT NULL,
    product_name     TEXT,
    claimed_amount   NUMERIC(15, 2) NOT NULL DEFAULT 0,
    scheme_start     DATE,
    scheme_end       DATE,
    discount_pct     NUMERIC(6, 3),
    raw_data         JSONB,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheme_master_tenant_id
    ON public.scheme_master (tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheme_master_party_name
    ON public.scheme_master (tenant_id, party_name);
CREATE INDEX IF NOT EXISTS idx_scheme_master_dates
    ON public.scheme_master (tenant_id, scheme_start, scheme_end);


-- ============================================================
-- 4. RLS — secondary_sales_data
-- ============================================================
ALTER TABLE public.secondary_sales_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "secondary_sales_select"       ON public.secondary_sales_data;
DROP POLICY IF EXISTS "secondary_sales_insert_admin" ON public.secondary_sales_data;
DROP POLICY IF EXISTS "secondary_sales_delete_admin" ON public.secondary_sales_data;

CREATE POLICY "secondary_sales_select"
    ON public.secondary_sales_data FOR SELECT
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "secondary_sales_insert_admin"
    ON public.secondary_sales_data FOR INSERT
    WITH CHECK (tenant_id = public.get_my_tenant_id() AND public.is_admin());

CREATE POLICY "secondary_sales_delete_admin"
    ON public.secondary_sales_data FOR DELETE
    USING (tenant_id = public.get_my_tenant_id() AND public.is_admin());


-- ============================================================
-- 5. RLS — scheme_master
-- ============================================================
ALTER TABLE public.scheme_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheme_master_select"       ON public.scheme_master;
DROP POLICY IF EXISTS "scheme_master_insert_admin" ON public.scheme_master;
DROP POLICY IF EXISTS "scheme_master_delete_admin" ON public.scheme_master;

CREATE POLICY "scheme_master_select"
    ON public.scheme_master FOR SELECT
    USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "scheme_master_insert_admin"
    ON public.scheme_master FOR INSERT
    WITH CHECK (tenant_id = public.get_my_tenant_id() AND public.is_admin());

CREATE POLICY "scheme_master_delete_admin"
    ON public.scheme_master FOR DELETE
    USING (tenant_id = public.get_my_tenant_id() AND public.is_admin());


-- ============================================================
-- 6. get_route_performance
-- Returns top routes by revenue + order count for a tenant+date range.
-- Same function signature style as get_kpi_summary in migration 003.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_route_performance(
    p_tenant_id  UUID,
    p_start_date DATE,
    p_end_date   DATE,
    p_limit      INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(row_data ORDER BY revenue DESC NULLS LAST)
    INTO   v_result
    FROM (
        SELECT
            jsonb_build_object(
                'route',           COALESCE(route, 'Unknown'),
                'revenue',         ROUND(SUM(total_amount)::NUMERIC, 2),
                'order_count',     COUNT(DISTINCT invoice_number),
                'unique_parties',  COUNT(DISTINCT party_name),
                'avg_order_value', CASE
                                       WHEN COUNT(DISTINCT invoice_number) > 0
                                       THEN ROUND(
                                                SUM(total_amount)::NUMERIC
                                                / COUNT(DISTINCT invoice_number)::NUMERIC,
                                                2
                                            )
                                       ELSE 0::NUMERIC
                                   END
            ) AS row_data,
            SUM(total_amount) AS revenue
        FROM public.sales_data
        WHERE tenant_id    = p_tenant_id
          AND invoice_date BETWEEN p_start_date AND p_end_date
          AND route        IS NOT NULL
          AND route        <> ''
        GROUP BY route
        ORDER BY revenue DESC NULLS LAST
        LIMIT p_limit
    ) sub;

    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;


-- ============================================================
-- 7. get_outstanding_parties
-- Returns parties with outstanding receivables > 0, ordered by amount.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_outstanding_parties(
    p_tenant_id UUID,
    p_limit     INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(row_data ORDER BY outstanding DESC NULLS LAST)
    INTO   v_result
    FROM (
        SELECT
            jsonb_build_object(
                'party_name',         party_name,
                'party_zone',         MAX(party_zone),
                'outstanding_amount', ROUND(SUM(outstanding_amount)::NUMERIC, 2),
                'invoice_count',      COUNT(*)
            ) AS row_data,
            SUM(outstanding_amount) AS outstanding
        FROM public.sales_data
        WHERE tenant_id          = p_tenant_id
          AND outstanding_amount IS NOT NULL
          AND outstanding_amount  > 0
        GROUP BY party_name
        ORDER BY outstanding DESC NULLS LAST
        LIMIT p_limit
    ) sub;

    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;


-- ============================================================
-- 8. get_scheme_leakage
-- Joins scheme_master vs secondary_sales_data to find distributors
-- whose claimed_amount exceeds their actual secondary offtake.
-- Uses a CTE so the aggregate is computed once and reused in HAVING.
-- Guards against NULL scheme dates (skips rows without a date window).
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
