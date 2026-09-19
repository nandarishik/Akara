# AKARA API — Curl Command Reference

Base URL: https://api.akara.app (production) / http://localhost:8000 (local)

Version: /v1 is primary. Unversioned customer paths are compatibility aliases (deprecated; remove in Phase 5).
There is no /api prefix on this application.

## Authentication
Tenant routes require: -H "Authorization: Bearer <access_token>"

### DELETE /v1/account
curl -X DELETE -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/account

### GET /v1/account/channels
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/account/channels

### GET /v1/account/export
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/account/export

### PATCH /v1/account/preferences
curl -X PATCH -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/account/preferences -H "Content-Type: application/json" --data '{}'

### POST /v1/account/preferences/test-email
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/account/preferences/test-email -H "Content-Type: application/json" --data '{}'

### POST /v1/account/preferences/test-whatsapp
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/account/preferences/test-whatsapp -H "Content-Type: application/json" --data '{}'

### POST /v1/account/preferences/unsubscribe
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/account/preferences/unsubscribe -H "Content-Type: application/json" --data '{}'

### PATCH /v1/account/profile
curl -X PATCH -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/account/profile -H "Content-Type: application/json" --data '{}'

### GET /v1/account/sessions
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/account/sessions

### POST /v1/account/sessions/revoke-others
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/account/sessions/revoke-others -H "Content-Type: application/json" --data '{}'

### GET /v1/alerts
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/alerts
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/alerts -H "Content-Type: application/json" --data '{}'

### PATCH /v1/alerts/{alert_id}
curl -X PATCH -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/alerts/{alert_id} -H "Content-Type: application/json" --data '{}'
curl -X DELETE -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/alerts/{alert_id}

### POST /v1/auth/consent-accept
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/auth/consent-accept -H "Content-Type: application/json" --data '{}'

### GET /v1/auth/consent-status
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/auth/consent-status

### GET /v1/auth/me
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/auth/me

### POST /v1/auth/onboarding-complete
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/auth/onboarding-complete -H "Content-Type: application/json" --data '{}'

### POST /v1/billing/cancel-subscription
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/billing/cancel-subscription -H "Content-Type: application/json" --data '{}'

### POST /v1/billing/create-checkout-session
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/billing/create-checkout-session -H "Content-Type: application/json" --data '{}'

### GET /v1/billing/details
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/billing/details
curl -X PATCH -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/billing/details -H "Content-Type: application/json" --data '{}'

### GET /v1/billing/invoices
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/billing/invoices

### GET /v1/billing/invoices/{invoice_id}/download
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/billing/invoices/{invoice_id}/download

### GET /v1/billing/subscription
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/billing/subscription

### POST /v1/billing/sync-subscription
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/billing/sync-subscription -H "Content-Type: application/json" --data '{}'

### GET /v1/billing/usage
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/billing/usage

### POST /v1/billing/webhook
curl -X POST http://localhost:8000/v1/billing/webhook -H "Content-Type: application/json" --data '{}'

### POST /v1/copilot/chat
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/copilot/chat -H "Content-Type: application/json" --data '{}'

### GET /v1/copilot/conversations/
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/copilot/conversations/
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/copilot/conversations/ -H "Content-Type: application/json" --data '{}'

### PATCH /v1/copilot/conversations/{conversation_id}
curl -X PATCH -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/copilot/conversations/{conversation_id} -H "Content-Type: application/json" --data '{}'
curl -X DELETE -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/copilot/conversations/{conversation_id}

### GET /v1/copilot/conversations/{conversation_id}/messages
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/copilot/conversations/{conversation_id}/messages

### POST /v1/copilot/feedback
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/copilot/feedback -H "Content-Type: application/json" --data '{}'

### POST /v1/data/import
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/data/import -H "Content-Type: application/json" --data '{}'

### POST /v1/data/import/async
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/data/import/async -H "Content-Type: application/json" --data '{}'

### GET /v1/data/import/jobs
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/data/import/jobs

### GET /v1/data/import/jobs/{job_id}
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/data/import/jobs/{job_id}

