import { BarChart, Bar, BarXAxis, BarYAxis, Grid, BarChartLoading } from "@/charts";
import {
  chartAspect,
  chartColors,
  chartMargins,
} from "@/lib/charts/chartTheme";
import { toZoneBarSeries, type BarRow } from "@/lib/charts/chartAdapters";
import type { ZoneBreakdown } from "@/types/kpi";

interface Props {
  data: ZoneBreakdown[] | BarRow[];
  loading?: boolean;
  horizontal?: boolean;
  className?: string;
  aspectRatio?: string | null;
}

export function ZoneBarChart({
  data,
  loading,
  horizontal = false,
  className,
  aspectRatio,
}: Props) {
  const rows =
    data.length > 0 && "zone" in data[0]
      ? toZoneBarSeries(data as ZoneBreakdown[])
      : (data as BarRow[]);

  const chartData = rows.map((r) => ({ name: r.name, value: r.value }));
  const resolvedAspect =
    aspectRatio === null ? undefined : (aspectRatio ?? chartAspect.standard);

  if (loading && chartData.length === 0) {
    return (
      <BarChartLoading
        className={className}
        aspectRatio={resolvedAspect}
        margin={horizontal ? chartMargins.barHorizontal : chartMargins.bar}
      />
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        No zone breakdown available
      </div>
    );
  }

  return (
    <BarChart
      className={className}
      data={chartData}
      xDataKey="name"
      orientation={horizontal ? "horizontal" : "vertical"}
      aspectRatio={resolvedAspect}
      margin={horizontal ? chartMargins.barHorizontal : chartMargins.bar}
      status={loading ? "loading" : "ready"}
    >
      <Grid horizontal={!horizontal} vertical={horizontal} stroke={chartColors.grid} />
      <Bar dataKey="value" fill={chartColors.primary} lineCap="butt" />
      {horizontal ? <BarYAxis /> : <BarXAxis />}
    </BarChart>
  );
}
