# AKARA — Simplified Production Architecture (Revised)

**Generated:** 2026-07-21
**Revision of:** `solutions.md` (14,571 lines — written before repository analysis)
**Based on:** Actual repository inspection of `dailyassistant-dms-client`
**Companion:** `akara.md` (Technical Due Diligence Report)
**Constraint:** Student founder, solo developer, very limited funding
**Target:** First 3 paying FMCG distributor customers, fastest safe path

---

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. Data Growth Estimates (Evidence-Based)](#2-data-growth-estimates-evidence-based)
- [3. Supabase Evaluation (Detailed)](#3-supabase-evaluation-detailed)
- [4. Comparison with Alternatives](#4-comparison-with-alternatives)
- [5. What solutions.md Got Wrong](#5-what-solutionsmd-got-wrong)
- [6. Recommended Architecture (Simplified)](#6-recommended-architecture-simplified)
- [7. Technology Decisions (Simplified)](#7-technology-decisions-simplified)
- [8. What NOT to Build](#8-what-not-to-build)
- [9. Cost Analysis (Corrected)](#9-cost-analysis-corrected)
- [10. Scaling Triggers (When to Change)](#10-scaling-triggers-when-to-change)
- [11. Phase 1 — Production-Ready for Customer #1 (2-Week Rebuild)](#11-phase-1--production-ready-for-customer-1-2-week-rebuild)
  - [11.1 Philosophy: Rebuild, Not Patch](#111-philosophy-rebuild-not-patch)
  - [11.2 Codebase Restructuring](#112-codebase-restructuring)
  - [11.3 Code Quality Standards](#113-code-quality-standards)
  - [11.4 The Two Tracks](#114-the-two-tracks)
  - [11.5 Exact 14-Day Roadmap](#115-exact-14-day-roadmap)
  - [11.6 Multi-Tenant Isolation (How It Works)](#116-multi-tenant-isolation-how-it-works)
  - [11.7 What's Included vs. Deferred](#117-whats-included-vs-deferred)
  - [11.8 Cost During Phase 1](#118-cost-during-phase-1)
- [12. Migration from SQLite to Supabase PostgreSQL](#12-migration-from-sqlite-to-supabase-postgresql)
- [13. What to Retain from Current Codebase](#13-what-to-retain-from-current-codebase)
- [14. Security (Simplified but Real)](#14-security-simplified-but-real)
- [15. Final Verdict](#15-final-verdict)

---

## 1. Executive Summary

### The Problem with the Original Plan

The original `solutions.md` (14,571 lines) was written as a theoretical architecture plan **before** seeing the actual repository. It assumed a complex, potentially large-scale application that would need Redis caching, background job workers, self-hosted monitoring, custom JWT authentication, multiple containers, and infrastructure costing $65-180/month.

### What the Repository Actually Is

The actual repository tells a very different story:

| Metric | Assumed (solutions.md) | Actual (repository) |
|--------|----------------------|---------------------|
| Repo size | "Large codebase" | ~24MB (23MB is the SQLite DB) |
| Source code | "Complex multi-service" | ~1MB across 77 files |
| Database | "Needs careful scaling" | SQLite, 2 tables, 40,243 rows total |
| Users | "Needs rate limiting" | <10 concurrent users expected |
| Data per customer | "High volume" | ~23MB/month in SQLite, ~8-15MB in Postgres |
| Authentication | "Complex JWT system" | Zero — none exists |
| Background jobs | "Worker processes needed" | None — all manual CLI scripts |
| Caching needs | "Redis required" | Queries take <100ms on SQLite |
| Containers | "Multi-container Docker" | No Docker, no containers at all |
| CI/CD | "Complex pipeline" | Empty `.github/workflows/` with only `.gitkeep` |

### The Revised Plan

**The entire production stack is three services:**

1. **Supabase Pro ($25/mo)** — Database + Auth + File Storage + Edge Functions + Backups + RLS
2. **Railway ($5-7/mo)** — Host the Python app (Streamlit + FastAPI)
3. **Gemini API (~$15-25/customer/mo)** — LLM inference

**Total infrastructure: ~$32/month fixed + ~$20/customer in LLM costs.**

Not $65-180/month. Not 4-6 weeks. Not Redis, queues, workers, or Kubernetes.

**First customer can be onboarded in 2-3 weeks**, not 4-6.

### Revenue vs. Cost at Launch

| Metric | Value |
|--------|-------|
| Infrastructure (1 customer) | $32/mo fixed + $20 LLM = **$52/mo** |
| Revenue (1 customer at ₹20K/mo) | **~$240/mo** |
| Gross margin | **78%** |
| Infrastructure (3 customers) | $32/mo fixed + $60 LLM = **$92/mo** |
| Revenue (3 customers) | **~$720/mo** |
| Gross margin | **87%** |

This is a viable business from day one.

---

## 2. Data Growth Estimates (Evidence-Based)

### Methodology

These estimates are derived from the **actual** repository data:

- `VIEW_AI_SALES`: 40,236 rows for 1 month of FMCG distributor data
- Each row contains ~70 columns (product name, invoice details, quantities, amounts, zones, routes)
- `context_intelligence`: 7 rows (weather/news cache for contextual enrichment)
- Average row size in PostgreSQL (with proper types, no padding): ~400 bytes for sales, ~2KB for context
- Chat history (not yet implemented): estimated 100 queries/day × 30 days × ~1KB per record
- Audit logs: ~500 entries/month × ~200 bytes each

### 2.1 Database Records Growth

#### Sales Data (core business data)

| Timeframe | 1 Customer | 3 Customers | 10 Customers |
|-----------|-----------|-------------|--------------|
| 1 month | 40,000 rows | 120,000 rows | 400,000 rows |
| 6 months | 240,000 rows | 720,000 rows | 2,400,000 rows |
| 1 year | 480,000 rows | 1,440,000 rows | 4,800,000 rows |
| 2 years | 960,000 rows | 2,880,000 rows | 9,600,000 rows |

#### Context Cache (weather/news/holidays)

| Timeframe | 1 Customer | 3 Customers | 10 Customers |
|-----------|-----------|-------------|--------------|
| 1 month | 30 rows | 90 rows | 300 rows |
| 6 months | 180 rows | 540 rows | 1,800 rows |
| 1 year | 360 rows | 1,080 rows | 3,600 rows |
| 2 years | 720 rows | 2,160 rows | 7,200 rows |

#### Chat History (100 queries/day average per customer)

| Timeframe | 1 Customer | 3 Customers | 10 Customers |
|-----------|-----------|-------------|--------------|
| 1 month | 3,000 rows | 9,000 rows | 30,000 rows |
| 6 months | 18,000 rows | 54,000 rows | 180,000 rows |
| 1 year | 36,000 rows | 108,000 rows | 360,000 rows |
| 2 years | 72,000 rows | 216,000 rows | 720,000 rows |

#### Audit Logs (500 events/month per customer)

| Timeframe | 1 Customer | 3 Customers | 10 Customers |
|-----------|-----------|-------------|--------------|
| 1 month | 500 rows | 1,500 rows | 5,000 rows |
| 6 months | 3,000 rows | 9,000 rows | 30,000 rows |
| 1 year | 6,000 rows | 18,000 rows | 60,000 rows |
| 2 years | 12,000 rows | 36,000 rows | 120,000 rows |

### 2.2 Database Size (PostgreSQL, with indexes)

PostgreSQL is more space-efficient than SQLite for structured data due to proper typing and TOAST compression. The 23MB SQLite file (40K rows × 70 columns) translates to approximately 8-15MB in PostgreSQL.

| Timeframe | 1 Customer | 3 Customers | 10 Customers |
|-----------|-----------|-------------|--------------|
| 1 month | ~15 MB | ~45 MB | ~150 MB |
| 6 months | ~85 MB | ~255 MB | ~850 MB |
| 1 year | ~170 MB | ~510 MB | ~1.7 GB |
| 2 years | ~340 MB | ~1.0 GB | ~3.4 GB |

**Supabase Pro includes 8GB of database storage.** At 3 customers, the database won't reach 8GB for over 4 years. At 10 customers, it takes ~2 years to approach 8GB — and overage is only $0.125/GB.

### 2.3 File Storage (uploaded CSVs, generated reports)

| Timeframe | 1 Customer | 3 Customers | 10 Customers |
|-----------|-----------|-------------|--------------|
| 1 month | ~30 MB | ~90 MB | ~300 MB |
| 6 months | ~180 MB | ~540 MB | ~1.8 GB |
| 1 year | ~360 MB | ~1.1 GB | ~3.6 GB |
| 2 years | ~720 MB | ~2.2 GB | ~7.2 GB |

Assumptions:
- Monthly CSV import per customer: ~25MB (monthly Excel/CSV export from DMS system)
- Generated reports (morning briefs, export CSVs, HTML reports): ~5MB/month per customer

**Supabase Pro includes 100GB of file storage.** At 10 customers, file storage won't reach 100GB for over 27 years.

### 2.4 Total Storage Summary

| Customers | 1 Year DB | 1 Year Files | 1 Year Total | Supabase Pro Capacity | Headroom |
|-----------|-----------|-------------|-------------|----------------------|----------|
| 1 | 170 MB | 360 MB | 530 MB | 8 GB DB + 100 GB files | 98.5%+ free |
| 3 | 510 MB | 1.1 GB | 1.6 GB | 8 GB DB + 100 GB files | 95%+ free |
| 10 | 1.7 GB | 3.6 GB | 5.3 GB | 8 GB DB + 100 GB files | 79%+ free |
| 50 | 8.5 GB | 18 GB | 26.5 GB | Upgrade to Team plan | Scale trigger |

**Bottom line:** Supabase Pro's included storage is absurdly more than AKARA needs for the foreseeable future. Storage will never be the scaling bottleneck.

---

## 3. Supabase Evaluation (Detailed)

### 3.1 Why Supabase?

Supabase is an open-source Firebase alternative built on PostgreSQL. For AKARA, it replaces **six separate services** that would otherwise need to be assembled individually:

| Need | Without Supabase | With Supabase |
|------|-----------------|---------------|
| Database | Neon ($19/mo) or Railway Postgres ($5/mo) | **Included** (PostgreSQL 15) |
| Authentication | Custom JWT + bcrypt + session management | **Included** (Supabase Auth) |
| File storage | S3 ($3-5/mo) + upload endpoints | **Included** (S3-compatible storage) |
| Row-level security | Custom middleware per query | **Included** (PostgreSQL RLS) |
| Scheduled functions | Railway cron or external service | **Included** (Edge Functions + pg_cron) |
| Backups | Custom pg_dump scripts | **Included** (daily, 7-day retention) |

### 3.2 Supabase Pro Plan — What's Included ($25/month)

| Feature | Included Amount | AKARA Needs (1 Year, 3 Customers) | Utilization |
|---------|----------------|-----------------------------------|-------------|
| Database size | 8 GB | ~510 MB | 6.4% |
| File storage | 100 GB | ~1.1 GB | 1.1% |
| Bandwidth | 250 GB/month | ~5-10 GB/month | 2-4% |
| Monthly Active Users | 100,000 MAU | ~10-30 MAU | 0.03% |
| Edge Function invocations | 2 million/month | ~1,000/month (morning briefs) | 0.05% |
| Realtime connections | 500 concurrent | 0 (future feature) | 0% |
| Daily backups | 7-day retention | Meets requirement | 100% |
| Support | Email support | Sufficient | 100% |

**AKARA will use less than 7% of Supabase Pro's capacity across every dimension.**

### 3.3 PostgreSQL Database

Supabase runs PostgreSQL 15 with full SQL compatibility. The migration from SQLite is straightforward because:

1. **SQLite SQL → PostgreSQL SQL** has minimal syntax differences for AKARA's query patterns
2. **Supabase includes pgBouncer** for connection pooling (important since Railway will create connections per request)
3. **Full-text search via `tsvector`** is available if AKARA ever needs it (no need for a separate search service)
4. **JSONB support** is native — excellent for storing flexible chat history metadata and tenant config
5. **Extensions available:** `pg_cron` (scheduling), `pg_stat_statements` (query monitoring), `pgsodium` (encryption)

Performance comparison for AKARA's typical queries:

| Query Type | SQLite (current) | PostgreSQL (Supabase) | Notes |
|------------|-----------------|----------------------|-------|
| Dashboard aggregate (5 KPIs) | ~80-120ms | ~20-50ms | Postgres parallelizes aggregates |
| Copilot SQL (filtered + GROUP BY) | ~50-100ms | ~10-30ms | Better query planner, indexes |
| Full-table scan (anomaly detection) | ~200-400ms | ~50-100ms | Parallel seq scan |
| Monthly trend (12-month window) | ~100-200ms | ~30-60ms | Partition-friendly |

PostgreSQL will be **faster** than SQLite for every query AKARA runs, while also providing ACID transactions, concurrent writes, and connection pooling.

### 3.4 Supabase Auth

Supabase Auth provides everything AKARA needs for authentication with **zero custom code**:

| Feature | Details |
|---------|---------|
| Email + password login | Built-in, with email verification |
| Password reset | Built-in flow with customizable templates |
| Session management | JWT tokens, auto-refresh, configurable expiry |
| User metadata | Store `tenant_id`, `role`, `display_name` in user profile |
| Row-Level Security integration | `auth.uid()` and `auth.jwt()` available in RLS policies |
| Client libraries | `supabase-py` for Python, `@supabase/supabase-js` for frontend |
| Multi-factor auth (MFA) | Available when needed for enterprise customers |
| OAuth providers | Google, Microsoft, etc. — add later if needed |

**What this replaces from solutions.md:**
- Custom JWT implementation (~200 lines of code)
- bcrypt password hashing setup
- Session cookie management
- Token refresh logic
- CSRF protection middleware
- Password reset email flow

All of this is **zero code** with Supabase Auth.

#### Auth Integration with Streamlit

```python
# supabase_auth.py — Complete auth integration for Streamlit
import streamlit as st
from supabase import create_client, Client
import os

def get_supabase_client() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_ANON_KEY"]
    )

def login_page():
    """Render login form and handle authentication."""
    st.title("AKARA — Login")
    
    tab_login, tab_register = st.tabs(["Login", "Register"])
    
    with tab_login:
        email = st.text_input("Email", key="login_email")
        password = st.text_input("Password", type="password", key="login_password")
        
        if st.button("Login", type="primary"):
            supabase = get_supabase_client()
            try:
                response = supabase.auth.sign_in_with_password({
                    "email": email,
                    "password": password
                })
                st.session_state["user"] = response.user
                st.session_state["session"] = response.session
                st.session_state["tenant_id"] = response.user.user_metadata.get("tenant_id")
                st.rerun()
            except Exception as e:
                st.error(f"Login failed: {e}")
    
    with tab_register:
        st.info("Contact admin@akara.ai to create an account.")

def require_auth():
    """Gate all pages behind authentication. Call at the top of every page."""
    if "user" not in st.session_state or st.session_state["user"] is None:
        login_page()
        st.stop()
    return st.session_state["user"]

def get_tenant_id() -> str:
    """Get the current user's tenant ID from their JWT claims."""
    user = st.session_state.get("user")
    if not user:
        raise ValueError("No authenticated user")
    return user.user_metadata.get("tenant_id")

def logout():
    """Clear session and sign out."""
    supabase = get_supabase_client()
    supabase.auth.sign_out()
    for key in ["user", "session", "tenant_id"]:
        st.session_state.pop(key, None)
    st.rerun()
```

Usage in the main app:

```python
# app/dashboard.py — Add auth gate at the very top
from auth.supabase_auth import require_auth, get_tenant_id, logout

user = require_auth()
tenant_id = get_tenant_id()

# Sidebar logout button
with st.sidebar:
    st.write(f"Logged in as: {user.email}")
    if st.button("Logout"):
        logout()

# All database queries now include tenant_id
# RLS handles enforcement at the database level as a safety net
```

### 3.5 Supabase File Storage

Supabase Storage is S3-compatible object storage with built-in access policies.

**AKARA's file storage needs:**
1. **CSV uploads** — Customers upload monthly sales data exports (~20-50MB each)
2. **Generated reports** — Morning briefs, export CSVs, HTML dashboards (<5MB/month)
3. **Voice audio** — Currently in-memory; could optionally store for debugging

```python
# file_storage.py — Supabase Storage integration
from supabase import Client

def upload_csv(supabase: Client, tenant_id: str, file_bytes: bytes, filename: str) -> str:
    """Upload a customer CSV to tenant-isolated storage bucket."""
    path = f"{tenant_id}/imports/{filename}"
    
    supabase.storage.from_("customer-data").upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": "text/csv"}
    )
    
    return path

def list_uploads(supabase: Client, tenant_id: str) -> list:
    """List all uploads for a specific tenant."""
    return supabase.storage.from_("customer-data").list(
        path=f"{tenant_id}/imports"
    )

def download_report(supabase: Client, tenant_id: str, report_name: str) -> bytes:
    """Download a generated report."""
    path = f"{tenant_id}/reports/{report_name}"
    return supabase.storage.from_("customer-data").download(path)
```

Storage bucket policy (set in Supabase dashboard or via SQL):

```sql
-- Storage policy: users can only access files in their tenant's folder
CREATE POLICY "Tenant isolation for storage"
ON storage.objects
FOR ALL
USING (
    bucket_id = 'customer-data'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
);
```

### 3.6 Row-Level Security (RLS)

RLS is PostgreSQL's built-in mechanism for tenant isolation. It operates at the database engine level — even if application code has a bug, RLS prevents cross-tenant data access.

**This replaces:**
- Custom middleware to inject `WHERE tenant_id = ?` into every query
- Application-level access control checks
- Risk of SQL injection bypassing tenant filters

RLS policies for AKARA (detailed implementation in Section 12):

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE sales_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own tenant's data
CREATE POLICY "tenant_isolation" ON sales_data
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

### 3.7 Edge Functions + pg_cron (Scheduled Jobs)

AKARA's only scheduled job is the **morning brief**: an anomaly scan + LLM diagnosis + email sent each morning per customer.

**solutions.md proposed:** APScheduler or FlashQ with a separate worker process.

**Supabase solution:** pg_cron triggers a Supabase Edge Function. Zero additional infrastructure.

```sql
-- Schedule morning brief at 7 AM IST (1:30 UTC) daily
SELECT cron.schedule(
    'morning-brief-trigger',
    '30 1 * * *',  -- 7:00 AM IST = 1:30 UTC
    $$
    SELECT net.http_post(
        url := 'https://your-railway-app.up.railway.app/v1/jobs/morning-brief',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.cron_secret')
        ),
        body := jsonb_build_object('trigger', 'scheduled')
    );
    $$
);
```

Alternatively, use a Supabase Edge Function directly:

```typescript
// supabase/functions/morning-brief/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Get all active tenants
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, config")
    .eq("is_active", true)

  // Trigger morning brief for each tenant via the Railway app
  const results = await Promise.all(
    tenants!.map(async (tenant) => {
      const response = await fetch(
        `${Deno.env.get("RAILWAY_APP_URL")}/v1/jobs/morning-brief`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("CRON_SECRET")}`,
          },
          body: JSON.stringify({ tenant_id: tenant.id }),
        }
      )
      return { tenant_id: tenant.id, status: response.status }
    })
  )

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  })
})
```

### 3.8 Daily Backups

Supabase Pro includes automatic daily backups with 7-day retention. This replaces:
- Custom `pg_dump` cron scripts
- Backup storage management
- Backup verification scripts
- Backup rotation logic

For additional safety, you can set up a weekly logical backup to a separate location:

```sql
-- Optional: query to verify backup status via Supabase dashboard
-- Supabase handles this automatically — no code needed
```

If you ever need point-in-time recovery (PITR), upgrade to the Supabase Team plan ($599/mo) — but this is years away for AKARA.

### 3.9 Supabase Verdict

| Evaluation Criterion | Rating | Notes |
|---------------------|--------|-------|
| Covers all AKARA needs? | **Yes** | DB, auth, storage, RLS, cron, backups |
| Cost-effective? | **Yes** | $25/mo vs. $45-70 assembling parts |
| Easy to operate solo? | **Yes** | Dashboard, logs, metrics built-in |
| Growth headroom? | **Excellent** | Won't outgrow Pro for 2+ years at 10 customers |
| Vendor lock-in risk? | **Low** | Built on open-source Postgres, standard S3 storage |
| Migration difficulty? | **Low** | Standard pg_dump if you ever need to leave |
| Community & docs? | **Strong** | Large community, comprehensive docs, Python SDK |

**Verdict: Supabase Pro ($25/mo) single-handedly handles database, authentication, file storage, tenant isolation, scheduled functions, and backups. It is MORE than sufficient for AKARA. The app will not outgrow the Pro plan for years, even at 10 customers.**

---

## 4. Comparison with Alternatives

### 4.1 Hosting + Database Comparison

| Criterion | Supabase Pro + Railway | Railway + Neon | Render + Managed PG | Self-hosted VPS |
|-----------|----------------------|----------------|---------------------|-----------------|
| **Monthly cost** | **$32** ($25+$7) | **$24** ($5+$19) | **$26** ($7+$19) | **$12-24** (Hetzner/DO) |
| **Setup time** | **2-3 hours** | 3-4 hours | 3-4 hours | 8-16 hours |
| **Maintenance** | **Near zero** | Low | Low | **High** (patches, updates, monitoring) |
| **Auth included?** | **Yes** (Supabase Auth) | **No** (build custom) | **No** (build custom) | **No** (build custom) |
| **File storage?** | **Yes** (100GB S3-compatible) | **No** (add S3 ~$3/mo) | **No** (add S3 ~$3/mo) | DIY (disk space) |
| **RLS built-in?** | **Yes** (Postgres RLS) | Yes (Postgres RLS) | Yes (Postgres RLS) | Yes (Postgres RLS) |
| **Backups?** | **Daily included** | Neon: automatic | Manual pg_dump | **DIY cron scripts** |
| **Connection pooling?** | **pgBouncer included** | Neon: built-in | Manual setup | **DIY pgBouncer** |
| **Scheduled functions?** | **Edge Functions + pg_cron** | External service needed | External service needed | cron + scripts |
| **Dashboard/metrics?** | **Built-in** | Neon dashboard | Render dashboard | **Grafana DIY** |
| **Scaling effort** | Click upgrade | Click upgrade | Click upgrade | **Manual migration** |
| **SSL/HTTPS** | **Automatic** | Automatic | Automatic | **Let's Encrypt DIY** |
| **Total with auth+storage** | **$32/mo** | **$27-30/mo** + dev time | **$29-32/mo** + dev time | **$12-24/mo** + 40hrs dev time |

### 4.2 Adjusted Cost Comparison (Including Developer Time)

The raw hosting cost hides the real expense — developer time. For a solo student founder, time is the scarcest resource.

| Solution | Monthly Cost | Auth Dev Time | Storage Dev Time | Cron Dev Time | Total Setup |
|----------|-------------|--------------|-----------------|--------------|-------------|
| **Supabase + Railway** | $32 | 0 hours | 0 hours | 1 hour | **~8 hours** |
| Railway + Neon | $24-27 | 15-20 hours | 5-8 hours | 3-5 hours | **~40 hours** |
| Render + Managed PG | $26-29 | 15-20 hours | 5-8 hours | 3-5 hours | **~40 hours** |
| Self-hosted VPS | $12-24 | 15-20 hours | 5-8 hours | 3-5 hours | **~60 hours** |

**At even ₹500/hour for your time, the "cheaper" alternatives cost ₹16,000-26,000 more in development time.** The $8/month premium for Supabase pays for itself in the first week.

### 4.3 Verdict

**Supabase Pro + Railway wins because it bundles everything for $32/month that would cost $45-70/month assembled from parts — or would require 30-50 hours of additional development to replicate.**

The only scenario where an alternative wins:
- **VPS** wins if you need data residency in a specific country (Supabase regions are limited)
- **Neon** wins if you need serverless scaling to zero (AKARA doesn't need this)
- **Railway Postgres** wins if you want everything on one platform (but loses auth+storage)

For a solo student founder optimizing for speed-to-revenue, Supabase is the clear winner.

---

## 5. What solutions.md Got Wrong

The original `solutions.md` is a thorough document with correct instincts about **what** needs to happen. But it over-engineered the **how** by assuming the app was more complex than it is. Here's a specific accounting:

### 5.1 Redis/Caching Layer (Section 1.21 of solutions.md)

**What solutions.md recommended:** Redis for caching LLM responses, query results, and session data.

**Why it's wrong for AKARA:**
- The app has <10 concurrent users
- SQLite queries take <100ms; PostgreSQL will be faster
- LLM responses are inherently contextual (caching returns stale data)
- Session data is tiny (<1KB per user) and fits in Streamlit's `st.session_state`
- Redis adds $10-15/month + operational complexity

**Correct approach:** No caching. If query performance becomes an issue at 50+ users, add PostgreSQL materialized views first (zero additional infrastructure). Only consider Redis if materialized views aren't sufficient.

### 5.2 FlashQ/APScheduler/Background Workers (Section 1.21)

**What solutions.md recommended:** APScheduler or FlashQ for background job processing, with a separate worker process.

**Why it's wrong for AKARA:**
- The only "background job" is the morning brief (runs once per day per customer)
- A dedicated worker process costs $5-7/month on Railway for something that runs for 30 seconds
- APScheduler in a multi-process environment requires careful state management

**Correct approach:** Supabase pg_cron triggers an HTTP call to the Railway app's `/v1/jobs/morning-brief` endpoint. The endpoint runs synchronously (it takes ~30 seconds). No separate process needed. Alternatively, use a Supabase Edge Function to orchestrate.

### 5.3 GlitchTip Self-Hosted Error Monitoring (Section 1.14)

**What solutions.md recommended:** Self-hosted GlitchTip for error monitoring and alerting.

**Why it's wrong for AKARA:**
- Self-hosted GlitchTip requires its own server ($5-10/month), PostgreSQL database, and maintenance
- AKARA generates maybe 5-50 errors per day, not thousands
- Setting up, maintaining, and monitoring the monitoring tool is a recursive waste of time

**Correct approach:** Sentry free tier provides 5,000 errors/month with alerting, stack traces, and release tracking. That's 166 errors per day — far more than AKARA will generate. Zero cost, zero maintenance.

### 5.4 Complex JWT Auth Implementation (Section 1.6)

**What solutions.md recommended:** Custom JWT implementation with bcrypt password hashing, token refresh, CSRF protection, and session management. Approximately 300-500 lines of security-critical code.

**Why it's wrong for AKARA:**
- Auth is the #1 thing you should never build yourself unless you're a security team
- Custom auth has a high probability of security vulnerabilities (timing attacks, weak hashing, token leakage)
- Supabase Auth handles all of this with zero custom code and has been battle-tested by millions of users

**Correct approach:** Supabase Auth. Call `supabase.auth.sign_in_with_password()`. Done. The JWT it issues contains the user's `tenant_id` in claims, which RLS policies use for tenant isolation. Total custom auth code: ~30 lines (the `supabase_auth.py` wrapper shown in Section 3.4).

### 5.5 Complex Health Check with Dependency Verification (Section 1.16)

**What solutions.md recommended:** A health endpoint that checks database connectivity, Redis connectivity, queue health, LLM API availability, and external service status.

**Why it's wrong for AKARA:**
- There is no Redis. There are no queues. Checking them would check nothing.
- LLM API health checks are unreliable (API might be fine but rate-limited)
- External services (WeatherAPI, NewsAPI) are non-critical and have fallbacks

**Correct approach:**

```python
@app.get("/health")
async def health():
    """Simple health check — is the app alive and can it reach the database?"""
    try:
        supabase.table("tenants").select("id").limit(1).execute()
        return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "error": str(e)}
        )
```

That's it. 10 lines. Not 100.

### 5.6 Rate Limiting Middleware (Section 1.17)

**What solutions.md recommended:** slowapi rate limiting with per-user, per-endpoint limits, Redis-backed token bucket, and abuse detection.

**Why it's wrong for AKARA:**
- The app has <10 users, all known customers paying ₹20K/month
- Rate limiting solves a problem that doesn't exist
- If a paying customer sends too many queries, the correct response is to talk to them, not rate-limit them
- Redis-backed rate limiting adds infrastructure complexity

**Correct approach:** Don't implement rate limiting. Add it when you have 10+ customers or detect actual abuse. When you do add it, use `slowapi` with in-memory storage (no Redis needed for <50 users).

### 5.7 Multiple Environment Setup (Section 1.13)

**What solutions.md recommended:** Development, staging, and production environments with separate databases, configs, and deployment pipelines.

**Why it's wrong for AKARA:**
- Three environments triple infrastructure costs and operational complexity
- Staging is most valuable when you have a QA team — AKARA has one developer
- With 3 customers, "staging" is just running the app locally with test data

**Correct approach:** Two environments: **local** (your laptop with a Supabase local dev stack or a free Supabase project) and **production** (Railway + Supabase Pro). Add a staging environment when the team grows to 2+ developers or customer count exceeds 10.

### 5.8 Separate Monitoring Stack (Section 1.14-1.15)

**What solutions.md recommended:** GlitchTip + structured logging + custom dashboards + alerting pipelines.

**Why it's wrong for AKARA:**
- The monitoring infrastructure would cost more than the app itself
- AKARA's "monitoring needs" are: is the app running? are there errors? is the DB okay?

**Correct approach:**
- **Sentry free tier** for error tracking (5K errors/month)
- **UptimeRobot free tier** for uptime monitoring (50 monitors, 5-min intervals)
- **Supabase dashboard** for database metrics (query performance, connection count, storage usage)
- **Railway dashboard** for app metrics (CPU, memory, logs)
- Total cost: $0/month

### 5.9 Complex Backup Scripts (Section 1.20)

**What solutions.md recommended:** Custom pg_dump scripts with rotation, verification, encrypted offsite storage, and automated restore testing.

**Why it's wrong for AKARA:**
- Supabase Pro includes daily backups with 7-day retention
- For 3 customers with <1GB of data, this is more than sufficient
- Automated restore testing is important — for a database serving 10,000 users, not 10

**Correct approach:** Use Supabase's built-in daily backups. If paranoid, add a weekly manual backup via `pg_dump` through Supabase's direct database connection. Store it in Supabase Storage (it's included). Total lines of code: 0.

### 5.10 CORS Configuration (Section 1.18)

**What solutions.md recommended:** Detailed CORS middleware configuration with allowlists, headers, and credential handling.

**Why it's wrong for AKARA:**
- Streamlit runs as a monolith — the frontend and backend are the same process
- There are no cross-origin requests because there's no separate frontend
- The FastAPI endpoints are called from the same Streamlit process, not from a browser

**Correct approach:** Skip CORS entirely for now. If you later build a separate React frontend, add CORS at that point with a simple `origins=["https://app.akara.ai"]` config.

### 5.11 Summary of Over-Engineering

| solutions.md Recommendation | Estimated Dev Time | Monthly Cost | Correct Approach | Dev Time | Monthly Cost |
|---------------------------|-------------------|-------------|-----------------|---------|-------------|
| Redis caching | 8-12 hours | $10-15 | No caching needed | 0 hours | $0 |
| Background workers | 6-10 hours | $5-7 | pg_cron + HTTP call | 1 hour | $0 |
| GlitchTip self-hosted | 8-12 hours | $5-10 | Sentry free tier | 30 min | $0 |
| Custom JWT auth | 15-25 hours | $0 | Supabase Auth | 2 hours | $0 |
| Complex health checks | 4-6 hours | $0 | 10-line endpoint | 15 min | $0 |
| Rate limiting | 4-6 hours | $0 | Not needed | 0 hours | $0 |
| Staging environment | 4-8 hours | $20-30 | Local + production | 0 hours | $0 |
| Monitoring stack | 8-12 hours | $5-10 | Free tier tools | 1 hour | $0 |
| Custom backup scripts | 4-6 hours | $2-3 | Supabase built-in | 0 hours | $0 |
| CORS configuration | 2-3 hours | $0 | Not needed | 0 hours | $0 |
| **TOTAL** | **63-100 hours** | **$47-75/mo** | | **~5 hours** | **$0** |

**The over-engineering in solutions.md would cost 63-100 hours of development time and $47-75/month in infrastructure — all for problems that don't exist at AKARA's current scale.**

---

## 6. Recommended Architecture (Simplified)

### 6.1 Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    USER (Browser)                         │
│              HTTPS (Railway auto-SSL)                     │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│           Railway (Python App — $5-7/mo)                  │
│                                                           │
│   ┌────────────────┐    ┌─────────────────────────┐      │
│   │   Streamlit    │    │      FastAPI             │      │
│   │  (Dashboard,   │    │  (API endpoints)         │      │
│   │   Copilot UI,  │    │                          │      │
│   │   Simulator)   │    │  GET  /health            │      │
│   │                │    │  POST /v1/copilot/query   │      │
│   │  Port 8501     │    │  GET  /v1/kpi/revenue    │      │
│   │                │    │  POST /v1/jobs/brief     │      │
│   └───────┬────────┘    └──────────┬──────────────┘      │
│           │                        │                      │
│           └────────┬───────────────┘                      │
│                    │                                      │
│         ┌──────────┴──────────┐                           │
│         │   Service Layer     │                           │
│         │  (query_service,    │                           │
│         │   kpi_service,      │                           │
│         │   copilot_brain)    │                           │
│         └──────────┬──────────┘                           │
│                    │                                      │
└────────────────────┼──────────────────────────────────────┘
                     │
          ┌──────────┴──────────────────────┐
          │                                 │
          ▼                                 ▼
┌───────────────────────┐    ┌──────────────────────────────┐
│  Supabase ($25/mo)    │    │   External APIs               │
│                       │    │                                │
│  ┌─────────────────┐  │    │  ┌───────────────────────┐   │
│  │  PostgreSQL     │  │    │  │ Google Gemini 2.5     │   │
│  │  (sales_data,   │  │    │  │ (primary LLM)         │   │
│  │   chat_history, │  │    │  │ ~$15-25/customer/mo   │   │
│  │   tenants,      │  │    │  └───────────────────────┘   │
│  │   audit_log)    │  │    │                                │
│  │  + pgBouncer    │  │    │  ┌───────────────────────┐   │
│  │  + RLS          │  │    │  │ OpenRouter             │   │
│  └─────────────────┘  │    │  │ (LLM fallback +       │   │
│                       │    │  │  Whisper STT)          │   │
│  ┌─────────────────┐  │    │  └───────────────────────┘   │
│  │  Auth           │  │    │                                │
│  │  (email+pass,   │  │    │  ┌───────────────────────┐   │
│  │   JWT, sessions)│  │    │  │ WeatherAPI             │   │
│  └─────────────────┘  │    │  │ (context enrichment)   │   │
│                       │    │  └───────────────────────┘   │
│  ┌─────────────────┐  │    │                                │
│  │  Storage        │  │    │  ┌───────────────────────┐   │
│  │  (CSV uploads,  │  │    │  │ NewsAPI                │   │
│  │   reports)      │  │    │  │ (context enrichment)   │   │
│  └─────────────────┘  │    │  └───────────────────────┘   │
│                       │    │                                │
│  ┌─────────────────┐  │    │  ┌───────────────────────┐   │
│  │  Edge Functions │  │    │  │ Gmail SMTP             │   │
│  │  (pg_cron for   │  │    │  │ (morning brief email)  │   │
│  │   morning brief)│  │    │  └───────────────────────┘   │
│  └─────────────────┘  │    │                                │
│                       │    └──────────────────────────────┘
│  ┌─────────────────┐  │
│  │  Daily Backups  │  │
│  │  (automatic,    │  │
│  │   7-day retain) │  │
│  └─────────────────┘  │
│                       │
└───────────────────────┘

Monitoring (all free):
  ├── Sentry free tier (error tracking, 5K errors/mo)
  ├── UptimeRobot free (uptime monitoring, 5-min checks)
  ├── Supabase dashboard (DB metrics, storage usage)
  └── Railway dashboard (app metrics, deploy logs)
```

### 6.2 Request Flow — Copilot Query

```
User types question in Streamlit chat
    │
    ▼
Streamlit → FastAPI POST /v1/copilot/query
    │
    ▼
Auth middleware checks Supabase JWT (tenant_id extracted from claims)
    │
    ▼
query_service.py → copilot_brain.py
    │
    ├── Step 1: Intent classification (regex patterns)
    │   └── If matched → parameterized SQL → Supabase PostgreSQL → response
    │
    ├── Step 2: LLM planning (if intent not matched)
    │   └── Gemini 2.5 Flash → JSON tool-call plan
    │       ├── query_sales_db → SQL → Supabase PostgreSQL (RLS enforced)
    │       ├── get_weather → WeatherAPI
    │       ├── get_news → NewsAPI
    │       └── analyze_product → in-memory pandas
    │
    ├── Step 3: Guardrail chain
    │   ├── premise_check (false premise detection)
    │   ├── numeric_digest (column sum verification)
    │   ├── causal_postcheck (causal claim audit)
    │   └── data_scope (schema boundary enforcement)
    │
    ├── Step 4: LLM synthesis
    │   └── Gemini 2.5 Flash → natural language response
    │
    └── Step 5: Audit logging
        └── INSERT into audit_log (tenant_id, question, response, metadata)

Total LLM calls per query: 2-3
Total DB queries per query: 1-3
Total latency: 3-8 seconds (dominated by LLM inference)
```

### 6.3 Request Flow — Dashboard Load

```
User opens dashboard
    │
    ▼
Streamlit checks session → Supabase Auth token valid?
    │
    ├── No → Redirect to login page
    │
    └── Yes → Load dashboard
        │
        ▼
    5 parallel SQL queries to Supabase PostgreSQL (all RLS-filtered):
        ├── Total revenue (SUM of amounts for tenant)
        ├── Total orders (COUNT of distinct invoices for tenant)
        ├── Average order value (revenue / orders)
        ├── Top 10 products (GROUP BY product, ORDER BY revenue)
        └── Zone breakdown (GROUP BY zone, SUM revenue)
        │
        ▼
    Plotly renders charts in Streamlit
        │
        ▼
    Dashboard loaded (~1-2 seconds total)
```

### 6.4 Monthly Cost Breakdown

| Component | Cost | What It Does |
|-----------|------|-------------|
| Railway (Hobby) | $5-7/mo | Hosts the Python app (Streamlit + FastAPI) |
| Supabase Pro | $25/mo | PostgreSQL + Auth + Storage + Edge Functions + Backups |
| Gemini API (per customer) | $15-25/mo | LLM inference for copilot + morning brief |
| Sentry | $0 | Error tracking (free tier: 5K errors/mo) |
| UptimeRobot | $0 | Uptime monitoring (free tier: 50 monitors) |
| GitHub Actions | $0 | CI/CD (free for public repos, 2000 min/mo private) |
| Gmail SMTP | $0 | Morning brief emails (free, 500/day limit) |
| **Total (1 customer)** | **~$47-57/mo** | |
| **Total (3 customers)** | **~$82-107/mo** | |

---

## 7. Technology Decisions (Simplified)

Every technology choice is guided by one principle: **what is the simplest thing that works for <10 users with <500MB of data?**

| Category | Recommendation | Why | Alternative (Add When) |
|----------|---------------|-----|----------------------|
| **Frontend hosting** | Railway (with Streamlit) | Git push deploy, $5/mo, auto-SSL | Vercel if switching to React/Next.js |
| **Backend hosting** | Same Railway instance | Monolith, not microservices | Separate service at 50+ users |
| **Database** | Supabase PostgreSQL | 8GB included, RLS, backups, pgBouncer | Neon if need serverless scaling |
| **Authentication** | Supabase Auth | Zero code, email+password, JWT with claims | Auth0/Clerk if need SSO/SAML |
| **File storage** | Supabase Storage | 100GB included, S3-compatible API | Direct S3 at 500GB+ |
| **Background jobs** | pg_cron → HTTP POST to Railway | No separate worker, zero cost | Dedicated worker at 20+ daily jobs |
| **Caching** | NOT NEEDED YET | <10 users, queries <100ms | PG materialized views first, then Redis |
| **Email** | Gmail SMTP (first 3 customers) | Free, 500/day limit, already works | Resend ($20/mo) at 10+ customers |
| **Logging** | Python `structlog` → stdout | Railway captures stdout, searchable | Datadog at 20+ customers |
| **Error tracking** | Sentry free tier | 5K errors/mo, alerting, stack traces | Sentry Team ($26/mo) at 10+ customers |
| **Uptime monitoring** | UptimeRobot free tier | 50 monitors, 5-min intervals, email alerts | Better Stack ($29/mo) at 10+ customers |
| **Analytics** | In-app usage table in Supabase | Track queries, logins, feature usage | PostHog free tier when needed |
| **Secrets management** | Railway env vars + Supabase vault | Built into platforms, encrypted at rest | HashiCorp Vault for enterprise |
| **Backups** | Supabase daily (included) | 7-day retention, one-click restore | PITR on Supabase Team ($599) for enterprise |
| **CI/CD** | GitHub Actions (free tier) | Lint + test on push, deploy on merge | CircleCI/GitLab at 5+ developers |
| **Vector search** | NOT NEEDED | App uses SQL queries, not RAG retrieval | pgvector on Supabase if RAG needed |
| **AI model** | Gemini 2.5 Flash (paid tier) | $0.15/$0.60 per 1M tokens, best cost/quality | Gemini 2.0 Flash-Lite if cost-cutting |
| **Rate limiting** | NOT NEEDED YET | <10 known, paying users | `slowapi` in-memory at 10+ customers |
| **Tenant isolation** | Supabase RLS (tenant_id column) | Database-level enforcement, zero app code | Separate databases for enterprise isolation |
| **Queues** | NOT NEEDED | No async processing required | BullMQ/Celery at 100+ concurrent jobs |
| **Redis** | NOT NEEDED | No caching, pub-sub, or sessions needed | Add at 50+ concurrent users IF needed |
| **Kubernetes** | NOT NEEDED | Single container on Railway | EKS/GKE at 50+ containers |
| **Docker** | Nice-to-have for local dev | Railway auto-detects Python from `requirements.txt` | Required if switching to ECS/EKS |
| **Multiple environments** | Local + production only | Solo developer, 3 customers | Add staging at 2+ developers |
| **Feature flags** | Supabase config table or env vars | Simple `SELECT` or `os.environ` check | LaunchDarkly at 50+ flags |

### 7.1 Decision Framework — When to Re-evaluate

```
IF customers > 10     → Re-evaluate: monitoring, rate limiting, staging environment
IF customers > 50     → Re-evaluate: dedicated caching, separate services, dedicated DB
IF customers > 200    → Re-evaluate: Kubernetes, enterprise auth (SSO/SAML), team plan
IF team size > 2      → Re-evaluate: staging environment, code review tooling, CI complexity
IF data > 8GB         → Re-evaluate: Supabase compute upgrade or dedicated PostgreSQL
IF LLM cost > $500/mo → Re-evaluate: response caching, cheaper models, batching
IF latency > 10s p95  → Re-evaluate: query optimization, caching, connection pooling tuning
```

---

## 8. What NOT to Build

Explicit list of items from solutions.md Phase 1 that should be **DEFERRED** — not skipped forever, but deferred until there's evidence they're needed.

### 8.1 Defer: Custom JWT Implementation

**solutions.md Section 1.6** described ~300 lines of custom auth code including:
- bcrypt password hashing with salt rounds
- JWT token generation and validation
- Refresh token rotation
- CSRF token middleware
- Session cookie management
- Password reset flow with email tokens

**Replace with:** `supabase.auth.sign_in_with_password()` — a single function call.

**When to reconsider:** If you need to leave Supabase, or if enterprise customers require SAML/SSO that Supabase doesn't support (Supabase does support SSO on Team plan).

### 8.2 Defer: Redis Caching Layer

**solutions.md** mentions Redis for caching LLM responses and query results.

**Why defer:**
- The app serves <10 users. Database queries take <100ms. LLM calls take 3-5 seconds regardless.
- Caching LLM responses is dangerous — the same question about yesterday's sales should give a different answer today.
- The only cacheable data is dashboard aggregates, which can be cached in Streamlit's `@st.cache_data(ttl=300)` — zero infrastructure.

**When to reconsider:** If PostgreSQL query time exceeds 500ms at scale, add materialized views. If that's not enough, add Redis.

### 8.3 Defer: Background Job Worker Process

**solutions.md Section 1.21** described a dedicated worker process for:
- Morning brief generation
- Scheduled anomaly scans
- Email dispatch

**Why defer:** The morning brief takes ~30 seconds. Running it as a synchronous HTTP request triggered by pg_cron is perfectly fine. No need for a $5-7/month worker process that runs for 30 seconds per day.

**When to reconsider:** If you have 20+ scheduled jobs running at different times, or if any job takes >5 minutes.

### 8.4 Defer: GlitchTip Self-Hosted Monitoring

**solutions.md Section 1.14** described setting up GlitchTip (self-hosted Sentry alternative).

**Why defer:** Self-hosted monitoring requires its own server, database, and maintenance. Sentry's free tier provides 5,000 errors/month — 166 per day — more than AKARA will generate in the first year.

**When to reconsider:** When Sentry free tier limits are hit (5K errors/month) — switch to Sentry Team ($26/month), not self-hosted.

### 8.5 Defer: Complex Health Check with Dependency Verification

**solutions.md Section 1.16** described health checks that verify database, Redis, queue, and LLM connectivity.

**Why defer:** There is no Redis. There are no queues. A health check that verifies database connectivity is sufficient.

**When to reconsider:** When you have multiple dependent services that could fail independently.

### 8.6 Defer: Rate Limiting Middleware

**solutions.md Section 1.17** described per-user, per-endpoint rate limiting with Redis-backed token buckets.

**Why defer:** All users are known, paying customers. If someone sends too many requests, call them. Rate limiting solves abuse from anonymous users — AKARA has none.

**When to reconsider:** When the app is accessible without authentication, or when there are 10+ customers.

### 8.7 Defer: CORS Configuration

**solutions.md Section 1.18** described detailed CORS middleware.

**Why defer:** Streamlit is a monolith. The frontend and backend run in the same process. There are no cross-origin requests.

**When to reconsider:** When building a separate frontend (React, Next.js, etc.).

### 8.8 Defer: Multiple Deployment Environments (staging)

**solutions.md Section 1.13** described dev, staging, and production environments.

**Why defer:** Three environments triple cost and complexity. Test locally, deploy to production. With 3 customers and 1 developer, staging adds cost without proportional safety.

**When to reconsider:** When the team grows to 2+ developers, or when customer count exceeds 10.

### 8.9 Defer: Feature Flag System

**solutions.md** implied a feature flag system for gradual rollouts.

**Why defer:** With 1-3 customers, you can toggle features with an environment variable or a row in a Supabase `config` table. No need for LaunchDarkly.

```python
# Simple feature flag — a single env var or DB row
ENABLE_VOICE_INPUT = os.environ.get("ENABLE_VOICE_INPUT", "false") == "true"
```

**When to reconsider:** When you have 10+ features to toggle independently across 10+ customers.

### 8.10 Defer: Complex Structured Logging

**solutions.md Section 1.15** described a detailed structured logging setup with correlation IDs, log levels, and structured output.

**Why defer:** Railway captures stdout/stderr automatically and provides searchable logs. Python's built-in `logging` with `structlog` for JSON formatting is sufficient.

```python
import structlog
import logging

logging.basicConfig(level=logging.INFO, format="%(message)s")
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
)

logger = structlog.get_logger()
logger.info("copilot_query", tenant_id=tenant_id, question=question[:100])
```

**When to reconsider:** When you need log aggregation across multiple services (not applicable for a monolith).

### 8.11 Defer: Separate Admin Panel

**Why defer:** With 1-3 customers, you manage everything through:
- Supabase dashboard (database management, user management, storage)
- Railway dashboard (deployments, logs, env vars)
- Direct database queries for anything else

**When to reconsider:** When you have a non-technical team member who needs to manage customers.

### 8.12 Defer: Custom Backup Scripts

**Why defer:** Supabase Pro includes daily backups with 7-day retention. For <1GB of data across 3 customers, this is more than sufficient.

**When to reconsider:** When you need point-in-time recovery (PITR) — upgrade to Supabase Team plan. Or when compliance requires 90-day backup retention — add a weekly pg_dump to cloud storage.

### 8.13 Summary — Build vs. Defer

| Item | solutions.md says | This document says | Build Now? |
|------|------------------|-------------------|------------|
| Remove hardcoded secrets | Build | Build | **YES** |
| Supabase migration | Build (as custom PG) | Build (use Supabase) | **YES** |
| Authentication | Build (custom JWT) | Build (Supabase Auth) | **YES** |
| RLS tenant isolation | Build | Build | **YES** |
| Schema parameterization | Build | Build | **YES** |
| Deploy to Railway | Build | Build | **YES** |
| Error tracking (Sentry) | Build (GlitchTip) | Build (Sentry free) | **YES** |
| CI/CD (GitHub Actions) | Build | Build (simpler) | **YES** |
| CSV upload endpoint | Build | Build | **YES** |
| Morning brief cron | Build (worker) | Build (pg_cron) | **YES** |
| Redis caching | Build | Defer | **NO** |
| Background workers | Build | Defer | **NO** |
| Rate limiting | Build | Defer | **NO** |
| CORS | Build | Defer | **NO** |
| Staging environment | Build | Defer | **NO** |
| Custom backup scripts | Build | Defer | **NO** |
| Complex health checks | Build | Defer | **NO** |
| Feature flags | Build | Defer | **NO** |
| Admin panel | Build | Defer | **NO** |

---

## 9. Cost Analysis (Corrected)

### 9.1 Infrastructure Costs by Phase

| Phase | Monthly Cost | Breakdown |
|-------|-------------|-----------|
| **Development** | **$0** | Supabase free tier + local dev + Gemini free tier (15 RPM) |
| **1 customer** | **$52/mo** | Railway $7 + Supabase Pro $25 + Gemini ~$20 |
| **3 customers** | **$92/mo** | Railway $7 + Supabase Pro $25 + Gemini ~$60 |
| **10 customers** | **$237/mo** | Railway $12 (upgrade) + Supabase Pro $25 + Gemini ~$200 |
| **50 customers** | **$1,100/mo** | Railway $25 + Supabase Pro $50 (storage overage) + Gemini ~$1,000 |
| **100 customers** | **$2,100/mo** | Railway $50 + Supabase Team $100 + Gemini ~$2,000 |

### 9.2 Per-Customer LLM Cost Breakdown

| Usage Level | Daily Queries | LLM Calls/Day | Monthly Input Tokens | Monthly Output Tokens | Monthly Cost |
|------------|--------------|--------------|---------------------|---------------------|-------------|
| Light user | 20 queries | 50 calls | 50M tokens | 12.5M tokens | ~$6/mo |
| Average user | 50 queries | 125 calls | 125M tokens | 31M tokens | ~$15/mo |
| Heavy user | 100 queries | 250 calls | 250M tokens | 62.5M tokens | ~$30/mo |
| Power user | 200 queries | 500 calls | 500M tokens | 125M tokens | ~$60/mo |

Calculation basis:
- Each copilot query = ~2.5 LLM calls (plan + synthesize + optional guardrail)
- Average input tokens per call: ~2,000
- Average output tokens per call: ~500
- Gemini 2.5 Flash pricing: $0.15 per 1M input tokens, $0.60 per 1M output tokens
- Morning brief: adds ~5 LLM calls/day per customer (~negligible vs. copilot usage)

### 9.3 Revenue Model

| Customers | Monthly Revenue (₹20K/customer) | Monthly Revenue (USD) | Monthly Cost | Gross Margin |
|-----------|--------------------------------|----------------------|-------------|-------------|
| 1 | ₹20,000 | ~$240 | $52 | **78%** |
| 3 | ₹60,000 | ~$720 | $92 | **87%** |
| 5 | ₹100,000 | ~$1,200 | $132 | **89%** |
| 10 | ₹200,000 | ~$2,400 | $237 | **90%** |
| 50 | ₹1,000,000 | ~$12,000 | $1,100 | **91%** |
| 100 | ₹2,000,000 | ~$24,000 | $2,100 | **91%** |

**Key insight:** Infrastructure costs scale sub-linearly (Supabase Pro handles 1-10 customers on the same $25/mo), while revenue scales linearly. Gross margin improves from 78% to 91% as customers increase.

### 9.4 Comparison with solutions.md Cost Estimates

| Phase | solutions.md Estimate | Revised Estimate | Savings |
|-------|---------------------|-----------------|---------|
| 1 customer | $65-95/mo | $52/mo | **37-45%** |
| 3 customers | $95-140/mo | $92/mo | **3-34%** |
| 10 customers | $180-280/mo | $237/mo | **15-32%** (LLM costs dominate) |

The savings are most dramatic at the start (when you can least afford waste) and diminish as LLM costs dominate at scale. LLM costs are the same regardless of infrastructure choices.

### 9.5 Cost Optimization Levers

If costs need to be reduced:

| Lever | Savings | Trade-off |
|-------|---------|-----------|
| Switch Gemini 2.5 Flash → 2.0 Flash-Lite | ~60% LLM cost reduction | Slightly lower quality responses |
| Cache dashboard aggregate queries (5-min TTL) | ~20% DB query reduction | Dashboard data 5 min stale |
| Implement response caching for common queries | ~30% LLM cost reduction | May return stale answers |
| Rate-limit copilot to 100 queries/user/day | Predictable max LLM cost | User-facing limit |
| Use Supabase free tier (dev/testing) | -$25/mo | No backups, 500MB DB limit |
| Batch morning brief LLM calls | ~10% LLM cost reduction | Slightly delayed briefs |

### 9.6 Break-Even Analysis

| Scenario | Monthly Cost | Break-Even Revenue | Break-Even Customers (₹20K each) |
|----------|-------------|-------------------|----------------------------------|
| Minimum viable | $52/mo (1 customer) | ₹4,300/mo (~$52) | **0.26 customers** |
| Comfortable | $92/mo (3 customers) | ₹7,700/mo (~$92) | **0.46 customers** |
| Growth | $237/mo (10 customers) | ₹19,800/mo (~$237) | **1.19 customers** |

**AKARA is profitable from Customer #1.** Even with the most conservative usage estimates, a single customer paying ₹20,000/month covers all infrastructure costs with 78% margin.

---

## 10. Scaling Triggers (When to Change)

Instead of pre-building for scale, monitor these triggers and act only when thresholds are approached.

### 10.1 Infrastructure Scaling Triggers

| Trigger | Threshold | Symptom | Action | Estimated Cost Impact |
|---------|-----------|---------|--------|----------------------|
| **DB size** | >6 GB | Supabase dashboard warns "Approaching 8GB limit" | Pay $0.125/GB overage, or upgrade Supabase compute | +$2-5/mo per additional GB |
| **File storage** | >80 GB | Supabase dashboard shows >80% storage | Pay $0.02/GB overage (extremely cheap) | +$1-2/mo per 50GB |
| **Concurrent users** | >50 | Dashboard page load >5s, Railway CPU >80% | Upgrade Railway to Performance plan ($20/mo) | +$13/mo |
| **API response time** | >10s p95 | Users complain about slow copilot | Add PG materialized views for common aggregates | $0 (SQL only) |
| **Connection pool exhaustion** | >20 concurrent connections | "too many connections" errors | Tune pgBouncer settings in Supabase | $0 (config only) |
| **Railway memory** | >512 MB RSS | OOM kills, app restarts | Upgrade Railway plan or optimize pandas operations | +$5-10/mo |

### 10.2 Product Scaling Triggers

| Trigger | Threshold | Symptom | Action |
|---------|-----------|---------|--------|
| **Customers** | >10 | Onboarding takes >2 days manually | Build self-service onboarding wizard |
| **Customers** | >20 | Manual billing unsustainable | Integrate Stripe/Razorpay for automated billing |
| **Team size** | >2 developers | Code conflicts, deployment fears | Add staging environment, PR-based deployments |
| **Feature requests** | >5 pending | Customers want different features | Build feature flag system (simple config table) |
| **Support tickets** | >5/week | Can't handle support volume | Build in-app help docs, FAQ page |

### 10.3 Cost Scaling Triggers

| Trigger | Threshold | Symptom | Action |
|---------|-----------|---------|--------|
| **LLM costs** | >$500/mo | LLM exceeds 30% of revenue | Switch to cheaper model, add response caching |
| **LLM costs** | >$2,000/mo | Need to optimize aggressively | Negotiate volume pricing with Google, batch calls |
| **Infra costs** | >$200/mo | Supabase Pro limits approaching | Evaluate Supabase Team ($599) vs. self-managed |
| **Total costs** | >40% of revenue | Margins shrinking | Full cost audit, consider reserved instances |

### 10.4 Security/Compliance Scaling Triggers

| Trigger | Threshold | Symptom | Action |
|---------|-----------|---------|--------|
| **Enterprise customer** | Contract requires | RFP mentions SOC 2, ISO 27001 | Begin SOC 2 Type 1 process (~3-6 months, ~$20K) |
| **Data residency** | India mandate | Customer requires India-only data | Migrate to Supabase Mumbai region or self-hosted |
| **Pen testing** | >10 customers | Security risk increases with exposure | Hire pen tester (~$5K-15K one-time) |
| **Audit logging** | Compliance request | Customer needs detailed access logs | Enhance audit_log table with IP, user agent, etc. |

### 10.5 What Happens at Each Customer Milestone

#### At 3 Customers (Launch Target)

No infrastructure changes needed. Same Railway ($7/mo) + Supabase Pro ($25/mo). Total: $92/mo including LLM.

#### At 10 Customers

- Upgrade Railway to better compute ($12-15/mo)
- Monitor Supabase DB size (~1.7GB, well within 8GB limit)
- Consider adding staging environment
- Consider automated billing (Razorpay)
- Total: ~$237/mo including LLM

#### At 50 Customers

- Upgrade Railway to Performance plan ($25/mo)
- Supabase may need minor storage overage ($5-10/mo)
- Add monitoring: Sentry Team ($26/mo) + Better Stack ($29/mo)
- Build self-service onboarding
- Hire first support/ops person
- Total: ~$1,100/mo including LLM

#### At 100 Customers

- Evaluate Supabase Team ($599/mo) for PITR, SLA, priority support
- Or migrate to dedicated PostgreSQL (RDS/Cloud SQL) + keep Supabase Auth
- Railway may need multiple instances ($50-100/mo)
- Build admin dashboard
- Full SOC 2 compliance process
- Total: ~$2,100/mo including LLM

---

## 11. Phase 1 — Production-Ready for Customer #1 (2-Week Rebuild)

**Duration:** 2 weeks (intensive grind)
**Goal:** A deployed, authenticated, multi-tenant app with React UI that a paying FMCG distributor can use
**Approach:** Clean rebuild — the old repo is reference material, not the starting point

---

### 11.1 Philosophy: Rebuild, Not Patch

You are **not patching the old codebase**. You're building a new, clean implementation that **ports the good logic** (guardrails, LLM failover, prompt engineering) into a proper architecture.

The old `dailyassistant-dms-client` repo becomes your **reference material**. You extract the proven ideas (guardrails, failover chains, prompt engineering patterns) and rewrite them cleanly in a new modular architecture. This is faster than trying to untangle and fix the existing monolith.

---

### 11.2 Codebase Restructuring

#### What Gets Restructured

| Old (Messy) | New (Clean) |
|-------------|-------------|
| `dashboard.py` — 54KB monolith (all UI in one file) | `frontend/src/pages/` — separate React pages per feature |
| `copilot_brain.py` — 59KB monolith (prompts + tools + planner + synthesis all tangled) | `backend/app/services/copilot/planner.py`, `tools.py`, `synthesizer.py`, `guardrails/` |
| `scripts/` with `sys.path.insert` hacks | Proper Python package with `__init__.py` and clean imports |
| Hardcoded "Bajaj" schema in 15+ files | Config-driven: tenant config JSONB → dynamic prompt generator reads it |
| No types, bare `except Exception: pass` | Full type hints, Pydantic models everywhere, specific exception handling |
| `requirements.txt` missing half the deps | `pyproject.toml` with pinned versions + `uv.lock` |
| No linting, no formatting | `ruff` for linting + formatting, enforced in CI |
| Feature flags with conflicting defaults | Single `config.py` with Pydantic settings, validated at startup |
| SQLite with raw string queries | Supabase Postgres with parameterized queries + RLS |
| Dead code (`if False:` notification tab, legacy coffee-shop refs) | Removed entirely |
| 40 scratch scripts | Deleted |
| No tests in CI | Tests run on every push, block merge if failing |

#### How `copilot_brain.py` Gets Decomposed

**Before (1 file, 59KB, 1237 lines):**
```
scripts/copilot_brain.py
├── System prompt (200 lines of hardcoded Bajaj schema)
├── Tool definitions (4 tools, inline)
├── Plan generation (LLM call)
├── Tool execution loop
├── Synthesis (LLM call)
├── LLM failover logic
├── Error handling
└── Everything tangled together
```

**After (clean modules, each <300 lines):**
```
backend/app/services/
├── copilot/
│   ├── __init__.py
│   ├── agent.py              # CopilotAgent class — orchestrates the pipeline
│   ├── planner.py            # generate_plan(question, schema) → ToolCallPlan
│   ├── synthesizer.py        # synthesize(question, tool_results, guardrail_output) → Answer
│   ├── tools/
│   │   ├── __init__.py       # ToolRegistry (register/lookup)
│   │   ├── query_sales.py    # query_sales_db tool (tenant-scoped)
│   │   ├── holiday.py        # get_holiday_status tool
│   │   ├── news.py           # get_news_context tool
│   │   └── product_mix.py    # analyze_product_mix tool
│   └── guardrails/
│       ├── __init__.py       # run_all_guardrails(response) → GuardrailResult
│       ├── premise_check.py  # Catches false decline assumptions
│       ├── numeric_digest.py # Column-sum verification
│       ├── numeric_postcheck.py
│       ├── causal_postcheck.py
│       └── data_scope.py     # Schema boundary enforcement
├── llm/
│   ├── __init__.py
│   ├── manager.py            # LLMManager with failover chain
│   ├── gemini.py             # Gemini-specific client
│   └── openrouter.py         # OpenRouter-specific client
├── prompts/
│   ├── __init__.py
│   ├── generator.py          # generate_system_prompt(tenant_config, schema_metadata)
│   └── templates.py          # Prompt fragments (reusable, parameterized)
└── sql/
    ├── guard.py              # SQL safety (allowlist, blocklist, limits)
    └── executor.py           # Safe query execution with timeout
```

#### No More Hardcoded Schema

**Before (scattered across 15+ files):**
```python
# Hardcoded everywhere
query = "SELECT SUM(NET_AMT) FROM VIEW_AI_SALES WHERE ZONE = ?"
```

**After (config-driven):**
```python
# backend/app/services/prompts/generator.py
async def generate_system_prompt(tenant_id: str, db: AsyncSession) -> str:
    config = await get_tenant_config(tenant_id, db)
    schema = await discover_schema(tenant_id, db)
    
    return SYSTEM_PROMPT_TEMPLATE.format(
        company_name=config.company_name,
        table_name=config.primary_table,
        revenue_column=config.column_mappings["revenue"],
        date_column=config.column_mappings["date"],
        columns=format_column_docs(schema.columns),
        business_terms=config.business_terminology,
        sql_examples=generate_example_queries(config),
    )
```

---

### 11.3 Code Quality Standards

```
Rules (enforced by ruff + CI):
├── Every function has type hints
├── Every API endpoint has a Pydantic request/response model
├── No file exceeds 300 lines (split if larger)
├── No bare `except Exception` — catch specific errors
├── No hardcoded strings for schema/column names
├── No secrets anywhere in code
├── Every service is independently testable (dependency injection)
├── Every SQL query is parameterized (no f-strings)
└── Imports are absolute, never sys.path hacks
```

**Tooling:**
- `ruff` for linting + formatting (single tool, replaces flake8 + black + isort)
- `pyproject.toml` with pinned versions + `uv.lock` for reproducible builds
- `uv` as package manager (fast, resolves correctly)
- `pytest` for tests
- `structlog` for structured JSON logging
- GitHub Actions: `ruff check` + `ruff format --check` + `pytest` on every push

---

### 11.4 The Two Tracks

The 14 days run two parallel tracks. They never block each other.

| | Track 1: Customer-Facing Product | Track 2: Operations |
|--|----------------------------------|---------------------|
| **What** | Backend + React frontend + deploy | Admin console + monitoring + CI |
| **Who uses it** | Your customer | You |
| **Blocks** | Revenue / first sale | Your efficiency after launch |
| **Priority** | Critical path — no compromises | Start when Track 1 backend is stable (Day 5) |

**Until Day 10, Track 2 never delays Track 1.** You manage tenants directly through Supabase Dashboard (Table Editor + SQL Editor) — it's already a full admin UI. You don't need your own admin console to test or demo.

**On CI:** GitHub Actions is developer tooling that protects a team from each other. You are a solo developer. Instead of spending 2-3 hours wiring up CI during the build, run this before every push:

```bash
ruff check . && pytest
```

Same protection, zero setup overhead. CI gets added properly on Day 13 when the codebase is stable and you're in polish mode.

---

### 11.5 Exact 14-Day Roadmap

```
DAY │ TRACK 1: CUSTOMER-FACING PRODUCT           │ TRACK 2: OPERATIONS
────┼────────────────────────────────────────────┼──────────────────────────────────
 1  │ Monorepo scaffold                          │ —
    │ • frontend/ + backend/ + supabase/ dirs    │
    │ • pyproject.toml + uv + ruff configured    │
    │ • Supabase project created                 │
    │ • All SQL migrations written               │
    │   (tenants, profiles, sales_data,          │
    │    chat_history, audit_log, reports)       │
    │ • RLS policies on every table              │
    │ • .env.example + .gitignore                │
────┼────────────────────────────────────────────┼──────────────────────────────────
 2  │ FastAPI core structure                     │ —
    │ • App entrypoint, router, CORS             │
    │ • Pydantic Settings (validated at startup) │
    │ • Supabase JWT auth middleware             │
    │ • Tenant context middleware                │
    │ • /health endpoint                         │
    │ • Dependency injection pattern wired up    │
────┼────────────────────────────────────────────┼──────────────────────────────────
 3  │ Port copilot — CLEAN                       │ —
    │ • services/copilot/agent.py                │
    │ • services/copilot/planner.py              │
    │ • services/copilot/synthesizer.py          │
    │ • services/copilot/tools/ (4 tools)        │
    │ • services/copilot/guardrails/ (5 files)   │
    │ • services/llm/manager.py (failover)       │
    │ • services/sql/guard.py + executor.py      │
    │ • All types, no bare exceptions            │
────┼────────────────────────────────────────────┼──────────────────────────────────
 4  │ Port KPI + data services — CLEAN           │ —
    │ • services/kpi/ (tenant-scoped queries)    │
    │ • services/data_import/ (CSV parser,       │
    │   validator, column mapper, bulk insert)   │
    │ • services/schema/discovery.py             │
    │ • services/prompts/generator.py            │
    │   (config-driven, no hardcoded Bajaj)      │
────┼────────────────────────────────────────────┼──────────────────────────────────
 5  │ Deploy backend + smoke test                │ Admin APIs (backend)
    │ • Admin + reports API routes               │ • POST /admin/tenants
    │ • Railway deployment configured            │ • GET  /admin/tenants
    │ • All env vars set in Railway              │ • POST /admin/tenants/{id}/users
    │ • /docs (FastAPI auto-docs) working        │ • POST /admin/tenants/{id}/import
    │ • Supabase Edge Function: morning brief    │ • GET  /admin/query-logs
    │   cron job wired up                        │ • GET  /admin/health
    │ • Manual smoke test: auth, query,          │
    │   import, copilot all working              │
────┼────────────────────────────────────────────┼──────────────────────────────────
 6  │ React scaffold + auth                      │ Admin console — Tenants page
    │ • Vite + React Router + TailwindCSS        │ • Tenant list table
    │ • shadcn/ui component library              │ • Create tenant form
    │ • Supabase Auth (login/signup/logout)      │ • Tenant config editor (JSONB)
    │ • Axios API client with JWT headers        │ • Activate/deactivate toggle
    │ • Protected route wrapper                  │
    │ • Deploy to Vercel                         │
────┼────────────────────────────────────────────┼──────────────────────────────────
 7  │ Dashboard page                             │ Admin console — Users page
    │ • KPI cards (revenue, volume, top zone,    │ • User list per tenant
    │   top product) with loading skeletons      │ • Create user form
    │ • Revenue trend line chart (Recharts)      │ • Role assignment
    │ • Zone breakdown bar chart                 │ • Reset password trigger
    │ • Top 10 products table                    │
    │ • Date range filter + zone filter          │
────┼────────────────────────────────────────────┼──────────────────────────────────
 8  │ Copilot page                               │ Admin console — Data + Logs
    │ • Chat message list                        │ • Import data for any tenant
    │ • Input box + send (Enter key)             │ • Query log viewer (table,
    │ • Streaming-feel (token-by-token display)  │   filterable by tenant/date)
    │ • Suggested question pills                 │ • System health panel
    │ • Expandable thought process section       │   (API status, DB size,
    │ • Chat history from DB (persisted)         │   recent Sentry errors)
────┼────────────────────────────────────────────┼──────────────────────────────────
 9  │ Data Management + Settings pages           │ Admin console — Reports
    │ • CSV drag-drop upload zone                │ • Manual morning brief trigger
    │ • Column preview table before import       │ • Scheduled jobs status view
    │ • Import progress + success/error state    │ • Log of briefs sent per tenant
    │ • Settings: profile, password change,      │
    │   notification preferences                 │
────┼────────────────────────────────────────────┼──────────────────────────────────
10  │ Reports + Simulator pages                  │ Sentry + UptimeRobot
    │ • Reports: morning brief display,          │ • Sentry free tier wired into
    │   anomaly alert history                    │   FastAPI + React
    │ • Simulator: zone/date/weather controls    │ • UptimeRobot monitors /health
    │   + prediction chart                       │   every 5 minutes
    │                                            │ • Alert to email on downtime
────┼────────────────────────────────────────────┼──────────────────────────────────
11  │ UI polish pass                             │ Onboarding dry-run
    │ • Loading skeletons on every data fetch    │ • Create test tenant via admin
    │ • Empty states (no data yet)               │ • Import Bajaj CSV
    │ • Error states (API down, auth expired)    │ • Run 10 copilot questions
    │ • 404 page                                 │ • Check morning brief fires
    │ • Mobile responsiveness check             │ • Fix anything broken
────┼────────────────────────────────────────────┼──────────────────────────────────
12  │ 20 core tests (backend)                   │ Internal documentation
    │ • Auth middleware (valid/invalid/expired)  │ • Customer onboarding runbook
    │ • Tenant isolation (RLS proves no leak)    │ • Env var reference
    │ • Copilot planner (intent parsing)         │ • API docs cleanup (/docs)
    │ • Guardrails (each one, pass/fail)         │
    │ • KPI queries (correct tenant scoping)     │
    │ • Data import (valid/invalid CSV)          │
    │ • Admin endpoints (auth required)          │
────┼────────────────────────────────────────────┼──────────────────────────────────
13  │ Privacy + legal + domain                  │ GitHub Actions CI (now it fits)
    │ • Privacy policy page (DPDP Act 2023)     │ • ruff check on push
    │ • Terms of service page                    │ • ruff format --check
    │ • Custom domain on Vercel                  │ • pytest runs on push
    │ • SSL confirmed on frontend + backend      │ • Merge blocked if failing
────┼────────────────────────────────────────────┼──────────────────────────────────
14  │ END-TO-END TEST + DEMO PREP               │ —
    │ • Full flow as a new customer:             │
    │   sign up → upload CSV → ask questions    │
    │   → view dashboard → check morning brief  │
    │ • Fix any last bugs                        │
    │ • Record a 3-min demo video                │
    │ • App is live, tested, ready to show       │
────┴────────────────────────────────────────────┴──────────────────────────────────
```

### Milestone Checkpoints

| Day | State |
|-----|-------|
| **5** | Backend live on Railway. Auth, copilot, and data import all working via API. |
| **10** | Full React app on Vercel. Customer can log in, see data, use copilot. **Demo-ready.** |
| **12** | Admin console complete. You can manage tenants without touching Supabase Dashboard directly. |
| **14** | Everything tested, monitored, documented. Ready for Customer #1. |

### Hard Rules for the 14 Days

- No new features after Day 5 — finish what's planned, don't add
- No premature optimization — if it works, ship it
- Every day ends with something deployed, not just local
- Track 2 never delays Track 1 — if behind on Track 1, drop Track 2 that day

---

### 11.6 Multi-Tenant Isolation (How It Works)

This section answers the critical question: **How do you prevent Company A from seeing Company B's data?**

The answer: **it's enforced at the database level, not just the application level.** Even if your code has a bug, the data still can't leak.

#### Layer 1: Every Row Has a `tenant_id`

```sql
CREATE TABLE sales_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    date DATE,
    zone TEXT,
    product TEXT,
    net_amt NUMERIC,
    ...
);
```

Every single row of data belongs to a specific tenant. No exceptions.

#### Layer 2: Supabase RLS (Row-Level Security) — The Hard Wall

```sql
-- This policy runs on EVERY query, automatically
ALTER TABLE sales_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own tenant's data"
ON sales_data
FOR ALL
USING (
    tenant_id = (
        SELECT tenant_id FROM profiles
        WHERE id = auth.uid()
    )
);
```

Even if your FastAPI code accidentally runs `SELECT * FROM sales_data` with no WHERE clause — the database itself only returns rows matching the logged-in user's tenant. It is physically impossible to see another tenant's data through normal queries.

#### Layer 3: The Request Flow

```
User from Company B logs in
        │
        ▼
┌─────────────────────────────────────────────────┐
│  Supabase Auth issues JWT with user_id           │
│  JWT contains: { sub: "user-uuid-xyz" }          │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  FastAPI Auth Middleware                          │
│  - Verifies JWT signature (can't be forged)      │
│  - Extracts user_id from token                   │
│  - Looks up user's tenant_id from profiles table │
│  - Injects tenant_id into request context        │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  Copilot generates SQL for the question          │
│  e.g. "What were my sales last month?"           │
│                                                  │
│  SQL: SELECT SUM(net_amt) FROM sales_data        │
│       WHERE date >= '2026-06-01'                 │
│                                                  │
│  Notice: no WHERE tenant_id = ... needed!        │
│  RLS adds it automatically at the DB level.      │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  Database returns ONLY Company B's data          │
│  Company A's data is invisible — doesn't exist   │
│  from this connection's perspective              │
└─────────────────────────────────────────────────┘
```

#### Layer 4: Attack Prevention

| Attack | Why It Fails |
|--------|--------------|
| User modifies their JWT to change `user_id` | JWT is cryptographically signed by Supabase — any modification invalidates it |
| User adds `WHERE tenant_id = 'other-company'` via SQL injection | RLS still applies — even if the query mentions another tenant_id, Postgres returns zero rows because `auth.uid()` doesn't match |
| User calls the API directly (bypasses frontend) | Auth middleware rejects the request if JWT is missing/invalid |
| A bug in your code forgets to filter by tenant | RLS catches it at the database layer — it's a safety net below your code |
| Admin accidentally exposes an endpoint without auth | A pytest test verifies every route requires the auth dependency — run locally before every push |

#### Layer 5: Extra Safety in the Copilot

```python
# backend/app/services/sql/guard.py
import re

BLOCKED_PATTERNS = [
    r"tenant_id\s*(!?=|<>|IN)",  # Can't manually filter tenants
    r"FROM\s+tenants",            # Can't query tenant table
    r"FROM\s+profiles",           # Can't query other users
    r"pg_catalog",                # Can't inspect DB internals
]

def validate_generated_sql(sql: str) -> bool:
    """Reject any LLM-generated SQL that tries to
    reference tenant boundaries or system tables."""
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, sql, re.IGNORECASE):
            raise SQLSafetyViolation(f"Blocked pattern: {pattern}")
    return True
```

Even the LLM is prevented from generating queries that could try to cross tenant boundaries.

#### Layer 6: The Admin Console (Platform Owner's View)

You, as the platform admin, have a **service role key** (not a normal user JWT) that bypasses RLS — so you can see all tenants' data in your admin console. This is stored server-side only, never exposed to the frontend.

```python
# Admin routes use service_role client
@router.get("/admin/tenants/{tenant_id}/stats")
async def get_tenant_stats(
    tenant_id: str,
    admin: Admin = Depends(require_admin_role)
):
    # Uses service_role — bypasses RLS intentionally
    supabase = get_service_client()
    data = supabase.table("sales_data").select("*").eq("tenant_id", tenant_id).execute()
    ...
```

#### In Plain Terms

When someone from a different company uses AKARA:

- They sign up → get their own tenant space
- They upload **their** data → tagged with **their** `tenant_id`
- They ask questions → copilot only sees **their** data
- They literally cannot see, query, or infer anything about other tenants
- This isn't just code logic — it's a **database-level guarantee** via RLS

It's the same pattern that Notion, Supabase Dashboard, Linear, and every multi-tenant SaaS uses. Data is invisible to other tenants at the storage layer itself.

---

### 11.7 What's Included vs. Deferred

#### Included in Phase 1

| Category | What's Done |
|----------|-------------|
| **Auth** | Email + password login via Supabase Auth |
| **Multi-tenancy** | PostgreSQL RLS, tenant_id on all tables |
| **Frontend** | React + TailwindCSS + shadcn/ui on Vercel |
| **Backend** | FastAPI on Railway |
| **Database** | Supabase PostgreSQL (8GB) |
| **AI Copilot** | Gemini 2.5 Flash + OpenRouter failover + all guardrails |
| **Dashboard** | KPI cards, charts, filters, export |
| **Data Import** | CSV/Excel upload with column mapping |
| **Reports** | Morning brief via cron (Edge Function) |
| **Simulator** | What-if prediction (RandomForest) |
| **Admin** | Tenant CRUD, user management, data import, health |
| **Security** | RLS, HTTPS, no secrets in code, SQL guard |
| **CI/CD** | GitHub Actions added Day 13 (codebase stable by then) |
| **Local quality gate** | `ruff check . && pytest` run before every push (Days 1–12) |
| **Monitoring** | Sentry free tier + UptimeRobot |
| **Backups** | Supabase daily (automatic) |
| **Code quality** | ruff linting, type hints, 300-line max, no bare exceptions |
| **Architecture** | Modular services, dependency injection, proper packaging |

#### Deferred (NOT in Phase 1)

| Deferred | When |
|----------|------|
| Billing/payments integration | Before Customer #3 (manual invoicing for #1) |
| Self-service signup (public) | Phase 2 (you manually create tenants via admin) |
| Voice input | Phase 2 (nice-to-have, not critical) |
| Industry templates | Phase 2 |
| White-labeling | Phase 3 |
| Mobile app | Phase 3+ |
| SSO / enterprise auth | Phase 4 |
| Advanced analytics (cohorts, funnels) | Phase 3 |

---

### 11.8 Cost During Phase 1

| Service | During Dev | With Customer #1 |
|---------|-----------|-----------------|
| Supabase | $0 (free) | $25/mo (Pro) |
| Railway | $5/mo | $5/mo |
| Vercel | $0 (free) | $0 (free) |
| Gemini API | $0-2 (testing) | ~$2-5/mo |
| Domain | $12/year | $12/year |
| **Total** | **~$6/mo** | **~$33/mo** |

**Revenue vs. Cost:**
- Customer #1 at ₹20K/mo (~$240/mo) → infrastructure costs $33/mo → **86% gross margin**
- 3 customers → revenue $720/mo, infrastructure $43/mo → **94% gross margin**

---

### Phase 1 Summary

You're not deploying the old messy code. You're:

1. **Writing new, clean code** that ports the proven logic (guardrails, failover, prompt engineering)
2. **Proper architecture** from day 1 (no monoliths, proper modules, types everywhere)
3. **Multi-tenant from day 1** (not bolted on later)
4. **React frontend from day 1** (not migrating from Streamlit later)
5. **Deployed and operational** by end of week 2

The old `dailyassistant-dms-client` repo becomes your reference. The new repo is built clean.


---

## 12. Migration from SQLite to Supabase PostgreSQL

### 12.1 Migration Overview

The current SQLite database has:
- `VIEW_AI_SALES`: 40,236 rows, ~70 columns of FMCG distributor sales data
- `context_intelligence`: 7 rows of weather/news cache

The migration is straightforward because:
1. Both databases use SQL — most queries transfer directly
2. The data volume is tiny (23MB)
3. Supabase provides a web SQL editor for running DDL

### 12.2 Step-by-Step Migration

#### Step 1: Export SQLite Data to CSV

```python
# scripts/export_sqlite_to_csv.py
import sqlite3
import pandas as pd
import os

DB_PATH = "database/AI_DMS_database.db"
OUTPUT_DIR = "migration/exports"
os.makedirs(OUTPUT_DIR, exist_ok=True)

conn = sqlite3.connect(DB_PATH)

# Export VIEW_AI_SALES
df_sales = pd.read_sql("SELECT * FROM VIEW_AI_SALES", conn)
df_sales.to_csv(f"{OUTPUT_DIR}/sales_data.csv", index=False)
print(f"Exported {len(df_sales)} sales rows to {OUTPUT_DIR}/sales_data.csv")
print(f"Columns: {list(df_sales.columns)}")
print(f"File size: {os.path.getsize(f'{OUTPUT_DIR}/sales_data.csv') / 1024 / 1024:.1f} MB")

# Export context_intelligence
df_context = pd.read_sql("SELECT * FROM context_intelligence", conn)
df_context.to_csv(f"{OUTPUT_DIR}/context_cache.csv", index=False)
print(f"Exported {len(df_context)} context rows")

conn.close()
```

#### Step 2: Create PostgreSQL Schema in Supabase

Run the SQL from [Section 11, Day 2-3](#day-2-3-set-up-supabase--migrate-sqlite--postgresql) in the Supabase SQL Editor.

#### Step 3: Create the First Tenant

```sql
-- Create the first tenant (Bajaj Consumer Care)
INSERT INTO tenants (name, slug, config) VALUES (
    'Bajaj Consumer Care',
    'bajaj',
    '{
        "company_name": "Bajaj Consumer Care",
        "display_name": "Bajaj DMS",
        "schema": {
            "sales_table": "sales_data",
            "date_column": "invoice_date",
            "amount_column": "total_amount",
            "product_column": "product_name",
            "product_group_column": "product_group",
            "customer_column": "party_name",
            "city_column": "party_city",
            "zone_column": "party_zone",
            "route_column": "route",
            "quantity_column": "quantity",
            "invoice_column": "invoice_number"
        },
        "features": {
            "copilot": true,
            "simulator": true,
            "morning_brief": true,
            "voice_input": true,
            "anomaly_detection": true,
            "basket_analysis": true
        },
        "morning_brief": {
            "enabled": true,
            "send_time": "07:00",
            "timezone": "Asia/Kolkata",
            "recipients": []
        }
    }'::jsonb
);

-- Note the generated UUID for the next step
SELECT id FROM tenants WHERE slug = 'bajaj';
```

#### Step 4: Import Sales Data

```python
# scripts/import_to_supabase.py
import pandas as pd
from supabase import create_client
import os

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]  # service_role bypasses RLS
TENANT_ID = os.environ["FIRST_TENANT_ID"]  # UUID from Step 3

client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Read exported CSV
df = pd.read_csv("migration/exports/sales_data.csv")

# Normalize column names to lowercase + underscores
df.columns = [
    col.lower().strip().replace(" ", "_").replace("-", "_")
    for col in df.columns
]

# Add tenant_id
df["tenant_id"] = TENANT_ID

# Convert date columns
date_cols = [c for c in df.columns if "date" in c.lower()]
for col in date_cols:
    try:
        df[col] = pd.to_datetime(df[col]).dt.strftime("%Y-%m-%d")
    except Exception:
        pass

# Replace NaN with None for JSON serialization
df = df.where(pd.notnull(df), None)

# Insert in batches
records = df.to_dict(orient="records")
batch_size = 500
total_inserted = 0

for i in range(0, len(records), batch_size):
    batch = records[i:i + batch_size]
    try:
        client.table("sales_data").insert(batch).execute()
        total_inserted += len(batch)
        print(f"Inserted {total_inserted}/{len(records)} rows...")
    except Exception as e:
        print(f"Error at batch {i}: {e}")
        # Try inserting one by one to identify problematic rows
        for j, record in enumerate(batch):
            try:
                client.table("sales_data").insert(record).execute()
                total_inserted += 1
            except Exception as row_error:
                print(f"  Skipped row {i + j}: {row_error}")

print(f"\nMigration complete: {total_inserted}/{len(records)} rows inserted")

# Import context cache
df_context = pd.read_csv("migration/exports/context_cache.csv")
df_context.columns = [c.lower().strip().replace(" ", "_") for c in df_context.columns]
df_context["tenant_id"] = TENANT_ID
df_context = df_context.where(pd.notnull(df_context), None)

context_records = df_context.to_dict(orient="records")
client.table("context_cache").insert(context_records).execute()
print(f"Imported {len(context_records)} context cache rows")
```

#### Step 5: Verify the Migration

```sql
-- Run in Supabase SQL Editor

-- Check row counts
SELECT 'sales_data' as table_name, COUNT(*) as row_count FROM sales_data
UNION ALL
SELECT 'context_cache', COUNT(*) FROM context_cache
UNION ALL
SELECT 'tenants', COUNT(*) FROM tenants;

-- Verify sales data looks correct
SELECT 
    MIN(invoice_date) as earliest_date,
    MAX(invoice_date) as latest_date,
    COUNT(*) as total_rows,
    COUNT(DISTINCT product_name) as unique_products,
    COUNT(DISTINCT party_name) as unique_customers,
    ROUND(SUM(total_amount)::numeric, 2) as total_revenue
FROM sales_data;

-- Compare with SQLite totals (run these manually and compare)
-- The numbers should match exactly

-- Verify RLS is working
-- This should return 0 rows when called without auth context:
SET ROLE anon;
SELECT COUNT(*) FROM sales_data;  -- Should be 0 (RLS blocks)
RESET ROLE;
```

#### Step 6: Verify Application Queries

Test the 5 most common dashboard queries against the new database:

```sql
-- 1. Total revenue (dashboard KPI)
SELECT SUM(total_amount) as total_revenue FROM sales_data WHERE tenant_id = 'your-tenant-uuid';

-- 2. Top 10 products (dashboard chart)
SELECT product_name, SUM(total_amount) as revenue
FROM sales_data WHERE tenant_id = 'your-tenant-uuid'
GROUP BY product_name
ORDER BY revenue DESC LIMIT 10;

-- 3. Zone breakdown (dashboard chart)
SELECT party_zone, SUM(total_amount) as revenue, COUNT(DISTINCT party_name) as customers
FROM sales_data WHERE tenant_id = 'your-tenant-uuid'
GROUP BY party_zone ORDER BY revenue DESC;

-- 4. Daily trend (copilot query)
SELECT invoice_date, SUM(total_amount) as daily_revenue, COUNT(*) as transactions
FROM sales_data WHERE tenant_id = 'your-tenant-uuid'
GROUP BY invoice_date ORDER BY invoice_date;

-- 5. Order count (dashboard KPI)
SELECT COUNT(DISTINCT invoice_number) as total_orders FROM sales_data WHERE tenant_id = 'your-tenant-uuid';
```

### 12.3 SQL Dialect Changes

| SQLite Pattern | PostgreSQL Equivalent | Impact on AKARA |
|---------------|----------------------|-----------------|
| `SUBSTR(col, 1, 10)` | `SUBSTRING(col FROM 1 FOR 10)` or `LEFT(col, 10)` | Low — few uses in copilot SQL gen |
| `GROUP_CONCAT(col, ', ')` | `STRING_AGG(col, ', ')` | Low — used in anomaly reports |
| `IFNULL(col, 0)` | `COALESCE(col, 0)` | Low — both work in PG |
| `datetime('now')` | `NOW()` or `CURRENT_TIMESTAMP` | Low — few uses |
| `PRAGMA` statements | No equivalent (not needed) | Remove all PRAGMA calls |
| `AUTOINCREMENT` | `SERIAL` or `BIGSERIAL` | Schema-level change |
| `INTEGER PRIMARY KEY` | `BIGSERIAL PRIMARY KEY` | Schema-level change |
| `TEXT` (untyped) | `TEXT`, `NUMERIC`, `DATE` (proper types) | Improved type safety |
| No connection pooling | pgBouncer (built into Supabase) | Configuration, not code |
| File-based locking | Row-level locking (concurrent safe) | No code change needed |

**Important:** Since the copilot generates SQL via LLM, update the system prompt to specify PostgreSQL syntax. The LLM should naturally generate correct PostgreSQL SQL if the prompt says "PostgreSQL database."

### 12.4 Python Database Layer Changes

Replace the SQLite connection pattern with Supabase client:

```python
# BEFORE: SQLite connection
import sqlite3
import pandas as pd

def get_connection():
    return sqlite3.connect("database/AI_DMS_database.db")

def query_sales(sql: str) -> pd.DataFrame:
    conn = get_connection()
    df = pd.read_sql(sql, conn)
    conn.close()
    return df

# AFTER: Supabase connection
from supabase import create_client, Client
import pandas as pd
import os

def get_supabase() -> Client:
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_ANON_KEY"]
    )

def query_sales(client: Client, sql: str) -> pd.DataFrame:
    """Execute SQL via Supabase RPC. RLS is enforced via the client's JWT."""
    result = client.rpc("execute_readonly_query", {"query_text": sql}).execute()
    return pd.DataFrame(result.data or [])

def query_sales_table(client: Client, **filters) -> pd.DataFrame:
    """Query sales using Supabase's query builder (simpler for basic queries)."""
    query = client.table("sales_data").select("*")
    
    for col, val in filters.items():
        if isinstance(val, tuple) and len(val) == 2:
            query = query.gte(col, val[0]).lte(col, val[1])
        else:
            query = query.eq(col, val)
    
    result = query.execute()
    return pd.DataFrame(result.data or [])
```

### 12.5 Connection Pooling

Supabase includes pgBouncer for connection pooling. Use the pooler connection string for the Railway app:

```
# Direct connection (for migrations, admin tasks):
postgresql://postgres:password@db.project-ref.supabase.co:5432/postgres

# Pooled connection (for the application — use this):
postgresql://postgres:password@project-ref.pooler.supabase.com:6543/postgres?pgbouncer=true
```

In settings.py:

```python
class Settings(BaseSettings):
    database_url: str  # Use the pooled connection string
    database_url_direct: str = ""  # Optional: for migrations only
```

---

## 13. What to Retain from Current Codebase

### 13.1 KEEP — These Are Genuinely Good

The repository has several well-engineered components that represent significant intellectual property. These should be retained and adapted for multi-tenancy.

#### AI Guardrail Chain

```
src/copilot/
├── premise_check.py     # Detects false premises in user questions
├── numeric_digest.py    # Verifies column sums match between SQL and LLM response
├── numeric_postcheck.py # Post-generation audit for numeric hallucination
├── causal_postcheck.py  # Catches unjustified causal claims
├── data_scope.py        # Enforces schema boundaries
└── trace.py             # JSONL audit trail
```

**Why keep:** This guardrail chain is a genuine competitive advantage. Most LLM-powered analytics tools hallucinate numbers freely. AKARA's multi-stage verification catches false premises, numeric errors, and unjustified causal claims. This is publishable-quality AI safety work.

**What to change:** Parameterize the schema references so guardrails work with any tenant's column names.

#### LLM Failover Engine

The existing failover chain (Gemini → OpenRouter) is well-implemented and should be retained. It ensures 99.5%+ LLM availability.

**What to change:** Nothing — this works as-is. Just ensure API keys come from environment variables.

#### SQL Guard

```
src/sql/
├── sql_guard.py         # Allowlist/blocklist for SQL keywords
└── guarded_execute.py   # Row-limited, timeout-guarded SQL execution
```

**Why keep:** Prevents LLM-generated SQL from running mutations (INSERT, UPDATE, DELETE, DROP). Essential for production safety.

**What to change:** Update to PostgreSQL dialect awareness. The allowlist/blocklist should account for PostgreSQL-specific keywords.

#### Copilot Brain Agent Architecture

The `Plan → Execute → Synthesize` pipeline in `copilot_brain.py` is well-designed:

1. **Plan:** LLM receives the question + schema → generates a JSON tool-call plan
2. **Execute:** Each tool call runs (SQL query, weather lookup, news fetch)
3. **Synthesize:** LLM receives all tool results → generates natural language answer
4. **Verify:** Guardrail chain checks the answer

**What to change:** Extract from the 59KB monolith into separate modules (planner, executor, synthesizer).

#### Prompt Engineering

The system prompts are thorough and domain-aware. They include:
- Schema context (column names, data types, sample values)
- Business rules (FMCG distributor terminology)
- Constraints (date ranges, allowed operations)
- Output format instructions

**What to change:** Make prompts dynamic (generated from tenant config + schema metadata).

#### KPI Service

```
src/services/kpi_service.py
```

Parameterized SQL queries for common KPIs (revenue, orders, AOV, top products). Well-structured and reusable.

**What to change:** Replace hardcoded column names with schema-driven column references.

### 13.2 REFACTOR — Good Logic, Bad Structure

#### dashboard.py (54KB) → Split into Pages/Components

```
# Current: one 54KB file does everything
app/dashboard.py  # 54KB monolith

# Target: Streamlit multi-page app
app/
├── main.py              # App entry point, auth gate, navigation
├── pages/
│   ├── 01_dashboard.py  # KPI dashboard + charts
│   ├── 02_copilot.py    # AI chat interface
│   ├── 03_simulator.py  # Revenue simulator
│   └── 04_settings.py   # User settings, data upload
├── components/
│   ├── kpi_cards.py     # Reusable KPI card components
│   ├── charts.py        # Plotly chart builders
│   └── chat_ui.py       # Chat message display
└── auth/
    └── supabase_auth.py # Auth wrapper
```

**How to split:**

```python
# app/main.py — Entry point
import streamlit as st
from auth.supabase_auth import require_auth, logout

st.set_page_config(page_title="AKARA", layout="wide")

user = require_auth()

# Streamlit's built-in multi-page navigation handles the rest
# Pages in app/pages/ are automatically discovered
```

```python
# app/pages/01_dashboard.py
import streamlit as st
from auth.supabase_auth import require_auth, get_tenant_id
from src.services.kpi_service import get_dashboard_kpis, get_top_products, get_zone_breakdown
from src.services.schema_service import get_tenant_schema
from src.data.db import get_supabase_client
from components.kpi_cards import render_kpi_cards
from components.charts import render_product_chart, render_zone_chart

user = require_auth()
tenant_id = get_tenant_id()
client = get_supabase_client(st.session_state.get("session", {}).get("access_token"))
schema = get_tenant_schema(client, tenant_id)

st.title("Sales Dashboard")

kpis = get_dashboard_kpis(client, schema)
render_kpi_cards(kpis)

col1, col2 = st.columns(2)
with col1:
    products = get_top_products(client, schema)
    render_product_chart(products, schema)

with col2:
    zones = get_zone_breakdown(client, schema)
    render_zone_chart(zones, schema)
```

#### copilot_brain.py (59KB) → Extract Into Modules

```
# Current: one 59KB file
scripts/copilot_brain.py  # 59KB — prompts + tools + planner + executor + synthesizer

# Target: modular architecture
src/copilot/
├── planner.py      # LLM generates tool-call plan from question
├── executor.py     # Executes each tool call (SQL, weather, news)
├── synthesizer.py  # LLM synthesizes results into answer
├── tools/
│   ├── sql_tool.py     # query_sales_db tool
│   ├── weather_tool.py # get_weather tool
│   ├── news_tool.py    # get_news tool
│   └── analysis_tool.py # product mix analysis tool
├── prompts/
│   ├── planner_prompt.py    # System prompt for planning
│   ├── synthesis_prompt.py  # System prompt for synthesis
│   └── guardrail_prompts.py # Prompts for verification
└── guardrails/       # (existing, kept as-is)
    ├── premise_check.py
    ├── numeric_digest.py
    ├── numeric_postcheck.py
    ├── causal_postcheck.py
    └── data_scope.py
```

#### Hardcoded Schema References → Config-Driven

Search the codebase for hardcoded references and replace:

```python
# Find all hardcoded references
# rg -i "bajaj|VIEW_AI_SALES|TOTAL_AMOUNT|PARTY_NAME|PRODUCT_NAME" --type py

# Example replacements:

# BEFORE:
# "SELECT SUM(TOTAL_AMOUNT) FROM VIEW_AI_SALES"
# AFTER:
# f"SELECT SUM({schema.amount_column}) FROM {schema.sales_table}"

# BEFORE:
# "Bajaj Consumer Care DMS Intelligence"
# AFTER:
# f"{tenant_config['display_name']} Intelligence"
```

### 13.3 REMOVE — Dead Code and Development Artifacts

#### Remove Immediately

| File/Directory | Reason |
|---------------|--------|
| `scratch/` (40+ files) | Development debugging scripts, not production code |
| `database/AI_DMS_database.db` | SQLite file, replaced by Supabase PostgreSQL |
| `scripts/build_database.py` | Excel → SQLite ETL, replaced by CSV upload endpoint |
| `scripts/clean_consolidate.py` | Raw data cleaning hardcoded to 4 Excel sheets |
| `.env` (with real keys) | Must not be in git; replace with `.env.example` |
| Notification tab code | Wrapped in `if False:` — dead code |

#### Remove After Migration Verified

| File/Directory | Reason |
|---------------|--------|
| `scripts/chaos_monkey.py` | Resilience testing for SQLite, not relevant for Supabase |
| Legacy coffee-shop schema references | Leftover from an earlier prototype |
| Any `sys.path.insert` hacks | Replaced by proper package structure |
| `legacy_adapter.py` | Bridges `src/` and `scripts/` circular deps, unnecessary after refactor |

### 13.4 What the Refactored Project Structure Looks Like

```
AKARA/
├── app/
│   ├── main.py                  # Streamlit entry point + auth gate
│   ├── pages/
│   │   ├── 01_dashboard.py      # KPI dashboard
│   │   ├── 02_copilot.py        # AI chat
│   │   ├── 03_simulator.py      # Revenue simulator
│   │   └── 04_settings.py       # Settings + data upload
│   ├── components/
│   │   ├── kpi_cards.py         # KPI card rendering
│   │   ├── charts.py            # Plotly chart builders
│   │   └── chat_ui.py           # Chat message display
│   ├── auth/
│   │   └── supabase_auth.py     # Supabase Auth wrapper
│   └── styles.py                # CSS-in-Python dark theme
│
├── src/
│   ├── api/
│   │   ├── main.py              # FastAPI app
│   │   ├── health.py            # Health endpoint
│   │   ├── upload.py            # CSV upload endpoint
│   │   └── jobs.py              # Morning brief endpoint
│   ├── config/
│   │   ├── settings.py          # Pydantic settings
│   │   └── sentry_setup.py      # Sentry initialization
│   ├── copilot/
│   │   ├── planner.py           # LLM planning
│   │   ├── executor.py          # Tool execution
│   │   ├── synthesizer.py       # Response synthesis
│   │   ├── tools/               # Individual tool implementations
│   │   ├── prompts/             # System prompt templates
│   │   └── guardrails/          # Verification chain
│   ├── data/
│   │   └── db.py                # Supabase client factory
│   ├── services/
│   │   ├── kpi_service.py       # Dashboard KPI queries
│   │   ├── schema_service.py    # Tenant schema loader
│   │   ├── prompt_service.py    # Dynamic prompt generator
│   │   └── voice_service.py     # Whisper STT
│   └── sql/
│       ├── sql_guard.py         # SQL allowlist/blocklist
│       └── guarded_execute.py   # Safe SQL execution
│
├── supabase/
│   ├── migrations/              # SQL migration files
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   └── 003_functions.sql
│   └── functions/               # Edge Functions (optional)
│       └── morning-brief/
│           └── index.ts
│
├── tests/
│   ├── test_copilot.py
│   ├── test_guardrails.py
│   ├── test_kpi_service.py
│   ├── test_sql_guard.py
│   └── test_upload.py
│
├── scripts/
│   ├── export_sqlite_to_csv.py  # One-time migration script
│   ├── import_to_supabase.py    # One-time data import
│   ├── anomaly_engine.py        # Z-score anomaly detection
│   ├── forecaster.py            # RandomForest model
│   ├── basket_analysis.py       # Market basket analysis
│   └── mailer.py                # SMTP email dispatch
│
├── .github/
│   └── workflows/
│       └── ci.yml               # Lint + test on push
│
├── .env.example                 # Template for environment variables
├── .gitignore
├── Procfile                     # Railway deployment
├── requirements.txt
├── requirements-dev.txt
├── runtime.txt                  # Python version for Railway
└── README.md                    # Setup + deployment instructions
```

---

## 14. Security (Simplified but Real)

### 14.1 What You MUST Do Before Customer #1

These are non-negotiable security requirements. Skip any of these and you risk data breaches, credential theft, or customer trust violations.

#### 1. Never Commit Secrets to Git

```bash
# Check if secrets are already in git history
rg -i "(api_key|secret|password|token)" .env

# If .env has been committed before, rotate ALL keys:
# - Generate new Gemini API key
# - Generate new OpenRouter API key
# - Generate new WeatherAPI key
# - Generate new NewsAPI key
# - Generate new Gmail app password
# - Set new Supabase project password

# Purge from git history (if committed)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all
```

**Rule:** All secrets live in Railway environment variables (production) or `.env` files (local, never committed).

#### 2. Enable Supabase RLS on ALL Tenant Tables

See [Section 11, Day 1-2 (Week 2)](#day-1-2-add-tenant_id--rls-policies) for complete RLS policy definitions.

**Verification test:**

```sql
-- As an anonymous user, this should return 0 rows:
SET ROLE anon;
SELECT COUNT(*) FROM sales_data;
-- Expected: 0

-- As a service_role user, this should return all rows:
RESET ROLE;
SELECT COUNT(*) FROM sales_data;
-- Expected: 40,236
```

#### 3. Use Supabase Auth

Do not build custom auth. See [Section 3.4](#34-supabase-auth) for the complete implementation.

Supabase Auth handles:
- Password hashing (bcrypt with proper salt rounds)
- Session management (JWT with configurable expiry)
- CSRF protection (built into the auth flow)
- Password reset (email flow with secure tokens)
- Rate limiting on login attempts (built-in brute force protection)

#### 4. Serve Over HTTPS

Railway provides free SSL certificates automatically. Verify:
- `https://your-app.up.railway.app` → valid certificate
- `http://your-app.up.railway.app` → redirects to HTTPS

No configuration needed.

#### 5. Keep SQL Guard Active

The existing `sql_guard.py` prevents LLM-generated SQL from running mutations. This is critical because:
- The copilot generates SQL dynamically based on user questions
- A prompt injection attack could trick the LLM into generating `DROP TABLE`
- The SQL guard blocks all non-SELECT statements

```python
# src/sql/sql_guard.py — Verify this is active and covers PostgreSQL
BLOCKED_KEYWORDS = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", 
    "TRUNCATE", "GRANT", "REVOKE", "COPY", "EXECUTE",
    "pg_catalog", "information_schema", "pg_stat",
]

def is_safe_query(sql: str) -> bool:
    """Check if SQL is read-only and safe to execute."""
    normalized = sql.strip().upper()
    
    if not normalized.startswith("SELECT"):
        return False
    
    for keyword in BLOCKED_KEYWORDS:
        if keyword in normalized:
            return False
    
    return True
```

Additionally, the Supabase RPC function `execute_readonly_query` (Section 11) provides a second layer of protection at the database level.

#### 6. Validate All User Input

Use Pydantic models for all API endpoints:

```python
from pydantic import BaseModel, Field, field_validator
import re

class CopilotQuery(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    
    @field_validator("question")
    @classmethod
    def sanitize_question(cls, v):
        if len(v.strip()) == 0:
            raise ValueError("Question cannot be empty")
        return v.strip()

class FileUpload(BaseModel):
    filename: str
    
    @field_validator("filename")
    @classmethod
    def validate_filename(cls, v):
        if not re.match(r'^[\w\-. ]+\.(csv|xlsx|xls)$', v):
            raise ValueError("Invalid filename. Only CSV and Excel files are accepted.")
        return v
```

#### 7. Set Gemini API to Paid Tier

On Google AI Studio's free tier, your data may be used for model training. On the paid tier, it is not.

- Go to https://ai.google.dev/ → Billing → Enable paid plan
- Set a budget alert at $50/month to catch unexpected usage spikes
- Cost is pay-per-use (no minimum), so this doesn't increase fixed costs

#### 8. Fix Malformed ALERT_RECIPIENT Email

The repository audit found a malformed email address in the `.env` file. Fix it:

```bash
# In Railway environment variables:
ALERT_RECIPIENT=valid-email@example.com

# In settings.py, validate at startup (see Day 1-2 implementation)
```

### 14.2 What You Can DEFER

These are important security practices that become necessary at scale but are not required for 1-3 customers.

| Security Measure | When to Add | Why Defer |
|-----------------|------------|-----------|
| Penetration testing | Before customer #10 | Cost: $5K-15K. Not justified for 3 customers with known users. |
| SOC 2 compliance | Before enterprise customers | Cost: $20K+, 3-6 months. Only needed for enterprises with compliance requirements. |
| Advanced audit logging | Before customer #10 | Basic audit table is sufficient. Add IP tracking, user agent, etc. later. |
| Rate limiting | When abuse occurs, or 10+ customers | All current users are known, paying customers. |
| IP allowlisting | For enterprise customers | Only if a customer's security team requires it. |
| Data encryption at rest (application-level) | For enterprise customers | Supabase encrypts at the infrastructure level. Application-level encryption (column-level) is only needed for highly regulated data. |
| MFA / Two-factor auth | Customer requests | Supabase Auth supports MFA. Enable per-tenant when requested. |
| Security headers | Before customer #5 | Add `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` to FastAPI responses. Low effort, do it when convenient. |
| Content Security Policy | When building custom frontend | Not relevant for Streamlit (it manages its own CSP). |
| Bug bounty program | At 100+ customers | Not worth the operational overhead before scale. |

### 14.3 Security Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│ SECURITY LAYERS (What You Get for Free)                  │
│                                                          │
│  Layer 1: HTTPS (Railway auto-SSL)                       │
│  ├── All traffic encrypted in transit                    │
│  └── HTTP → HTTPS redirect automatic                    │
│                                                          │
│  Layer 2: Supabase Auth                                  │
│  ├── bcrypt password hashing                             │
│  ├── JWT with configurable expiry                        │
│  ├── Brute force protection (built-in)                   │
│  └── CSRF protection (built-in)                          │
│                                                          │
│  Layer 3: Row-Level Security (RLS)                       │
│  ├── Tenant isolation at database level                  │
│  ├── Even application bugs can't leak cross-tenant data  │
│  └── Policies checked on every query                     │
│                                                          │
│  Layer 4: SQL Guard (Application)                        │
│  ├── Blocks non-SELECT queries                           │
│  ├── Blocks system catalog access                        │
│  └── Row limit enforcement (10K max)                     │
│                                                          │
│  Layer 5: SQL Guard (Database)                           │
│  ├── execute_readonly_query RPC function                 │
│  ├── SECURITY INVOKER (runs with caller's RLS context)   │
│  └── Secondary mutation blocking at DB level             │
│                                                          │
│  Layer 6: Input Validation (Pydantic)                    │
│  ├── Type checking on all API inputs                     │
│  ├── Length limits                                        │
│  └── Filename sanitization                               │
│                                                          │
│  Layer 7: LLM Safety                                     │
│  ├── Paid Gemini tier (data not used for training)       │
│  ├── AI guardrail chain (hallucination detection)        │
│  └── System prompts constrain output format              │
│                                                          │
│  Layer 8: Monitoring                                     │
│  ├── Sentry error tracking (catches unexpected errors)   │
│  ├── Audit log table (tracks all significant actions)    │
│  └── UptimeRobot (alerts on downtime)                    │
│                                                          │
│  Layer 9: Backups                                        │
│  ├── Supabase daily backups (7-day retention)            │
│  └── Data recovery within 24 hours                       │
└─────────────────────────────────────────────────────────┘
```

**9 layers of security, $0 additional cost, <5 hours of development time.** This is more secure than most startups at 10x the scale.

---

## 15. Final Verdict

### What the Original solutions.md Got Right

The original `solutions.md` is a thorough, well-organized document. It correctly identifies:

1. **The critical problems:** No auth, no multi-tenancy, hardcoded secrets, hardcoded schema, no deployment infrastructure.
2. **The correct priorities:** Security first, then multi-tenancy, then operational tooling.
3. **The right questions:** How to handle tenant isolation, how to manage LLM costs, how to onboard customers.
4. **The codebase quality assessment:** What to keep, refactor, and remove is largely accurate.

**The WHAT is 90% correct. The HOW is 70% over-engineered.**

### What the Original solutions.md Got Wrong

It assumed an application that was bigger, more complex, and more heavily used than reality:

| Assumption | Reality |
|-----------|---------|
| "Needs Redis for caching" | <10 users, queries take <100ms |
| "Needs background workers" | 1 daily cron job that takes 30 seconds |
| "Needs self-hosted monitoring" | Sentry free tier handles everything |
| "Needs custom JWT auth" | Supabase Auth handles everything |
| "Needs complex health checks" | 10-line endpoint is sufficient |
| "Needs rate limiting" | All users are known, paying customers |
| "Needs staging environment" | 1 developer, 3 customers |
| "Needs custom backup scripts" | Supabase includes daily backups |
| "Needs Docker" | Railway auto-detects Python |
| "Costs $65-180/month" | Costs $32/month fixed |

### The Correct Architecture

The application is a **simple Python monolith** serving <10 users with <500MB of data. It does not need:

- ~~Kubernetes~~ → Single Railway container
- ~~Redis~~ → No caching needed
- ~~Multiple containers~~ → One process
- ~~Complex monitoring stacks~~ → Sentry free + UptimeRobot free
- ~~Multiple deployment environments~~ → Local + production
- ~~Custom auth servers~~ → Supabase Auth
- ~~Background job workers~~ → pg_cron + HTTP call
- ~~Self-hosted error tracking~~ → Sentry free tier

**It needs three things:**

| Service | Cost | Covers |
|---------|------|--------|
| **Supabase Pro** | $25/mo | Database + Auth + Storage + Backups + Edge Functions + RLS |
| **Railway** | $7/mo | Hosting the Python app |
| **Gemini paid tier** | ~$20/customer/mo | LLM inference |

**Plus free-tier tools:** Sentry, UptimeRobot, GitHub Actions, Gmail SMTP.

### Cost Summary

| Customers | Monthly Infra | Monthly LLM | Total Cost | Revenue (₹20K each) | Margin |
|-----------|-------------|------------|-----------|---------------------|--------|
| **1** | $32 | $20 | **$52** | $240 | **78%** |
| **3** | $32 | $60 | **$92** | $720 | **87%** |
| **10** | $37 | $200 | **$237** | $2,400 | **90%** |
| **100** | $100 | $2,000 | **$2,100** | $24,000 | **91%** |

### Timeline

| Week | Milestone | Result |
|------|-----------|--------|
| Week 1 | Deployable + Secure | App running on Railway + Supabase with auth |
| Week 2 | Multi-tenant + Adaptive | RLS isolation, parameterized schema, CSV upload |
| Week 3 | Operational | Morning brief cron, error tracking, CI/CD, legal docs |
| Week 3+ | **Customer #1 ready** | Onboarding dry-run complete, documentation done |

### The Bottom Line

> **This is a production-ready architecture that a student can afford, operate alone, and scale gradually by upgrading plan tiers — not by re-architecting.**

The path from prototype to paid product is **3 weeks of focused work**, not 4-6 weeks of building infrastructure. Every additional service, tool, or layer of complexity must justify its existence against the question: **"Does this help me get the first 3 paying customers?"**

If the answer is no, defer it.

---

## Appendix A: Quick Reference — Environment Variables

```bash
# === Required for Production ===
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...                          # Public anon key
SUPABASE_SERVICE_ROLE_KEY=eyJ...                   # Service role key (server-side only)
DATABASE_URL=postgresql://postgres:pw@pooler...     # Pooled connection string
GOOGLE_API_KEY=AI...                               # Gemini API key (paid tier)
OPENROUTER_API_KEY=sk-or-...                       # OpenRouter fallback
WEATHER_API_KEY=...                                # WeatherAPI.com
NEWS_API_KEY=...                                   # NewsAPI.org
GMAIL_USER=akara-alerts@gmail.com                  # Gmail sender
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx             # Gmail app password
ALERT_RECIPIENT=admin@company.com                  # Alert recipient (valid email!)
CRON_SECRET=random-32-char-string                  # Auth for cron endpoints
SENTRY_DSN=https://xxx@sentry.io/yyy              # Sentry project DSN
APP_ENV=production                                 # Environment flag
LOG_LEVEL=INFO                                     # Logging level

# === Optional ===
PORT=8501                                          # Streamlit port (Railway sets this)
ENABLE_VOICE_INPUT=true                            # Feature flag: voice input
ENABLE_SIMULATOR=true                              # Feature flag: revenue simulator
```

## Appendix B: Quick Reference — Supabase Setup Checklist

```markdown
## Supabase Project Setup

1. [ ] Create project at supabase.com (Mumbai region for India customers)
2. [ ] Note: Project URL, anon key, service_role key, DB password
3. [ ] Run migration SQL (Section 11, Day 2-3)
4. [ ] Enable RLS on all tables (Section 11, Day 1-2 Week 2)
5. [ ] Create RLS policies (Section 11, Day 1-2 Week 2)
6. [ ] Enable pg_cron extension (Database → Extensions)
7. [ ] Enable pg_net extension (for HTTP calls from pg_cron)
8. [ ] Create execute_readonly_query function (Section 11, Day 1-2 Week 2)
9. [ ] Create first tenant record
10. [ ] Import initial data (Section 12)
11. [ ] Create first user (Authentication → Users → Invite)
12. [ ] Set tenant_id in user metadata
13. [ ] Create storage bucket "customer-data" (private)
14. [ ] Set storage policy for tenant isolation
15. [ ] Set up pg_cron schedule for morning brief
16. [ ] Verify: dashboard loads with data
17. [ ] Verify: RLS blocks unauthorized access
18. [ ] Verify: morning brief endpoint works
```

## Appendix C: Quick Reference — Railway Deployment Checklist

```markdown
## Railway Deployment

1. [ ] Install Railway CLI: npm install -g @railway/cli
2. [ ] Login: railway login
3. [ ] Init project: railway init
4. [ ] Create Procfile (Section 11, Day 4-5)
5. [ ] Create runtime.txt (Python 3.11)
6. [ ] Update requirements.txt (Section 11, Day 4-5)
7. [ ] Set ALL environment variables (Appendix A)
8. [ ] Deploy: railway up
9. [ ] Verify: app accessible at https://your-app.up.railway.app
10. [ ] Verify: HTTPS active (automatic)
11. [ ] Verify: health endpoint returns healthy
12. [ ] Verify: login works
13. [ ] Verify: dashboard loads with data
14. [ ] Optional: set up custom domain
15. [ ] Set up UptimeRobot monitor
```

## Appendix D: Supabase RLS Policy Testing

After setting up RLS, run these tests to verify tenant isolation:

```sql
-- Test 1: Anonymous access should return nothing
SET ROLE anon;
SELECT COUNT(*) FROM sales_data;
-- Expected: 0
RESET ROLE;

-- Test 2: Service role should bypass RLS
SELECT COUNT(*) FROM sales_data;
-- Expected: 40,236 (or however many rows you imported)

-- Test 3: Simulate a user with a specific tenant_id
-- (This simulates what happens when a user makes a request)
SET LOCAL request.jwt.claims = '{"tenant_id": "your-tenant-uuid"}';
SET ROLE authenticated;
SELECT COUNT(*) FROM sales_data;
-- Expected: 40,236 (only this tenant's data)
RESET ROLE;

-- Test 4: Simulate a user with a DIFFERENT tenant_id
SET LOCAL request.jwt.claims = '{"tenant_id": "00000000-0000-0000-0000-000000000000"}';
SET ROLE authenticated;
SELECT COUNT(*) FROM sales_data;
-- Expected: 0 (no data for this tenant)
RESET ROLE;

-- Test 5: Verify INSERT is restricted
SET LOCAL request.jwt.claims = '{"tenant_id": "your-tenant-uuid"}';
SET ROLE authenticated;
INSERT INTO sales_data (tenant_id, invoice_date, product_name, total_amount)
VALUES ('different-tenant-uuid', '2026-01-01', 'Test', 100);
-- Expected: ERROR (RLS blocks inserting to another tenant)
RESET ROLE;
```

## Appendix E: Monitoring Dashboard (Free Stack)

```
┌────────────────────────────────────────────────────────────┐
│                  MONITORING (all free)                       │
│                                                             │
│  ┌──────────────────────┐  ┌─────────────────────────────┐ │
│  │  Sentry Free Tier    │  │  UptimeRobot Free           │ │
│  │                      │  │                              │ │
│  │  • 5K errors/month   │  │  • 50 monitors              │ │
│  │  • Error grouping    │  │  • 5-min check intervals    │ │
│  │  • Stack traces      │  │  • Email alerts             │ │
│  │  • Release tracking  │  │  • Status page              │ │
│  │  • Email alerts      │  │  • Response time logging    │ │
│  │                      │  │                              │ │
│  │  Setup: 15 minutes   │  │  Setup: 5 minutes           │ │
│  │  Cost: $0/month      │  │  Cost: $0/month             │ │
│  └──────────────────────┘  └─────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────┐  ┌─────────────────────────────┐ │
│  │  Supabase Dashboard  │  │  Railway Dashboard          │ │
│  │                      │  │                              │ │
│  │  • DB size & growth  │  │  • CPU & memory usage       │ │
│  │  • Connection count  │  │  • Deploy history           │ │
│  │  • Query performance │  │  • Real-time logs           │ │
│  │  • Storage usage     │  │  • Environment variables    │ │
│  │  • Auth analytics    │  │  • Build logs               │ │
│  │  • API usage         │  │  • Crash reports            │ │
│  │                      │  │                              │ │
│  │  Included with Pro   │  │  Included with plan         │ │
│  │  Cost: $0 additional │  │  Cost: $0 additional        │ │
│  └──────────────────────┘  └─────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  In-App Audit Log (Supabase table)                    │  │
│  │                                                        │  │
│  │  • All copilot queries + responses                     │  │
│  │  • Data uploads (who, when, file, rows)                │  │
│  │  • Morning brief sends (success/failure)               │  │
│  │  • Login/logout events                                 │  │
│  │  • Configuration changes                               │  │
│  │                                                        │  │
│  │  Query via: SELECT * FROM audit_log ORDER BY ...       │  │
│  │  Cost: $0 (it's just a table)                          │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘

Total monitoring cost: $0/month
Setup time: ~30 minutes
```

## Appendix F: Customer Onboarding Runbook

### Pre-Onboarding (Sales → Tech Handoff)

```
1. Receive from sales:
   - Customer company name
   - Admin user email
   - Sample DMS export (CSV/Excel) — at least 1 month of data
   - Desired morning brief schedule and recipient emails
   - Any specific KPIs or metrics they care about

2. Technical validation:
   - Open the sample CSV/Excel
   - Identify column mappings (which column is revenue? product? customer? date?)
   - Check data quality (nulls, date formats, numeric formats)
   - Estimate row count and file size for the full dataset
   - Flag any unusual schema that needs special handling
```

### Onboarding Execution (30-60 minutes)

```
Step 1: Create tenant (5 minutes)
  - INSERT INTO tenants with config JSONB (column mappings, features, branding)
  - Note the generated tenant UUID

Step 2: Create user account (5 minutes)
  - Supabase Auth → Invite user by email
  - Set tenant_id in user metadata
  - User receives email invitation with password setup link

Step 3: Import data (10-20 minutes)
  - Run import script or use CSV upload endpoint
  - Verify row count matches expectations
  - Run 3-5 test queries to confirm data integrity

Step 4: Verify features (10 minutes)
  - Login as the customer user
  - Check: dashboard loads with correct KPIs
  - Check: copilot answers questions about their data
  - Check: simulator runs with their data
  - Check: morning brief generates correctly

Step 5: Configure operations (5 minutes)
  - Set morning brief recipients in tenant config
  - Verify pg_cron schedule includes this tenant
  - Test morning brief endpoint manually

Step 6: Customer walkthrough (15-30 minutes)
  - Screen share with customer
  - Walk through each tab
  - Show 5-10 sample copilot questions relevant to their business
  - Answer questions
  - Share support contact
```

### Post-Onboarding Monitoring (Week 1)

```
Daily checks:
  - [ ] Customer logged in today? (Check Supabase Auth logs)
  - [ ] Any errors in Sentry for this tenant?
  - [ ] Morning brief delivered successfully?
  - [ ] Any unusual query patterns? (Check audit_log)

Day 3: Follow-up call
  - How is the dashboard working?
  - Any questions about the copilot?
  - Any data quality issues?
  - Feature requests?

Day 7: Week 1 review
  - Usage stats: logins, queries, features used
  - Any recurring errors?
  - Customer satisfaction check
  - Gather feedback for product roadmap
```

---

## 16. Competitive Additions (All Days)

These features were added after competitive analysis of FireAI (fireai.in) and Ocheto (ocheto.ai) — the two Indian startups targeting the same FMCG distributor customer. All additions slot into existing days with no new day required.

### What the competitive analysis revealed

**FireAI** is live at ₹4,999/month with: native Tally connector, 700+ data connectors, Hindi + English NLQ, primary-vs-secondary sales intelligence, scheme leakage detection, beat effectiveness analytics, and a "Monday Commercial Brief" delivering rupee-ranked decisions.

**Ocheto** is an AI-native DMS replacement (different category — they generate the data at point of transaction, not analyze it).

**Generic global tools** (Defog.ai, Julius AI, TextQL) are not direct competitors — none have Tally integration, Hindi support, or FMCG distribution domain knowledge. They are developer tools or US enterprise tools.

### Day 1 additions (schema)

| Addition | Purpose |
|---|---|
| `outstanding_amount` nullable column on `sales_data` | Credit exposure KPI — "which parties have overdue outstanding > 30 days" |
| `secondary_sales_data` table | Stores DMS offtake (distributor → retailer) for primary-vs-secondary analysis |
| `scheme_master` table | Stores distributor scheme claims for leakage detection |
| RLS policies for new tables | Same tenant isolation pattern as `sales_data` |

### Day 3 additions (copilot intelligence — industry-agnostic architecture)

| Addition | Purpose |
|---|---|
| Generic `_SYNTHESIZE_SYSTEM` base prompt | No currency, no language, no industry hardcoded — works for any vertical out of the box |
| Generic `_PLAN_SYSTEM` base prompt | No table names or FMCG rules hardcoded — table descriptions come from `SchemaDiscovery` dynamically |
| `system_addendum` param on `Planner.plan()` + `Synthesizer.synthesize()` | Industry rules appended at request time, not baked into constants |
| `PromptGenerator._INDUSTRY_ADDENDUMS` registry | FMCG addendum contains: ₹ lakh/crore formatting, rupee impact framing, domain glossary, scheme leakage join rules. Language is **not** in this addendum — it is fully separate. Adding a new vertical = one dict entry |
| `TenantContext.tenant_config` | `get_tenant_context()` now also fetches `tenants.config` JSONB — `industry`, `currency`, `language` exposed as typed properties |
| `PromptGenerator.build_language_addendum()` | New method — reads `tenant_config.language` and injects mirror-language instructions separately from industry rules. Supported: `hi`, `te`, `ta`, `mr`, `kn`, `bn`, `gu`. Defaults to English if absent. |
| Language stored in `tenants.config` JSONB | Set at creation via `POST /admin/tenants` (`config: {"language": "te"}`). Updated at any time via `PATCH /admin/tenants/{id}/config`. |
| `PromptGenerator` wired into `copilot.py` | Route builds `synthesizer_addendum = build_synthesizer_addendum() + build_language_addendum()` — industry and language rules are independent, both appended |

**Result:** FMCG tenants (`config.industry = "fmcg_distribution"`) get ₹ framing and FMCG join rules. Any tenant with `config.language = "te"` (or any other supported language) gets mirror-language copilot responses — the user speaks in their language, the bot mirrors it. A Tamil-speaking cafe owner gets Tamil responses; a Hindi-speaking FMCG distributor gets Hindi responses. Language and industry are fully orthogonal.

### Day 4 additions (services and endpoints)

| Addition | Purpose |
|---|---|
| `RoutePerformance` KPI model + service method | Route/beat analytics from existing `route` column — no SFA needed |
| `OutstandingParty` KPI model + service method | Credit exposure leaderboard — top parties by outstanding amount |
| `source_type` parameter on `DataImportService` | Routes rows to correct table: primary → `sales_data`, secondary → `secondary_sales_data`, scheme → `scheme_master` |
| `POST /data/sync` JSON endpoint | Ingest point for overnight agent script — customer installs once, auto-syncs nightly |

### Day 7 additions (dashboard)

| Addition | Purpose |
|---|---|
| Route performance card | Top 5 routes by revenue, rendered conditionally if `route` data present |
| Credit exposure card | Outstanding parties leaderboard, rendered conditionally if `outstanding_amount` data present |

### Day 9 additions (data page + morning brief)

| Addition | Purpose |
|---|---|
| Secondary sales upload panel | Second upload picker, calls `/data/import?source_type=secondary` → `secondary_sales_data` |
| Scheme master upload panel | Third upload picker, calls `/data/import?source_type=scheme` → `scheme_master` |
| Morning brief verdict format | Rewrites brief from narrative to "Top 3 actions ranked by ₹ impact" with lakh/crore notation |

### Day 10 additions (reports page)

| Addition | Purpose |
|---|---|
| Scheme leakage report card | Joins `scheme_master` vs `secondary_sales_data` — shows ₹ deniable per distributor per scheme cycle |
| `get_scheme_leakage` SQL function | Runs in Supabase, compares claimed vs. actual offtake by party + product + date window |

### The overnight agent strategy

For the first 2–3 customers, data freshness is achieved without a full live connector:

1. Customer installs `akara_agent.py` on their Tally machine — 100-line Python script, provided at onboarding
2. Windows Task Scheduler runs it nightly at 11 PM
3. Script reads Tally's local HTTP XML API (port 9000) → transforms to AKARA schema → POSTs to `POST /data/sync`
4. Dashboard shows fresh data every morning — zero manual work after initial setup

This bridges the gap between "manual CSV upload" (current) and "live Tally HTTP connector" (future). Full Tally connector is the next milestone after the first 3 paying customers. The `akara_agent.py` script is written after Day 4 when the `/data/sync` endpoint exists.

### Complete feature-to-day map

```
Day 1   → Add 3 schema items (secondary_sales_data, scheme_master, outstanding_amount col)
          Migration 004: get_route_performance(), get_outstanding_parties(), get_scheme_leakage()
          Migration 005: execute_tenant_query RPC (critical — copilot breaks without this)
          Migration 006: update_tenant_config RPC (PATCH /admin/tenants/{id}/config)
Day 3   → Industry-agnostic base prompts + PromptGenerator addendum registry
          Language rules decoupled from industry — build_language_addendum() reads tenant_config.language
          Mirror-language behavior: 7 Indian languages supported (hi/te/ta/mr/kn/bn/gu)
Day 4   → Route KPIs, dual source import, /data/sync endpoint
Day 5   → PATCH /admin/tenants/{id}/config endpoint (update language/industry/currency after creation)
Day 7   → Route card + outstanding card on dashboard
Day 9   → 3-panel upload UI (primary/secondary/scheme) + verdict brief format + Settings page (language change)
Day 10  → Scheme leakage report card + SQL function
Post-14 → akara_agent.py overnight Tally push script (shipped at Customer 1 onboarding)
```

### Competitive position after all additions

| Capability | FireAI | AKARA (after additions) |
|---|---|---|
| ₹ framing on every insight | Yes | Yes — FMCG tenants via `PromptGenerator` addendum (Day 3); other industries get generic numeric format |
| Multi-language NLQ | Hindi + English only | **All tenants** — mirror-input model. Tenant picks language at onboarding (stored in `tenants.config.language`). Supported: Telugu, Tamil, Marathi, Kannada, Bengali, Gujarati, Hindi. User speaks their language, copilot mirrors it. English always accepted. |
| Route/beat analytics | Yes | Yes — from existing `route` column (Day 4 + Day 7 card) |
| Credit/outstanding visibility | Yes | Yes — if `outstanding_amount` in CSV (Day 4 + Day 7 card) |
| Secondary sales upload | Yes (live DMS connector) | Yes — manual CSV upload on Day 9 UI, auto via overnight agent |
| Scheme master upload | Yes (automated) | Yes — manual CSV upload on Day 9 UI |
| Scheme leakage detection | Yes (live, automated) | Yes — report card on Day 10, runs vs. uploaded scheme + secondary CSVs |
| Primary vs. secondary mismatch | Yes (live, automated) | Yes — copilot can query both tables from Day 3 |
| Monday Commercial Brief | Yes | Yes — verdict format (Top 3 actions, ₹ ranked) added Day 9 |
| Native Tally connector | Yes | Overnight agent script (Post-14); full live connector — Month 2 roadmap |
| Pricing | ₹4,999/month | TBD — competitive target ₹3,999–₹5,999/month |

---

*Document generated: 2026-07-21*
*Updated: 2026-07-22 — competitive analysis additions for all 14 days + post-launch agent*
*Based on: Actual repository analysis of dailyassistant-dms-client + competitive analysis (FireAI, Ocheto)*
*Supersedes: solutions.md (sections that conflict with repository findings)*
*Total infrastructure cost at launch: ~$52/month for Customer #1*
*Timeline to production: 3 weeks*
