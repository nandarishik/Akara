-- ============================================================
-- AKARA: Day 5 — Stripe billing, GST invoices, dunning
-- Migration 015 — run AFTER 014_day4_copilot_feedback_conversations_import_jobs
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Tenant billing details (GAP 1 — GSTIN collection)
-- ============================================================
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS billing_details JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS past_due_since TIMESTAMPTZ;

COMMENT ON COLUMN public.tenants.billing_details IS
    'Customer GST/billing: { gstin, company_name, billing_address, billing_state }';
COMMENT ON COLUMN public.tenants.past_due_since IS
    'Set on first payment failure; cleared on successful payment. Used by dunning cron.';

-- ============================================================
-- 2. Invoice sequence (atomic INV-YYYY-NNNN)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoice_sequence (
    year        INT         PRIMARY KEY,
    last_number INT         NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.next_invoice_number(p_year INT DEFAULT EXTRACT(YEAR FROM NOW())::INT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_num INT;
BEGIN
    INSERT INTO public.invoice_sequence (year, last_number)
    VALUES (p_year, 1)
    ON CONFLICT (year) DO UPDATE
        SET last_number = public.invoice_sequence.last_number + 1
    RETURNING last_number INTO v_num;

    RETURN 'INV-' || p_year::TEXT || '-' || LPAD(v_num::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_invoice_number(INT) TO service_role;

-- ============================================================
-- 3. GST invoices ledger
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoices (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_number      TEXT        NOT NULL UNIQUE,
    stripe_invoice_id   TEXT,
    stripe_payment_intent_id TEXT,
    amount_excl_tax     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cgst_amount         NUMERIC(12, 2) NOT NULL DEFAULT 0,
    sgst_amount         NUMERIC(12, 2) NOT NULL DEFAULT 0,
    igst_amount         NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_amount        NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency            TEXT        NOT NULL DEFAULT 'INR',
    tax_type            TEXT        NOT NULL DEFAULT 'igst'
        CHECK (tax_type IN ('cgst_sgst', 'igst')),
    customer_gstin      TEXT,
    customer_state      TEXT,
    pdf_storage_path    TEXT,
    status              TEXT        NOT NULL DEFAULT 'issued'
        CHECK (status IN ('issued', 'void', 'refunded')),
    emailed_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id
    ON public.invoices (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice
    ON public.invoices (stripe_invoice_id)
    WHERE stripe_invoice_id IS NOT NULL;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_tenant_read" ON public.invoices;
CREATE POLICY "invoices_tenant_read"
    ON public.invoices FOR SELECT
    USING (tenant_id = public.get_my_tenant_id());

GRANT SELECT ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.invoices TO service_role;

-- ============================================================
-- 4. Stripe webhook inbox (idempotency)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    event_id        TEXT        PRIMARY KEY,
    event_type      TEXT        NOT NULL,
    payload_hash    TEXT,
    processed_at    TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created
    ON public.stripe_webhook_events (created_at DESC);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.stripe_webhook_events TO service_role;

-- ============================================================
-- 5. Dunning ledger
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dunning_events (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    day_offset      INT         NOT NULL CHECK (day_offset IN (0, 3, 7, 14)),
    channel         TEXT        NOT NULL DEFAULT 'email'
        CHECK (channel IN ('email', 'whatsapp')),
    status          TEXT        NOT NULL DEFAULT 'sent'
        CHECK (status IN ('sent', 'failed', 'skipped')),
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB       NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dunning_tenant_day_channel
    ON public.dunning_events (tenant_id, day_offset, channel);
CREATE INDEX IF NOT EXISTS idx_dunning_tenant_id
    ON public.dunning_events (tenant_id, sent_at DESC);

ALTER TABLE public.dunning_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.dunning_events TO service_role;

COMMIT;
