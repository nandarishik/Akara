import { curveLinear } from "@visx/curve";

import {
  LineChart,
  Line,
  Grid,
  XAxis,
  ChartTooltip,
  ProfitLossLine,
  profitLossColor,
  resolveProfitLossTooltipLabel,
  ProjectionLine,
  buildProjectionPath,
} from "@/charts";
import { formatINRCompact } from "@/lib/format";
import {
  chartAspect,
  chartColors,
  chartMargins,
  CHART_LOADING_LABEL,
} from "@/lib/charts/chartTheme";
import {
  toWeekdayProfitLoss,
  toSimulatorProfitLoss,
  toMomentumProjectionSeries,
  toSimulatorProjectionSeries,
  type ProfitLossPoint,
  type AreaPoint,
} from "@/lib/charts/chartAdapters";

interface PnLProps {
  points: ProfitLossPoint[];
  loading?: boolean;
  className?: string;
}

export function WowProfitLossChart({ points, loading, className }: PnLProps) {
  if (!loading && points.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        No variance data
      </div>
    );
  }

  return (
    <LineChart
      className={className}
      data={(points.length ? points : [{ date: new Date(), pnl: 0 }]) as unknown as Record<string, unknown>[]}
      aspectRatio={chartAspect.wide}
      margin={chartMargins.line}
      status={loading ? "loading" : "ready"}
      loadingLabel={loading ? CHART_LOADING_LABEL : undefined}
    >
      <Grid highlightRowValues={[0]} horizontal stroke={chartColors.grid} />
      <Line
        curve={curveLinear}
        dataKey="pnl"
        fadeEdges={false}
        showHighlight={false}
        stroke="transparent"
        strokeWidth={0}
      />
      <ProfitLossLine dataKey="pnl" />
      <XAxis />
      <ChartTooltip
        indicatorColor={(point) => profitLossColor((point.pnl as number) ?? 0)}
        rows={(point) => [
          {
            color: profitLossColor((point.pnl as number) ?? 0),
            label: resolveProfitLossTooltipLabel("Variance"),
            value: formatINRCompact((point.pnl as number) ?? 0),
          },
        ]}
      />
    </LineChart>
  );
}

export function WeekdayPnLChart({
  pulse,
  loading,
  className,
}: {
  pulse: { day: string; revenue: number; trailing_avg: number }[];
  loading?: boolean;
  className?: string;
}) {
  return (
    <WowProfitLossChart
      points={toWeekdayProfitLoss(pulse)}
      loading={loading}
      className={className}
    />
  );
}

export function ScenarioPnLChart({
  baselineDaily,
  projectedDaily,
  loading,
  className,
}: {
  baselineDaily: number;
  projectedDaily: number;
  loading?: boolean;
  className?: string;
}) {
  return (
    <WowProfitLossChart
      points={toSimulatorProfitLoss(baselineDaily, projectedDaily)}
      loading={loading}
      className={className}
    />
  );
}

interface ProjectionProps {
  actual: AreaPoint[];
  endValue: number;
  seriesKey?: string;
  loading?: boolean;
  className?: string;
}

export function MomentumProjectionChart({
  actual,
  endValue,
  seriesKey = "revenue",
  loading,
  className,
}: ProjectionProps) {
  const chartData = actual.map((p) => ({ date: p.date, [seriesKey]: p.revenue }));
  const projectionPath = buildProjectionPath({
    sourceData: chartData,
    seriesKey,
    mode: "target",
    pathDensity: "endpoints",
    horizonPoints: 6,
    endValue,
  });

  return (
    <ProjectionChartInner
      chartData={chartData}
      seriesKey={seriesKey}
      projectionPath={projectionPath}
      loading={loading}
      className={className}
    />
  );
}

export function ScenarioProjectionChart({
  dailyAvg,
  projectedTotal,
  dataDays,
  loading,
  className,
}: {
  dailyAvg: number;
  projectedTotal: number;
  dataDays: number;
  loading?: boolean;
  className?: string;
}) {
  const { actual, projectionPath } = toSimulatorProjectionSeries(
    dailyAvg,
    projectedTotal,
    dataDays,
  );
  const chartData = actual.map((p) => ({ date: p.date, revenue: p.revenue }));
  return (
    <ProjectionChartInner
      chartData={chartData}
      seriesKey="revenue"
      projectionPath={projectionPath}
      loading={loading}
      className={className}
    />
  );
}

export function DebriefMomentumProjectionChart({
  priorRevenue,
  thisRevenue,
  projectedMonth,
  loading,
  className,
}: {
  priorRevenue: number;
  thisRevenue: number;
  projectedMonth: number;
  loading?: boolean;
  className?: string;
}) {
  const { actual, projectionPath } = toMomentumProjectionSeries(
    priorRevenue,
    thisRevenue,
    projectedMonth,
  );
  const chartData = actual.map((p) => ({ date: p.date, revenue: p.revenue }));
  return (
    <ProjectionChartInner
      chartData={chartData}
      seriesKey="revenue"
      projectionPath={projectionPath}
      loading={loading}
      className={className}
    />
  );
}

function ProjectionChartInner({
  chartData,
  seriesKey,
  projectionPath,
  loading,
  className,
}: {
  chartData: Record<string, unknown>[];
  seriesKey: string;
  projectionPath: ReturnType<typeof buildProjectionPath>;
  loading?: boolean;
  className?: string;
}) {
  if (!loading && chartData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        No projection data
      </div>
    );
  }

  return (
    <LineChart
      className={className}
      data={chartData}
      aspectRatio={chartAspect.wide}
      margin={chartMargins.line}
      status={loading ? "loading" : "ready"}
      loadingLabel={loading ? CHART_LOADING_LABEL : undefined}
    >
      <Grid horizontal stroke={chartColors.grid} />
      <Line dataKey={seriesKey} stroke={chartColors.primary} strokeWidth={2} />
      {projectionPath.length >= 2 ? (
        <ProjectionLine data={projectionPath} stroke={chartColors.secondary} strokeDasharray="6 4" />
      ) : null}
      <XAxis />
      <ChartTooltip
        rows={(point) => [
          {
            label: "Value",
            value: formatINRCompact(Number(point[seriesKey]) || 0),
            color: chartColors.primary,
          },
        ]}
      />
    </LineChart>
  );
}
