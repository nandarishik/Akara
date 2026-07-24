-- ============================================================
-- AKARA: Razorpay provider migration (forward-only after 015)
-- Migration 016 — run AFTER 015_billing_stripe_gst.sql
-- ============================================================

BEGIN;

-- 1. Tenant Razorpay linkage (stripe_* columns left deprecated)
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_razorpay_customer
    ON public.tenants (razorpay_customer_id)
    WHERE razorpay_customer_id IS NOT NULL;

-- Optional backfill if any Stripe test ids exist
UPDATE public.tenants
SET razorpay_customer_id = stripe_customer_id
WHERE razorpay_customer_id IS NULL AND stripe_customer_id IS NOT NULL;

UPDATE public.tenants
SET razorpay_subscription_id = stripe_subscription_id
WHERE razorpay_subscription_id IS NULL AND stripe_subscription_id IS NOT NULL;

-- 2. Rename invoice provider columns (015 applied)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'invoices'
          AND column_name = 'stripe_invoice_id'
    ) THEN
        ALTER TABLE public.invoices RENAME COLUMN stripe_invoice_id TO provider_payment_id;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'invoices'
          AND column_name = 'stripe_payment_intent_id'
    ) THEN
        ALTER TABLE public.invoices RENAME COLUMN stripe_payment_intent_id TO provider_order_id;
    END IF;
END $$;

DROP INDEX IF EXISTS idx_invoices_stripe_invoice;
CREATE INDEX IF NOT EXISTS idx_invoices_provider_payment
    ON public.invoices (provider_payment_id)
    WHERE provider_payment_id IS NOT NULL;

-- 3. Rename webhook inbox to provider-neutral
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'stripe_webhook_events'
    ) THEN
        ALTER TABLE public.stripe_webhook_events RENAME TO payment_webhook_events;
    END IF;
END $$;

ALTER TABLE public.payment_webhook_events
    ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'razorpay';

DROP INDEX IF EXISTS idx_stripe_webhook_events_created;
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_created
    ON public.payment_webhook_events (created_at DESC);

COMMIT;
