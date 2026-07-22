-- ============================================================
-- AKARA: Initial Schema
-- Migration 001
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- tenants
-- One row per customer organisation (e.g. one FMCG distributor)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenants (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT        NOT NULL,
    slug        TEXT        NOT NULL UNIQUE,
    config      JSONB       NOT NULL DEFAULT '{}',
    -- config shape:
    -- {
    --   "company_name": "Bajaj Consumer Care",
    --   "industry": "fmcg_distribution",
    --   "primary_table": "sales_data",
    --   "column_mappings": {
    --     "revenue": "total_amount",
    --     "date": "invoice_date",
    --     "customer": "party_name",
    --     "product": "product_name",
    --     "region": "party_zone"
    --   },
    --   "business_terms": { "customer": "distributor party", "region": "zone" }
    -- }
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug      ON public.tenants (slug);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON public.tenants (is_active);

-- ============================================================
-- profiles
-- Extends auth.users — created automatically via trigger (migration 003)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role         TEXT        NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
    display_name TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role      ON public.profiles (role);

-- ============================================================
-- sales_data
-- Core transactional data — one row per invoice line item
-- Migrated from SQLite VIEW_AI_SALES (40,236 rows for Bajaj)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sales_data (
    id               BIGSERIAL   PRIMARY KEY,
    tenant_id        UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_date     DATE        NOT NULL,
    invoice_number   TEXT,
    party_name       TEXT,
    party_city       TEXT,
    party_zone       TEXT,
    route            TEXT,
    product_name     TEXT,
    product_group    TEXT,
    product_category TEXT,
    hsn_code         TEXT,
    quantity         NUMERIC(12, 3),
    gross_amount     NUMERIC(15, 2),
    discount_amount  NUMERIC(15, 2),
    net_amount       NUMERIC(15, 2),
    tax_amount       NUMERIC(15, 2),
    total_amount     NUMERIC(15, 2),
    raw_data         JSONB,
    -- raw_data stores any extra columns not explicitly mapped above
    -- used for non-FMCG tenants with different schemas
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_data_tenant_id    ON public.sales_data (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_data_invoice_date ON public.sales_data (invoice_date);
CREATE INDEX IF NOT EXISTS idx_sales_data_party_name   ON public.sales_data (party_name);
CREATE INDEX IF NOT EXISTS idx_sales_data_party_zone   ON public.sales_data (party_zone);
CREATE INDEX IF NOT EXISTS idx_sales_data_product_name ON public.sales_data (product_name);
CREATE INDEX IF NOT EXISTS idx_sales_data_tenant_date  ON public.sales_data (tenant_id, invoice_date);
CREATE INDEX IF NOT EXISTS idx_sales_data_tenant_zone  ON public.sales_data (tenant_id, party_zone);

-- ============================================================
-- context_cache
-- Weather, news, holiday data fetched by the copilot
-- ============================================================
CREATE TABLE IF NOT EXISTS public.context_cache (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    context_type  TEXT        NOT NULL CHECK (context_type IN ('weather', 'news', 'holiday')),
    context_date  DATE        NOT NULL,
    content       JSONB       NOT NULL DEFAULT '{}',
    source        TEXT,
    expires_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, context_type, context_date)
);

CREATE INDEX IF NOT EXISTS idx_context_cache_tenant_id  ON public.context_cache (tenant_id);
CREATE INDEX IF NOT EXISTS idx_context_cache_expires_at ON public.context_cache (expires_at);

-- ============================================================
-- chat_history
-- Persisted copilot Q&A — previously only in session state
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_history (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id  UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question   TEXT        NOT NULL,
    response   TEXT,
    metadata   JSONB       NOT NULL DEFAULT '{}',
    -- metadata shape:
    -- {
    --   "intent": "revenue_query",
    --   "sql_queries_run": ["SELECT ..."],
    --   "llm_model": "gemini-2.5-flash",
    --   "tokens_used": {"input": 1200, "output": 340},
    --   "guardrail_results": {"premise": "pass", "numeric": "pass"},
    --   "response_time_ms": 3421
    -- }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_history_tenant_id  ON public.chat_history (tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id    ON public.chat_history (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON public.chat_history (created_at DESC);

-- ============================================================
-- audit_log
-- All significant user and system actions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID        REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    action        TEXT        NOT NULL,
    resource_type TEXT,
    resource_id   TEXT,
    details       JSONB       NOT NULL DEFAULT '{}',
    ip_address    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id  ON public.audit_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id    ON public.audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON public.audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);

-- ============================================================
-- generated_reports
-- Metadata for reports stored in Supabase Storage
-- ============================================================
CREATE TABLE IF NOT EXISTS public.generated_reports (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id        UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    report_type      TEXT        NOT NULL,
    -- report_type: 'morning_brief' | 'export_csv' | 'anomaly_report'
    title            TEXT        NOT NULL,
    storage_path     TEXT,
    file_size_bytes  BIGINT,
    metadata         JSONB       NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_tenant_id   ON public.generated_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_report_type ON public.generated_reports (report_type);
CREATE INDEX IF NOT EXISTS idx_generated_reports_created_at  ON public.generated_reports (created_at DESC);

-- ============================================================
-- Trigger helper: auto-update updated_at on tenants
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_updated_at ON public.tenants;
CREATE TRIGGER tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
