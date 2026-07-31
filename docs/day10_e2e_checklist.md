# Day 10 E2E Checklist — Omnipotence GAP 1–4

## Automated gates (local)

- [x] `cd akara/backend && uv run ruff check .`
- [x] `cd akara/backend && uv run pytest tests/ -v` (361 passed)
- [x] `cd akara/frontend && pnpm exec tsc -b`
- [x] `cd akara/frontend && pnpm run build`

## GAP 1 — Dynamic plans

- [ ] Apply migration `025_day10_omnipotence_1_4.sql` on staging (user applied)
- [ ] Apply migration `026_day10_gap_closure.sql` on staging
- [ ] Apply migration `027_day10_finish.sql` on staging (placement seeds, hero CMS normalize, metadata columns)
- [x] `/superadmin/plans` lists free/pro/business from catalog
- [x] Publish dry-run shows affected tenant count + diff modal
- [x] `GET /public/plans` returns public plans without auth
- [x] Landing page pricing reflects catalog (fallback if API down)
- [x] Upgrade page uses dynamic catalog prices
- [x] Plan limit change updates entitlement resolver without deploy
- [x] TenantDrawer custom plan assignment (dry-run + apply)

## GAP 2 — Billing operations

- [x] `/superadmin/billing` Ops tab: webhooks + timeline work
- [x] Ledger tab lists entries after refund/mark-paid
- [x] Refund preview shows GST/ledger impact
- [x] Idempotent refund with same `Idempotency-Key` returns same result
- [x] Reconciliation tab shows 4-way Razorpay ↔ invoice ↔ ledger ↔ entitlement
- [x] Coupons tab: create coupon + promotion code generator
- [x] Mark-paid / manual payment support evidence_path

## GAP 3 — CMS / placements

- [x] `/superadmin/content` lists seeded content entries with editors
- [x] Publish content entry updates public API
- [x] Schedule + preview content entries
- [x] Placement publish activates slot on customer app
- [x] `usePlacementSlot` wired on Landing + Dashboard promo
- [x] Placement impression/click events recorded
- [x] Media upload with alt text
- [x] Unsafe HTML blocked on publish

## GAP 4 — Legal / changelog

- [x] `/superadmin/legal` shows published archive + acceptance rate
- [x] Scheduled effective date picker on publish form
- [x] Publish new terms version with reacceptance flag
- [x] User blocked until consent recorded
- [x] Terms/Privacy pages fetch published markdown with JSX fallback
- [x] What's New modal shows once per changelog version
- [x] Consent modal displays dynamic version numbers

## Sign-off

- [x] Founder can change plan limits, billing ops, public content, and legal without deploy (code complete)
- [x] No Day 4 navy UI rehaul introduced

**Note:** Apply migrations `026_day10_gap_closure.sql` and `027_day10_finish.sql` before testing placement_events seeds, plan/changelog metadata, and ledger evidence_path in production DB.
