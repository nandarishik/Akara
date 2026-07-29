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
}

export function ZoneBarChart({ data, loading, horizontal = true, className }: Props) {
  const rows =
    data.length > 0 && "zone" in data[0]
      ? toZoneBarSeries(data as ZoneBreakdown[])
      : (data as BarRow[]);

  const chartData = rows.map((r) => ({ name: r.name, value: r.value }));

  if (loading && chartData.length === 0) {
    return (
      <BarChartLoading
        className={className}
        aspectRatio={chartAspect.standard}
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
      aspectRatio={chartAspect.standard}
      margin={horizontal ? chartMargins.barHorizontal : chartMargins.bar}
      status={loading ? "loading" : "ready"}
    >
      <Grid horizontal={!horizontal} vertical={horizontal} stroke={chartColors.grid} />
      <Bar dataKey="value" fill={chartColors.primary} />
      {horizontal ? <BarYAxis /> : <BarXAxis />}
    </BarChart>
  );
}
