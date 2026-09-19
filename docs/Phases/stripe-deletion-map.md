# Stripe leftover inventory (Phase 2 — document only)

**Do not DROP columns or tables in Phase 2.** Safe deletion / cleanup after Phase 5 billing hardening (and prod null-row checks).

Grep date: 2026-09-19  
Branch: `phase/02-dev-2-modular-foundation`  
Base: `255f937`

## Migration hits

| Migration | Line(s) | Object / text | Notes | Safe to delete after |
|---|---|---|---|---|
| `011_billing.sql` | 29–31, 44–46, 321 | `tenants.stripe_customer_id`, `tenants.stripe_subscription_id`, index `idx_tenants_stripe_customer` | Still present on tenants | Phase 5 |
| `015_billing_stripe_gst.sql` | whole file + 56–57, 77–79, 92–107 | Stripe GST day; `invoices.stripe_invoice_id`, `stripe_payment_intent_id`; table `stripe_webhook_events` | Largely superseded by 016 renames | Phase 5 (after confirming unused) |
| `016_billing_razorpay_provider.sql` | 3, 8, 17–24, 32–64 | Deprecates stripe_*; backfill to razorpay_*; renames invoice stripe cols → `provider_*`; renames `stripe_webhook_events` → `payment_webhook_events` | Transition migration — keep history | N/A (already migrated names) |
| `028_day11_control_plane.sql` | 87 | Runbook name `reconcile_stripe_subscription` | Naming leftover; provider-agnostic purpose | Phase 5 rename optional |

## Backend / test hits

| Path | Line(s) | Hit | Notes | Safe to delete after |
|---|---|---|---|---|
| `backend/app/api/superadmin/billing.py` | 45, 95–97, 212–215 | `stripe_invoice_id` field; `/billing/stripe-status/{tenant_id}` alias; query filters | Compat aliases / field names | Phase 5 |
| `backend/app/api/superadmin/control_plane.py` | 85 | Runbook `reconcile_stripe_subscription` | Mirror of migration seed | Phase 5 |
| `backend/app/api/superadmin/day11.py` | 401 | Confirm string includes `reconcile_stripe_subscription` | Dangerous-op confirm list | Phase 5 |
| `backend/app/api/superadmin/plan.py` | 28, 79, 100, 132 | `bypass_stripe` flag | Superadmin plan override naming | Phase 5 rename optional |
| `backend/tests/superadmin/superadmin_helpers.py` | 398 | GET stripe-status path | Test coverage of alias | Phase 5 |
| `backend/tests/superadmin/test_day11_control_plane.py` | 51 | Runbook name in list | Test | Phase 5 |

## Deletion protocol (Phase 5+)

1. Confirm production rows: `stripe_customer_id` / `stripe_subscription_id` null (or migrated).
2. Remove superadmin stripe-status alias only after dashboard/clients updated.
3. Rename runbook `reconcile_stripe_subscription` → provider-neutral id in same change as control-plane seed.
4. DROP unused columns/indexes only with a forward migration; never from Phase 2.

## Coverage check

Documented hits ≥ combined grep of `stripe` under `supabase/migrations/` and `backend/` (app + tests) as of this inventory.
