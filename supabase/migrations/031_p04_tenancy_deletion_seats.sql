-- Phase 4 tenancy columns used by DPDP deletion and seats
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pending_deletion_since TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_seats INTEGER;
