-- Phase 11: recommendations (30-col store + helper primary_item_id)
-- Lunar/ops notes live in festival_calendar / runbook, not here.

CREATE TABLE IF NOT EXISTS public.recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.canonical_locations(id) ON DELETE SET NULL,
    recommendation_type TEXT NOT NULL CHECK (recommendation_type IN (
        'menu_engineering', 'pricing', 'waste', 'promotion', 'operational', 'gst', 'delivery_margin'
    )),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '[]'::JSONB,
    data_range DATERANGE NOT NULL,
    data_freshness TIMESTAMPTZ NOT NULL,
    metric_versions JSONB NOT NULL DEFAULT '{}'::JSONB,
    model_version TEXT NOT NULL,
    playbook_version TEXT NOT NULL,
    confidence_score NUMERIC(3,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
    confidence_methodology TEXT NOT NULL,
    data_days INTEGER,
    expected_impact_min NUMERIC(14,2),
    expected_impact_max NUMERIC(14,2),
    expected_impact_currency TEXT NOT NULL DEFAULT 'INR',
    assumptions JSONB NOT NULL DEFAULT '[]'::JSONB,
    risks JSONB NOT NULL DEFAULT '[]'::JSONB,
    cost_or_effort TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
        'open', 'watching', 'snoozed', 'resolved', 'rejected', 'superseded', 'expired'
    )),
    owner_response TEXT,
    owner_response_at TIMESTAMPTZ,
    snooze_until TIMESTAMPTZ,
    snooze_reason TEXT,
    reject_reason TEXT,
    outcome_measured JSONB,
    outcome_measured_at TIMESTAMPTZ,
    outcome_measurement_due TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    primary_item_id TEXT
);

CREATE INDEX IF NOT EXISTS rec_tenant_status ON public.recommendations (tenant_id, status);
CREATE INDEX IF NOT EXISTS rec_tenant_type ON public.recommendations (tenant_id, recommendation_type, created_at DESC);
CREATE INDEX IF NOT EXISTS rec_outcome_due ON public.recommendations (outcome_measurement_due)
    WHERE status = 'watching' AND outcome_measured IS NULL;
CREATE INDEX IF NOT EXISTS rec_snooze ON public.recommendations (snooze_until)
    WHERE status = 'snoozed';
CREATE UNIQUE INDEX IF NOT EXISTS rec_dedup_open
    ON public.recommendations (tenant_id, recommendation_type, COALESCE(primary_item_id, ''), date_trunc('day', created_at))
    WHERE status = 'open';

DROP TRIGGER IF EXISTS set_recommendations_updated_at ON public.recommendations;
CREATE TRIGGER set_recommendations_updated_at
    BEFORE UPDATE ON public.recommendations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recommendations_tenant_isolation ON public.recommendations;
CREATE POLICY recommendations_tenant_isolation ON public.recommendations
    USING (tenant_id = public.get_my_tenant_id());
DROP POLICY IF EXISTS recommendations_tenant_update ON public.recommendations;
CREATE POLICY recommendations_tenant_update ON public.recommendations
    FOR UPDATE
    USING (tenant_id = public.get_my_tenant_id())
    WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY recommendations_no_client_insert ON public.recommendations
    FOR INSERT
    WITH CHECK (false);
GRANT SELECT, UPDATE ON public.recommendations TO authenticated;
GRANT ALL ON public.recommendations TO service_role;

CREATE OR REPLACE FUNCTION public.recommendations_limit_tenant_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_user = 'service_role' THEN
        RETURN NEW;
    END IF;
    IF NEW.title IS DISTINCT FROM OLD.title
        OR NEW.description IS DISTINCT FROM OLD.description
        OR NEW.evidence IS DISTINCT FROM OLD.evidence
        OR NEW.confidence_score IS DISTINCT FROM OLD.confidence_score
        OR NEW.expected_impact_min IS DISTINCT FROM OLD.expected_impact_min
        OR NEW.expected_impact_max IS DISTINCT FROM OLD.expected_impact_max
        OR NEW.recommendation_type IS DISTINCT FROM OLD.recommendation_type
        OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
        OR NEW.primary_item_id IS DISTINCT FROM OLD.primary_item_id
    THEN
        RAISE EXCEPTION 'tenant may only update recommendation lifecycle columns';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recommendations_limit_tenant_update ON public.recommendations;
CREATE TRIGGER recommendations_limit_tenant_update
    BEFORE UPDATE ON public.recommendations
    FOR EACH ROW
    EXECUTE FUNCTION public.recommendations_limit_tenant_update();
