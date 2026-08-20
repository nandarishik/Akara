# Architecture overview

AKARA is a multi-tenant sales analytics platform:

- **Frontend** (`frontend/`) — React + Vite, hosted on Vercel
- **Backend** (`backend/`) — FastAPI + Python 3.12, hosted on Railway
- **Database** (`supabase/`) — Postgres + Auth + Storage + Edge Functions

## Data flow (copilot)

```
User question → Planner (LLM) → SQL (guarded) → Execute → Synthesizer (LLM) → Response
```

## Tenancy

All transactional data is scoped by `tenant_id`. Tenant config lives on `tenants.config` (industry, currency, language, feature overrides).

## Related docs

- [Plan catalog](./plan_catalog.md) — plan limits source of truth
- [Additional changes](./additional_changes.md) — post-launch changelog
- Operations runbooks under `docs/operations/`
