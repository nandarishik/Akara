CREATE TABLE IF NOT EXISTS public.recommendation_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    recommendation_id UUID NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'in_app')),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivery_status TEXT DEFAULT 'sent'
);

ALTER TABLE public.recommendation_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recommendation_notifications_tenant_isolation ON public.recommendation_notifications;
CREATE POLICY recommendation_notifications_tenant_isolation ON public.recommendation_notifications
    USING (tenant_id = public.get_my_tenant_id());
GRANT ALL ON public.recommendation_notifications TO service_role;
