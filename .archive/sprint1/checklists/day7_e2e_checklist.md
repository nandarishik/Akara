# Day 7 E2E Checklist — Communications, Teams, Debrief, Account Rights

## Automated gate

```bash
cd backend && pytest tests/test_debrief_engine.py tests/test_debrief_pdf.py tests/test_copilot_debrief_context.py tests/test_team_invites.py tests/test_account.py tests/test_activation_emails.py tests/test_account_deletion.py -q
cd frontend && npm run build
```

## Database

- [ ] Migration `018_day7_comms_teams_debrief.sql` applied on Supabase
- [ ] Migration `019_day7_gap_fixes.sql` applied (`email_suppressions`, `debrief_delivery_ledger`)
- [ ] `reserve_team_invite` RPC callable via service role
- [ ] RLS: team_invites, user_events, delivery_logs readable by tenant

## Account & preferences

- [ ] `GET /account/channels` returns `whatsapp_enabled: false` until BSP live
- [ ] `PATCH /account/preferences` merges JSONB (email/WhatsApp debrief toggles)
- [ ] `GET /account/export` downloads JSON with profile + conversations
- [ ] `DELETE /account` requires exact email confirmation; returns 202 and queues async deletion
- [ ] `POST /account/preferences/test-email` (Pro) sends test message

## Team invites (Pro)

- [ ] Admin creates invite — seat meter includes pending invite
- [ ] Resend extends expiry; cancel releases seat
- [ ] Accept with matching email joins tenant
- [ ] Seat limit returns 402 when full

## Weekly debrief

- [ ] `WeeklyDebriefEngine` computes for tenant with 14+ days data
- [ ] Free tenant: one lifetime debrief only
- [ ] `POST /admin/reports/weekly-debrief` manual trigger (service key or superadmin)
- [ ] Email E3 sends when SendGrid configured
- [ ] WhatsApp logs `skipped` / `templates_not_ready` in `delivery_logs`
- [ ] `/debrief` — skeleton, stale banner, PDF blob download, Copilot router state
- [ ] Copilot accepts `report_id` for debrief context (cross-tenant rejected)
- [ ] Settings P14 tabs: Profile / Notifications / Billing / Security / Team / API Keys / Danger Zone
- [ ] Team tab: role change, seat_locked badges, downgrade modal, reactivate
- [ ] **Railway cron `weekly_debrief`** schedule `30 1 * * 1` — **deferred until Day 14** (4-service Railway limit). Until then: manual admin trigger or `python -m app.tasks.weekly_debrief`

## Activation emails

- [ ] `user_events` recorded: signed_up, onboarded, first_import, first_copilot
- [ ] Daily cron sends E8/E9/E10-style Day 7 phone nudge / Day 14 upgrade nudge (ledger dedupes)
- [ ] **Railway cron `activation_emails`** schedule `0 8 * * *` — **deferred until Day 14**. Until then: run `python -m app.tasks.activation_emails` locally or as a one-off job

## Superadmin diagnostics

- [ ] `/admin/security/communications` shows delivery log table + activation pending
- [ ] `/admin/tenants/{id}/debrief-status` returns last debrief + lifetime count
- [ ] Superadmin can trigger morning brief / weekly debrief from Security Ops

## Manual prod P0

1. Create team invite on Pro tenant; accept on second email
2. Export JSON from Settings Danger Zone
3. Trigger debrief via admin; view at `/debrief`
4. Confirm activation email for user missing `first_copilot`
5. Confirm WhatsApp path in `delivery_logs` as `skipped` until `WHATSAPP_SENDS_ENABLED=true`

## Operator — when Meta templates approved

1. Set `ZAPTILO_API_KEY` + `ZAPTILO_SENDER_NUMBER` on Railway
2. Set `WHATSAPP_SENDS_ENABLED=true`
3. Submit W1–W4 in Meta Business Manager
4. Test send from Settings
