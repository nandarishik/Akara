-- AKARA: product × zone sales heatmap for Bklit HeatmapChart
CREATE OR REPLACE FUNCTION public.get_sales_heatmap(
  p_tenant_id UUID,
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  zone TEXT,
  product_name TEXT,
  revenue NUMERIC,
  order_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      COALESCE(NULLIF(TRIM(party_zone), ''), 'Unknown') AS zone,
      COALESCE(NULLIF(TRIM(product_name), ''), 'Unknown') AS product_name,
      COALESCE(total_amount, 0)::NUMERIC AS amount,
      invoice_number
    FROM public.sales_data
    WHERE tenant_id = p_tenant_id
      AND invoice_date >= p_start_date
      AND invoice_date <= p_end_date
  ),
  top_products AS (
    SELECT product_name
    FROM filtered
    GROUP BY product_name
    ORDER BY SUM(amount) DESC
    LIMIT 8
  ),
  top_zones AS (
    SELECT zone
    FROM filtered
    GROUP BY zone
    ORDER BY SUM(amount) DESC
    LIMIT 6
  )
  SELECT
    f.zone,
    f.product_name,
    SUM(f.amount) AS revenue,
    COUNT(DISTINCT f.invoice_number)::BIGINT AS order_count
  FROM filtered f
  INNER JOIN top_products tp ON tp.product_name = f.product_name
  INNER JOIN top_zones tz ON tz.zone = f.zone
  GROUP BY f.zone, f.product_name
  ORDER BY revenue DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_heatmap(UUID, DATE, DATE) TO service_role;
