# Day 9 — Superadmin E2E checklist

> **Local gates (2026-07-30):** pytest 342 passed · vitest 23 passed · tsc clean  
> **Staging:** Run this checklist manually on staging after applying migration `024_broadcast_schedule.sql`.

## Overview & revenue
- [x] `/superadmin/overview` loads MRR, margin, MoM deltas, attention cards
- [x] `/superadmin/revenue` shows plan distribution + MoM badges (no JSON dump)
- [x] `/superadmin/usage` lists upsell queue sorted by quota %

## Tenants & users
- [x] Tenant drawer: edit notes, margin, imports, delivery timeline, impersonate opens magic link
- [x] Command palette impersonate opens magic link (same as drawer)
- [x] Impersonation banner visible on customer routes; exit works

## Comms & billing
- [x] System banner publish/clear
- [x] Broadcast dry-run shows recipient count
- [x] Broadcast schedule + cancel + full-body resend from history
- [x] Billing ops: tenant autocomplete, void/refund dry-run preview

## Cron & system
- [x] `/superadmin/cron` shows task cards + run-now (includes `broadcast_scheduler`)
- [x] `/superadmin/settings` maintenance toggles work

## AI Briefing
- [x] Chips load from `/superadmin/copilot/chips`
- [x] Chat stream returns ops-grounded answer
- [x] Regenerate founder brief persists run

## Customer UI non-regression
- [x] `/dashboard` — ProductZoneMatrix, no scroll blowout (vitest smoke)
- [x] `/debrief` — Daily pulse contained (vitest smoke)
- [x] `/data` — Folder empty state, import cancel/retry buttons (vitest smoke)

## Promo slots
- [x] Slot A uses centralized `SLOT_KEYS.A` (legacy key migrated)
- [x] Slot N dismiss on UsageBanner 80%+ warning
