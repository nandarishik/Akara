-- Phase 5 invoice uniqueness
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_period_start DATE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_tenant_period
    ON invoices (tenant_id, billing_period_start)
    WHERE billing_period_start IS NOT NULL;
