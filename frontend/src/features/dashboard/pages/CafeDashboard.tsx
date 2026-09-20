import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { listLocations } from "@/features/data-import/api/cafeImportApi";
import {
  useCafeChannel,
  useCafeDaypart,
  useCafeItems,
  useCafeSummary,
  useCafeTrends,
  useMetricDefs,
} from "../hooks/useCafeKpi";
import type { CafeKpiFilters } from "../types";
import { DashboardHeader } from "../components/DashboardHeader";
import { MetricEvidence } from "../components/MetricEvidence";
import {
  AOVCard,
  FoodCostAlertCard,
  OrdersCard,
  RevenueHeroCard,
} from "../components/Layer1Cards";
import {
  CafeRevenueTrendChart,
  ChannelBreakdownDonut,
  DaypartHeatmap,
  InventoryMetricsRow,
  ItemPerformanceTable,
  LabourCostTrend,
} from "../components/CafeCharts";
import { DataQualityWidget } from "@/features/data-import/components/DataQualityWidget";
import ProductPageLayout from "@/shared/layout/ProductPageLayout";

function todayIST(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function CafeDashboard() {
  const [filters, setFilters] = useState<CafeKpiFilters>({
    from: todayIST(),
    to: todayIST(),
  });
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [layer3On, setLayer3On] = useState(false);
  const layer3Ref = useRef<HTMLDivElement | null>(null);

  const { data: summary, isLoading, isError } = useCafeSummary(filters);
  const layer1Ready = Boolean(summary) || isError;
  const { data: trends } = useCafeTrends(
    { ...filters, from: daysAgo(6), to: todayIST() },
    layer1Ready,
  );
  const { data: channel } = useCafeChannel(filters, layer1Ready);
  const { data: items } = useCafeItems(filters, layer1Ready);
  const { data: daypart } = useCafeDaypart(filters, layer3On);
  const { data: defs } = useMetricDefs(true);
  const metricDefs = defs?.metrics;

  useEffect(() => {
    void listLocations()
      .then((res) =>
        setLocations(
          (res.locations ?? []).map((l) => ({
            id: l.location_id,
            name: l.location_name,
          })),
        ),
      )
      .catch(() => setLocations([]));
  }, []);

  useEffect(() => {
    const el = layer3Ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLayer3On(true);
      },
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const empty = useMemo(
    () => !isLoading && !summary && isError,
    [isLoading, summary, isError],
  );

  return (
    <ProductPageLayout
      title="Dashboard"
      description="Café metrics for today — evidence-backed, versioned."
    >
      <DashboardHeader
        filters={filters}
        onChange={setFilters}
        locations={locations}
        lastUpdatedMinutesAgo={summary?.evidence.last_updated_minutes_ago}
      />

      {empty ? (
        <div className="py-8" data-testid="cafe-dashboard-empty">
          <p className="text-text-primary">No café metrics yet.</p>
          <p className="mt-2 text-sm text-text-muted">
            Import orders on{" "}
            <Link to="/data" className="text-accent underline">
              Data
            </Link>{" "}
            or connect a live source on{" "}
            <Link to="/connectors" className="text-accent underline">
              Connectors
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <section className="mb-8" data-testid="layer1">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
              Today at a glance
            </h2>
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-lg bg-white/5"
                    aria-hidden
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <RevenueHeroCard metric={summary?.metrics.revenue} defs={metricDefs} />
                <FoodCostAlertCard metric={summary?.metrics.food_cost_pct} defs={metricDefs} />
                <OrdersCard metric={summary?.metrics.orders} defs={metricDefs} />
                <AOVCard metric={summary?.metrics.aov} defs={metricDefs} />
              </div>
            )}
            <MetricEvidence evidence={summary?.evidence} />
          </section>

          {layer1Ready ? (
            <section className="mb-8 space-y-6" data-testid="layer2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                Weekly trends
              </h2>
              <div className="grid gap-6 lg:grid-cols-2">
                <CafeRevenueTrendChart points={trends?.trend_7d ?? []} />
                <ChannelBreakdownDonut channels={channel?.channels ?? []} />
              </div>
              <ItemPerformanceTable items={items?.items ?? []} />
            </section>
          ) : null}

          <div ref={layer3Ref} className="min-h-[4rem]">
            {layer3On ? (
              <section className="mb-8 space-y-6" data-testid="layer3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                  Detailed analytics
                </h2>
                <DaypartHeatmap cells={daypart?.cells ?? []} />
                <LabourCostTrend points={trends?.trend_30d ?? []} />
                <InventoryMetricsRow waste={null} turnover={null} stockout={null} />
              </section>
            ) : (
              <p className="py-6 text-center text-xs text-text-muted">Scroll for detailed analytics…</p>
            )}
          </div>
        </>
      )}

      <DataQualityWidget />
    </ProductPageLayout>
  );
}
