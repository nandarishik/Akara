-- Day 10: Omnipotence GAP 1–4 — plan catalog, billing ledger, CMS, legal/consent

BEGIN;

-- ---------------------------------------------------------------------------
-- GAP 1: Dynamic plan catalog
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_catalog (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code                    TEXT UNIQUE NOT NULL,
    display_name            TEXT NOT NULL,
    description             TEXT NOT NULL DEFAULT '',
    currency                TEXT NOT NULL DEFAULT 'INR',
    monthly_price_minor     BIGINT NOT NULL DEFAULT 0 CHECK (monthly_price_minor >= 0),
    annual_price_minor      BIGINT CHECK (annual_price_minor >= 0),
    razorpay_monthly_plan_id TEXT,
    razorpay_annual_plan_id  TEXT,
    entitlements            JSONB NOT NULL DEFAULT '{}',
    limits                  JSONB NOT NULL DEFAULT '{}',
    cta_label               TEXT NOT NULL DEFAULT '',
    is_public               BOOLEAN NOT NULL DEFAULT FALSE,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order              INT NOT NULL DEFAULT 0,
    draft_limits            JSONB,
    draft_entitlements      JSONB,
    draft_monthly_price_minor BIGINT,
    draft_annual_price_minor  BIGINT,
    version                 INT NOT NULL DEFAULT 1,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.plan_assignments (
    tenant_id           UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_code           TEXT NOT NULL REFERENCES public.plan_catalog(code),
    custom_limits       JSONB NOT NULL DEFAULT '{}',
    custom_price_minor  BIGINT,
    source              TEXT NOT NULL CHECK (source IN ('razorpay','manual','contract','promotion')),
    effective_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until     TIMESTAMPTZ,
    notes               TEXT NOT NULL DEFAULT '',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- GAP 2: Billing ledger + coupons
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_ledger_entries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    entry_type      TEXT NOT NULL CHECK (entry_type IN (
        'payment','refund','credit','write_off','manual_payment','invoice_void'
    )),
    amount_minor    BIGINT NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'INR',
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending','confirmed','failed','reversed'
    )),
    provider_ref    TEXT,
    invoice_id      UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    idempotency_key TEXT UNIQUE,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_ledger_tenant ON public.billing_ledger_entries (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_ledger_type ON public.billing_ledger_entries (entry_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.billing_coupons (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    discount_type   TEXT NOT NULL CHECK (discount_type IN ('percent','fixed')),
    discount_value  BIGINT NOT NULL CHECK (discount_value > 0),
    duration        TEXT NOT NULL DEFAULT 'once' CHECK (duration IN ('once','repeating','forever')),
    max_redemptions INT,
    redemption_count INT NOT NULL DEFAULT 0,
    eligible_plans  TEXT[] NOT NULL DEFAULT '{}',
    first_time_only BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at      TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billing_promotion_codes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id   UUID NOT NULL REFERENCES public.billing_coupons(id) ON DELETE CASCADE,
    code        TEXT UNIQUE NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- GAP 3: CMS, media, placements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_entries (
    key             TEXT NOT NULL,
    locale          TEXT NOT NULL DEFAULT 'en-IN',
    draft_value     JSONB NOT NULL DEFAULT '{}',
    published_value JSONB,
    version         INT NOT NULL DEFAULT 1,
    updated_by      UUID,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at    TIMESTAMPTZ,
    scheduled_at    TIMESTAMPTZ,
    PRIMARY KEY (key, locale)
);

CREATE TABLE IF NOT EXISTS public.media_assets (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    storage_path TEXT UNIQUE NOT NULL,
    public_url   TEXT NOT NULL,
    kind         TEXT NOT NULL CHECK (kind IN ('image','video','document','logo','og_image')),
    alt_text     TEXT NOT NULL,
    width        INT,
    height       INT,
    bytes        BIGINT,
    mime_type    TEXT,
    created_by   UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.placement_slots (
    key             TEXT PRIMARY KEY,
    kind            TEXT NOT NULL CHECK (kind IN ('demo','promotion','partner','announcement')),
    draft_content   JSONB NOT NULL DEFAULT '{}',
    published_content JSONB,
    audience_rules  JSONB NOT NULL DEFAULT '{}',
    starts_at       TIMESTAMPTZ,
    ends_at         TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    version         INT NOT NULL DEFAULT 1,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at    TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- GAP 4: Legal documents + consent
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_versions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_key            TEXT NOT NULL,
    version                 TEXT NOT NULL,
    title                   TEXT NOT NULL,
    body_markdown           TEXT NOT NULL,
    effective_at            TIMESTAMPTZ NOT NULL,
    requires_reacceptance   BOOLEAN NOT NULL DEFAULT FALSE,
    published_by            UUID,
    published_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_published            BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (document_key, version)
);
CREATE INDEX IF NOT EXISTS idx_document_versions_key ON public.document_versions (document_key, effective_at DESC);

CREATE TABLE IF NOT EXISTS public.user_consents (
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_key    TEXT NOT NULL,
    version         TEXT NOT NULL,
    accepted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_hash         TEXT,
    user_agent      TEXT,
    PRIMARY KEY (user_id, document_key, version)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.plan_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_promotion_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Superadmin full access via service role; authenticated read for published data
CREATE POLICY plan_catalog_read ON public.plan_catalog FOR SELECT USING (true);
CREATE POLICY plan_assignments_read ON public.plan_assignments FOR SELECT USING (true);
CREATE POLICY content_entries_read ON public.content_entries FOR SELECT USING (true);
CREATE POLICY placement_slots_read ON public.placement_slots FOR SELECT USING (true);
CREATE POLICY document_versions_read ON public.document_versions FOR SELECT USING (is_published = true);
CREATE POLICY user_consents_own ON public.user_consents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_consents_insert ON public.user_consents FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Seed plan catalog from canonical limits
-- ---------------------------------------------------------------------------
INSERT INTO public.plan_catalog (
    code, display_name, description, monthly_price_minor, annual_price_minor,
    entitlements, limits, cta_label, is_public, is_active, sort_order
) VALUES
(
    'free', 'Free', 'Get started with AKARA', 0, 0,
    '{"features":{"morning_brief":false,"scheme_leakage":false,"simulator":false,"reports":false,"custom_language":false,"secondary_sales":false,"api_push":false,"tally_connector":false,"team_invites":false,"api_keys":false,"ask_copilot_debrief":false,"alerts":false}}'::jsonb,
    '{"copilot_calls_per_month":10,"rows_total":10000,"uploads_per_month":5,"uploads_per_day":3,"undos_per_day":2,"users":1,"alerts_max":0,"weekly_debriefs_lifetime":1,"daily_briefs":false,"retention_days":30,"data_sources":["csv"]}'::jsonb,
    'Start free →', true, true, 0
),
(
    'pro', 'Pro', 'For growing distributors', 799900, 7679000,
    '{"features":{"morning_brief":true,"scheme_leakage":false,"simulator":true,"reports":true,"custom_language":true,"secondary_sales":true,"api_push":true,"tally_connector":false,"team_invites":true,"api_keys":false,"ask_copilot_debrief":true,"alerts":true}}'::jsonb,
    '{"copilot_calls_per_month":400,"rows_total":500000,"uploads_per_month":-1,"uploads_per_day":3,"undos_per_day":2,"users":3,"alerts_max":5,"weekly_debriefs_lifetime":-1,"daily_briefs":true,"retention_days":365,"data_sources":["csv","secondary_sales","scheme_master","api"]}'::jsonb,
    'Upgrade to Pro →', true, true, 1
),
(
    'business', 'Business', 'For enterprise distribution teams', 1399900, 13439000,
    '{"features":{"morning_brief":true,"scheme_leakage":true,"simulator":true,"reports":true,"custom_language":true,"secondary_sales":true,"api_push":true,"tally_connector":true,"team_invites":true,"api_keys":true,"ask_copilot_debrief":true,"alerts":true}}'::jsonb,
    '{"copilot_calls_per_month":800,"rows_total":2000000,"uploads_per_month":-1,"uploads_per_day":3,"undos_per_day":2,"users":10,"alerts_max":-1,"weekly_debriefs_lifetime":-1,"daily_briefs":true,"retention_days":1095,"data_sources":["csv","secondary_sales","scheme_master","api","tally"]}'::jsonb,
    'Upgrade to Business →', true, true, 2
)
ON CONFLICT (code) DO NOTHING;

-- Seed landing content keys
INSERT INTO public.content_entries (key, locale, draft_value, published_value, published_at) VALUES
('landing.hero.title', 'en-IN', '{"text":"Your distribution data, finally answering back."}'::jsonb, '{"text":"Your distribution data, finally answering back."}'::jsonb, NOW()),
('landing.hero.subtitle', 'en-IN', '{"text":"Ask questions in plain English. Get answers from your sales data in seconds."}'::jsonb, '{"text":"Ask questions in plain English. Get answers from your sales data in seconds."}'::jsonb, NOW()),
('landing.faqs', 'en-IN', '{"items":[]}'::jsonb, '{"items":[]}'::jsonb, NOW()),
('landing.seo.title', 'en-IN', '{"text":"AKARA — AI Copilot for Indian Distributors"}'::jsonb, '{"text":"AKARA — AI Copilot for Indian Distributors"}'::jsonb, NOW())
ON CONFLICT (key, locale) DO NOTHING;

-- Seed legal v1.0
INSERT INTO public.document_versions (document_key, version, title, body_markdown, effective_at, requires_reacceptance, is_published) VALUES
('terms', '1.0', 'Terms of Service', '# Terms of Service\n\nVersion 1.0 — Use of AKARA is subject to these terms.', NOW(), false, true),
('privacy', '1.0', 'Privacy Policy', '# Privacy Policy\n\nVersion 1.0 — We process your data in accordance with applicable law.', NOW(), false, true),
('changelog', '1.0', 'What''s New', '# Welcome to AKARA\n\nInitial release.', NOW(), false, true)
ON CONFLICT (document_key, version) DO NOTHING;

COMMIT;
