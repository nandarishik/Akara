CREATE TABLE IF NOT EXISTS public.playbook_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    playbook_name TEXT NOT NULL,
    weight NUMERIC(5,4) NOT NULL DEFAULT 1.0,
    calibration_count INTEGER NOT NULL DEFAULT 0,
    last_calibrated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE NULLS NOT DISTINCT (tenant_id, playbook_name)
);

ALTER TABLE public.playbook_weights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS playbook_weights_tenant_isolation ON public.playbook_weights;
CREATE POLICY playbook_weights_tenant_isolation ON public.playbook_weights
    USING (tenant_id IS NULL OR tenant_id = public.get_my_tenant_id());
GRANT ALL ON public.playbook_weights TO service_role;

INSERT INTO public.playbook_weights (tenant_id, playbook_name, weight) VALUES
    (NULL, 'menu_engineering', 1.0),
    (NULL, 'repricing', 1.0),
    (NULL, 'waste_detection', 1.0),
    (NULL, 'gst_optimisation', 1.0),
    (NULL, 'delivery_margin', 1.0),
    (NULL, 'weather_playbook', 1.0),
    (NULL, 'festival_playbook', 1.0)
ON CONFLICT DO NOTHING;
