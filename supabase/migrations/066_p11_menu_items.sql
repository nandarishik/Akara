CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    category TEXT,
    current_selling_price NUMERIC(12,2),
    current_cost_price NUMERIC(12,2),
    gst_category TEXT,
    delivery_commission_pct NUMERIC(5,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    price_last_changed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_tenant ON public.menu_items (tenant_id, item_name);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS menu_items_tenant_isolation ON public.menu_items;
CREATE POLICY menu_items_tenant_isolation ON public.menu_items
    USING (tenant_id = public.get_my_tenant_id());
GRANT ALL ON public.menu_items TO service_role;
