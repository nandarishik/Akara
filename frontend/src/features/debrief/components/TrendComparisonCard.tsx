import { ArrowDown, ArrowUp } from "lucide-react";

import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import type { TrendComparison } from "@/features/intelligence/api/types";

export function TrendComparisonCard({ trend }: { trend: TrendComparison }) {
  const Arrow = trend.revenue_wow_pct >= 0 ? ArrowUp : ArrowDown;
  return (
    <GlowSurfaceCard padding="md" hover={false} className="space-y-2">
      <h3 className="text-sm font-semibold">Trend vs previous period</h3>
      <p className="text-sm text-text-secondary flex items-center gap-1">
        <Arrow className="h-4 w-4" />
        Revenue {trend.revenue_wow_pct >= 0 ? "+" : ""}
        {trend.revenue_wow_pct.toFixed(1)}%
      </p>
      {trend.food_cost_wow_pct != null && (
        <p className="text-sm text-text-muted">
          Food cost {trend.food_cost_wow_pct >= 0 ? "+" : ""}
          {trend.food_cost_wow_pct.toFixed(1)}%
        </p>
      )}
    </GlowSurfaceCard>
  );
}
