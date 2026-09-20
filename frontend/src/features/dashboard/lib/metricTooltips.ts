/** Frozen §11.3 tooltip copy; others from GET /metrics. */

export const FROZEN_TOOLTIPS: Record<string, string> = {
  revenue: "Total sales for the selected period before refunds, in INR.",
  food_cost_pct:
    "Food cost as a percentage of revenue. Requires expense tracking for COGS categories.",
  aov: "Average order value — revenue divided by order count for the period.",
};

export function metricTooltip(
  metricId: string,
  defs?: { metric_id: string; description: string }[],
): string {
  if (FROZEN_TOOLTIPS[metricId]) return FROZEN_TOOLTIPS[metricId];
  const found = defs?.find((d) => d.metric_id === metricId);
  return found?.description ?? "";
}
