# Runbook — decision engine

- Disable generation: `DECISION_ENGINE_ENABLED=false`.
- Schedule: existing `cron_intelligence_worker` at 22:30 UTC (decision) and 23:30 UTC (outcome). `railway.decision_engine.json` is schedule documentation only — do **not** deploy a 5th Railway service.
- Festival lunar dates (Eid, Diwali, Ugadi, Gudi Padwa) need an annual Operations update of `festival_calendar`.
- Impact ceiling: `MAX_EXPECTED_IMPACT_INR=500000`.
- Cross-tenant accept must 404.
