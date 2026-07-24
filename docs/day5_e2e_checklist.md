# Day 5 — Razorpay test-mode E2E checklist

Run against **deployed** Railway API + Vercel frontend with Razorpay **test mode** keys.

Setup: [`razorpay_setup.md`](razorpay_setup.md)

## Prerequisites
- Migrations **015** and **016** applied (`python backend/scripts/verify_supabase.py` — all OK)
- Railway: `RAZORPAY_*`, `COMPANY_GSTIN`, `SENDGRID_*`, `CUSTOMER_FRONTEND_URL`
- Razorpay webhook → `/billing/webhook` with signing secret set
- Dunning cron: second Railway service using `railway.dunning.json` (`python -m app.tasks.dunning`, daily)

## Checkout and upgrade

| # | Action | Expected |
|---|--------|----------|
| 1 | Free user → `/upgrade` → Pro monthly, Razorpay test payment | `tenants.plan=pro`, `plan_status=active` |
| 2 | Upgrade Business annual | Plan correct in DB |
| 3 | Double-click upgrade (same idempotency key) | Single subscription flow |
| 4 | Already subscribed → upgrade | 409 UI → link to `/billing` |

## Payment failure and recovery

| # | Action | Expected |
|---|--------|----------|
| 5 | Failed payment (Razorpay test failure) | `plan_status=past_due`, PastDueBanner, copilot/import blocked |
| 6 | Successful retry / new payment | `past_due_since` cleared |
| 7 | `past_due_since` 3+ days ago + dunning cron | Email + `dunning_events` row |

## GST invoice

| # | Action | Expected |
|---|--------|----------|
| 8 | After `subscription.charged` / `payment.captured` | Row in `invoices`, PDF in storage |
| 9 | `/billing` invoice history | Download PDF works |
| 10 | SendGrid configured | GST invoice email with PDF |

## Cancellation (in-app — no Razorpay portal)

| # | Action | Expected |
|---|--------|----------|
| 11 | Billing → Cancel subscription | Razorpay cancel at cycle end; `plan_status=cancelled` after webhook |
| 12 | Grace period | Access per `plan_guard` until `trial_ends_at` |

## Webhooks

| # | Action | Expected |
|---|--------|----------|
| 13 | Replay same webhook `event_id` | Idempotent — no duplicate invoice |
| 14 | `/superadmin/billing` | Webhook stats + tenant timeline |

## Day 16 UI gates

| # | Action | Expected |
|---|--------|----------|
| 15 | Free: 11th copilot question | 402 + banner |
| 16 | Data: 4th upload same day | Blocked |
| 17 | Data: 3rd undo same day | Undo disabled |
| 18 | Free `/simulator` | Lock overlay |
| 19 | `/billing` usage + daily pills | Match API |

## Automated gates

```bash
cd akara/backend && pytest tests/test_razorpay_webhook.py tests/test_billing_checkout.py tests/test_gst_invoice.py tests/test_dunning.py tests/test_admin_billing.py
cd akara/frontend && npx tsc --noEmit && npm run build
```
