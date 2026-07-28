---
name: Fix All Day 1-11 Gaps
overview: "Fix every gap identified in the Days 1–11 audit: stale .env.example, unrouted and missing admin pages (TenantsPage routing + UsersPage creation), and two missing documents (runbook + akara_agent.py). No backend changes, no new packages, no tests (Days 12–14 separate)."
todos:
  - id: fix-env-example
    content: Fix akara/backend/.env.example — replace Gmail vars with SendGrid, add BACKEND_SERVICE_KEY
    status: completed
  - id: create-users-page
    content: Create akara/frontend/src/pages/admin/UsersPage.tsx
    status: completed
  - id: wire-admin-routes
    content: Update App.tsx — import and wire /admin/tenants and /admin/users routes
    status: completed
  - id: appshell-admin-nav
    content: Update AppShell.tsx — add conditional admin nav items (Building2 + Users icons, role=admin only)
    status: completed
  - id: create-runbook
    content: Create akara/docs/runbook.md
    status: completed
  - id: create-tally-agent
    content: Create akara_agent.py at repo root
    status: completed
  - id: quality-gate-gaps
    content: Run tsc --noEmit — 0 errors
    status: completed
isProject: false
---

# Fix All Day 1–11 Gaps

## Scope

5 targeted fixes. No new packages. No backend changes. All content is already fully specified in `daywise.md`.

## Fix 1 — `akara/backend/.env.example` (stale)

Replace Gmail variables with SendGrid, add missing `BACKEND_SERVICE_KEY`:

- Remove: `GMAIL_USER`, `GMAIL_APP_PASSWORD`
- Add: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `BACKEND_SERVICE_KEY`
- These match [`akara/backend/app/core/config.py`](akara/backend/app/core/config.py) exactly (`sendgrid_api_key`, `sendgrid_from_email`, `backend_service_key` fields)

## Fix 2 — Admin `TenantsPage` routing (unrouted dead page)

[`akara/frontend/src/pages/admin/TenantsPage.tsx`](akara/frontend/src/pages/admin/TenantsPage.tsx) exists and is complete but is never imported or routed in `App.tsx`.

Changes to [`akara/frontend/src/App.tsx`](akara/frontend/src/App.tsx):
- Add import: `import { TenantsPage } from "@/pages/admin/TenantsPage"`
- Add route inside `<AppShell>`: `<Route path="/admin/tenants" element={<TenantsPage />} />`

Changes to [`akara/frontend/src/components/layout/AppShell.tsx`](akara/frontend/src/components/layout/AppShell.tsx):
- Add a nav item for `/admin/tenants` to `NAV_ITEMS` — but only shown when `user?.role === "admin"` (conditional render so regular users never see it)
- Lucide icon: `Building2`

## Fix 3 — `UsersPage.tsx` (never created)

Create [`akara/frontend/src/pages/admin/UsersPage.tsx`](akara/frontend/src/pages/admin/UsersPage.tsx) — admin view to list and manage users for the current tenant.

Backend endpoint available: `GET /admin/users/{tenant_id}` and `PATCH /admin/users/{user_id}/role` (both live in [`akara/backend/app/api/routes/admin/users.py`](akara/backend/app/api/routes/admin/users.py)).

Page structure:
- Fetches `GET /admin/users/{tenantId}` using `user.tenantId` from `AuthContext`
- Table: display_name, role badge, "Change Role" dropdown (admin/user), calls `PATCH /admin/users/{id}/role`
- Uses existing `Table`, `Badge`, `Button` shadcn components (same pattern as `TenantsPage`)

Then:
- Add import + `<Route path="/admin/users" element={<UsersPage />} />` in `App.tsx`
- Add conditional nav item in `AppShell.tsx` (same admin-only guard)

## Fix 4 — `docs/runbook.md` (missing Track 2 deliverable)

Create [`akara/docs/runbook.md`](akara/docs/runbook.md) — content is 100% specified in `daywise.md` lines 7123–7157. Covers:
- Health check URL
- Logs (Railway + Sentry)
- Common issues (backend 500, import failure, copilot "all providers unavailable")
- Deployment commands
- Database access

## Fix 5 — `akara_agent.py` (missing post-launch deliverable)

Create [`akara_agent.py`](akara_agent.py) at the repo root — content is 100% specified in `daywise.md` lines 7682–7860. A ~100-line Python script that:
- Reads Tally invoices via local HTTP XML API
- Maps columns to AKARA schema
- POSTs to `POST /data/sync`
- Runs via Windows Task Scheduler nightly

## Implementation Order

1. Fix `backend/.env.example`
2. Create `UsersPage.tsx`
3. Update `App.tsx` (wire both admin routes)
4. Update `AppShell.tsx` (add conditional admin nav items)
5. Create `docs/runbook.md`
6. Create `akara_agent.py`

## Quality Gate

After all changes: `npx tsc --noEmit` in `akara/frontend` — must pass 0 errors.