### POST /v1/data/import/jobs/{job_id}/cancel
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/data/import/jobs/{job_id}/cancel -H "Content-Type: application/json" --data '{}'

### POST /v1/data/import/jobs/{job_id}/retry
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/data/import/jobs/{job_id}/retry -H "Content-Type: application/json" --data '{}'

### DELETE /v1/data/imports/{import_job_id}
curl -X DELETE -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/data/imports/{import_job_id}

### POST /v1/data/sheets
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/data/sheets -H "Content-Type: application/json" --data '{}'

### POST /v1/data/sync
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/data/sync -H "Content-Type: application/json" --data '{}'

### GET /v1/debrief
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/debrief

### POST /v1/debrief/generate
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/debrief/generate -H "Content-Type: application/json" --data '{}'

### GET /v1/debrief/latest
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/debrief/latest

### GET /v1/debrief/{report_id}
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/debrief/{report_id}

### GET /v1/debrief/{report_id}/pdf
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/debrief/{report_id}/pdf

### GET /v1/health
curl -X GET http://localhost:8000/v1/health

### GET /v1/kpi/
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/kpi/

### GET /v1/kpi/data-bounds
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/kpi/data-bounds

### GET /v1/kpi/heatmap
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/kpi/heatmap

### POST /v1/marketing/email-capture
curl -X POST http://localhost:8000/v1/marketing/email-capture -H "Content-Type: application/json" --data '{}'

### POST /v1/onboarding/setup
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/onboarding/setup -H "Content-Type: application/json" --data '{}'

### GET /v1/public/content/{key}
curl -X GET http://localhost:8000/v1/public/content/{key}

### GET /v1/public/legal/{document_key}
curl -X GET http://localhost:8000/v1/public/legal/{document_key}

### GET /v1/public/placements
curl -X GET http://localhost:8000/v1/public/placements

### POST /v1/public/placements/{slot_key}/click
curl -X POST http://localhost:8000/v1/public/placements/{slot_key}/click -H "Content-Type: application/json" --data '{}'

### POST /v1/public/placements/{slot_key}/impression
curl -X POST http://localhost:8000/v1/public/placements/{slot_key}/impression -H "Content-Type: application/json" --data '{}'

### GET /v1/public/plans
curl -X GET http://localhost:8000/v1/public/plans

### GET /v1/ready
curl -X GET http://localhost:8000/v1/ready

### GET /v1/reports/
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/reports/

### GET /v1/reports/scheme-leakage
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/reports/scheme-leakage

### GET /v1/reports/{report_id}/download
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/reports/{report_id}/download

### GET /v1/simulator/baseline
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/simulator/baseline

### POST /v1/simulator/run
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/simulator/run -H "Content-Type: application/json" --data '{}'

### GET /v1/system/banner
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/system/banner

### GET /v1/system/settings
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/system/settings

### POST /v1/team/accept
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/team/accept -H "Content-Type: application/json" --data '{}'

### POST /v1/team/downgrade-seat-selection
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/team/downgrade-seat-selection -H "Content-Type: application/json" --data '{}'

### POST /v1/team/invite
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/team/invite -H "Content-Type: application/json" --data '{}'

### GET /v1/team/invites
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/team/invites

### DELETE /v1/team/invites/{invite_id}
curl -X DELETE -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/team/invites/{invite_id}

### POST /v1/team/invites/{invite_id}/resend
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/team/invites/{invite_id}/resend -H "Content-Type: application/json" --data '{}'

### GET /v1/team/members
curl -X GET -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/team/members

### DELETE /v1/team/members/{member_id}
curl -X DELETE -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/team/members/{member_id}

### POST /v1/team/members/{member_id}/reactivate
curl -X POST -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/team/members/{member_id}/reactivate -H "Content-Type: application/json" --data '{}'

### PATCH /v1/team/members/{member_id}/role
curl -X PATCH -H "Authorization: Bearer <access_token>" http://localhost:8000/v1/team/members/{member_id}/role -H "Content-Type: application/json" --data '{}'

### GET /v1/version
curl -X GET http://localhost:8000/v1/version

