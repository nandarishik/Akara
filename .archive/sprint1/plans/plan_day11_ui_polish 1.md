---
name: Day 11 UI Polish
overview: Add ErrorBoundary, 404 page, reusable EmptyState + SkeletonCard components, and a mobile-responsive AppShell sidebar. All 6 pages become production-quality on both desktop and 375px mobile.
todos:
  - id: error-boundary
    content: Create frontend/src/components/ErrorBoundary.tsx
    status: completed
  - id: not-found-page
    content: Create frontend/src/pages/NotFoundPage.tsx
    status: completed
  - id: empty-state
    content: Create frontend/src/components/EmptyState.tsx
    status: completed
  - id: skeleton-card
    content: Create frontend/src/components/SkeletonCard.tsx
    status: completed
  - id: appshell-mobile
    content: Update AppShell.tsx — add mobile sidebar toggle (hamburger, overlay, slide animation)
    status: completed
  - id: app-routing-404
    content: Update App.tsx — replace Navigate catch-all with NotFoundPage; wire ErrorBoundary
    status: completed
  - id: onboarding-docs
    content: Create docs/onboarding-checklist.md (Track 2)
    status: completed
  - id: quality-gate
    content: Run ruff check, pytest, tsc --noEmit — all must pass
    status: completed
isProject: false
---

# Day 11 — UI Polish

## Current State

- [`frontend/src/App.tsx`](akara/frontend/src/App.tsx) — `path="*"` currently redirects to `/dashboard` instead of a 404 page. No ErrorBoundary anywhere.
- [`frontend/src/components/layout/AppShell.tsx`](akara/frontend/src/components/layout/AppShell.tsx) — sidebar is `position: static`, always visible, breaks completely on mobile (no hamburger, no overlay).
- No `ErrorBoundary`, `NotFoundPage`, `EmptyState`, or `SkeletonCard` components exist yet.
- Track 2: `docs/onboarding-checklist.md` does not exist.

---

## 1. `frontend/src/components/ErrorBoundary.tsx` — Created

React class component catching render-phase errors. Shows a friendly "Something went wrong" UI with a reload button. Wraps `<Outlet />` in AppShell so any page crash is contained.

```typescript
export class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State { ... }
  render() {
    if (this.state.hasError) {
      return <div ...> ⚠️ Something went wrong + Reload button </div>
    }
    return this.props.children;
  }
}
```

---

## 2. `frontend/src/pages/NotFoundPage.tsx` — Created

Standalone page (no AppShell, no auth required) shown for all unmatched routes. Large "404" heading, "Page not found" message, "Back to Dashboard" button via `<Link>`.

---

## 3. `frontend/src/components/EmptyState.tsx` — Created

Reusable empty-state component. Takes `icon: LucideIcon`, `title`, `description`, optional `action` (ReactNode). Used by existing pages (ReportsPage already has its own inline empty state — EmptyState becomes available for future use and can replace those inline patterns).

```typescript
export function EmptyState({ icon: Icon, title, description, action }: Props)
```

---

## 4. `frontend/src/components/SkeletonCard.tsx` — Created

Reusable animated pulse skeleton. Takes `className` and `lines` (default 3). Produces a card outline with shimmer lines of decreasing width. Used by pages that already have ad-hoc `animate-pulse` divs.

```typescript
export function SkeletonCard({ className, lines = 3 }: Props)
```

---

## 5. `frontend/src/components/layout/AppShell.tsx` — Modified

**Biggest change.** The current sidebar has no mobile support at all. This update adds:

- `useState(false)` for `sidebarOpen`
- Sidebar gets `fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto` + `transform transition-transform` + conditional `translate-x-0 / -translate-x-full` classes
- Dark overlay `div` renders behind sidebar on mobile when open, closes on click
- Mobile header bar (hidden on `lg:`) with hamburger `<Menu>` icon and "AKARA" title
- Nav link clicks close the sidebar on mobile (`setSidebarOpen(false)`)
- `X` close button inside sidebar on mobile

Key CSS classes for sidebar toggle:
```typescript
className={cn(
  "w-64 bg-white border-r border-slate-200 flex flex-col",
  "fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto",
  "transform transition-transform duration-200",
  sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
)}
```

---

## 6. `frontend/src/App.tsx` — Modified (2 changes)

**Change 1:** Replace `<Navigate to="/dashboard" replace />` with `<NotFoundPage />` on the `path="*"` catch-all route.

**Change 2:** Wrap `<AppShell />` route's content area with `<ErrorBoundary>`. Since AppShell renders `<Outlet />`, wrap it directly inside the main `<main>` tag — done inside AppShell.tsx itself (see item 5), not in App.tsx.

The only App.tsx change:
```typescript
// Before:
<Route path="*" element={<Navigate to="/dashboard" replace />} />
// After:
import { NotFoundPage } from "@/pages/NotFoundPage";
<Route path="*" element={<NotFoundPage />} />
```

---

## 7. Track 2 — `docs/onboarding-checklist.md` — Created

Simple markdown document covering the 6-step customer onboarding procedure (provision tenant in SQL, create auth user, create profile, send welcome email, customer uploads data, verify KPIs). Already specified in `daywise.md` lines 6801–6833.

---

## Quality Gates

```bash
cd akara/backend
uv run ruff check .
uv run pytest
# Expected: 2 passed (no backend changes)

cd akara/frontend
npx tsc --noEmit
# Expected: 0 errors
```

---

## Verification

1. Navigate to `/nonexistent-route` — 404 page renders (not redirect to dashboard)
2. Open Chrome DevTools → 375px iPhone view → hamburger button visible in top bar → tap it → sidebar slides in with overlay → tap a nav item → sidebar closes
3. On desktop — sidebar always visible, no hamburger shown
4. Simulate a render error (temporarily throw in a page) — ErrorBoundary catches and shows "Something went wrong"
5. `tsc --noEmit` — 0 errors
