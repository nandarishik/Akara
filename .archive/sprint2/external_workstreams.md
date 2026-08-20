# AKARA Phase 2 — External Workstreams Checklist

**These items require operator action (not code changes).**
Track completion status here and update before each daily gate check.

Each item has a "Latest by Day" deadline — if missed, dependent sprint tasks
will be blocked.

---

## EXT-1: Supabase India-region staging project

- **Latest by:** End of Day 1
- **Status:** `pending`
- **Steps:**
  1. Go to [supabase.com](https://supabase.com) → New project
  2. Region: **South Asia (Mumbai) — ap-south-2** (DPDP data residency)
  3. Name: `akara-staging`
  4. Save project URL, anon key, service role key to staging `.env`
  5. Enable **Transaction-mode pooler** in Settings → Database → Connection Pooling
  6. Copy pooler connection string to `SUPABASE_POOLER_URL`
  7. Apply migrations 001–010 in sequence via SQL Editor
  8. Confirm RLS is enabled on all tables (see MIGRATION_MANIFEST.md)
- **Evidence:** Pooler URL in staging secrets + green `/ready` probe

---

## EXT-2: Stripe test-mode products + prices

- **Latest by:** End of Day 4 (needed for Day 5 billing integration)
- **Status:** `pending`
- **Steps:**
  1. Sign in to [dashboard.stripe.com](https://dashboard.stripe.com)
  2. Switch to **Test mode**
  3. Create products matching `plan_catalog.md` slugs:
     - `prod_pro_akara` → prices: `price_pro_monthly` (₹2,499) + `price_pro_annual` (₹24,990)
     - `prod_business_akara` → prices: `price_business_monthly` (₹5,999) + `price_business_annual` (₹59,990)
  4. Set up a webhook endpoint pointing to `https://staging-api.akara.ai/billing/webhook`
     - Events: `checkout.session.completed`, `customer.subscription.updated`,
       `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`
  5. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`
  6. Copy Price IDs to staging secrets
- **Evidence:** Test Stripe checkout flow completes, webhook logs show events

---

## EXT-3: Zaptilo BSP WhatsApp account

- **Latest by:** Day 1 (approval takes 5–7 business days — START IMMEDIATELY)
- **Status:** `pending`
- **Steps:**
  1. Apply at [zaptilo.com](https://zaptilo.com) for BSP BSP onboarding
  2. Submit WhatsApp Business Account (WABA) registration
  3. Apply for template approval — submit W1–W4 templates from `sprint_phase2.md §5`
     - W1: Weekly debrief summary
     - W2: Morning brief
     - W3: Quota warning
     - W4: Import failure
  4. Get API key + sender number → set `ZAPTILO_API_KEY`, `ZAPTILO_SENDER_NUMBER`
  5. Test template sending to a personal number
- **Evidence:** Successful WhatsApp test message delivered

---

## EXT-4: Cloudflare Turnstile keys

- **Latest by:** End of Day 2 (needed before Day 3 signup page)
- **Status:** `pending`
- **Steps:**
  1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile
  2. Add site: `akara.ai` (and `staging.akara.ai`)
  3. Widget type: **Managed** (recommended)
  4. Copy Site Key → `VITE_TURNSTILE_SITE_KEY` in frontend
  5. Copy Secret Key → `TURNSTILE_SECRET_KEY` in backend
- **Evidence:** Turnstile widget renders on signup page; server validates token

---

## EXT-5: PostHog project

- **Latest by:** End of Day 12 (needed before Day 13 analytics)
- **Status:** `pending`
- **Steps:**
  1. Create project at [app.posthog.com](https://app.posthog.com)
  2. Select region: **EU** (nearest to India available, keeps data outside US)
  3. Copy API key → `POSTHOG_API_KEY` (server) + `VITE_POSTHOG_KEY` (client)
  4. Create two projects: `AKARA Staging` + `AKARA Production`
  5. Set up dashboards: DAU, signup funnel, copilot usage, plan distribution
- **Evidence:** Events visible in PostHog after login

---

## EXT-6: GST registration + invoice policy review

- **Latest by:** End of Day 4 (needed before Day 5 invoice generation)
- **Status:** `pending`
- **Steps:**
  1. Confirm GSTIN is valid and active on [gst.gov.in](https://www.gst.gov.in)
  2. Set `COMPANY_GSTIN`, `COMPANY_ADDRESS`, `COMPANY_STATE_CODE` in backend env
  3. Have accountant confirm:
     - SAC code for SaaS subscription services (usually 998314)
     - B2B vs B2C tax invoice format requirements
     - Whether reverse-charge applies for any customer segment
  4. Prepare invoice PDF template based on Sprint Phase 2 §18 spec
- **Evidence:** Sample GST invoice rendered correctly

---

## EXT-7: Legal review — Privacy Policy + Terms of Service

- **Latest by:** End of Day 5
- **Status:** `pending`
- **Steps:**
  1. Have a legal professional (preferably with DPDP Act 2023 expertise) review
     Privacy Policy and Terms pages against requirements in `sprint_phase2.md §DPDP`
  2. Confirm all required DPDP sections are present:
     - Data Fiduciary identification
     - Purposes of processing
     - Rights of Data Principals
     - Grievance Officer details
     - Data retention periods
     - Cross-border transfer policy (OpenRouter sub-processor)
  3. Confirm all consent capture flows are documented
  4. Set document version to `v1.0` and publish date
- **Evidence:** Legal sign-off received; version stored in `document_versions` table

---

## EXT-8: OpenRouter Data Processing Agreement

- **Latest by:** End of Day 5
- **Status:** `pending`
- **Steps:**
  1. Sign the DPA at [openrouter.ai](https://openrouter.ai)
  2. Store a copy in project legal folder
  3. Add OpenRouter as a sub-processor in the Privacy Policy
- **Evidence:** Signed DPA in project docs

---

## EXT-9: DNS / email configuration

- **Latest by:** End of Day 6 (needed before Day 7 email delivery)
- **Status:** `pending`
- **Steps:**
  1. Add SPF, DKIM, DMARC records for `akara.ai` via your DNS provider
     - SendGrid provides these after domain verification
  2. Verify sending domain in SendGrid Dashboard
  3. Add Vercel CNAME for `app.akara.ai` (or your chosen subdomain)
  4. Test email delivery with SendGrid's "Send Test" feature
  5. Confirm DMARC policy is `p=quarantine` or stricter before launch
- **Evidence:** DMARC report shows `pass` for sending domain

---

## EXT-10: Sentry — error tracking

- **Latest by:** End of Day 2
- **Status:** `pending`
- **Steps:**
  1. Create two projects at [sentry.io](https://sentry.io):
     - `akara-backend` (Python → FastAPI)
     - `akara-frontend` (JavaScript → React)
  2. Copy DSNs to env: `SENTRY_DSN` (backend) + `VITE_SENTRY_DSN` (frontend)
  3. Create staging + production environments in Sentry
  4. Set alert rule: notify Slack/email on first occurrence of any new issue
- **Evidence:** Test error appears in Sentry dashboard

---

## EXT-11: healthchecks.io — cron monitoring

- **Latest by:** End of Day 6 (needed before Day 7 crons go live)
- **Status:** `pending`
- **Steps:**
  1. Create account at [healthchecks.io](https://healthchecks.io)
  2. Create one check for each scheduled task:
     - `akara-morning-brief` — period: 24h, grace: 30min
     - `akara-weekly-debrief` — period: 7 days, grace: 60min
     - `akara-usage-reset` — period: 24h, grace: 30min
     - `akara-dunning` — period: 24h, grace: 30min
     - `akara-activation` — period: 24h, grace: 30min
  3. Copy base ping URL to `HEALTHCHECKS_PING_URL`
  4. Add Slack integration for "check down" alerts
- **Evidence:** Cron ping logs visible in healthchecks.io

---

## EXT-12: UptimeRobot — HTTP monitor

- **Latest by:** End of Day 13
- **Status:** `pending`
- **Steps:**
  1. Create free account at [uptimerobot.com](https://uptimerobot.com)
  2. Add HTTP monitor: `https://api.akara.ai/health`
     - Interval: 5 minutes
     - Alert email + SMS
  3. Add status page (public or internal) at `status.akara.ai`
- **Evidence:** Monitor shows green

---

## EXT-13: Railway — backend deployment

- **Latest by:** End of Day 1 (staging)
- **Status:** `pending`
- **Steps:**
  1. Create Railway project: `AKARA`
  2. Add service: `akara-backend-staging`
     - Root directory: `akara/backend`
     - Start command: `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`
  3. Set all staging environment variables
  4. Connect GitHub repo and enable auto-deploy on `main`
  5. Note the Railway public URL → set `VITE_API_BASE_URL` in frontend staging env
- **Evidence:** `https://staging-api.akara.ai/health` returns `{"status":"ok"}`

---

## EXT-14: Vercel — frontend deployment

- **Latest by:** End of Day 1 (staging)
- **Status:** `pending`
- **Steps:**
  1. Create Vercel project: `akara-frontend-staging`
     - Root directory: `akara/frontend`
     - Framework preset: Vite
  2. Set all staging environment variables (`VITE_*`)
  3. Add domain `staging.akara.ai` (or use Vercel-assigned URL)
  4. Enable preview deployments for PRs
- **Evidence:** `https://staging.akara.ai` loads without errors

---

## EXT-15: SendGrid sender domain verified

- **Latest by:** End of Day 6
- **Status:** `pending`
- **Steps:**
  1. Log in to [app.sendgrid.com](https://app.sendgrid.com) → Settings → Sender Authentication
  2. Authenticate domain `akara.ai`
  3. Add DNS records provided by SendGrid
  4. Wait for propagation → click Verify
  5. Create an API key with `Mail Send` permission
  6. Set `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`
- **Evidence:** Domain shows "Verified" in SendGrid; test email delivers to inbox (not spam)

---

## EXT-15: Healthchecks.io entries for cron jobs

- **Latest by:** End of Day 2 (needed before retention cron is scheduled in Railway)
- **Status:** `pending`
- **Steps:**
  1. Go to healthchecks.io (or self-hosted instance)
  2. Create check: **AKARA Retention Cleanup** — schedule `0 20 * * *` (UTC = 2 AM IST), grace 1 hour
  3. Copy ping URL → set as `HEALTHCHECKS_RETENTION_URL` env var in Railway
  4. In `retention_cleanup.py`, add ping-start/ping-success calls around `run()` using the URL
  5. Create check: **AKARA Cost Aggregation** — to be wired in Day 8 (set pending for now)
  6. Add both URLs to Railway environment variables and `.env.example`
- **Evidence:** Healthchecks.io dashboard shows last ping within expected window after first cron run

---

*Last updated: Day 2*
