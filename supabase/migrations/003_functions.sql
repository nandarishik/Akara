-- ============================================================
-- AKARA: Database Functions & Triggers
-- Migration 003
-- Run AFTER migrations 001 and 002
-- ============================================================

-- ============================================================
-- Auto-create profile on new user signup
--
-- When a user signs up via Supabase Auth, this trigger fires
-- and creates a corresponding row in public.profiles.
--
-- The caller (FastAPI /auth/invite or Supabase Admin SDK) MUST
-- pass tenant_id and role in user_metadata when creating the user:
--
--   supabase.auth.admin.create_user({
--     email: "user@example.com",
--     user_metadata: {
--       tenant_id: "uuid-of-tenant",
--       role: "admin",               -- or "user"
--       display_name: "Alice"
--     }
--   })
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, tenant_id, role, display_name)
    VALUES (
        NEW.id,
        (NEW.raw_user_meta_data->>'tenant_id')::UUID,
        COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- get_kpi_summary
-- Returns aggregated KPIs for a given tenant + date range.
-- Called by FastAPI GET /v1/kpi/summary
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_kpi_summary(
    p_tenant_id   UUID,
    p_start_date  DATE,
    p_end_date    DATE
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
    SELECT jsonb_build_object(
        'total_revenue',    COALESCE(SUM(total_amount), 0),
        'total_orders',     COUNT(DISTINCT invoice_number),
        'unique_parties',   COUNT(DISTINCT party_name),
        'avg_order_value',  CASE
                                WHEN COUNT(DISTINCT invoice_number) > 0
                                THEN ROUND(SUM(total_amount) / COUNT(DISTINCT invoice_number), 2)
                                ELSE 0
                            END,
        'total_quantity',   COALESCE(SUM(quantity), 0),
        'total_discount',   COALESCE(SUM(discount_amount), 0),
        'date_range_start', p_start_date,
        'date_range_end',   p_end_date
    )
    INTO v_result
    FROM public.sales_data
    WHERE tenant_id = p_tenant_id
      AND invoice_date BETWEEN p_start_date AND p_end_date;

    RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

-- ============================================================
-- get_top_products
-- Returns top N products by revenue for a tenant + date range.
-- Called by FastAPI GET /v1/kpi/top-products
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_top_products(
    p_tenant_id  UUID,
    p_start_date DATE,
    p_end_date   DATE,
    p_limit      INT DEFAULT 10
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
    SELECT jsonb_agg(row_data ORDER BY revenue DESC)
    INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'product_name', product_name,
            'revenue',      ROUND(SUM(total_amount), 2),
            'quantity',     SUM(quantity),
            'orders',       COUNT(DISTINCT invoice_number)
        ) AS row_data,
        SUM(total_amount) AS revenue
        FROM public.sales_data
        WHERE tenant_id = p_tenant_id
          AND invoice_date BETWEEN p_start_date AND p_end_date
          AND product_name IS NOT NULL
        GROUP BY product_name
        ORDER BY revenue DESC
        LIMIT p_limit
    ) sub;

    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- ============================================================
-- get_zone_breakdown
-- Returns revenue and party count per zone for a tenant + date range.
-- Called by FastAPI GET /v1/kpi/zones
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_zone_breakdown(
    p_tenant_id  UUID,
    p_start_date DATE,
    p_end_date   DATE
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
    SELECT jsonb_agg(row_data ORDER BY revenue DESC)
    INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'zone',           COALESCE(party_zone, 'Unknown'),
            'revenue',        ROUND(SUM(total_amount), 2),
            'unique_parties', COUNT(DISTINCT party_name),
            'orders',         COUNT(DISTINCT invoice_number)
        ) AS row_data,
        SUM(total_amount) AS revenue
        FROM public.sales_data
        WHERE tenant_id = p_tenant_id
          AND invoice_date BETWEEN p_start_date AND p_end_date
        GROUP BY party_zone
        ORDER BY revenue DESC
    ) sub;

    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;
