DROP INDEX IF EXISTS idx_invoices_tenant_period;
ALTER TABLE invoices DROP COLUMN IF EXISTS billing_period_start;
