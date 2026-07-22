# AKARA — Complete Deployment Guide

This document walks you through setting up every external service from scratch and wiring them together. Follow the sections in order. Do not skip ahead.

**Estimated total time: 60–90 minutes on first setup.**

---

## Prerequisites — Before You Start

You need accounts on:
- [supabase.com](https://supabase.com) — free tier is fine
- [railway.app](https://railway.app) — Hobby plan ($5/mo)
- [vercel.com](https://vercel.com) — free tier is fine
- [github.com](https://github.com) — free tier is fine

You also need these API keys ready (get them before starting):
- **Google Gemini API key** — [aistudio.google.com](https://aistudio.google.com) → Get API Key → free tier is fine
- **OpenRouter API key** — [openrouter.ai](https://openrouter.ai) → sign up → top up $5 minimum → copy key
- **SendGrid API key** (optional — only needed for morning brief emails) — [sendgrid.com](https://sendgrid.com) → free tier sends 100 emails/day

---

## Part 1 — Supabase

### Step 1.1 — Create a New Project

1. Go to [supabase.com](https://supabase.com) → Sign in → **New Project**
2. Choose your organisation (or create one)
3. Fill in:
   - **Name**: `akara` (or anything you like)
   - **Database Password**: generate a strong password — **save it somewhere safe**, you will need it later
   - **Region**: choose the one closest to your customers (e.g., `Southeast Asia (Singapore)` for India)
4. Click **Create new project**
5. Wait ~2 minutes for the project to spin up

---

### Step 1.2 — Collect Your Project Credentials

Once the project is ready, go to:

**Supabase Dashboard → Project Settings → API**

Copy and save these three values — you will paste them into Railway and your local `.env` file later:

| Value | Where to find it | Variable name |
|---|---|---|
| Project URL | "Project URL" box | `SUPABASE_URL` |
| `anon` public key | "Project API Keys" → `anon` | `SUPABASE_ANON_KEY` |
| `service_role` secret key | "Project API Keys" → `service_role` (click reveal) | `SUPABASE_SERVICE_ROLE_KEY` |

⚠️ **Never expose `service_role` publicly.** It bypasses all RLS policies.

Then go to:

**Supabase Dashboard → Project Settings → API → JWT Settings**

Copy:
| Value | Variable name |
|---|---|
| JWT Secret | `JWT_SECRET` |

---

### Step 1.3 — Run Database Migrations

All 9 migration files are in `akara/migrations/`. Run them one at a time in the Supabase SQL Editor.

Go to: **Supabase Dashboard → SQL Editor → New Query**

Paste and run each file **in order**. After each one, click **Run**. If you see an error, stop and fix it before continuing.

**Migration order:**

1. `akara/migrations/001_initial_schema.sql` — creates all tables
2. `akara/migrations/002_rls_policies.sql` — enables Row Level Security
3. `akara/migrations/003_functions.sql` — creates database functions + auth trigger
4. `akara/migrations/004_competitive_additions.sql` — adds secondary sales, scheme master, outstanding columns
5. `akara/migrations/005_execute_tenant_query.sql` — adds the RLS-safe query executor function
6. `akara/migrations/006_update_tenant_config_rpc.sql` — adds tenant config updater RPC
7. `akara/migrations/007_conversations.sql` — adds conversations table for chat history
8. `akara/migrations/008_user_preferences.sql` — adds user preferences to profiles
9. `akara/migrations/009_scheme_leakage_fn.sql` — adds scheme leakage analytics function

After running all 9, verify everything worked by running this query in the SQL Editor:

```sql
-- Verify all 7 core tables exist with RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'tenants', 'profiles', 'sales_data',
    'context_cache', 'chat_history', 'audit_log', 'generated_reports'
  );
-- Expected: 7 rows, all with rowsecurity = true
```

If you see 7 rows with `rowsecurity = true`, migrations succeeded.

---

### Step 1.4 — Configure Supabase Auth

Go to: **Supabase Dashboard → Authentication → URL Configuration**

Set:
- **Site URL**: `https://your-vercel-app.vercel.app` (you will get this URL after deploying to Vercel in Part 3 — come back and update this)
- **Redirect URLs**: add `https://your-vercel-app.vercel.app/**` and `http://localhost:5173/**`

Go to: **Authentication → Providers → Email**

Confirm:
- **Enable Email provider**: ON
- **Confirm email**: you can turn this OFF for now to simplify early testing (turn it back ON before onboarding customers)

---

### Step 1.5 — Deploy the Edge Function (Morning Brief)

The morning brief scheduled email is an Edge Function at `akara/supabase/functions/daily-morning-brief/index.ts`.

**Install Supabase CLI first (one-time):**
```bash
brew install supabase/tap/supabase
```
Or on Linux/Windows: [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli/getting-started)

**Link your project:**
```bash
cd /Users/bandi.nandarishik/Desktop/Functional-test2
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Your project ref is the string in your Supabase URL: `https://YOUR_PROJECT_REF.supabase.co`

**Deploy the function:**
```bash
supabase functions deploy daily-morning-brief
```

**Set the Edge Function secrets:**

Go to: **Supabase Dashboard → Edge Functions → daily-morning-brief → Secrets**

Add these two secrets (the others are auto-injected by Supabase):

| Secret name | Value |
|---|---|
| `BACKEND_API_URL` | Your Railway URL — e.g. `https://akara-backend-production.up.railway.app` (fill in after Part 2) |
| `BACKEND_SERVICE_KEY` | Generate a random string: run `python3 -c "import secrets; print(secrets.token_hex(32))"` and save the output — **this same value must also be set in Railway** |

**Set the schedule:**

Go to: **Supabase Dashboard → Edge Functions → daily-morning-brief → Schedule**

Set cron to: `30 1 * * *`

This fires at 01:30 UTC = 07:00 AM IST every day.

> **Note**: Morning brief emails are optional. If you don't set up SendGrid, the function will run but no emails will be sent. The dashboard still works completely.

---

## Part 2 — Railway (Backend)

### Step 2.1 — Push Code to GitHub First

Railway deploys from a GitHub repository. If you haven't pushed yet:

```bash
cd /Users/bandi.nandarishik/Desktop/Functional-test2
git init          # if not already a git repo
git add .
git commit -m "Initial AKARA implementation — Days 1-13"
# Create a repo at github.com/new, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

---

### Step 2.2 — Create a New Railway Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Select **Deploy from GitHub repo**
3. Authorise Railway to access your GitHub account (one-time)
4. Select your AKARA repository
5. Railway detects the `railway.json` file in `akara/backend/` automatically

**Important**: Railway will try to deploy the root of the repo. You need to set the **root directory** to `akara/backend`:

- In your Railway project → **Settings** → **Source** → **Root Directory**: set to `akara/backend`

Click **Deploy**.

---

### Step 2.3 — Set Railway Environment Variables

Go to: **Railway project → Variables tab → Add Variable** (or bulk-edit)

Add every variable below. Do not skip any required ones.

| Variable | Required | Value |
|---|---|---|
| `SUPABASE_URL` | **Yes** | From Step 1.2 — `https://your-project.supabase.co` |
| `SUPABASE_ANON_KEY` | **Yes** | From Step 1.2 — `eyJ...` anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | From Step 1.2 — `eyJ...` service role key |
| `JWT_SECRET` | **Yes** | From Step 1.2 — JWT secret from Supabase settings |
| `GEMINI_API_KEY` | **Yes** | From Google AI Studio — `AIza...` |
| `OPENROUTER_API_KEY` | **Yes** | From openrouter.ai — `sk-or-...` |
| `BACKEND_SERVICE_KEY` | **Yes** | The same random string you generated in Step 1.5 |
| `ENVIRONMENT` | **Yes** | `production` |
| `LOG_LEVEL` | **Yes** | `INFO` |
| `ALLOWED_ORIGINS_RAW` | **Yes** | Your Vercel URL — e.g. `https://akara-frontend.vercel.app` (fill in after Part 3 — come back and update) |
| `SENDGRID_API_KEY` | Optional | `SG....` — only needed for morning brief emails |
| `SENDGRID_FROM_EMAIL` | Optional | `insights@yourdomain.com` |
| `SENTRY_DSN` | Optional | From sentry.io — leave blank until you set up Sentry |

After adding variables, Railway **automatically redeploys**. Watch the deployment logs to confirm it goes green.

---

### Step 2.4 — Verify the Backend is Live

Once deployment succeeds, Railway shows you a public URL like:
`https://akara-backend-production.up.railway.app`

Test it:
```bash
curl https://akara-backend-production.up.railway.app/health
```

Expected response:
```json
{"status": "ok", "environment": "production", "timestamp": "2026-..."}
```

If you see this, the backend is live. **Copy this Railway URL** — you need it in the next parts.

---

### Step 2.5 — Update ALLOWED_ORIGINS_RAW

After deploying the frontend in Part 3, come back here and update `ALLOWED_ORIGINS_RAW` in Railway variables to include your Vercel URL:

```
ALLOWED_ORIGINS_RAW=https://your-app.vercel.app
```

If you add a custom domain later, add it too (comma-separated):
```
ALLOWED_ORIGINS_RAW=https://your-app.vercel.app,https://app.yourdomain.com
```

Railway redeploys automatically when you save.

---

## Part 3 — Vercel (Frontend)

### Step 3.1 — Import the Repository

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repository
3. On the **Configure Project** screen:
   - **Framework Preset**: Vite (auto-detected)
   - **Root Directory**: click **Edit** → set to `akara/frontend`
   - **Build Command**: `pnpm build` (or leave as auto-detected)
   - **Output Directory**: `dist` (auto-detected)
   - **Install Command**: `pnpm install`
4. **Do not click Deploy yet** — set environment variables first (next step)

---

### Step 3.2 — Set Vercel Environment Variables

Still on the Configure Project screen, scroll down to **Environment Variables**.

Add these 4 variables. All apply to Production, Preview, and Development environments:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL — `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key — `eyJ...` |
| `VITE_API_BASE_URL` | Your Railway URL — `https://akara-backend-production.up.railway.app` |
| `VITE_SENTRY_DSN` | Leave blank for now (optional) |

Click **Deploy**.

---

### Step 3.3 — Verify the Frontend is Live

Vercel gives you a URL like `https://akara-frontend-abc123.vercel.app`.

Open it in a browser. You should see the AKARA login page.

Try signing in — it will fail with "Invalid login credentials" because no users exist yet. That's expected. The fact that the login page loads and the sign-in button triggers a response (even an error) means the frontend → Supabase connection works.

**Copy your Vercel URL** — go back to Railway and update `ALLOWED_ORIGINS_RAW` (Step 2.5) with this URL.

---

### Step 3.4 — Update Supabase Auth URL

Go back to Supabase Dashboard → Authentication → URL Configuration (Step 1.4) and update the Site URL to your Vercel URL:

```
https://your-app.vercel.app
```

---

## Part 4 — GitHub Secrets (for CI)

The CI workflow in `.github/workflows/ci.yml` requires these secrets to run the backend tests. Without them, the CI will fail on `pytest` (because `test_config.py` reads env vars).

Go to: **GitHub → Your Repository → Settings → Secrets and Variables → Actions → New repository secret**

Add each one:

| Secret name | Value |
|---|---|
| `SUPABASE_URL` | Same as Railway `SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Same as Railway `SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | Same as Railway `SUPABASE_SERVICE_ROLE_KEY` |
| `JWT_SECRET` | Same as Railway `JWT_SECRET` |
| `GEMINI_API_KEY` | Same as Railway `GEMINI_API_KEY` |
| `OPENROUTER_API_KEY` | Same as Railway `OPENROUTER_API_KEY` |
| `VITE_SUPABASE_URL` | Same as Vercel `VITE_SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Same as Vercel `VITE_SUPABASE_ANON_KEY` |
| `VITE_API_BASE_URL` | Same as Vercel `VITE_API_BASE_URL` |

After adding all secrets, trigger CI manually:
- Go to **GitHub → Actions → CI → Run workflow → Run workflow**

Both jobs (`Backend — Lint + Test` and `Frontend — Build`) should go green.

---

## Part 5 — Onboard Your First Customer

Now everything is wired. To add a customer, follow `akara/docs/onboarding-checklist.md`. The short version:

### Step 5.1 — Create the Tenant Row

Go to: **Supabase Dashboard → SQL Editor → New Query**

```sql
INSERT INTO public.tenants (name, slug, config)
VALUES (
    'Customer Company Name',
    'customer-slug',
    '{"timezone": "Asia/Kolkata", "industry": "fmcg_distribution", "language": "en"}'
)
RETURNING id;
```

**Copy the returned UUID** — this is the `tenant_id`.

---

### Step 5.2 — Create the User in Supabase Auth

Go to: **Supabase Dashboard → Authentication → Users → Invite User**

Enter the customer's admin email address. Supabase sends them a magic link to set their password.

After they accept, note their **User UUID** from the Users table.

---

### Step 5.3 — Create the Profile Row

```sql
INSERT INTO public.profiles (id, tenant_id, role, display_name, preferences)
VALUES (
    'USER_UUID_FROM_STEP_5_2',
    'TENANT_UUID_FROM_STEP_5_1',
    'admin',
    'Customer Admin Name',
    '{"morning_brief_enabled": true}'
);
```

---

### Step 5.4 — Send Welcome Email

Send the customer:
- **URL**: your Vercel URL (or custom domain)
- **Email**: the email used in Step 5.2
- **First task**: Go to `/data` and upload your first Excel/CSV file

---

## Part 6 — Optional: Custom Domain

If you have a domain (e.g., `app.yourdomain.com`):

### Vercel custom domain

1. **Vercel → Project → Settings → Domains → Add**
2. Enter `app.yourdomain.com`
3. Vercel shows you a CNAME record: `cname.vercel-dns.com`
4. Go to your DNS provider (Namecheap, GoDaddy, Cloudflare, etc.)
5. Add a CNAME record:
   - **Type**: CNAME
   - **Name**: `app`
   - **Value**: `cname.vercel-dns.com`
6. Wait 5–60 minutes for DNS propagation
7. Vercel automatically provisions SSL (Let's Encrypt) once DNS propagates
8. Verify: open `https://app.yourdomain.com` — should show AKARA login with a green padlock

### Update CORS for custom domain

Go back to Railway → Variables → update `ALLOWED_ORIGINS_RAW`:
```
ALLOWED_ORIGINS_RAW=https://your-app.vercel.app,https://app.yourdomain.com
```

---

## Part 7 — Optional: SendGrid (Morning Brief Emails)

1. Sign up at [sendgrid.com](https://sendgrid.com) → free tier gives 100 emails/day
2. Go to **Settings → API Keys → Create API Key** → Full Access → copy the `SG....` key
3. Go to **Settings → Sender Authentication → Single Sender Verification** → add and verify your sender email
4. Add to Railway variables:
   - `SENDGRID_API_KEY` = `SG....`
   - `SENDGRID_FROM_EMAIL` = the verified sender email
5. Come back to Supabase Edge Function secrets (Step 1.5) and make sure `BACKEND_API_URL` is set to your Railway URL

The morning brief fires at 7:00 AM IST daily for any user with `preferences.morning_brief_enabled = true`.

---

## Part 8 — Optional: Sentry Error Tracking

1. Sign up at [sentry.io](https://sentry.io) → free tier
2. Create a new project → Platform: **React**
3. Copy the DSN (looks like `https://abc123@o123.ingest.sentry.io/456789`)
4. Add to **Vercel environment variables**: `VITE_SENTRY_DSN` = the DSN
5. Redeploy Vercel (`vercel --prod` or push to `main`)
6. Create another Sentry project → Platform: **Python / FastAPI**
7. Copy that DSN
8. Add to **Railway variables**: `SENTRY_DSN` = the FastAPI DSN
9. Railway redeploys automatically

Errors from both backend and frontend now appear in your Sentry dashboard.

---

## Part 9 — Optional: UptimeRobot Monitoring

1. Sign up at [uptimerobot.com](https://uptimerobot.com) → free tier monitors every 5 minutes
2. **Add Monitor → HTTP(s)**:
   - Monitor 1: Name `AKARA Backend`, URL `https://your-railway-url.railway.app/health`
   - Monitor 2: Name `AKARA Frontend`, URL `https://your-vercel-url.vercel.app`
3. Add your email for alerts
4. You'll receive an email if either goes down

---

## Final Verification Checklist

Run these checks after completing all parts:

```bash
# 1. Backend health
curl https://your-railway-url.railway.app/health
# Expected: {"status":"ok","environment":"production",...}

# 2. Frontend loads
# Open https://your-vercel-url.vercel.app in browser
# Expected: AKARA login page

# 3. Auth works
# Try logging in with a provisioned user
# Expected: redirected to /dashboard

# 4. Backend tests in CI
# GitHub → Actions → latest CI run → both jobs green

# 5. CORS is correct
# Open browser DevTools on the frontend → Network tab
# Make any API call (e.g., load dashboard)
# Expected: no CORS errors in console

# 6. Edge Function (optional)
# Supabase → Edge Functions → daily-morning-brief → Logs
# Run it manually and check for errors
```

---

## Environment Variables Master Reference

### Railway (Backend)

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | `https://your-project.supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (never expose publicly) |
| `JWT_SECRET` | Yes | Copied from Supabase → Settings → API → JWT Secret |
| `GEMINI_API_KEY` | Yes | Google AI Studio key (`AIza...`) |
| `OPENROUTER_API_KEY` | Yes | OpenRouter key (`sk-or-...`) |
| `BACKEND_SERVICE_KEY` | Yes | Random 64-char hex string you generated |
| `ENVIRONMENT` | Yes | `production` |
| `LOG_LEVEL` | Yes | `INFO` |
| `ALLOWED_ORIGINS_RAW` | Yes | Comma-separated list of allowed frontend URLs |
| `SENDGRID_API_KEY` | Optional | `SG....` |
| `SENDGRID_FROM_EMAIL` | Optional | Verified sender email for morning brief |
| `SENTRY_DSN` | Optional | Sentry FastAPI DSN |
| `WEATHER_API_KEY` | Optional | weatherapi.com key (leave blank to disable) |
| `NEWS_API_KEY` | Optional | newsapi.org key (leave blank to disable) |

### Vercel (Frontend)

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Same as `SUPABASE_URL` above |
| `VITE_SUPABASE_ANON_KEY` | Yes | Same as `SUPABASE_ANON_KEY` above |
| `VITE_API_BASE_URL` | Yes | Your Railway URL — `https://...railway.app` |
| `VITE_SENTRY_DSN` | Optional | Sentry React DSN |

### Supabase Edge Function Secrets

| Secret | Required | Description |
|---|---|---|
| `BACKEND_API_URL` | Yes | Your Railway URL |
| `BACKEND_SERVICE_KEY` | Yes | Same random string as Railway `BACKEND_SERVICE_KEY` |

### GitHub Actions Secrets

Same as Railway + Vercel variables combined (see Part 4).

---

## Common Problems and Fixes

### "Missing Supabase environment variables" on frontend

**Cause**: `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is not set in Vercel.
**Fix**: Go to Vercel → Environment Variables → add them → redeploy.

### CORS error in browser console

**Cause**: `ALLOWED_ORIGINS_RAW` in Railway does not include your Vercel URL.
**Fix**: Add your Vercel URL to `ALLOWED_ORIGINS_RAW` in Railway variables → Railway redeploys automatically.

### Login redirects correctly but dashboard shows no data

**Cause**: No tenant row or profile row created for the user.
**Fix**: Follow Steps 5.1–5.3 to create the tenant and profile.

### `/health` returns 500

**Cause**: One of the required Railway env vars is missing or wrong (most commonly `SUPABASE_SERVICE_ROLE_KEY` or `JWT_SECRET`).
**Fix**: Go to Railway → Logs → find the error traceback → fix the variable.

### CI fails on `test_config.py`

**Cause**: One or more GitHub Secrets are missing.
**Fix**: Go to GitHub → Settings → Secrets → add the missing secret → re-run the workflow.

### Morning brief not sending emails

**Cause**: Either `SENDGRID_API_KEY` is not set in Railway, or `BACKEND_SERVICE_KEY` in Railway does not match `BACKEND_SERVICE_KEY` in the Supabase Edge Function secrets.
**Fix**: Verify both values match exactly. Check Supabase → Edge Functions → daily-morning-brief → Logs for the specific error.

### Supabase project pauses (free tier)

Supabase free projects pause after 7 days of inactivity.
**Fix**: Visit the Supabase dashboard to unpause. Once you have a paying customer, upgrade to Pro ($25/mo) to disable auto-pausing.
