# Razorpay setup (test mode)

## 1. API keys

1. Open [Razorpay Dashboard → Settings → API Keys](https://dashboard.razorpay.com/app/keys).
2. Generate **Test Mode** keys.
3. **Regenerate the secret** if it was ever pasted in chat or committed.
4. Set on Railway and local `backend/.env` (never commit):

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

## 2. Create subscription plans (4)

Dashboard → **Subscriptions → Plans → Create Plan**

| Plan | Amount (INR) | Amount (paise) | Billing interval | Env var |
|------|--------------|----------------|------------------|---------|
| Pro Monthly | ₹7,999 | 799900 | Monthly | `RAZORPAY_PRO_MONTHLY_PLAN_ID` |
| Pro Annual | ₹79,999 | 7999900 | Yearly | `RAZORPAY_PRO_ANNUAL_PLAN_ID` |
| Business Monthly | ₹13,999 | 1399900 | Monthly | `RAZORPAY_BUSINESS_MONTHLY_PLAN_ID` |
| Business Annual | ₹1,39,999 | 13999900 | Yearly | `RAZORPAY_BUSINESS_ANNUAL_PLAN_ID` |

Copy each `plan_...` ID into the matching env var.

GST is issued by AKARA (not Razorpay). List prices are tax-inclusive; PDF uses your `COMPANY_GSTIN`.

## 3. Webhook

Dashboard → **Settings → Webhooks → Add New Webhook**

- **URL:** `https://<your-railway-api>/billing/webhook`
- **Events:** `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`, `payment.failed`, `payment.captured`
- Copy **Webhook Secret** → `RAZORPAY_WEBHOOK_SECRET`

## 4. Database

Apply migration 016 after 015:

```bash
# Option A — Supabase SQL Editor: paste supabase/migrations/016_billing_razorpay_provider.sql
# Option B — direct Postgres (set SUPABASE_DB_URL in backend/.env first):
cd akara/backend && python scripts/apply_migration.py ../supabase/migrations/016_billing_razorpay_provider.sql
cd akara/backend && python scripts/verify_supabase.py
```

## 5. Test payment

Use Razorpay test mode cards/UPI from [Razorpay docs](https://razorpay.com/docs/payments/payments/test-card-upi-details/).

See [day5_e2e_checklist.md](day5_e2e_checklist.md) for full QA steps.
