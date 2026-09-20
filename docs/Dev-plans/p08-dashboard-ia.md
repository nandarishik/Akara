# Phase 8 dashboard IA (D2-P08-001)

ASCII wire for café dashboard v2 (`NEW_DASHBOARD=true`). FMCG layout unchanged when flag false.

```
+------------------------------------------------------------------+
| DashboardHeader                                                  |
| [DateRange] [Location?] [Channel]          Last updated N min ago|
+------------------------------------------------------------------+
| Layer 1 — Today at a glance                                      |
| +--------------+ +----------+ +--------+ +------+                |
| | RevenueHero  | | FoodCost | | Orders | | AOV  |                |
| | vs yday/wk   | | alert %  | | count  | | INR  |                |
| +--------------+ +----------+ +--------+ +------+                |
| MetricEvidence (orders, range, last import, versions)            |
+------------------------------------------------------------------+
| Layer 2 — Weekly trends (after Layer 1)                          |
| [RevenueTrend 7d bars + prior week] [Channel donut]              |
| [ItemPerformance top/bottom 5]                                   |
+------------------------------------------------------------------+
| Layer 3 — Detailed (Intersection Observer)                       |
| [DaypartHeatmap 5x7] [LabourCostTrend] [InventoryMetricsRow]    |
+------------------------------------------------------------------+
| DataQualityWidget (kept on both flag paths)                      |
+------------------------------------------------------------------+
```

Null metric values render as "—" with setup CTA (e.g. expense_tracking → expense guide).
Partial evidence shows banner: "Showing partial data (query timed out)".
