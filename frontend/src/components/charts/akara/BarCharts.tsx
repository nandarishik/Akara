import { BarChart, Bar, BarXAxis, Grid } from "@/charts";
import { chartAspect, chartColors, chartMargins } from "@/lib/charts/chartTheme";
import { toWeekdayBarSeries, toMoverBarSeries, toRouteBarSeries, type BarRow } from "@/lib/charts/chartAdapters";

interface WeekdayProps {
  pulse: { day: string; weekday: string; revenue: number; trailing_avg: number }[];
  loading?: boolean;
  className?: string;
  aspectRatio?: string | null;
}

export function WeekdayBarChart({ pulse, loading, className, aspectRatio }: WeekdayProps) {
  return (
    <GenericBarChart
      rows={toWeekdayBarSeries(pulse)}
      loading={loading}
      className={className}
      aspectRatio={aspectRatio}
    />
  );
}

interface MoverProps {
  movers: { name: string; change_inr: number; change_pct: number; direction: "up" | "down" }[];
  loading?: boolean;
  className?: string;
  aspectRatio?: string | null;
}

export function ProductMoverBarChart({ movers, loading, className, aspectRatio }: MoverProps) {
  return (
    <GenericBarChart
      rows={toMoverBarSeries(movers)}
      loading={loading}
      className={className}
      aspectRatio={aspectRatio}
    />
  );
}

interface RouteProps {
  routes: { route: string; revenue: number; orders: number }[];
  loading?: boolean;
  className?: string;
  aspectRatio?: string | null;
}

export function RouteBarChart({ routes, loading, className, aspectRatio }: RouteProps) {
  return (
    <GenericBarChart
      rows={toRouteBarSeries(routes)}
      loading={loading}
      className={className}
      aspectRatio={aspectRatio}
    />
  );
}

function GenericBarChart({
  rows,
  loading,
  className,
  aspectRatio = chartAspect.wide,
}: {
  rows: BarRow[];
  loading?: boolean;
  className?: string;
  aspectRatio?: string | null;
}) {
  const chartData = rows.map((r) => ({ name: r.name, value: r.value }));

  if (!loading && chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        No data yet
      </div>
    );
  }

  return (
    <BarChart
      className={className}
      data={chartData.length ? chartData : [{ name: "—", value: 0 }]}
      xDataKey="name"
      aspectRatio={aspectRatio === null ? undefined : (aspectRatio ?? chartAspect.wide)}
      margin={chartMargins.bar}
      status={loading || chartData.length === 0 ? "loading" : "ready"}
    >
      <Grid horizontal stroke={chartColors.grid} />
      <Bar dataKey="value" fill={chartColors.primary} lineCap="butt" />
      <BarXAxis />
    </BarChart>
  );
}
