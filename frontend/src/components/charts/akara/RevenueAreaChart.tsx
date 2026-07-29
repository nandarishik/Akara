import {
  AreaChart,
  Area,
  Grid,
  XAxis,
  ChartTooltip,
  AreaChartLoading,
} from "@/charts";
import { formatINRCompact } from "@/lib/format";
import {
  CHART_LOADING_LABEL,
  chartAspect,
  chartColors,
  chartMargins,
} from "@/lib/charts/chartTheme";
import { toAreaSeries, type AreaPoint } from "@/lib/charts/chartAdapters";
import type { RevenueByDate } from "@/types/kpi";

interface Props {
  data: RevenueByDate[] | AreaPoint[];
  loading?: boolean;
  className?: string;
}

export function RevenueAreaChart({ data, loading, className }: Props) {
  const series =
    data.length > 0 && "invoice_date" in data[0]
      ? toAreaSeries(data as RevenueByDate[])
      : (data as AreaPoint[]);

  if (loading && series.length === 0) {
    return (
      <AreaChartLoading
        className={className}
        aspectRatio={chartAspect.wide}
        label={CHART_LOADING_LABEL}
        margin={chartMargins.area}
      />
    );
  }

  if (series.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        No revenue data for this range
      </div>
    );
  }

  return (
    <AreaChart
      className={className}
      data={series as unknown as Record<string, unknown>[]}
      aspectRatio={chartAspect.wide}
      margin={chartMargins.area}
      status={loading ? "loading" : "ready"}
      loadingLabel={loading ? CHART_LOADING_LABEL : undefined}
    >
      <Grid horizontal stroke={chartColors.grid} />
      <Area dataKey="revenue" fill={chartColors.primary} stroke={chartColors.primary} />
      <XAxis />
      <ChartTooltip
        rows={(point) => [
          {
            label: "Revenue",
            value: formatINRCompact(Number(point.revenue) || 0),
            color: chartColors.primary,
          },
        ]}
      />
    </AreaChart>
  );
}
