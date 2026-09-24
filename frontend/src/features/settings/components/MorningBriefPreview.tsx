import { formatINR } from "@/lib/format";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import type { MorningBriefPreview as Preview } from "@/features/intelligence/api/types";

export function MorningBriefPreview({ data }: { data: Preview }) {
  return (
    <div className="space-y-4">
      <GlowSurfaceCard padding="md" hover={false}>
        <h3 className="text-sm font-semibold">Revenue</h3>
        <p className="text-text-secondary text-sm mt-1">
          Yesterday {formatINR(data.revenue_yesterday)} vs last week{" "}
          {formatINR(data.revenue_same_day_lw)} ({data.revenue_wow_pct.toFixed(1)}%)
        </p>
      </GlowSurfaceCard>

      <GlowSurfaceCard padding="md" hover={false}>
        <h3 className="text-sm font-semibold">Top 5</h3>
        {data.top_items.length === 0 ? (
          <p className="text-sm text-text-muted mt-1">No item sales yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-text-secondary">
            {data.top_items.map((item) => (
              <li key={item.item_name}>
                {item.item_name} · {formatINR(item.total_revenue)} · {item.total_qty} sold
              </li>
            ))}
          </ul>
        )}
      </GlowSurfaceCard>

      <GlowSurfaceCard padding="md" hover={false}>
        <h3 className="text-sm font-semibold">Food cost</h3>
        <p className="text-sm text-text-secondary mt-1">
          {data.food_cost_ratio == null
            ? "Food-cost ratio not available yet."
            : `${(data.food_cost_ratio * 100).toFixed(1)}%${data.food_cost_alert ? " — above 35% alert" : ""}`}
        </p>
      </GlowSurfaceCard>

      {data.weather && (
        <GlowSurfaceCard padding="md" hover={false}>
          <h3 className="text-sm font-semibold">Weather</h3>
          <p className="text-sm text-text-secondary mt-1">
            {data.weather.temp_max_c}°C
            {data.weather.is_rainy || data.weather.precipitation_mm >= 20
              ? " · rain — expect about 15% dine-in drop"
              : ""}
          </p>
          <p className="text-xs text-text-muted mt-2">{data.weather.attribution}</p>
        </GlowSurfaceCard>
      )}

      <GlowSurfaceCard padding="md" hover={false}>
        <h3 className="text-sm font-semibold">Demand forecast</h3>
        {data.forecast_tomorrow ? (
          <p className="text-sm text-text-secondary mt-1">
            Tomorrow {formatINR(data.forecast_tomorrow.predicted_revenue_tomorrow)} (
            {data.forecast_tomorrow.busy_day_pct.toFixed(1)}% vs typical)
          </p>
        ) : (
          <p className="text-sm text-text-muted mt-1">
            {data.forecast_unavailable_reason ??
              "Forecast not yet available — need 14+ days of data"}
          </p>
        )}
      </GlowSurfaceCard>
    </div>
  );
}
