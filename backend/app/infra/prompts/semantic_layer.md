# Café semantic layer (Phase 9 stub)

Phase 8 metric keys for copilot prompt injection. This file was missing on the Phase 8 land SHA; DEV1 created it on the Phase 9 split branch.

| metric_id | meaning |
|---|---|
| revenue | Gross sales for the selected period (INR) |
| food_cost_pct | Food cost as a percentage of revenue |
| orders | Order count |
| aov | Average order value (revenue / orders) |
| labour_cost_pct | Labour cost as a percentage of revenue |

Do not interpolate tenant PII or credentials into the system prompt. User text stays in the `user` role message (max 2000 characters).
