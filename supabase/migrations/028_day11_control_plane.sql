-- Day 11: safe Data Studio, Query Console, runbooks, AI controls, templates.
-- Forward-only. The dedicated query role is created NOLOGIN intentionally; set a
-- secret and LOGIN only in the environment's secret-management workflow.
BEGIN;

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.data_studio_saved_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    definition JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_data_studio_views_updated ON public.data_studio_saved_views (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.saved_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    sql TEXT NOT NULL,
    parameters TEXT[] NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.query_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID,
    reason TEXT NOT NULL,
    sql_hash TEXT NOT NULL,
    duration_ms NUMERIC,
    row_count INTEGER NOT NULL DEFAULT 0,
    tenant_scope UUID,
    status TEXT NOT NULL CHECK (status IN ('succeeded','failed','cancelled','timeout')),
    error_message TEXT,
    fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
    exported_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_query_executions_created ON public.query_executions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_executions_actor ON public.query_executions (actor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.runbook_definitions (
    name TEXT PRIMARY KEY,
    version INTEGER NOT NULL DEFAULT 1,
    purpose TEXT NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}',
    permission TEXT NOT NULL,
    max_rows INTEGER NOT NULL,
    rollback_notes TEXT NOT NULL,
    reversible BOOLEAN NOT NULL DEFAULT FALSE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.runbook_executions (
    id UUID PRIMARY KEY,
    runbook_name TEXT NOT NULL REFERENCES public.runbook_definitions(name),
    version INTEGER NOT NULL DEFAULT 1,
    parameters JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','cancelled','dry_run')),
    actor_id UUID,
    reason TEXT NOT NULL,
    max_rows INTEGER NOT NULL,
    affected_rows INTEGER,
    reversible BOOLEAN NOT NULL DEFAULT FALSE,
    rollback_notes TEXT NOT NULL,
    failure_state JSONB,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_runbook_exec_created ON public.runbook_executions (created_at DESC);

INSERT INTO public.runbook_definitions (name, purpose, parameters, permission, max_rows, rollback_notes, reversible)
VALUES
 ('rebuild_tenant_metrics','Rebuild derived metrics for one tenant','{"tenant_id":"uuid"}','runbooks:metrics',1000000,'rebuild from source tables',true),
 ('requeue_failed_import','Put one failed import back on the worker queue','{"import_job_id":"uuid"}','runbooks:imports',1,'cancel the queued job',true),
 ('reconcile_stripe_subscription','Reconcile a subscription with the billing provider','{"tenant_id":"uuid"}','runbooks:billing',1,'not_reversible: provider state is external',false),
 ('recalculate_usage_month','Recalculate one tenant usage month','{"tenant_id":"uuid","month":"YYYY-MM"}','runbooks:usage',1,'restore prior counter snapshot',true),
 ('revoke_all_tenant_sessions','Revoke every active session for a tenant','{"tenant_id":"uuid"}','runbooks:sessions',100000,'not_reversible: sessions cannot be restored',false),
 ('repair_missing_profile','Create or repair a missing tenant profile','{"user_id":"uuid","tenant_id":"uuid","role":"owner|admin|member"}','runbooks:profiles',1,'delete only the newly-created profile',true),
 ('regenerate_invoice','Regenerate an invoice PDF and ledger link','{"invoice_id":"uuid"}','runbooks:billing',1,'not_reversible: financial document evidence is retained',false),
 ('purge_expired_exports','Permanently remove expired account exports','{"before":"datetime"}','runbooks:exports',100000,'not_reversible: expired exports are deleted',false)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.llm_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    user_id UUID,
    feature TEXT NOT NULL,
    prompt_version_id UUID,
    model TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'openrouter',
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms NUMERIC,
    estimated_cost_usd NUMERIC,
    status TEXT NOT NULL,
    provider_error TEXT,
    tool_calls JSONB NOT NULL DEFAULT '[]',
    sql_fingerprint TEXT,
    redaction_summary JSONB NOT NULL DEFAULT '{}',
    quality_feedback JSONB,
    is_test_traffic BOOLEAN NOT NULL DEFAULT FALSE,
    excluded_from_quota BOOLEAN NOT NULL DEFAULT FALSE,
    replayed_from UUID,
    raw_prompt TEXT,
    raw_response TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_llm_requests_created ON public.llm_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_requests_tenant ON public.llm_requests (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.prompt_definitions (
    prompt_key TEXT PRIMARY KEY,
    published_version_id UUID,
    routing JSONB NOT NULL DEFAULT '{}',
    updated_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.prompt_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_key TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    content TEXT NOT NULL,
    model TEXT,
    status TEXT NOT NULL CHECK (status IN ('draft','published','archived')),
    regression_set JSONB NOT NULL DEFAULT '[]',
    created_by UUID,
    published_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(prompt_key, version)
);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_key ON public.prompt_versions (prompt_key, created_at DESC);
CREATE TABLE IF NOT EXISTS public.ai_routing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rules JSONB NOT NULL DEFAULT '{}',
    updated_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.ai_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    global_monthly_usd NUMERIC NOT NULL DEFAULT 0,
    per_tenant_monthly_usd NUMERIC NOT NULL DEFAULT 0,
    kill_switch BOOLEAN NOT NULL DEFAULT FALSE,
    circuit_breakers JSONB NOT NULL DEFAULT '{}',
    updated_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.message_templates (
    key TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('email','whatsapp','in_app')),
    locale TEXT NOT NULL DEFAULT 'en-IN',
    draft JSONB NOT NULL DEFAULT '{}',
    published JSONB,
    allowed_variables TEXT[] NOT NULL DEFAULT '{}',
    required_variables TEXT[] NOT NULL DEFAULT '{}',
    fallback_channel TEXT CHECK (fallback_channel IN ('email','whatsapp','in_app')),
    quiet_hours JSONB NOT NULL DEFAULT '{}',
    unsubscribe_category TEXT,
    provider_approval_status TEXT NOT NULL DEFAULT 'not_required',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','suppressed')),
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    updated_by UUID,
    published_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    PRIMARY KEY (key, channel, locale)
);
CREATE TABLE IF NOT EXISTS public.message_template_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL,
    channel TEXT NOT NULL,
    locale TEXT NOT NULL,
    version INTEGER NOT NULL,
    payload JSONB NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(key, channel, locale, version)
);
CREATE TABLE IF NOT EXISTS public.delivery_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    template_key TEXT NOT NULL,
    template_version INTEGER,
    recipient_hash TEXT,
    recipient_masked TEXT,
    provider TEXT,
    status TEXT NOT NULL CHECK (status IN ('accepted','delivered','opened','clicked','bounced','failed','retrying','suppressed')),
    provider_response_id TEXT,
    error_details TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    is_test BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_delivery_events_created ON public.delivery_events (created_at DESC);

-- Checked-in communication contract represented in the database from day one.
-- Draft payloads intentionally stay small; operators can replace them through
-- the Templates screen and publish only after variable/provider validation.
INSERT INTO public.message_templates
    (key, channel, locale, draft, allowed_variables, required_variables, provider_approval_status)
VALUES
 ('E1','email','en-IN','{"subject":"Verify your email - AKARA","html":"Welcome to AKARA. Verify here: {{verify_url}}"}',ARRAY['verify_url'],ARRAY['verify_url'],'not_required'),
 ('E2','email','en-IN','{"subject":"Reset your AKARA password","html":"Reset your password: {{reset_url}}"}',ARRAY['reset_url'],ARRAY['reset_url'],'not_required'),
 ('E3','email','en-IN','{"subject":"AKARA Weekly - {{company_name}}","html":"Revenue {{revenue}}. Dashboard: {{dashboard_url}}"}',ARRAY['company_name','revenue','dashboard_url'],ARRAY['company_name','revenue','dashboard_url'],'not_required'),
 ('E4','email','en-IN','{"subject":"Good morning - {{date}}","html":"{{company_name}} brief. {{dashboard_url}}"}',ARRAY['date','company_name','dashboard_url'],ARRAY['date','company_name','dashboard_url'],'not_required'),
 ('E5','email','en-IN','{"subject":"AKARA payment failed","html":"{{plan}} payment of {{amount}} failed. {{billing_url}}"}',ARRAY['plan','amount','billing_url'],ARRAY['plan','amount','billing_url'],'not_required'),
 ('E6','email','en-IN','{"subject":"Payment received - AKARA {{amount}}","html":"Invoice {{invoice_number}}: {{invoice_url}}"}',ARRAY['amount','invoice_number','invoice_url'],ARRAY['amount','invoice_number','invoice_url'],'not_required'),
 ('E7','email','en-IN','{"subject":"Your AKARA plan has changed","html":"You are now on {{plan}}. {{upgrade_url}}"}',ARRAY['plan','upgrade_url'],ARRAY['plan','upgrade_url'],'not_required'),
 ('E8','email','en-IN','{"subject":"Ready to see your sales data?","html":"Import your first file: {{data_url}}"}',ARRAY['data_url'],ARRAY['data_url'],'not_required'),
 ('E9','email','en-IN','{"subject":"Need help importing your data?","html":"Reply to {{support_email}}"}',ARRAY['support_email'],ARRAY['support_email'],'not_required'),
 ('E10','email','en-IN','{"subject":"Running low on AI questions","html":"{{used}} of {{limit}} used. {{upgrade_url}}"}',ARRAY['used','limit','upgrade_url'],ARRAY['used','limit','upgrade_url'],'not_required'),
 ('E11','email','en-IN','{"subject":"{{inviter_name}} invited you","html":"{{company_name}} invite: {{invite_url}}"}',ARRAY['inviter_name','company_name','invite_url'],ARRAY['inviter_name','company_name','invite_url'],'not_required'),
 ('W1','whatsapp','en-IN','{"body":"{{company_name}} - Week of {{week_of}}. Revenue {{revenue}} ({{revenue_change}}). Best zone {{top_zone}}. {{alert_count}} alerts. {{action_1}} / {{action_2}} / {{action_3}}"}',ARRAY['company_name','week_of','revenue','revenue_change','top_zone','alert_count','outstanding','party_count','action_1','action_2','action_3'],ARRAY['company_name','week_of','revenue','revenue_change','top_zone','alert_count','action_1','action_2','action_3'],'pending'),
 ('W2','whatsapp','en-IN','{"body":"Morning brief {{date}}: {{yesterday_revenue}} revenue, {{order_count}} orders, {{trend_arrow}} {{trend_pct}}. {{focus_metric}}"}',ARRAY['date','yesterday_revenue','order_count','trend_arrow','trend_pct','focus_metric'],ARRAY['date','yesterday_revenue','order_count','trend_arrow','trend_pct','focus_metric'],'pending'),
 ('W3','whatsapp','en-IN','{"body":"Alert {{alert_name}}: {{alert_message}} ({{triggered_at}})"}',ARRAY['alert_name','alert_message','triggered_at'],ARRAY['alert_name','alert_message','triggered_at'],'pending'),
 ('W4','whatsapp','en-IN','{"body":"Welcome to {{plan_name}}. {{copilot_calls}} AI questions/month and {{users}} seats."}',ARRAY['plan_name','copilot_calls','users'],ARRAY['plan_name','copilot_calls','users'],'pending')
 ,('in_app.weekly_debrief','in_app','en-IN','{"headline":"{{headline}}","body":"{{body}}","deep_link":"{{deep_link}}"}',ARRAY['headline','body','deep_link'],ARRAY['headline','body','deep_link'],'not_required')
ON CONFLICT (key, channel, locale) DO NOTHING;

-- All Day 11 records are backend-owned. Authenticated browser clients receive
-- data only through the server's superadmin routes (service role + sudo/CSRF).
ALTER TABLE public.data_studio_saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runbook_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runbook_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'akara_query_readonly') THEN
        CREATE ROLE akara_query_readonly NOLOGIN;
    END IF;
END $$;
ALTER ROLE akara_query_readonly SET statement_timeout = '10s';
REVOKE ALL ON SCHEMA auth, storage FROM akara_query_readonly;
REVOKE ALL ON ALL TABLES IN SCHEMA auth, storage FROM akara_query_readonly;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM akara_query_readonly;
GRANT USAGE ON SCHEMA public TO akara_query_readonly;
GRANT SELECT ON public.tenants, public.profiles, public.sales_data, public.secondary_sales_data,
    public.scheme_master, public.import_jobs, public.usage_tracking, public.invoices,
    public.delivery_logs, public.copilot_feedback, public.generated_reports,
    public.tenant_alerts, public.alert_trigger_events, public.user_events,
    public.user_consents, public.llm_cost_log, public.llm_requests TO akara_query_readonly;

COMMIT;
