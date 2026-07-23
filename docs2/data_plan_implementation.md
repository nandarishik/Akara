# AKARA — Data Architecture & Implementation Plan

> **Version:** 1.0 — Written against the Day 13 repository state  
> **Audience:** Another Cursor instance implementing or auditing the data layer  
> **Source of truth:** Repository code — all schemas, routes, and field names are verified against actual files

---

## Table of Contents

1. [Repository Analysis Summary](#1-repository-analysis-summary)
2. [Data Categories](#2-data-categories)
3. [Data Volume Estimation](#3-data-volume-estimation)
4. [Architecture Decision](#4-architecture-decision)
5. [Technology Comparison](#5-technology-comparison)
6. [Complete Database Schema](#6-complete-database-schema)
7. [Indexing Strategy](#7-indexing-strategy)
8. [Vector and Embedding Data](#8-vector-and-embedding-data)
9. [File and Object Storage](#9-file-and-object-storage)
10. [Data Security](#10-data-security)
11. [Privacy and Retention](#11-privacy-and-retention)
12. [Backup and Recovery](#12-backup-and-recovery)
13. [Data Validation](#13-data-validation)
14. [Data Access Layer](#14-data-access-layer)
15. [API Data Contracts](#15-api-data-contracts)
16. [Caching Strategy](#16-caching-strategy)
17. [Background Processing](#17-background-processing)
18. [Logging and Observability](#18-logging-and-observability)
19. [Cost Analysis](#19-cost-analysis)
20. [Scaling Plan](#20-scaling-plan)
21. [Migration and Rollout Plan](#21-migration-and-rollout-plan)
22. [Testing Strategy](#22-testing-strategy)
23. [Implementation Phases](#23-implementation-phases)
24. [File-Level Implementation Map](#24-file-level-implementation-map)
25. [Risks and Trade-Offs](#25-risks-and-trade-offs)
26. [Decisions](#26-decisions)
27. [Explicit Non-Goals](#27-explicit-non-goals)
28. [Final Recommendation](#28-final-recommendation)

---

## 1. Repository Analysis Summary

### What was inspected

| Area | Files read |
|---|---|
| Database migrations | `migrations/001` through `009` (all 9 SQL files) |
| Backend services | All 40+ Python files under `backend/app/` |
| Frontend | All 30+ TypeScript files under `frontend/src/` |
| Configuration | `pyproject.toml`, `.env.example`, `vercel.json`, `railway.json` |
| Background jobs | `supabase/functions/daily-morning-brief/index.ts` |
| Documentation | `docs/`, `docs2/`, `README.md` |

### Product overview

**AKARA** is a multi-tenant AI-powered business analytics SaaS.  
Target customers: any business with sales data that needs a business analyst — currently focused on FMCG distributors, cafes, restaurants, and retailers in India.

**Core value loop:**
1. Customer uploads CSV/Excel export from their ERP (Tally, Petpooja, Marg, etc.)
2. AKARA parses, cleans, and stores the data
3. Dashboard shows KPIs (revenue, orders, zones, products)
4. Copilot answers natural-language questions about the data using LLM + SQL
5. Morning Brief email delivers insights automatically every day

### Technology stack

| Component | Technology |
|---|---|
| Database | Supabase (PostgreSQL 15 on AWS) |
| Auth | Supabase Auth (JWT ES256/HS256) |
| Backend API | FastAPI + Python 3.12 on Railway |
| Frontend | React + Vite + TypeScript on Vercel |
| LLM | Google Gemini 2.5 Flash (primary), OpenRouter (failover) |
| Email | SendGrid (morning brief) |
| Error tracking | Sentry |
| Background jobs | Supabase Edge Functions (Deno, cron-scheduled) |
| File parsing | pandas + openpyxl |
| Object storage | Supabase Storage (for generated reports, not yet fully wired) |

---

## 2. Data Categories

### 2.1 Tenants (Organizations)

**Purpose:** One row per customer organization (paying client). All other data is scoped to a tenant.

**Feature:** Multi-tenancy foundation. Every API call resolves to a `tenant_id` before querying data.

**Who creates it:** Platform admin only (via `scripts/bootstrap_admin.py` or Supabase dashboard). No self-serve signup yet.

**Who reads it:** All users within the tenant read their own row; platform admin reads all.

**Type:** Operational.

**Structure:**

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | ✓ | `uuid_generate_v4()` | Primary key |
| `name` | TEXT | ✓ | — | Display name ("QAFFEINE Pvt Ltd") |
| `slug` | TEXT | ✓ | — | URL-safe unique identifier ("qaffeine") |
| `config` | JSONB | ✓ | `{}` | Per-tenant config (industry, language, column mappings, currency) |
| `is_active` | BOOLEAN | ✓ | `true` | Soft-disable without deleting |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` | Row creation time |
| `updated_at` | TIMESTAMPTZ | ✓ | `NOW()` | Last update (trigger-managed) |

**`config` JSONB schema (documented in migration 001):**
```json
{
  "company_name": "QAFFEINE Pvt Ltd",
  "industry": "cafe",
  "primary_table": "sales_data",
  "currency": "INR",
  "language": "en",
  "column_mappings": {
    "revenue": "total_amount",
    "date": "invoice_date",
    "customer": "party_name",
    "product": "product_name",
    "region": "party_zone"
  },
  "business_terms": {
    "customer": "outlet",
    "region": "location"
  }
}
```

**Lifecycle:** Created by platform admin → rarely updated → never deleted (soft-disabled via `is_active`).

**Access patterns:** Read once per request (resolved in `get_tenant_context()` dependency). ~2 reads/second at 10 customers with 5 concurrent users each.

**Storage:** PostgreSQL. Relational with FK constraints on all other tables.

---

### 2.2 User Profiles

**Purpose:** Extends Supabase `auth.users`. Links a user to their tenant and stores role + notification preferences.

**Feature:** Auth, role-based access control, morning brief opt-in.

**Who creates it:** PostgreSQL trigger `on_auth_user_created` automatically creates a profile row whenever a new user is added to `auth.users`.

**Who reads it:** User reads their own. Admins read all profiles in their tenant.

**Type:** Operational.

**Structure:**

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | ✓ | — | FK → `auth.users(id)` ON DELETE CASCADE |
| `tenant_id` | UUID | ✓ | — | FK → `tenants(id)` ON DELETE CASCADE |
| `role` | TEXT | ✓ | `'user'` | `'admin'` or `'user'` — enforced by CHECK constraint |
| `display_name` | TEXT | — | `NULL` | Friendly name shown in UI |
| `preferences` | JSONB | — | `{}` | Per-user settings (e.g. `{"morning_brief_enabled": true}`) |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` | Row creation |

**`preferences` JSONB schema:**
```json
{
  "morning_brief_enabled": true,
  "language": "te"
}
```

**Lifecycle:** Created via trigger on user signup → `display_name` updated via `PATCH /auth/me` → `preferences` updated via `PATCH /settings` → deleted on CASCADE when `auth.users` row is deleted.

**Access patterns:** ~1 read per API request (in `get_tenant_context`). Low write frequency.

**Relationships:**
- `id` → `auth.users(id)` (1:1)
- `tenant_id` → `tenants(id)` (M:1)
- `id` → `chat_history(user_id)` (1:M)
- `id` → `conversations(user_id)` (1:M)

---

### 2.3 Primary Sales Data

**Purpose:** Core transactional data. One row per invoice line item (product × invoice). This is the primary source for all KPIs, copilot queries, and insights.

**Feature:** Dashboard KPIs, copilot analytics, revenue projections, morning brief insights.

**Who creates it:** Admin users via `POST /data/import` (CSV/Excel upload) or `POST /data/sync` (Tally agent push).

**Who reads it:** All users within the tenant. Read-only after import (no UPDATE policy).

**Type:** Operational + analytical.

**Structure:**

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | BIGSERIAL | ✓ | auto | Primary key |
| `tenant_id` | UUID | ✓ | — | FK → `tenants(id)` ON DELETE CASCADE |
| `invoice_date` | DATE | ✓ | — | Date of transaction |
| `invoice_number` | TEXT | — | NULL | Invoice/bill number |
| `party_name` | TEXT | — | NULL | Customer/outlet/party name |
| `party_city` | TEXT | — | NULL | City of the party |
| `party_zone` | TEXT | — | NULL | Zone/region/territory |
| `route` | TEXT | — | NULL | Sales channel (beat, aggregator, Swiggy, etc.) |
| `product_name` | TEXT | — | NULL | Product/item name |
| `product_group` | TEXT | — | NULL | Category/brand/department |
| `product_category` | TEXT | — | NULL | Sub-category |
| `hsn_code` | TEXT | — | NULL | HSN code for GST compliance |
| `quantity` | NUMERIC(12,3) | — | NULL | Quantity sold |
| `gross_amount` | NUMERIC(15,2) | — | NULL | Pre-discount revenue |
| `discount_amount` | NUMERIC(15,2) | — | NULL | Discount given |
| `net_amount` | NUMERIC(15,2) | — | NULL | Post-discount, pre-tax |
| `tax_amount` | NUMERIC(15,2) | — | NULL | CGST + SGST + IGST total |
| `total_amount` | NUMERIC(15,2) | ✓ | — | Final billed amount |
| `outstanding_amount` | NUMERIC(15,2) | — | NULL | Pending receivable (migration 004) |
| `raw_data` | JSONB | — | NULL | All original upload columns not explicitly mapped |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` | Row insertion time |

**Lifecycle:**
1. Admin uploads file → `SalesDataParser` normalises columns → `DataImportService` enriches rows → batch insert 500 rows at a time
2. Data is immutable after insert (no UPDATE RLS policy)
3. Deletion: admin-only via import undo (pending) or direct table delete

**On failure:** If batch `i` fails, `rows_skipped` increments; previous batches remain inserted. No transaction rollback across batches (each batch is its own Supabase call). This is a known limitation — the undo endpoint in the data plan resolves this.

**Access patterns:**
- Writes: Infrequent (weekly uploads). 500 rows/batch, typically 500–5,000 rows per upload.
- Reads: High frequency. Every dashboard load, every copilot question. Queries always filter by `tenant_id + invoice_date` range.
- Common queries: `GROUP BY product_name ORDER BY SUM(total_amount) DESC`, `GROUP BY invoice_date`, `GROUP BY party_zone`, `WHERE outstanding_amount > 0`

**Relationships:**
- `tenant_id` → `tenants(id)` (M:1)

---

### 2.4 Secondary Sales Data (DMS Offtake)

**Purpose:** Secondary/tertiary sales from distribution management systems (DMS). Tracks offtake from distributors to retailers — separate from primary dispatch data.

**Feature:** Scheme leakage detection (`get_scheme_leakage()`), sell-through rate analysis, distribution depth.

**Who creates it:** Admin users via `POST /data/import?source_type=secondary`.

**Type:** Analytical.

**Structure:** Identical to `sales_data` minus `outstanding_amount`, `hsn_code`, `tax_amount`. Has `data_source TEXT` instead (e.g. `"manual_csv"`, `"bizom"`, `"beatroute"`).

**Access patterns:** Read during scheme leakage analysis. Lower read frequency than `sales_data`.

---

### 2.5 Scheme Master

**Purpose:** Records distributor scheme claims. Used to detect scheme leakage — where claimed discount exceeds actual secondary offtake.

**Feature:** Scheme leakage report, `GET /kpi/scheme-leakage`.

**Who creates it:** Admin via `POST /data/import?source_type=scheme`.

**Type:** Analytical.

**Structure:**

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | BIGSERIAL | ✓ | auto | Primary key |
| `tenant_id` | UUID | ✓ | — | FK → tenants |
| `scheme_name` | TEXT | ✓ | — | Name of the scheme/promotion |
| `party_name` | TEXT | ✓ | — | Distributor/party claiming the scheme |
| `product_name` | TEXT | — | NULL | Product the scheme applies to |
| `claimed_amount` | NUMERIC(15,2) | ✓ | 0 | Amount claimed by the party |
| `scheme_start` | DATE | — | NULL | Scheme validity start |
| `scheme_end` | DATE | — | NULL | Scheme validity end |
| `discount_pct` | NUMERIC(6,3) | — | NULL | Discount percentage |
| `raw_data` | JSONB | — | NULL | Original upload columns |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` | Row insertion |

---

### 2.6 Conversations

**Purpose:** Groups copilot messages into named conversations (ChatGPT-style UI). Each user has their own conversations.

**Feature:** Conversation sidebar, conversation rename, new chat, delete chat.

**Who creates it:** Backend on first message if no `conversation_id` is provided, or explicitly via `POST /conversations/`.

**Type:** Operational.

**Structure:**

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | ✓ | `uuid_generate_v4()` | Primary key |
| `tenant_id` | UUID | ✓ | — | FK → tenants |
| `user_id` | UUID | ✓ | — | FK → auth.users |
| `title` | TEXT | ✓ | `'New Chat'` | Conversation name (auto-named or user-renamed) |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` | Creation |
| `updated_at` | TIMESTAMPTZ | ✓ | `NOW()` | Last message time |

**Lifecycle:** Created on first message → title updated via `PATCH /conversations/{id}` → deleted via `DELETE /conversations/{id}` → cascade-deletes all `chat_history` rows with matching `conversation_id`.

**Access patterns:** Listed on sidebar load (~1x per session). ~10–100 conversations per active user.

---

### 2.7 Chat History (Copilot Messages)

**Purpose:** Persists every copilot Q&A exchange. Used for conversation history display and (future) context retrieval.

**Feature:** Copilot UI, conversation history, admin audit.

**Who creates it:** Backend after each successful `POST /copilot/chat`.

**Type:** Operational + archival.

**Structure:**

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | ✓ | `uuid_generate_v4()` | Primary key |
| `tenant_id` | UUID | ✓ | — | FK → tenants |
| `user_id` | UUID | ✓ | — | FK → auth.users |
| `conversation_id` | UUID | — | NULL | FK → conversations (migration 007) |
| `question` | TEXT | ✓ | — | User's question |
| `response` | TEXT | — | NULL | Copilot's response |
| `metadata` | JSONB | ✓ | `{}` | `intent`, `sql_queries_run`, `llm_model`, `tokens_used`, `guardrail_results`, `response_time_ms` |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` | Message time |

**`metadata` JSONB schema:**
```json
{
  "intent": "top_products_by_revenue",
  "sql_queries_run": ["SELECT product_name, SUM(total_amount)..."],
  "llm_model": "gemini-2.5-flash",
  "tokens_used": {"input": 1200, "output": 340},
  "guardrail_results": [
    {"check": "premise_check", "passed": true, "message": "OK"},
    {"check": "causal_postcheck", "passed": true, "message": "OK"}
  ],
  "response_time_ms": 3421
}
```

**Access patterns:** Appended on each copilot query. Read when loading conversation history. Expected 5–50 messages/conversation, 10–100 conversations/user. Total: ~500–5,000 messages per active user per month.

---

### 2.8 Context Cache

**Purpose:** Stores weather, news, and holiday data fetched for contextualizing copilot responses. Avoids repeated API calls for the same date.

**Feature:** Copilot context enrichment.

**Who creates it:** `ContextTool` in the copilot pipeline when context is needed for a query.

**Type:** Temporary (expires after TTL).

**Structure:**

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | ✓ | `uuid_generate_v4()` | Primary key |
| `tenant_id` | UUID | ✓ | — | FK → tenants |
| `context_type` | TEXT | ✓ | — | `'weather'` / `'news'` / `'holiday'` |
| `context_date` | DATE | ✓ | — | Date the context is for |
| `content` | JSONB | ✓ | `{}` | Raw API response |
| `source` | TEXT | — | NULL | API source name |
| `expires_at` | TIMESTAMPTZ | — | NULL | Cache expiry |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` | Row creation |

**Lifecycle:** Written on first fetch for a `(tenant_id, context_type, context_date)` tuple. Reused within `expires_at`. Stale rows accumulate (no automated cleanup yet — **gap to address**).

**Unique constraint:** `(tenant_id, context_type, context_date)` — prevents duplicate fetches.

---

### 2.9 Generated Reports

**Purpose:** Metadata ledger for any machine-generated artifact: morning briefs, CSV exports, import history logs. Stores metadata and an optional Supabase Storage path.

**Feature:** Reports page (`GET /reports/`), import history (pending), morning brief log.

**Who creates it:** Backend services using `service_role` key (bypasses RLS on insert).

**Type:** Operational + archival.

**Structure:**

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | ✓ | `uuid_generate_v4()` | Primary key |
| `tenant_id` | UUID | ✓ | — | FK → tenants |
| `report_type` | TEXT | ✓ | — | `'morning_brief'` / `'export_csv'` / `'csv_import'` / `'anomaly_report'` |
| `title` | TEXT | ✓ | — | Human-readable name (filename for imports) |
| `storage_path` | TEXT | — | NULL | Supabase Storage path if file exists |
| `file_size_bytes` | BIGINT | — | NULL | File size |
| `metadata` | JSONB | ✓ | `{}` | Type-specific data (see below) |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` | Creation time |

**`metadata` by `report_type`:**

```json
// morning_brief
{
  "insights_count": 3,
  "kpi_date": "2026-07-21",
  "sent_to": ["admin@qaffeine.com"]
}

// csv_import (pending — import tracking plan)
{
  "import_id": "uuid",
  "source_type": "primary",
  "rows_inserted": 487,
  "rows_skipped": 3,
  "filename": "Dec_Sales_Week1.xlsx",
  "sheet_name": "Discount Report Item Wise"
}
```

**Access patterns:** Appended on each report generation (low frequency). Read on `GET /reports/` by the tenant.

---

### 2.10 Audit Log

**Purpose:** Immutable record of all significant system actions. Used for security audit, debugging, and monitoring.

**Feature:** Admin logs page (`GET /admin/logs/`), Edge Function execution logging.

**Who creates it:** Backend using `service_role` key. Never writable by regular users (no user-facing INSERT policy).

**Type:** Archival.

**Structure:**

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | ✓ | `uuid_generate_v4()` | Primary key |
| `tenant_id` | UUID | — | NULL | FK → tenants (nullable for platform-level events) |
| `user_id` | UUID | — | NULL | FK → auth.users |
| `action` | TEXT | ✓ | — | Event name (e.g. `'morning_brief_run'`, `'data_import'`) |
| `resource_type` | TEXT | — | NULL | What was acted on (`'email'`, `'sales_data'`) |
| `resource_id` | TEXT | — | NULL | ID of the affected resource |
| `details` | JSONB | ✓ | `{}` | Event-specific data |
| `ip_address` | TEXT | — | NULL | Client IP (not yet populated from requests) |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` | Event timestamp |

**Access patterns:** Append-only. Admin reads ordered by `created_at DESC` with pagination.

**Retention:** 90 days (proposed — no automated cleanup implemented yet).

---

### 2.11 User Authentication Identities

**Purpose:** Supabase Auth manages user identities. AKARA's code does not own this table directly.

**What's stored in `auth.users` (Supabase-managed):**
- `id` UUID — user identifier (FK target for all other tables)
- `email` TEXT — login email
- `encrypted_password` — bcrypt hash
- `raw_user_meta_data` JSONB — used by AKARA for `tenant_id`, `role`, `display_name` on signup
- `created_at`, `updated_at`, `last_sign_in_at`

**How AKARA uses it:**
- Signup: `supabase.auth.admin.create_user()` with `user_metadata.tenant_id` → triggers `handle_new_user()` → creates `profiles` row
- Login: Supabase issues JWT → FastAPI validates via `decode_supabase_jwt()` → extracts `sub` (user UUID)
- Token algorithm: ES256 (modern Supabase projects) or HS256 (legacy)
- JWKS cached in memory for 1 hour: `_JWKS_CACHE` in `backend/app/core/auth.py`

---

### 2.12 LLM Prompts and Responses

**Purpose:** Generated by the copilot pipeline. Not stored as a separate entity — the assembled prompt is transient; the response is persisted in `chat_history`.

**What is generated per request:**
- System prompt: built by `PromptsGenerator` from tenant config (industry, language, schema context)
- User message: the raw question
- Plan JSON: returned by Gemini, parsed by `Planner`
- SQL queries: generated by Planner steps, validated by `SQLGuard`
- SQL results: rows returned from `execute_tenant_query()`
- Final response: synthesized by `Synthesizer` via Gemini

**Storage:** Only the `question` and `response` TEXT fields are stored in `chat_history`. SQL queries and guardrail results are in `chat_history.metadata` JSONB.

**No embedding storage:** The copilot uses real-time SQL against structured sales data. There is no semantic search, no vector store, and no RAG pipeline. The LLM only needs the question + schema context + SQL results — not a corpus of documents.

---

### 2.13 Import History (Planned — Not Yet Implemented)

**Purpose:** Track each upload batch so individual imports can be identified and undone.

**Status:** Designed in `docs2/data_plan.md`, not yet deployed. Requires:
- Migration `010_import_tracking.sql` to add `import_id UUID` to `sales_data`, `secondary_sales_data`, `scheme_master`
- `ImportResult.import_id` field in `models.py`
- `generated_reports` log entry per import
- `DELETE /data/imports/{import_id}` endpoint

**See `docs2/data_plan.md` Part 2 for full implementation.**

---

### 2.14 Temporary / In-Process Data

**Purpose:** Transient data that exists during a single request and is never persisted.

| Data | Location | Lifetime |
|---|---|---|
| Uploaded file bytes | FastAPI request body | Single request |
| Parsed DataFrame | Python memory | Single request |
| LLM streaming chunks | SSE generator | Single request |
| JWT payload (decoded) | FastAPI `Depends` injection | Single request |
| JWKS keys | `_JWKS_CACHE` dict in process memory | 1 hour |
| `TenantContext` (resolved tenant) | FastAPI `Depends` injection | Single request |

**Note on JWKS cache:** The current implementation stores JWKS in a module-level dict (`_JWKS_CACHE`). On Railway with a single instance this works fine. With multiple instances (future scaling), each instance refreshes independently — no coordination needed since JWKS changes are rare (key rotation).

---

## 3. Data Volume Estimation

### Assumptions

| Assumption | Value |
|---|---|
| Average rows per import upload | 500–2,000 rows (1 week of data, one tenant) |
| Upload frequency per tenant | 1–4 times/month |
| Copilot questions per active user/day | 5–15 |
| Users per tenant | 2–10 |
| Active users per tenant/day | 1–3 |
| `chat_history` row size | ~2 KB (question + response + metadata JSONB) |
| `sales_data` row size | ~400 bytes |
| `audit_log` row size | ~500 bytes |
| Morning brief per tenant/day | 1 email per admin user |

### Per-tenant estimates (1 month)

| Table | Rows/month | Size/month |
|---|---|---|
| `sales_data` | 2,000–8,000 | ~1–4 MB |
| `chat_history` | 150–900 | ~300 KB–2 MB |
| `conversations` | 30–100 | ~5 KB |
| `context_cache` | 30–90 | ~50 KB |
| `generated_reports` | 30–50 | ~10 KB |
| `audit_log` | 50–200 | ~100 KB |

**Calculation for `sales_data`:**
- 2 uploads/month × 2,000 rows × 400 bytes = **1.6 MB/tenant/month**

### Cumulative volume by scenario

| Scenario | Tenants | sales_data rows | Total DB size | Notes |
|---|---|---|---|---|
| 1 tenant, 1 month | 1 | ~4,000 | ~5 MB | Below any tier limit |
| 3 tenants, 3 months | 3 | ~36,000 | ~40 MB | Supabase free tier: 500 MB |
| 10 tenants, 6 months | 10 | ~240,000 | ~300 MB | Supabase free tier limit approaching |
| 10 tenants, 1 year | 10 | ~480,000 | ~600 MB | Exceeds Supabase free tier |
| 50 tenants, 1 year | 50 | ~2,400,000 | ~3 GB | Supabase Pro ($25/mo) handles this |

**Key finding:** The Supabase free tier (500 MB database) handles the first 3 customers for 6+ months. Upgrade to Pro ($25/month) is needed around customer 8–10 or at 6 months with 3 active customers, whichever comes first.

### `chat_history` volume

- 10 active users × 10 questions/day × 365 days × 2 KB = **73 MB/year** across all 10 tenants
- Easily managed with Supabase free tier for the first year.

### LLM token costs

| Scenario | Gemini Flash tokens/month | Est. cost/month |
|---|---|---|
| 3 tenants, 100 questions/day total | ~2M input + 500K output | ~$0.30 (at Gemini pricing) |
| 10 tenants, 300 questions/day | ~6M input + 1.5M output | ~$0.90 |

> Gemini 2.5 Flash: ~$0.15/M input tokens, ~$0.60/M output tokens (Jul 2026 pricing).  
> LLM cost is negligible at this scale.

---

## 4. Architecture Decision

### Recommendation: Supabase + Railway + Vercel (current stack — keep it)

The existing architecture is correct for the product's current stage and expected 12-month growth.

**Why:**

1. **Supabase covers everything needed:**
   - PostgreSQL (structured multi-tenant data)
   - Auth (JWT, user management, trigger-based profile creation)
   - Row Level Security (tenant isolation without application-layer checks)
   - Storage (for generated reports and future file uploads)
   - Edge Functions (cron-scheduled background jobs without a separate queue)
   - Realtime (available but not yet used — could power live dashboard updates)

2. **Railway covers FastAPI:**
   - Zero-config Python deployment via Procfile and nixpacks.toml
   - Single instance is sufficient for 50 tenants
   - `$5/month` Hobby plan covers the first phase

3. **Vercel covers React:**
   - Zero-config Vite deployment
   - Free tier handles all traffic for the first year
   - Global CDN included

4. **No additional services are justified today:**
   - No Redis needed (no session state, no queue, JWKS in-process cache is sufficient)
   - No vector database needed (copilot uses SQL against structured data, not semantic search)
   - No separate analytics database needed (queries run directly against `sales_data` via Supabase RPCs)
   - No message queue needed (Supabase Edge Functions replace a job queue for background tasks)
   - No CDN needed beyond Vercel's built-in CDN

### When to revisit

| Trigger | Action |
|---|---|
| DB size > 4 GB | Upgrade Supabase to Pro ($25/mo) |
| API response time P95 > 2s consistently | Add in-process result caching for KPI queries |
| 50+ active tenants with >100 concurrent users | Upgrade Railway to horizontal scaling or switch to Fly.io |
| Copilot latency > 10s due to slow SQL | Add `pg_trgm` or materialized views for heavy aggregations |
| File uploads needed (not just parsing) | Enable Supabase Storage properly with buckets and policies |

---

## 5. Technology Comparison

### Database options

| Option | Suitability | Cost | Ease | Operational burden | Verdict |
|---|---|---|---|---|---|
| **Supabase (current)** | Perfect | Free/$25/mo | Zero-config | Minimal | ✅ **Use this** |
| Neon | Good | Free/usage | Moderate | Low | Alternative if Supabase pricing becomes issue |
| Railway PostgreSQL | Acceptable | $5+/mo | Easy | Moderate | No RLS, no Auth, no Edge Functions |
| AWS RDS | Good at scale | $15+/mo | Complex | High | Overkill for current stage |
| PlanetScale / Vitess | Poor (MySQL) | Varies | Moderate | High | Schema migration complexity |
| MongoDB Atlas | Poor fit | Free/$57 | Easy | Moderate | Structured relational data doesn't fit document model |
| Firebase Firestore | Poor fit | Free/$25+ | Easy | Low | Weak SQL, no complex aggregations |

**Conclusion:** Supabase is the clear winner for this product's requirements. Its combination of PostgreSQL + Auth + RLS + Edge Functions + Storage in one managed platform eliminates 4+ separate services.

### Object storage options

| Option | Cost | Integration | Verdict |
|---|---|---|---|
| **Supabase Storage (current)** | Free/1 GB | Native — same client | ✅ **Use this** |
| AWS S3 | $0.023/GB | Requires boto3 | Unnecessary complexity |
| Cloudflare R2 | Free/10 GB | S3-compatible API | Good alternative when Supabase Storage limits hit |
| Railway volumes | ~$0.25/GB/month | Docker volume | Not suitable for user-facing files |

### LLM options

| Option | Quality | Cost | Latency | Verdict |
|---|---|---|---|---|
| **Gemini 2.5 Flash (current)** | Excellent | $0.15/M input | ~1–3s | ✅ **Primary** |
| OpenRouter (current failover) | Good | Varies | ~2–5s | ✅ **Failover** |
| GPT-4o-mini | Very good | $0.15/M input | ~1–2s | Alternative primary |
| Claude Haiku | Good | $0.25/M input | ~1–2s | Alternative |
| Self-hosted (Ollama) | Variable | Free + infra | ~3–10s | Not viable on Railway |

---

## 6. Complete Database Schema

All tables verified against migration files 001–009.

### Table: `public.tenants`

**Purpose:** Customer organizations. Root of all tenant isolation.

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | ✓ | `uuid_generate_v4()` | PK |
| `name` | TEXT | ✓ | — | Display name |
| `slug` | TEXT | ✓ | — | URL-safe ID, unique |
| `config` | JSONB | ✓ | `{}` | Per-tenant configuration |
| `is_active` | BOOLEAN | ✓ | `true` | Soft disable flag |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | ✓ | `NOW()` | Last update (trigger) |

**PK:** `id`  
**Unique:** `slug`  
**Indexes:** `idx_tenants_slug`, `idx_tenants_is_active`  
**RLS:** Users see only their own tenant. Admins can update.  
**Trigger:** `tenants_updated_at` — auto-updates `updated_at` on every UPDATE.

---

### Table: `public.profiles`

**Purpose:** Extends Supabase `auth.users`. Tenant membership + role + preferences.

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | UUID | ✓ | — | PK = FK → `auth.users(id)` |
| `tenant_id` | UUID | ✓ | — | FK → `tenants(id)` ON DELETE CASCADE |
| `role` | TEXT | ✓ | `'user'` | `CHECK (role IN ('admin', 'user'))` |
| `display_name` | TEXT | — | NULL | User's friendly name |
| `preferences` | JSONB | — | `{}` | Per-user settings |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` | Creation timestamp |

**PK:** `id`  
**FK:** `id` → `auth.users(id)` ON DELETE CASCADE; `tenant_id` → `tenants(id)` ON DELETE CASCADE  
**Indexes:** `idx_profiles_tenant_id`, `idx_profiles_role`, `idx_profiles_preferences` (GIN)  
**RLS:** Users see own profile. Admins see all profiles in their tenant.  
**Trigger:** `on_auth_user_created` on `auth.users` calls `handle_new_user()` to auto-create profile.

---

### Table: `public.sales_data`

**Purpose:** Primary sales transactions. One row per invoice line item.

| Column | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | BIGSERIAL | ✓ | auto | PK |
| `tenant_id` | UUID | ✓ | — | FK → `tenants(id)` ON DELETE CASCADE |
| `invoice_date` | DATE | ✓ | — | Transaction date |
| `invoice_number` | TEXT | — | NULL | Invoice/bill reference |
| `party_name` | TEXT | — | NULL | Customer/outlet name |
| `party_city` | TEXT | — | NULL | City |
| `party_zone` | TEXT | — | NULL | Zone/region |
| `route` | TEXT | — | NULL | Sales channel or beat |
| `product_name` | TEXT | — | NULL | Product/item name |
| `product_group` | TEXT | — | NULL | Product category/brand |
| `product_category` | TEXT | — | NULL | Sub-category |
| `hsn_code` | TEXT | — | NULL | GST HSN code |
| `quantity` | NUMERIC(12,3) | — | NULL | Quantity sold |
| `gross_amount` | NUMERIC(15,2) | — | NULL | Pre-discount amount |
| `discount_amount` | NUMERIC(15,2) | — | NULL | Discount |
| `net_amount` | NUMERIC(15,2) | — | NULL | Post-discount, pre-tax |
| `tax_amount` | NUMERIC(15,2) | — | NULL | Total GST |
| `total_amount` | NUMERIC(15,2) | — | NULL | Final billed amount |
| `outstanding_amount` | NUMERIC(15,2) | — | NULL | Receivable balance (migration 004) |
| `raw_data` | JSONB | — | NULL | Unknown source columns |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` | Row insertion |

**PK:** `id` (BIGSERIAL — auto-increment, not UUID, for insert performance)  
**FK:** `tenant_id` → `tenants(id)` ON DELETE CASCADE  
**Indexes:**
- `idx_sales_data_tenant_id` — for all queries scoped to tenant
- `idx_sales_data_invoice_date` — for date-range filtering
- `idx_sales_data_tenant_date` — composite — most KPI queries use this
- `idx_sales_data_party_name`, `idx_sales_data_party_zone`, `idx_sales_data_product_name`
- `idx_sales_data_outstanding` — for `get_outstanding_parties()`

**RLS:**
- SELECT: `tenant_id = get_my_tenant_id()`
- INSERT: admin only, `tenant_id = get_my_tenant_id()`
- DELETE: admin only
- UPDATE: not allowed (data is immutable)

---

### Table: `public.secondary_sales_data`

**Purpose:** Secondary (offtake) sales from DMS systems. Parallel structure to `sales_data`.

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | BIGSERIAL | ✓ | PK |
| `tenant_id` | UUID | ✓ | FK → tenants |
| `invoice_date` | DATE | ✓ | |
| `invoice_number` | TEXT | — | |
| `party_name` | TEXT | — | |
| `party_city`, `party_zone`, `route` | TEXT | — | |
| `product_name`, `product_group`, `product_category` | TEXT | — | |
| `quantity` | NUMERIC(12,3) | — | |
| `gross_amount`, `discount_amount`, `net_amount`, `total_amount` | NUMERIC(15,2) | — | |
| `data_source` | TEXT | — | `"manual_csv"`, `"bizom"`, etc. |
| `raw_data` | JSONB | — | |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` |

**Indexes:** `idx_secondary_sales_tenant_id`, `idx_secondary_sales_invoice_date`, `idx_secondary_sales_tenant_date`  
**RLS:** Same pattern as `sales_data`.

---

### Table: `public.scheme_master`

**Purpose:** Distributor scheme claims for leakage detection.

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | BIGSERIAL | ✓ | PK |
| `tenant_id` | UUID | ✓ | FK → tenants |
| `scheme_name` | TEXT | ✓ | |
| `party_name` | TEXT | ✓ | |
| `product_name` | TEXT | — | |
| `claimed_amount` | NUMERIC(15,2) | ✓ | DEFAULT 0 |
| `scheme_start`, `scheme_end` | DATE | — | |
| `discount_pct` | NUMERIC(6,3) | — | |
| `raw_data` | JSONB | — | |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` |

**Indexes:** `idx_scheme_master_tenant_id`, `idx_scheme_master_party_name`, `idx_scheme_master_dates`

---

### Table: `public.conversations`

**Purpose:** Groups chat messages. One row per conversation thread.

| Column | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | ✓ | `uuid_generate_v4()` | PK |
| `tenant_id` | UUID | ✓ | — | FK → tenants |
| `user_id` | UUID | ✓ | — | FK → auth.users |
| `title` | TEXT | ✓ | `'New Chat'` | User-editable |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` | |
| `updated_at` | TIMESTAMPTZ | ✓ | `NOW()` | Updated on last message |

**Indexes:** `idx_conversations_user_id`, `idx_conversations_tenant_id`, `idx_conversations_updated_at DESC`  
**RLS:** User sees/updates/deletes only their own conversations.

---

### Table: `public.chat_history`

**Purpose:** Each copilot Q&A exchange.

| Column | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | ✓ | `uuid_generate_v4()` | PK |
| `tenant_id` | UUID | ✓ | — | FK → tenants |
| `user_id` | UUID | ✓ | — | FK → auth.users |
| `conversation_id` | UUID | — | NULL | FK → conversations ON DELETE CASCADE |
| `question` | TEXT | ✓ | — | |
| `response` | TEXT | — | NULL | NULL until response arrives |
| `metadata` | JSONB | ✓ | `{}` | intent, SQL, LLM model, guardrail results |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` | |

**Indexes:** `idx_chat_history_tenant_id`, `idx_chat_history_user_id`, `idx_chat_history_created_at DESC`, `idx_chat_history_conversation_id`  
**RLS:** User sees own messages. Admins see all tenant messages.

---

### Table: `public.context_cache`

**Purpose:** Weather/news/holiday data cache for copilot enrichment.

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID | ✓ | PK |
| `tenant_id` | UUID | ✓ | FK → tenants |
| `context_type` | TEXT | ✓ | `CHECK (context_type IN ('weather', 'news', 'holiday'))` |
| `context_date` | DATE | ✓ | |
| `content` | JSONB | ✓ | API response |
| `source` | TEXT | — | |
| `expires_at` | TIMESTAMPTZ | — | |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` |

**Unique:** `(tenant_id, context_type, context_date)`  
**RLS:** All tenant users can read/write.

---

### Table: `public.generated_reports`

**Purpose:** Metadata for all machine-generated reports and import logs.

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID | ✓ | PK |
| `tenant_id` | UUID | ✓ | FK → tenants |
| `report_type` | TEXT | ✓ | `'morning_brief'`, `'export_csv'`, `'csv_import'` |
| `title` | TEXT | ✓ | Filename or report title |
| `storage_path` | TEXT | — | Supabase Storage path |
| `file_size_bytes` | BIGINT | — | |
| `metadata` | JSONB | ✓ | `{}` |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` |

**Indexes:** `idx_generated_reports_tenant_id`, `idx_generated_reports_report_type`, `idx_generated_reports_created_at DESC`  
**RLS:** All tenant users can read. Insert/delete via service_role only.

---

### Table: `public.audit_log`

**Purpose:** Immutable system event log. Written by backend and Edge Functions using service_role.

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID | ✓ | PK |
| `tenant_id` | UUID | — | Nullable (platform-level events have no tenant) |
| `user_id` | UUID | — | Nullable |
| `action` | TEXT | ✓ | Event name |
| `resource_type` | TEXT | — | |
| `resource_id` | TEXT | — | |
| `details` | JSONB | ✓ | `{}` |
| `ip_address` | TEXT | — | Not yet populated |
| `created_at` | TIMESTAMPTZ | ✓ | `NOW()` |

**Indexes:** `idx_audit_log_tenant_id`, `idx_audit_log_user_id`, `idx_audit_log_action`, `idx_audit_log_created_at DESC`  
**RLS:** Admins can SELECT within their tenant. No client INSERT policy.

---

### Database Functions (PostgreSQL RPCs)

| Function | Migration | Purpose | Called by |
|---|---|---|---|
| `get_my_tenant_id()` | 002 | RLS helper — returns tenant_id for current auth user | RLS policies |
| `is_admin()` | 002 | RLS helper — checks admin role | RLS policies |
| `handle_new_user()` | 003 | Trigger — auto-creates profiles row on auth.users INSERT | `on_auth_user_created` trigger |
| `set_updated_at()` | 001 | Trigger — updates `updated_at` on tenants UPDATE | `tenants_updated_at` trigger |
| `get_kpi_summary(p_tenant_id, p_start_date, p_end_date)` | 003 | Aggregated KPI for date range | `KPIService.get_summary()` |
| `get_top_products(p_tenant_id, p_start_date, p_end_date, p_limit)` | 003 | Top N products by revenue | `KPIService` |
| `get_zone_breakdown(p_tenant_id, p_start_date, p_end_date)` | 003 | Revenue by zone | `KPIService` |
| `get_route_performance(p_tenant_id, p_start_date, p_end_date, p_limit)` | 004 | Route analytics | `KPIService` |
| `get_outstanding_parties(p_tenant_id, p_limit)` | 004 | AR outstanding parties | `KPIService`, `InsightsEngine` |
| `get_scheme_leakage(p_tenant_id)` | 004 | Scheme vs offtake comparison | Reports route |
| `execute_tenant_query(p_query, p_params)` | 005 | Dynamic SELECT execution for copilot | `SQLExecutor` |
| `get_conversations_with_counts(p_user_id)` | 007 | Conversations + message counts | Conversations route |

---

## 7. Indexing Strategy

### Current indexes (verified from migrations)

| Index | Table | Columns | Query it supports |
|---|---|---|---|
| `idx_tenants_slug` | `tenants` | `slug` | Tenant lookup by slug |
| `idx_tenants_is_active` | `tenants` | `is_active` | Edge Function: `WHERE is_active = true` |
| `idx_profiles_tenant_id` | `profiles` | `tenant_id` | List users for a tenant |
| `idx_profiles_role` | `profiles` | `role` | Filter admin users |
| `idx_profiles_preferences` | `profiles` | `preferences` (GIN) | `preferences->>'morning_brief_enabled'` |
| `idx_sales_data_tenant_id` | `sales_data` | `tenant_id` | All sales queries |
| `idx_sales_data_invoice_date` | `sales_data` | `invoice_date` | Date range filters |
| `idx_sales_data_tenant_date` | `sales_data` | `(tenant_id, invoice_date)` | **Most used** — all KPI queries with date range |
| `idx_sales_data_party_name` | `sales_data` | `party_name` | Party lookup, outstanding |
| `idx_sales_data_party_zone` | `sales_data` | `party_zone` | Zone breakdown |
| `idx_sales_data_product_name` | `sales_data` | `product_name` | Product analytics |
| `idx_sales_data_outstanding` | `sales_data` | `(tenant_id, outstanding_amount)` | `get_outstanding_parties()` |
| `idx_chat_history_tenant_id` | `chat_history` | `tenant_id` | Admin chat history |
| `idx_chat_history_user_id` | `chat_history` | `user_id` | User's own history |
| `idx_chat_history_created_at` | `chat_history` | `created_at DESC` | Latest messages first |
| `idx_chat_history_conversation_id` | `chat_history` | `conversation_id` | Messages in a conversation |
| `idx_conversations_user_id` | `conversations` | `user_id` | User's conversations |
| `idx_conversations_updated_at` | `conversations` | `updated_at DESC` | Recent first |
| `idx_audit_log_created_at` | `audit_log` | `created_at DESC` | Recent events first |

### Indexes to add (Phase 2)

| Index | Table | Columns | Reason |
|---|---|---|---|
| `idx_sales_data_route` | `sales_data` | `(tenant_id, route)` | When `get_route_performance()` is slow |
| `idx_sales_data_product_group` | `sales_data` | `(tenant_id, product_group)` | Category filtering |
| `idx_generated_reports_type_tenant` | `generated_reports` | `(tenant_id, report_type)` | Import history queries |
| `idx_context_cache_expires` | `context_cache` | `expires_at` | Scheduled cleanup of stale cache |

### What not to index yet

- `chat_history.question` — full-text search not needed; copilot doesn't search past messages
- `sales_data.invoice_number` — not queried frequently enough to justify the index write overhead
- `sales_data.raw_data` — JSONB GIN index is expensive; defer until a specific field access pattern emerges

---

## 8. Vector and Embedding Data

**Current status: Not used. Not needed.**

The AKARA copilot does NOT use embeddings, vector search, or RAG. Here is why this is correct:

1. **The data is structured SQL** — sales transactions with fixed columns (date, amount, party, product). The LLM generates SQL queries, executes them, and synthesizes the results. This is far more precise than semantic search over unstructured text.

2. **No documents corpus** — there is no user-uploaded document library, no knowledge base, no policy documents. Nothing to embed.

3. **Column schema is small** — the schema context passed to the LLM fits in ~500 tokens. No need to retrieve relevant schema chunks.

**When to revisit:** If a future feature requires semantic search over:
- Customer notes or comments
- Product descriptions from catalogues
- A knowledge base of business rules or regulations
- Historical copilot conversations for similar-question retrieval

**If needed:** pgvector (already available in Supabase) with `vector(1536)` columns is sufficient up to ~100,000 embeddings. A dedicated Pinecone/Weaviate instance is not needed at this scale.

---

## 9. File and Object Storage

### Current state

Supabase Storage is referenced in `generated_reports.storage_path` but no bucket creation, upload, or download logic is currently implemented in the application code. The morning brief email is sent directly without file storage. Report downloads on the frontend trigger `GET /reports/` which returns metadata — the download URL is in `storage_path` (currently NULL).

### File categories and storage design

#### Category 1: Generated report files (CSV exports, HTML email snapshots)

| Property | Value |
|---|---|
| File types | `.csv`, `.html`, `.pdf` (future) |
| Expected size | 5 KB – 500 KB per file |
| Maximum size | 10 MB |
| Storage bucket | `reports` (private) |
| Path convention | `{tenant_id}/{report_type}/{YYYY-MM-DD}_{uuid}.{ext}` |
| Access | Signed URLs (30-minute expiry) generated server-side |
| Retention | 90 days, then auto-delete via Supabase Storage lifecycle |
| Current status | **NOT YET IMPLEMENTED** |

#### Category 2: Uploaded data files (CSV/Excel imports)

**Current design decision: Files are NOT stored.**

The parser reads the file bytes, extracts rows, and discards the raw file. Only the parsed row data enters the database (with all original columns in `raw_data` JSONB).

**Rationale:**
- Storing raw files creates GDPR/privacy obligations for raw business data
- The parsed `raw_data` JSONB captures all original columns anyway
- Customers can re-upload if needed
- Avoids Supabase Storage costs for potentially large Excel files

**If file storage is added later:**

| Property | Value |
|---|---|
| File types | `.csv`, `.xlsx`, `.xls` |
| Expected size | 100 KB – 10 MB |
| Maximum size | 50 MB (current API limit) |
| Storage bucket | `uploads` (private, admin-only) |
| Path convention | `{tenant_id}/imports/{YYYY-MM-DD}_{import_id}.{ext}` |
| Retention | 30 days (reference copy, then delete) |
| Metadata | Row in `generated_reports` with `report_type='csv_import'` |

### Supabase Storage configuration (to implement)

```sql
-- Run in Supabase SQL Editor

-- Bucket: reports (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false);

-- RLS: Only tenant users can read their own reports
CREATE POLICY "reports_tenant_select"
  ON storage.objects FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = (
      SELECT tenant_id::TEXT FROM public.profiles WHERE id = auth.uid()
    )
  );

-- RLS: Only service_role can insert (no client upload needed)
-- Insert is done server-side via service_role key
```

---

## 10. Data Security

### Authentication

**Mechanism:** Supabase Auth issues JWTs after email/password login. FastAPI validates the JWT on every protected request.

**JWT validation flow (verified in `backend/app/core/auth.py`):**
1. Extract Bearer token from `Authorization` header
2. Decode header to get `alg` (HS256 or ES256)
3. If HS256: validate with `JWT_SECRET` from environment
4. If ES256: fetch JWKS from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` (cached 1 hour in `_JWKS_CACHE`)
5. Verify `aud = "authenticated"` claim
6. Extract `sub` (user UUID), `email`, `role` from payload
7. Return `AuthenticatedUser` or raise HTTP 401

**Key security note:** The `JWT_SECRET` must match the Supabase project's JWT secret exactly. This is set in Railway environment variables and the `.env` file.

### Tenant isolation

**Two-layer isolation:**

**Layer 1 — Row Level Security (PostgreSQL):**
- All 8 user-accessible tables have RLS enabled
- `get_my_tenant_id()` SECURITY DEFINER function returns the tenant_id for the current auth user
- Policies use `tenant_id = get_my_tenant_id()` — a user physically cannot read another tenant's rows
- RLS is enforced at the database level, not the application level

**Layer 2 — Application level (FastAPI):**
- `get_tenant_context()` dependency resolves `tenant_id` from the JWT subject
- All service calls explicitly pass `tenant_id` as a parameter
- All Supabase RPC calls include `p_tenant_id` parameter

**Cross-tenant protection:** Even if a bug in application code sent a wrong `tenant_id`, RLS would prevent the query from returning data for another tenant.

### Service role key

The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It is used by:
- `get_supabase_service_client()` — for `get_tenant_context()` (profile lookup) and all service-layer inserts
- `DataImportService` — insert into `sales_data` (admin-only operation)
- `MorningBriefService` — insert into `generated_reports`
- Edge Function — reads all tenants, inserts into `audit_log`

**Risk:** Service role key misuse could expose all tenant data. It must never be logged, exposed to the frontend, or included in error responses.

### SQL injection protection

**`execute_tenant_query()`** accepts arbitrary SQL. Protection layers:

1. **SQLGuard** (`backend/app/sql/guard.py`): Validates before execution:
   - Must start with `SELECT`
   - No `INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, `ALTER`, `TRUNCATE`, `GRANT`, `REVOKE`, `EXECUTE`, `COPY`
   - No access to `pg_catalog`, `information_schema`, `pg_toast`
   - No dangerous functions: `pg_read_file`, `pg_ls_dir`, `pg_sleep`, `lo_import`, `lo_export`, `dblink`

2. **SECURITY DEFINER on `execute_tenant_query`** with REVOKE from PUBLIC, GRANT to service_role only — client cannot call it directly
3. **LLM-generated SQL uses `:tenant_id` parameter** — prevents injection via question text

### CORS

FastAPI `CORSMiddleware` allows only origins in `ALLOWED_ORIGINS_RAW` (comma-separated env var). Production should be set to `https://app.akara.ai` only.

### Secrets management

| Secret | Used in | Source |
|---|---|---|
| `SUPABASE_URL` | Backend + Frontend | Railway env + Vercel env |
| `SUPABASE_ANON_KEY` | Frontend (safe to expose) | Vercel env + `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend only | Railway env — NEVER in frontend |
| `JWT_SECRET` | Backend auth | Railway env |
| `GEMINI_API_KEY` | Backend LLM | Railway env |
| `OPENROUTER_API_KEY` | Backend LLM | Railway env |
| `SENDGRID_API_KEY` | Backend email | Railway env |
| `BACKEND_SERVICE_KEY` | Edge Function → Backend | Railway env + Supabase secrets |
| `SENTRY_DSN` | Backend + Frontend | Railway env + Vercel env |

### Encryption

- **In transit:** All connections over HTTPS/TLS (Supabase, Railway, Vercel enforce TLS)
- **At rest:** Supabase encrypts the database at rest (AES-256 on AWS RDS)
- **Passwords:** Managed by Supabase Auth — bcrypt, never stored in plain text
- **Sensitive fields:** No PII beyond email and display name. Sales data contains business financial data, not personal health/financial data about individuals.

### Role-based access control

| Role | Capabilities |
|---|---|
| `admin` | Import data, delete data, invite users, view all chat history, manage tenant config, receive morning brief |
| `user` | View dashboard, use copilot (own chats), view reports |
| `service_role` | Full database access (bypasses RLS) — used by FastAPI service layer |
| Platform admin | Create tenants, manage all tenants — only via Supabase dashboard or bootstrap script |

---

## 11. Privacy and Retention

### Data classification

| Data | Sensitivity | PII | Notes |
|---|---|---|---|
| `tenants.name` | Low | No | Business name |
| `profiles.email` | Medium | Yes | User's business email |
| `profiles.display_name` | Low | Yes (indirect) | |
| `sales_data.*` | High | No (business data) | Business financial data — confidential but not personal |
| `chat_history.question` | Medium | Maybe | User may mention names in questions |
| `audit_log.*` | Medium | Yes (indirect) | Contains user_id and actions |
| `context_cache.*` | Low | No | Weather/news API responses |

### Retention policy (proposed — not yet enforced by code)

| Table | Retention | Enforcement |
|---|---|---|
| `tenants` | Indefinite (active) / 90 days post-offboarding | Manual |
| `profiles` | Follows `auth.users` CASCADE | Supabase Auth cascade |
| `sales_data` | Indefinite during subscription | On tenant offboarding, DELETE by tenant_id |
| `chat_history` | 12 months rolling | Scheduled Edge Function (not yet implemented) |
| `audit_log` | 90 days | Scheduled Edge Function (not yet implemented) |
| `context_cache` | 7 days (expires_at) | Scheduled cleanup needed |
| `generated_reports` metadata | 90 days | Scheduled cleanup needed |
| Supabase Storage files | 90 days | Storage lifecycle policy |

### User deletion

When an admin deletes a user:
- `auth.users` row is deleted
- `profiles` row cascades (ON DELETE CASCADE)
- `chat_history` rows cascade (ON DELETE CASCADE via user_id FK)
- `conversations` rows cascade

**Sales data is NOT deleted** when a user is deleted — it belongs to the tenant, not the user.

### Tenant offboarding

No automated offboarding implemented. Manual steps:
1. Set `tenants.is_active = false`
2. Notify admin
3. After 30-day grace period: DELETE all rows by `tenant_id` from all tables
4. Delete the `auth.users` rows for all users in that tenant
5. Purge Supabase Storage files under `{tenant_id}/`

**This must be implemented before onboarding paying customers.**

### Data export / portability

Not implemented. Future: `GET /admin/export` endpoint that generates a CSV of `sales_data` and `chat_history` for the tenant, stored in Supabase Storage with a signed URL.

---

## 12. Backup and Recovery

### Database (Supabase-managed)

| Property | Supabase Free | Supabase Pro |
|---|---|---|
| Point-in-time recovery | Not available | 7 days |
| Daily backups | Not available | Included |
| Backup frequency | — | Daily |
| Restore | — | Supabase dashboard |
| Backup retention | — | 7 days |

**Current state:** On the free tier, there are NO automated backups. This is a critical gap for production.

**Recommendation:**
1. Upgrade to Supabase Pro ($25/month) before onboarding the first paying customer
2. Pro includes daily backups with 7-day retention and PITR

**Recovery objectives (production):**
- **RPO (Recovery Point Objective):** 24 hours (daily backup)
- **RTO (Recovery Time Objective):** 4–8 hours (manual restore from Supabase dashboard)

**Manual backup option (free tier):**
Run a nightly `pg_dump` from a cron job or Railway scheduled task:
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```
Store to an S3 bucket or Cloudflare R2. This is a viable stop-gap before upgrading.

### Object storage (Supabase Storage)

- Supabase Storage does not offer independent backup
- Generated report files are re-generatable from database data
- No backup needed for storage if database is backed up

### Recovery procedure

1. Restore from Supabase dashboard: Settings → Database → Backups → Restore
2. Verify: check `sales_data` row count, `tenants` row count
3. Run smoke test: `GET /health` → 200, `GET /kpi/` with valid token → data returns
4. Notify affected customers of the data recovery date

### Disaster scenarios

| Scenario | Impact | Recovery |
|---|---|---|
| Supabase outage | Full service down | Wait for Supabase restoration (SLA 99.9% Pro) |
| Bad data import | Wrong data in `sales_data` | Import undo feature (pending) or manual DELETE |
| Accidental tenant data deletion | Data loss | Restore from Supabase daily backup |
| Railway outage | API down, DB unaffected | Redeploy from GitHub via Railway |
| Vercel outage | Frontend down, DB + API unaffected | Redeploy or use Railway to serve static files |
| LLM API outage | Copilot down, dashboard works | Failover to OpenRouter (already implemented) |

---

## 13. Data Validation

### Validation layers (from outermost to innermost)

#### Layer 1: Frontend (TypeScript)

**Location:** React Hook Form or direct state in component

**What is validated:**
- Login form: email format, password non-empty
- Data upload: file type (`.csv`, `.xlsx`, `.xls`), file size < 50 MB
- Copilot question: non-empty string, max length
- Settings form: display_name non-empty

**Current gaps:** Most frontend validation is implicit (HTML5 `required` attributes). No formal validation library (e.g. zod) is used on input forms. This is acceptable for now.

#### Layer 2: FastAPI API layer (Pydantic)

**Location:** `backend/app/api/routes/`

**What is validated:**
- Route parameters: UUID format (FastAPI auto-validates `{import_id: UUID}`)
- Query parameters: `source_type` Literal type, date format strings
- Request bodies: Pydantic models (`SyncPayload`, `CopilotRequest`, etc.)
- File uploads: content-type check + file size check in `import_data()`

**Example (verified from `data.py`):**
```python
source_type: Annotated[SourceType, Query()] = "primary"
# SourceType = Literal["primary", "secondary", "scheme"]
# FastAPI validates this automatically
```

#### Layer 3: Service layer (Python dataclasses + pandas)

**Location:** `backend/app/services/data_import/parser.py`

**What is validated:**
- Required columns present: `REQUIRED_COLUMNS = {"invoice_date", "party_name", "total_amount"}`
- Date parsing: `pd.to_datetime(..., errors="coerce")` — invalid dates become NaT, then dropped
- Numeric coercion: `pd.to_numeric(..., errors="coerce").fillna(0.0)` — invalid values become 0
- File extension: rejected if not `.csv`, `.xlsx`, `.xls`

**Failure behavior:** `ValueError` raised on missing required columns → caught in `import_file()` → returned as `ImportResult(errors=[...])` (not a 500 error)

#### Layer 4: Database constraints

**What is enforced:**
- `NOT NULL` on required fields
- `CHECK (role IN ('admin', 'user'))` on `profiles.role`
- `CHECK (context_type IN ('weather', 'news', 'holiday'))` on `context_cache.context_type`
- `UNIQUE (tenant_id, context_type, context_date)` — prevents duplicate cache entries
- `UNIQUE (slug)` on `tenants`
- Foreign key constraints — cannot insert child rows with invalid parent IDs
- `DEFAULT NOW()` on timestamps

#### Layer 5: SQL Guard (copilot-specific)

**Location:** `backend/app/sql/guard.py`

Validates LLM-generated SQL before execution. See Section 10 (Data Security) for details.

### Source of truth for validation

**Pydantic models** in `backend/app/services/` define the canonical schema. The database schema is the enforcement layer. The two must stay in sync — currently done manually via migrations.

**Gap:** No schema diffing or migration validation tooling. Manual discipline required when adding columns.

---

## 14. Data Access Layer

### How backend code interacts with Supabase

**Pattern:** Direct Supabase Python client. No ORM. No custom repository pattern.

```python
# Supabase client initialization (verified from tenant.py)
def get_supabase_service_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
```

**Two client types:**
1. `service_role` client — bypasses RLS, used for all service-layer operations
2. `anon` client — defined but not used in practice (RLS is bypassed server-side)

**Where queries live:**
- KPI queries: `backend/app/services/kpi/service.py` — calls Supabase RPCs
- Data import: `backend/app/services/data_import/service.py` — batch inserts
- Copilot SQL: `backend/app/sql/executor.py` — via `execute_tenant_query` RPC
- Insights: `backend/app/services/insights/engine.py` — direct table queries
- Simulator: `backend/app/services/simulator/projector.py` — direct table query

**Tenant enforcement in queries:**
- All service methods receive `tenant_id: UUID` parameter explicitly
- All queries filter by `tenant_id` in the application code
- RLS provides a second enforcement layer at the database

### Transaction handling

**Current state:** No explicit transactions. Each batch insert in `DataImportService` is a separate Supabase call. This means partial imports are possible if a batch fails.

**Mitigation (pending):** The `import_id` tracking feature (see `docs2/data_plan.md`) will allow identifying and deleting partially imported batches.

**For future atomic operations:** Use Supabase's PostgreSQL functions (SECURITY DEFINER) that wrap multi-table operations in a single DB-level transaction.

### Pagination

**Copilot SQL results:** Capped at 2,000 rows in `SQLExecutor._MAX_ROWS`.

**KPI endpoints:** No pagination (all KPI results are aggregated — typically <100 rows).

**Chat history / conversations:** The frontend uses React Query with infinite scroll; the backend routes support `limit` and `offset` parameters.

**Reports list:** `limit(50)` hardcoded.

### Error normalization

FastAPI exception handlers return consistent JSON:
```json
{
  "detail": "Only SELECT statements are permitted. Got: 'DELETE..'"
}
```

Service-level errors are caught and returned as `ImportResult.errors: list[str]` rather than raising HTTP 500.

### Connection pooling

**Current state:** Supabase Python client creates a new HTTP connection per request (uses httpx internally). This is fine for Railway's single-instance deployment.

**At 50+ concurrent users:** Supabase uses PgBouncer by default (connection pooling at the DB level). No application-level connection pool needed.

### Retry behavior

- LLM calls: Not retried at FastAPI level (client should retry on timeout)
- SendGrid calls: 3 retries with exponential backoff (verified in `morning_brief.py`)
- Data import: No retry — failures are logged in `ImportResult.errors`

### Testing data access

Tests use FastAPI's `TestClient` for endpoint tests. No DB mocking — tests that require DB access use real Supabase credentials from environment.

**Gaps:**
- `test_config.py` tests settings loading (requires env vars)
- `test_health_endpoint.py` tests auth middleware (requires app startup)
- No tests for actual DB operations (would require test DB or mock)

---

## 15. API Data Contracts

All routes verified from `backend/app/main.py` and route files. Authentication is Bearer JWT for all routes except `/health`, `/privacy`, `/terms`.

### `GET /health`

**Auth:** None  
**Response:**
```json
{
  "status": "ok",
  "environment": "production",
  "timestamp": "2026-07-22T18:30:00Z"
}
```

---

### `GET /auth/me`

**Auth:** Bearer JWT  
**Response:**
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "tenant_id": "uuid",
  "role": "admin",
  "display_name": "Alice"
}
```

---

### `POST /auth/invite` (admin only)

**Auth:** Bearer JWT + admin role  
**Request body:**
```json
{
  "email": "newuser@example.com",
  "role": "user",
  "display_name": "Bob"
}
```

---

### `GET /kpi/?start_date=2026-07-01&end_date=2026-07-22`

**Auth:** Bearer JWT  
**Response:**
```json
{
  "summary": {
    "total_revenue": "485230.00",
    "total_orders": 1234,
    "unique_parties": 89,
    "avg_order_value": "393.22",
    "total_quantity": "4523.000",
    "total_discount": "12450.00"
  },
  "top_products": [
    {"product_name": "Famous Cold Coffee", "total_revenue": "45230.00", "quantity": "342.000", "order_count": 342}
  ],
  "zone_breakdown": [
    {"zone": "HYDERABAD", "revenue": "350000.00", "order_count": 890, "revenue_pct": 72.1}
  ],
  "revenue_trend": [
    {"invoice_date": "2026-07-01", "revenue": "22000.00", "orders": 56}
  ],
  "route_performance": [
    {"route": "Swiggy Online Order", "revenue": "120000.00", "order_count": 280, "unique_parties": 1, "avg_order_value": "428.57"}
  ],
  "outstanding_parties": [
    {"party_name": "ABC Stores", "party_zone": "NORTH", "outstanding_amount": "45000.00", "invoice_count": 12}
  ],
  "date_range_start": "2026-07-01",
  "date_range_end": "2026-07-22"
}
```

---

### `POST /copilot/chat`

**Auth:** Bearer JWT  
**Request body:**
```json
{
  "question": "What are my top 5 products this week?",
  "conversation_id": "uuid-optional"
}
```

**Response (SSE streaming):**
```
data: {"type": "token", "content": "Your "}
data: {"type": "token", "content": "top 5 "}
...
data: {"type": "done", "metadata": {"intent": "top_products", "response_time_ms": 2340}}
```

---

### `GET /conversations/`

**Auth:** Bearer JWT  
**Response:**
```json
[
  {
    "id": "uuid",
    "title": "Revenue Analysis Week 1",
    "created_at": "2026-07-15T09:00:00Z",
    "updated_at": "2026-07-15T09:45:00Z",
    "message_count": 8
  }
]
```

---

### `POST /data/sheets` (admin only)

**Auth:** Bearer JWT + admin role  
**Request:** multipart/form-data with `file`  
**Response:**
```json
{
  "sheets": [
    {
      "sheet_name": "Discount Report Item Wise",
      "score": 101,
      "row_count": 562,
      "detected_header_row": 2,
      "detected_columns": ["DATE", "LOCATION NAME", "BILL NO", "PRODUCT NAME", "QTY", "BASIC AMT"],
      "reason": "sheet name contains 'discount'; col score=76"
    }
  ],
  "recommended": "Discount Report Item Wise"
}
```

---

### `POST /data/import?source_type=primary&sheet_name=Discount+Report+Item+Wise` (admin only)

**Auth:** Bearer JWT + admin role  
**Request:** multipart/form-data with `file`  
**Response (201):**
```json
{
  "rows_inserted": 487,
  "rows_skipped": 3,
  "errors": [],
  "warnings": ["Row 45: invalid numeric value in total_amount"],
  "import_id": null
}
```

---

### `GET /reports/`

**Auth:** Bearer JWT  
**Response:**
```json
[
  {
    "id": "uuid",
    "report_type": "morning_brief",
    "title": "Daily Brief - 22 Jul 2026",
    "storage_path": null,
    "file_size_bytes": null,
    "metadata": {"insights_count": 3},
    "created_at": "2026-07-22T07:00:00Z"
  }
]
```

---

### `GET /simulator/baseline`

**Auth:** Bearer JWT  
**Response:**
```json
{
  "total_revenue_30d": 485230.0,
  "total_orders_30d": 1234,
  "daily_avg_revenue": 16174.33,
  "daily_stddev_revenue": 3240.12,
  "data_days": 30
}
```

---

### `POST /simulator/project`

**Auth:** Bearer JWT  
**Request body:**
```json
{
  "growth_rate_pct": 10.0,
  "discount_change_pct": 5.0
}
```

**Response:**
```json
{
  "baseline_revenue": 485230.0,
  "projected_revenue": 534095.8,
  "projected_orders": 1357,
  "confidence_interval_lower": 441230.0,
  "confidence_interval_upper": 626961.6,
  "revenue_delta": 48865.8,
  "revenue_delta_pct": 10.07,
  "growth_rate_pct": 10.0,
  "discount_change_pct": 5.0,
  "data_days": 30
}
```

---

### `GET /admin/logs/` (admin only)

**Auth:** Bearer JWT + admin role  
**Response:** Paginated list of `audit_log` rows

---

### `GET /admin/tenants/` (admin only)

**Auth:** Bearer JWT + admin role  
**Response:** Tenant details for the admin's tenant (and all tenants for platform admin)

---

## 16. Caching Strategy

### Current caching

| What | Where | Duration | Mechanism |
|---|---|---|---|
| Supabase JWKS keys | Process memory (`_JWKS_CACHE` dict) | 1 hour | Manual TTL check |
| Context cache (weather/news) | `context_cache` table | Until `expires_at` | DB row with TTL |

### Recommendation: No additional caching needed now

**KPI queries** are fast (< 500ms) because:
- They use indexed columns (`tenant_id`, `invoice_date`)
- `get_kpi_summary()` is a single RPC returning a pre-aggregated JSONB
- Dataset is small (< 50,000 rows per tenant)

**When to add caching:**
- If KPI query latency P95 > 2 seconds at 10+ tenants
- Proposed approach: in-process dict cache with 5-minute TTL per `(tenant_id, start_date, end_date)` key

**What NOT to add:**
- Redis: overkill for single-instance Railway deployment; adds $15+/month operational cost
- Memcached: same reasoning
- HTTP response caching (CDN): inappropriate for authenticated, tenant-specific API responses

---

## 17. Background Processing

### Current background jobs

#### Job 1: Daily Morning Brief

| Property | Value |
|---|---|
| Trigger | Cron: `0 1 * * *` (7:00 AM IST / 1:30 UTC) |
| Where | Supabase Edge Function: `daily-morning-brief` |
| Input | All active tenants + opted-in admin users |
| Output | Email via SendGrid + `audit_log` entry |
| Status tracking | `audit_log` row with `action = 'morning_brief_run'` |
| Retry behavior | SendGrid client retries 3× with exponential backoff |
| Failure handling | Failures logged to `audit_log` and Edge Function console |
| Timeout | 30s per backend API call, AbortSignal |
| Rate limit | MAX_EMAILS_PER_RUN = 90 (SendGrid free tier: 100/day) |

**Gap:** No alert when the Edge Function fails silently. Add Sentry monitoring for the Edge Function or a heartbeat check.

#### Job 2: Tally Agent (akara_agent.py — planned)

| Property | Value |
|---|---|
| Trigger | Nightly cron on customer's Tally machine (Windows Task Scheduler) |
| Where | Customer's local machine |
| Input | Tally data via COM API |
| Output | `POST /data/sync` with rows |
| Status tracking | HTTP response from API |
| Failure handling | Log to local file |

**Current status:** Documented as planned in `docs/` but not yet implemented.

### Jobs that need to be implemented

#### Job 3: Context cache cleanup

| Property | Value |
|---|---|
| Trigger | Daily cron (Supabase Edge Function or Railway scheduled task) |
| Purpose | Delete `context_cache` rows where `expires_at < NOW()` |
| Query | `DELETE FROM context_cache WHERE expires_at < NOW()` |
| Failure handling | Log and retry next day |

#### Job 4: Audit log rotation

| Property | Value |
|---|---|
| Trigger | Monthly cron |
| Purpose | Delete `audit_log` rows older than 90 days |
| Query | `DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days'` |
| Failure handling | Log and retry |

#### Job 5: Chat history rotation (future)

| Property | Value |
|---|---|
| Trigger | Monthly cron |
| Purpose | Delete `chat_history` rows older than 12 months |
| Query | `DELETE FROM chat_history WHERE created_at < NOW() - INTERVAL '12 months'` |

### Job infrastructure recommendation

Use **Supabase Edge Functions with pg_cron** for all cleanup jobs. No separate job queue (no Celery, no Bull, no Redis). Edge Functions run in Deno without cold starts and are free up to 500K invocations/month.

For the Tally agent: Python script on Windows cron — no queue needed since it runs once nightly.

---

## 18. Logging and Observability

### What is logged

**Application logs (structlog → stdout → Railway logs):**
- Request/response (FastAPI access log via uvicorn)
- SQL execution: `"Executing SQL for tenant %s: %.100s"` (info)
- SQL guard violations: warning + details
- LLM model used, tokens, latency
- Failed batch inserts: error with batch index
- Morning brief send results: info per recipient
- Guardrail failures: warning per check name

**Structured log fields:**
- `tenant_id` (in service-level logs)
- `user_id` (where available)
- `environment` (from Settings)

**Audit log (database):**
- `morning_brief_run` — daily email job results
- (Proposed) `data_import`, `data_undo`, `user_invite`

**Sentry (error tracking):**
- All unhandled exceptions (FastAPI + React)
- `sentry_sdk.capture_exception()` in `morning_brief.py` on SendGrid failure
- Traces sample rate: 10% (configured in `main.py`)

### What must NEVER be logged

- JWT tokens
- `SUPABASE_SERVICE_ROLE_KEY`
- `SENDGRID_API_KEY`
- User passwords (obvious — but worth stating)
- Customer PII in query results (e.g. phone numbers from `raw_data`)
- Full SQL results (results may contain sensitive business data)

### Log retention

- Railway: 30 days on paid plan, 1 day on free plan
- Sentry: 90 days on free tier
- `audit_log` table: 90 days (proposed rotation job)

### Metrics to monitor

| Metric | Tool | Alert threshold |
|---|---|---|
| API uptime | UptimeRobot (free) | < 99% in 24h |
| API response time P95 | UptimeRobot / Sentry | > 3s |
| Copilot error rate | Sentry | > 5% of requests |
| Morning brief success rate | `audit_log` query | < 80% success |
| Database size | Supabase dashboard | > 400 MB (free tier warning) |
| LLM API errors | Sentry | > 3 in 1 hour |

### Correlation IDs

**Gap:** No request correlation ID is currently threaded through logs. Every log entry from a single request has no common identifier.

**Proposed fix (Phase 2):**
Add FastAPI middleware to generate a `request_id` UUID per request and include it in:
- `X-Request-ID` response header
- All structured log entries
- Error responses

---

## 19. Cost Analysis

### Monthly infrastructure cost (current pricing, Jul 2026)

#### Development / pre-launch

| Service | Plan | Monthly cost |
|---|---|---|
| Supabase | Free | $0 |
| Railway (backend) | Hobby $5 credit | ~$3–5 |
| Vercel (frontend) | Free | $0 |
| SendGrid | Free (100 emails/day) | $0 |
| Sentry | Free (5K errors/month) | $0 |
| UptimeRobot | Free | $0 |
| Gemini API | Free (15 req/min quota) | $0 |
| **Total** | | **~$3–5/month** |

#### 3 initial customers (paying)

| Service | Plan | Monthly cost | Notes |
|---|---|---|---|
| Supabase | **Pro** ($25/mo) | $25 | Daily backups required for production |
| Railway (backend) | Hobby | $5–15 | Based on usage |
| Vercel (frontend) | Free | $0 | |
| SendGrid | Free | $0 | ~90 emails/day (30 tenants × 3 users) |
| Sentry | Free | $0 | |
| UptimeRobot | Free | $0 | |
| Gemini API | Usage | ~$0.50 | ~3M tokens/month |
| **Total** | | **~$30–40/month** | |

#### 10 customers

| Service | Plan | Monthly cost | Notes |
|---|---|---|---|
| Supabase | Pro | $25 + $0.125/GB over 8 GB | ~$25–35 |
| Railway | Team | $20–40 | May need more resources |
| Vercel | Pro (if needed) | $20 | Only if team features needed |
| SendGrid | Free | $0 | <100 emails/day |
| Sentry | Free | $0 | |
| Gemini API | Usage | ~$1.50 | ~10M tokens/month |
| **Total** | | **~$65–100/month** | |

#### 50 customers

| Service | Plan | Monthly cost | Notes |
|---|---|---|---|
| Supabase | Pro + compute | $25 + extras | ~$50–80 |
| Railway | Team/Pro | $40–80 | May need autoscaling |
| Vercel | Pro | $20 | |
| SendGrid | Essentials ($20/mo) | $20 | 400+ emails/day exceeds free tier |
| Sentry | Team ($26/mo) | $26 | |
| Gemini API | Usage | ~$8 | |
| **Total** | | **~$165–215/month** | |

### Cost risks

1. **Supabase egress:** Free tier includes 2 GB egress/month. Pro includes 50 GB. Copilot returning large SQL results could hit this.
2. **Railway compute:** Long-running copilot requests (SSE streaming) hold connections open; might need a larger instance.
3. **SendGrid:** 100 emails/day free tier is tight at 10 active tenants with 10 admin users.

### Cost controls

- Copilot SQL results capped at 2,000 rows (`_MAX_ROWS = 2000` in executor.py)
- LLM traces sample rate at 10% to reduce Sentry quota usage
- Morning brief email rate limited to 90/run to stay under SendGrid free tier

---

## 20. Scaling Plan

### Current capacity (single Railway instance + Supabase free)

- **Concurrent users:** Up to ~20 (limited by Railway's memory, not DB)
- **Tenants:** Up to ~8 (limited by Supabase free tier 500 MB DB)
- **Sales data rows:** Up to ~1.2M total across all tenants before DB size is an issue

### Scaling thresholds

| Component | Metric | Current limit | When to scale | Next step |
|---|---|---|---|---|
| Database size | MB | 500 MB free | At 400 MB | Upgrade to Supabase Pro ($25/mo) |
| DB connections | Count | 60 (free tier) | At 50 concurrent | Supabase Pro (200 connections + PgBouncer) |
| API memory | MB | Railway Hobby ~512 MB | If OOM errors occur | Upgrade Railway plan |
| API latency | P95 ms | Target < 2s | P95 > 3s consistently | Add result caching, optimize RPCs |
| LLM cost | $/month | Negligible | At $20/month | Review query complexity, add caching |
| Email volume | Emails/day | 100 free | At 80 emails/day | Upgrade SendGrid to Essentials ($20/mo) |
| Sentry errors | Events/month | 5K free | At 4K/month | Upgrade Sentry ($26/mo) |

### What should not change until forced

- Database engine (PostgreSQL via Supabase — no need for another engine)
- Application architecture (monolith FastAPI — no microservices needed)
- Deployment platform (Railway — no Kubernetes until 100+ instances needed)
- LLM approach (real-time SQL + synthesis — no pre-computed embeddings needed)

### What to optimize first (before spending money)

1. Add a `LIMIT 5000` to copilot queries that currently have no limit
2. Materialize `get_kpi_summary` as a daily snapshot if KPI queries slow down
3. Add `(tenant_id, product_group, invoice_date)` composite index if product category analytics are slow

---

## 21. Migration and Rollout Plan

### Schema creation order (must follow this sequence)

```
001_initial_schema.sql       — tenants, profiles, sales_data, context_cache,
                               chat_history, audit_log, generated_reports
002_rls_policies.sql         — RLS policies + helper functions (get_my_tenant_id, is_admin)
003_functions.sql            — DB functions (get_kpi_summary, etc.) + handle_new_user trigger
004_competitive_additions.sql — outstanding_amount, secondary_sales_data, scheme_master,
                               route/outstanding/scheme functions + their RLS
005_execute_tenant_query.sql — dynamic SQL RPC for copilot (must be after 004)
006_update_tenant_config_rpc.sql — tenant config update RPC
007_conversations.sql        — conversations table, conversation_id on chat_history
008_user_preferences.sql     — preferences JSONB on profiles
009_scheme_leakage_fn.sql    — get_scheme_leakage() function
```

**Pending migrations (not yet created):**
```
010_import_tracking.sql      — import_id UUID on sales_data, secondary_sales_data, scheme_master
011_storage_buckets.sql      — Storage bucket creation + RLS policies
012_cleanup_jobs.sql         — pg_cron jobs for context_cache and audit_log rotation
```

### Environment setup

```
1. Create Supabase project
2. Run migrations 001–009 in SQL Editor
3. Set Supabase Auth: enable email/password login, disable self-signup
4. Set JWT settings (note JWT secret)
5. Create Railway project, set environment variables
6. Deploy FastAPI to Railway via GitHub
7. Create Vercel project, set environment variables
8. Deploy React frontend via GitHub
9. Configure Supabase Edge Function: deploy daily-morning-brief
10. Set Edge Function secrets: BACKEND_API_URL, BACKEND_SERVICE_KEY
11. Run bootstrap_admin.py to create first tenant + admin user
```

### Rollback plan

| Step | Rollback |
|---|---|
| Failed migration | Supabase SQL Editor → run `DROP TABLE IF EXISTS ...` for the failed table |
| Bad data import | Delete rows by `import_id` (pending) or by `created_at` range |
| Railway deploy failure | Railway → Deployments → Rollback to previous |
| Vercel deploy failure | Vercel → Deployments → Rollback to previous |
| Broken migration applied | Restore from Supabase backup (requires Pro) |

---

## 22. Testing Strategy

### Current test coverage (verified from `backend/tests/`)

| File | Tests | Status |
|---|---|---|
| `test_sql_guard.py` | 7 SQL guard rules | ✅ Implemented |
| `test_guardrails.py` | 5 guardrail checks | ✅ Implemented |
| `test_data_parser.py` | 4 parser tests | ✅ Implemented |
| `test_config.py` | 3 settings tests | ✅ Implemented |
| `test_health_endpoint.py` | 6 endpoint tests | ✅ Implemented |
| `test_planner.py` | 1 async planner test | ✅ Implemented |
| `test_data_import_service.py` | (exists) | Verify content |
| `test_health.py` | (exists) | Verify content |

### Tests to add (prioritized)

#### Priority 1: Data isolation (critical for multi-tenant security)

```python
def test_sales_data_tenant_isolation():
    """Tenant A cannot read Tenant B's sales_data even with valid JWT."""
    # Create two tenants, import data for each
    # Verify tenant A's JWT returns only tenant A's data
```

#### Priority 2: Import pipeline

```python
def test_import_petpooja_excel():
    """Petpooja 49-sheet Excel correctly selects Discount Report Item Wise."""

def test_import_tally_csv():
    """Tally Sales Register CSV maps Voucher No, Particulars, Amount correctly."""

def test_import_missing_required_column():
    """Upload without invoice_date returns clear error, 0 rows inserted."""

def test_import_metadata_rows_stripped():
    """File with 5 metadata rows at top still parses correctly."""
```

#### Priority 3: Authorization

```python
def test_non_admin_cannot_import():
    """User with role='user' gets 403 on POST /data/import."""

def test_non_admin_cannot_invite():
    """User with role='user' gets 403 on POST /auth/invite."""
```

#### Priority 4: KPI correctness

```python
def test_kpi_summary_matches_raw_aggregation():
    """get_kpi_summary() total_revenue matches SUM(total_amount) from raw query."""
```

#### Priority 5: Copilot safety

```python
def test_copilot_cannot_delete():
    """Copilot question 'delete all my data' raises SQLGuardError."""

def test_copilot_cannot_access_other_tenant():
    """Generated SQL cannot reference another tenant's data."""
```

### Test infrastructure

- `pytest` + `pytest-asyncio` (already configured)
- `TestClient` from `fastapi.testclient` for endpoint tests
- Real Supabase credentials from env for integration tests
- Fixture tenant/user created per test session, cleaned up after

### Test environment variables (CI, from `.github/workflows/ci.yml`)

```yaml
SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
JWT_SECRET: ${{ secrets.JWT_SECRET }}
GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
ENVIRONMENT: ci
```

---

## 23. Implementation Phases

### Phase 1: Minimum Production Data Layer (Ready for first 3 customers)

**Objective:** Everything required to safely onboard paying customers.

**Tasks:**
1. ✅ Run migrations 001–009
2. ✅ RLS on all tables
3. ✅ Data import pipeline (parser + service)
4. ✅ KPI queries via RPCs
5. ✅ Copilot with SQL guard
6. ✅ Morning brief Edge Function
7. ⬜ **Upgrade Supabase to Pro** (daily backups — critical before first payment)
8. ⬜ **Add `import_id` tracking** (migration 010 + service changes from `data_plan.md`)
9. ⬜ **Tenant offboarding script** (DELETE all rows by tenant_id)
10. ⬜ **Wire Supabase Storage** for generated reports

**Exit criteria:** First tenant can upload data, view dashboard, use copilot, receive morning brief. Their data is backed up daily. Bad imports can be undone.

---

### Phase 2: Reliability and Operational Controls

**Objective:** Monitoring, cleanup, stronger failure handling.

**Tasks:**
1. ⬜ Add request correlation IDs to logs
2. ⬜ Implement context_cache cleanup Edge Function
3. ⬜ Implement audit_log rotation Edge Function
4. ⬜ Add import history UI (`ImportHistoryPanel` + `useImportHistory` hook)
5. ⬜ Add `DELETE /data/imports/{import_id}` endpoint
6. ⬜ Set up UptimeRobot monitoring for `/health`
7. ⬜ Test backup restore from Supabase
8. ⬜ Add `ip_address` capture to audit_log
9. ⬜ Add rate limiting to `POST /copilot/chat` (prevent runaway LLM costs)

**Exit criteria:** All background jobs run reliably. Import history visible to admins. Alerts fire on downtime. Backups verified.

---

### Phase 3: Scaling Improvements (When metrics demand it)

**Objective:** Performance and cost optimization based on real usage.

**Tasks (only implement when triggered by metrics):**
1. Add composite index `(tenant_id, product_group, invoice_date)` if product analytics are slow
2. Add in-process KPI result caching if P95 > 2s
3. Upgrade Railway to horizontal scaling if single instance OOM
4. Add `request_id` correlation to Sentry for distributed tracing
5. Implement `pg_cron` for scheduled cleanups (replace Edge Functions if needed)
6. Add materialized view for `get_kpi_summary` if it becomes the bottleneck

**Exit criteria:** KPI P95 < 500ms. Copilot P95 < 5s. DB size growing linearly, cost controlled.

---

## 24. File-Level Implementation Map

### Currently implemented (verified)

| File | Status | Tables / Services |
|---|---|---|
| `migrations/001_initial_schema.sql` | ✅ Complete | tenants, profiles, sales_data, context_cache, chat_history, audit_log, generated_reports |
| `migrations/002_rls_policies.sql` | ✅ Complete | RLS on all tables |
| `migrations/003_functions.sql` | ✅ Complete | KPI RPCs, handle_new_user trigger |
| `migrations/004_competitive_additions.sql` | ✅ Complete | outstanding, secondary_sales_data, scheme_master |
| `migrations/005_execute_tenant_query.sql` | ✅ Complete | Dynamic SQL for copilot |
| `migrations/006_update_tenant_config_rpc.sql` | ✅ Complete | Tenant config update |
| `migrations/007_conversations.sql` | ✅ Complete | conversations, chat_history.conversation_id |
| `migrations/008_user_preferences.sql` | ✅ Complete | profiles.preferences |
| `migrations/009_scheme_leakage_fn.sql` | ✅ Complete | get_scheme_leakage() |
| `backend/app/core/config.py` | ✅ Complete | Settings (pydantic-settings) |
| `backend/app/core/auth.py` | ✅ Complete | JWT validation, JWKS cache |
| `backend/app/core/tenant.py` | ✅ Complete | TenantContext, Supabase clients |
| `backend/app/sql/guard.py` | ✅ Complete | SQL validation |
| `backend/app/sql/executor.py` | ✅ Complete | execute_tenant_query wrapper |
| `backend/app/services/data_import/detector.py` | ✅ Complete | Sheet scoring, header detection |
| `backend/app/services/data_import/parser.py` | ✅ Complete | Column aliases, parsing |
| `backend/app/services/data_import/service.py` | ✅ Complete | Batch insert, enrichment |
| `backend/app/services/kpi/service.py` | ✅ Complete | KPI queries |
| `backend/app/services/insights/engine.py` | ✅ Complete | Morning brief insights |
| `backend/app/services/email/morning_brief.py` | ✅ Complete | SendGrid + Jinja2 |
| `backend/app/services/simulator/projector.py` | ✅ Complete | Revenue projection |
| `backend/app/services/copilot/agent.py` | ✅ Complete | Plan-Execute-Synthesize |
| `supabase/functions/daily-morning-brief/index.ts` | ✅ Complete | Daily email Edge Function |

### Pending implementation

#### File: `akara/migrations/010_import_tracking.sql`

**Status:** Create

**Purpose:** Add `import_id UUID` to the three data tables so uploads can be identified and undone.

**Planned changes:**
```sql
ALTER TABLE public.sales_data ADD COLUMN IF NOT EXISTS import_id UUID;
ALTER TABLE public.secondary_sales_data ADD COLUMN IF NOT EXISTS import_id UUID;
ALTER TABLE public.scheme_master ADD COLUMN IF NOT EXISTS import_id UUID;

CREATE INDEX IF NOT EXISTS idx_sales_data_import_id
    ON public.sales_data (tenant_id, import_id) WHERE import_id IS NOT NULL;
-- (same for other two tables)
```

**Dependencies:** Migration 009 must be applied first.  
**Verification:** `SELECT column_name FROM information_schema.columns WHERE table_name = 'sales_data' AND column_name = 'import_id';`

---

#### File: `akara/backend/app/services/data_import/models.py`

**Status:** Modify

**Planned change:** Add `import_id: str | None = None` to `ImportResult`.

**Verification:** `python -c "from app.services.data_import.models import ImportResult; print(ImportResult.model_fields)"`

---

#### File: `akara/backend/app/services/data_import/service.py`

**Status:** Modify

**Planned changes:**
- Generate `import_id = uuid.uuid4()` per upload
- Tag every inserted row: `record["import_id"] = str(import_id)`
- Log import to `generated_reports` after all batches

---

#### File: `akara/backend/app/api/routes/data.py`

**Status:** Modify

**Planned changes:**
- `GET /data/imports/history` — list import history from `generated_reports`
- `DELETE /data/imports/{import_id}` — undo an upload

---

#### File: `akara/frontend/src/hooks/useImportHistory.ts`

**Status:** Create

**Planned changes:** `useImportHistory()` and `useUndoImport()` React Query hooks.

---

#### File: `akara/frontend/src/pages/DataPage.tsx`

**Status:** Modify

**Planned changes:**
- Sheet picker dropdown (shown when `POST /data/sheets` returns >1 sheet)
- `ImportHistoryPanel` component with undo button

---

#### File: `akara/supabase/functions/context-cache-cleanup/index.ts`

**Status:** Create

**Planned changes:** Delete `context_cache` rows where `expires_at < NOW()`.

**Schedule:** `0 2 * * *` (daily at 2:00 UTC)

---

#### File: `akara/supabase/functions/audit-log-rotation/index.ts`

**Status:** Create

**Planned changes:** Delete `audit_log` rows older than 90 days.

**Schedule:** `0 3 1 * *` (monthly at 3:00 UTC on 1st)

---

## 25. Risks and Trade-Offs

### Risk 1: No daily backups on Supabase free tier

| Property | Value |
|---|---|
| Likelihood | Certain (it's a limitation, not a risk) |
| Impact | High — data loss from any accidental deletion is permanent |
| Mitigation | Upgrade to Supabase Pro before first paying customer |
| Trigger to act | Immediately |

---

### Risk 2: Partial imports with no undo

| Property | Value |
|---|---|
| Likelihood | Medium — batch failure leaves partial data in `sales_data` |
| Impact | Medium — incorrect KPIs until data is manually fixed |
| Mitigation | Implement `import_id` tracking + `DELETE /data/imports/{id}` (from `data_plan.md`) |
| Trigger to act | Before onboarding customer 2 |

---

### Risk 3: `execute_tenant_query` is powerful

| Property | Value |
|---|---|
| Likelihood | Low — SQL guard is thorough |
| Impact | High — if bypassed, could read any table accessible to service_role |
| Mitigation | SQL guard blocks non-SELECT and dangerous schemas. Grant is restricted to service_role only. LLM prompts explicitly constrain table scope. |
| Trigger | Review if new schemas or tables are added |

---

### Risk 4: Context cache never cleaned up

| Property | Value |
|---|---|
| Likelihood | High — no cleanup job exists |
| Impact | Low — rows accumulate slowly (~30–90/month), don't affect query performance |
| Mitigation | Implement cleanup Edge Function in Phase 2 |
| Trigger | When `context_cache` exceeds 10,000 rows |

---

### Risk 5: Service role key exposure

| Property | Value |
|---|---|
| Likelihood | Low if environment variables are properly managed |
| Impact | Critical — bypasses all RLS, exposes all tenant data |
| Mitigation | Never log or return in responses. Railway uses encrypted env vars. Rotate quarterly. |
| Trigger | Any Railway breach or employee offboarding |

---

### Risk 6: Supabase free tier limits hit unexpectedly

| Property | Value |
|---|---|
| Likelihood | Medium at 6+ months with 3+ active tenants |
| Impact | Medium — service degradation or paused project |
| Mitigation | Monitor DB size weekly via Supabase dashboard. Set alert at 400 MB. |
| Trigger | DB size > 400 MB OR connection count > 50 |

---

### Risk 7: Single-vendor dependency on Supabase

| Property | Value |
|---|---|
| Likelihood | Low (Supabase is stable, well-funded) |
| Impact | High — entire data layer depends on Supabase |
| Mitigation | PostgreSQL is standard SQL — migration to Neon, RDS, or raw PG is feasible if needed. Auth would require work to replace. |
| Trigger | Supabase pricing changes materially or SLA failures |

---

## 26. Decisions

### Decision 1: Use Supabase for everything (DB + Auth + Storage + Edge Functions)

**Chosen approach:** Supabase as the primary managed platform.  
**Alternatives considered:** Separate PostgreSQL (Neon/RDS) + Auth0 + S3 + AWS Lambda  
**Why chosen:** Single platform, single billing, built-in RLS, Edge Functions replace job queue, Auth handles JWT issuance.  
**Trade-offs accepted:** Single-vendor dependency; Supabase free tier limits.  
**Condition to change:** Supabase pricing > $200/month or SLA failures.

---

### Decision 2: BIGSERIAL (not UUID) for sales_data primary key

**Chosen approach:** `id BIGSERIAL` on `sales_data`, `secondary_sales_data`, `scheme_master`.  
**Alternatives considered:** UUID primary key.  
**Why chosen:** Bulk imports of 500+ rows in a single batch benefit from sequential integer PK performance. UUID4 is random — poor B-tree insert performance for high-volume inserts.  
**Trade-offs accepted:** Cannot predict or expose the ID externally (not a problem — IDs are internal).  
**Condition to change:** If distributed multi-region writes are needed (not relevant at current scale).

---

### Decision 3: No dedicated vector database

**Chosen approach:** No pgvector, no Pinecone, no Weaviate.  
**Alternatives considered:** pgvector for historical chat context retrieval; Pinecone for product catalog search.  
**Why chosen:** AKARA's copilot works on structured SQL data, not unstructured text corpora. SQL queries are more precise and auditable than semantic search for financial analytics.  
**Condition to change:** When a document library feature is added (manuals, SOPs, product catalogues).

---

### Decision 4: Files are NOT stored after import

**Chosen approach:** Parse file → insert rows → discard bytes. No file storage.  
**Alternatives considered:** Store files in Supabase Storage for audit/re-processing.  
**Why chosen:** Avoids privacy obligations for raw business data. `raw_data` JSONB captures all original columns anyway.  
**Condition to change:** When customers request file download or audit trail of original uploads.

---

### Decision 5: Row-level batching instead of full transaction on import

**Chosen approach:** 500 rows per Supabase batch call. Batches are independent.  
**Alternatives considered:** Server-side PostgreSQL function wrapping entire import in a transaction.  
**Why chosen:** Simpler to implement and debug. Supabase Python client doesn't natively support explicit transactions across multiple calls.  
**Trade-offs accepted:** Partial imports possible on batch failure.  
**Mitigation:** `import_id` tracking allows undo of all rows from an upload.

---

### Decision 6: Dynamic SQL via `execute_tenant_query()` rather than pre-defined queries

**Chosen approach:** LLM generates SQL → SQLGuard validates → `execute_tenant_query()` runs it.  
**Alternatives considered:** Pre-defined SQL templates with LLM selecting and filling placeholders.  
**Why chosen:** More flexible for ad-hoc questions. Customers ask varied, specific questions that don't fit templates.  
**Trade-offs accepted:** Requires robust SQL guard. LLM-generated SQL can be inefficient.  
**Mitigation:** SQLGuard blocks dangerous statements. 2,000-row cap prevents runaway result sets.

---

## 27. Explicit Non-Goals

The following infrastructure should NOT be introduced unless there is verified evidence of a specific, unmet requirement:

| What NOT to add | Why |
|---|---|
| Kubernetes / ECS | Railway single instance handles 50+ tenants. No need for orchestration. |
| Redis / Memcached | No session state, no job queue, no high-frequency cache invalidation required. |
| Kafka / RabbitMQ | No event stream consumers. Morning brief Edge Function is sufficient. |
| Dedicated vector database (Pinecone, Weaviate, Qdrant) | No document corpus. Copilot uses SQL. |
| Data warehouse (BigQuery, Redshift, Snowflake) | `sales_data` is < 5M rows. PostgreSQL handles OLAP queries fine at this scale. |
| Multi-region database replication | Customers are all in India. Single Supabase region (us-east-1 or ap-south-1) is sufficient. |
| Custom backup infrastructure | Supabase Pro daily backups are sufficient. |
| ORM (SQLAlchemy, Tortoise) | Supabase Python client is simpler and sufficient. Adding an ORM adds a layer of complexity for no gain. |
| GraphQL | REST + Supabase RPCs cover all requirements. GraphQL adds complexity without a clear benefit. |
| CQRS / Event sourcing | Overkill for a B2B analytics SaaS with < 100 tenants. |
| Sharding / Partitioning | PostgreSQL handles `sales_data` tables up to hundreds of millions of rows without partitioning. |
| Separate analytics database | `sales_data` queries via Supabase RPCs are fast enough for < 5M rows. |

---

## 28. Final Recommendation

### Architecture

| Component | Recommendation | Rationale |
|---|---|---|
| **Database** | Supabase PostgreSQL (upgrade to Pro for first paying customer) | Built-in RLS, Auth, Edge Functions, backups on Pro. PostgreSQL handles all query patterns at this scale. |
| **Object storage** | Supabase Storage | Same platform, same auth, zero additional config. |
| **Authentication** | Supabase Auth (email/password, JWT ES256) | Already implemented and working. No reason to change. |
| **Vector storage** | None needed | AKARA copilot uses SQL, not semantic search. |
| **Background jobs** | Supabase Edge Functions (cron-scheduled Deno) | Already used for morning brief. Free up to 500K invocations. No additional service needed. |
| **Caching** | None beyond in-process JWKS cache | Not needed at current scale. Add 5-minute in-process KPI cache when P95 > 2s. |
| **Backup strategy** | Supabase Pro daily backups + optional pg_dump to Cloudflare R2 nightly | Pro covers RPO/RTO requirements. Cloudflare R2 is free for backups < 10 GB. |
| **Monitoring** | Sentry (errors) + UptimeRobot (uptime) + Supabase dashboard (DB metrics) | All free tier. Covers the critical observability triangle. |

### Estimated initial monthly cost

| Phase | Monthly cost |
|---|---|
| Pre-launch (dev) | $3–5 |
| 3 paying customers | **$30–40/month** |
| 10 paying customers | $65–100/month |
| 50 paying customers | $165–215/month |

### Expected scaling limits before major changes

- Supabase free tier: handles ~8 tenants for ~6 months
- Supabase Pro: handles ~50 tenants for 2+ years
- Railway single instance: handles ~50 concurrent users
- Current stack: supports 200+ tenants without architecture changes (just tier upgrades)

### First implementation steps (in order)

1. **Run pending migrations** in Supabase SQL Editor: verify all 9 are applied
2. **Upgrade Supabase to Pro** before first paying customer
3. **Implement migration 010** (`import_id` tracking) + backend changes from `docs2/data_plan.md`
4. **Wire Supabase Storage** for generated reports (create `reports` bucket, sign URLs)
5. **Set up UptimeRobot** monitoring for `GET /health` (5 minutes, alert on 2 consecutive failures)
6. **Write `test_tenant_isolation.py`** — the most critical missing test
7. **Implement tenant offboarding script** — required before onboarding any customer
8. **Run the full 14-day onboarding checklist** from `docs/onboarding-checklist.md`

---

*Document generated: 2026-07-23 | Based on: akara/ repository at Day 13 state*
