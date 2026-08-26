import type { HeatmapColumn } from "@/shared/charts/heatmap/heatmap-context";
import type { RadarData, RadarMetric } from "@/shared/charts/radar-context";
import type { RingData } from "@/shared/charts/ring-context";
import { buildProjectionPath } from "@/shared/charts/projection-utils";
import type { UsageResponse } from "@/lib/api/billing";
import { getUsagePct } from "@/lib/api/billing";
import { toNum } from "@/lib/format";
import type { RevenueByDate, ZoneBreakdown } from "@/types/kpi";
import type { SchemeLeakageRow } from "@/features/reports/hooks/useReports";

export interface AreaPoint {
  date: Date;
  revenue: number;
  orders?: number;
}

export interface BarRow {
  name: string;
  value: number;
  label?: string;
}

export interface FunnelStageRow {
  label: string;
  value: number;
  displayValue?: string;
}

export interface ProfitLossPoint {
  date: Date;
  pnl: number;
}

export interface HeatmapCellRow {
  zone: string;
  product_name: string;
  revenue: number;
  order_count: number;
}

export function toAreaSeries(rows: RevenueByDate[]): AreaPoint[] {
  return rows.map((r) => ({
    date: new Date(r.invoice_date),
    revenue: toNum(r.revenue),
    orders: toNum(r.orders),
  }));
}

export function toZoneBarSeries(rows: ZoneBreakdown[], limit = 5): BarRow[] {
  return rows
    .slice()
    .sort((a, b) => toNum(b.revenue) - toNum(a.revenue))
    .slice(0, limit)
    .map((z) => ({
      name: z.zone,
      value: toNum(z.revenue),
      label: formatCompactINR(toNum(z.revenue)),
    }));
}

export function toWeekdayBarSeries(
  pulse: { day: string; weekday: string; revenue: number; trailing_avg: number }[],
): BarRow[] {
  return pulse.map((p) => ({
    name: p.day,
    value: p.revenue,
    label: p.weekday,
  }));
}

export function toMoverBarSeries(
  movers: { name: string; change_inr: number; change_pct: number; direction: "up" | "down" }[],
): BarRow[] {
  return movers.slice(0, 8).map((m) => ({
    name: m.name.length > 18 ? `${m.name.slice(0, 16)}…` : m.name,
    value: m.change_inr,
    label: m.direction,
  }));
}

export function toRouteBarSeries(
  routes: { route: string; revenue: number; orders: number }[],
): BarRow[] {
  return routes.map((r) => ({
    name: r.route.length > 14 ? `${r.route.slice(0, 12)}…` : r.route,
    value: r.revenue,
    label: String(r.orders),
  }));
}

export function toBillingRings(usage: UsageResponse): RingData[] {
  const quotas = [
    { label: "Copilot", used: usage.copilot_calls_used, limit: usage.copilot_calls_limit },
    { label: "Rows", used: usage.rows_used, limit: usage.rows_limit },
    { label: "Uploads", used: usage.uploads_used, limit: usage.uploads_limit },
    { label: "Seats", used: usage.users_used, limit: usage.users_limit },
  ].filter((q) => q.limit !== 0);

  return quotas.map((q, i) => ({
    label: q.label,
    value: q.used,
    maxValue: q.limit === -1 ? Math.max(q.used, 1) : q.limit,
    color: chartRingColor(i),
  }));
}

function chartRingColor(index: number): string {
  const colors = ["#00BCD4", "#42A5F5", "#00E676", "#FFB300", "#B388FF"];
  return colors[index % colors.length]!;
}

export function toBillingGauge(usage: UsageResponse): number {
  const pcts = [
    getUsagePct(usage.copilot_calls_used, usage.copilot_calls_limit),
    getUsagePct(usage.rows_used, usage.rows_limit),
    getUsagePct(usage.uploads_used, usage.uploads_limit),
    getUsagePct(usage.users_used, usage.users_limit),
  ];
  return Math.max(0, ...pcts);
}

export function toLeakageFunnel(rows: SchemeLeakageRow[]): FunnelStageRow[] {
  if (!rows.length) return [];
  const claimed = rows.reduce((s, r) => s + toNum(r.claimed_amount), 0);
  const offtake = rows.reduce((s, r) => s + toNum(r.actual_offtake), 0);
  const leakage = rows.reduce((s, r) => s + toNum(r.leakage_amount), 0);
  return [
    { label: "Claimed", value: claimed, displayValue: formatCompactINR(claimed) },
    { label: "Matched offtake", value: offtake, displayValue: formatCompactINR(offtake) },
    { label: "Leakage", value: leakage, displayValue: formatCompactINR(leakage) },
  ];
}

export function toZoneRadar(rows: ZoneBreakdown[], limit = 5): {
  data: RadarData[];
  metrics: RadarMetric[];
} {
  const top = rows
    .slice()
    .sort((a, b) => toNum(b.revenue) - toNum(a.revenue))
    .slice(0, limit);

  const totalRevenue = top.reduce((s, z) => s + toNum(z.revenue), 0) || 1;
  const totalOrders = top.reduce((s, z) => s + z.order_count, 0) || 1;

  const metrics: RadarMetric[] = [
    { key: "share", label: "Revenue share" },
    { key: "orders", label: "Order share" },
    { key: "aov", label: "AOV index" },
  ];

  const maxAov = Math.max(
    ...top.map((z) => (z.order_count > 0 ? toNum(z.revenue) / z.order_count : 0)),
    1,
  );

  const data: RadarData[] = top.map((z, i) => {
    const aov = z.order_count > 0 ? toNum(z.revenue) / z.order_count : 0;
    return {
      label: z.zone,
      color: chartRingColor(i),
      values: {
        share: (toNum(z.revenue) / totalRevenue) * 100,
        orders: (z.order_count / totalOrders) * 100,
        aov: (aov / maxAov) * 100,
      },
    };
  });

  return { data, metrics };
}

export function toWeekdayProfitLoss(
  pulse: { day: string; revenue: number; trailing_avg: number }[],
): ProfitLossPoint[] {
  const base = new Date();
  return pulse.map((p, i) => ({
    date: new Date(base.getFullYear(), base.getMonth(), base.getDate() - pulse.length + i + 1),
    pnl: p.revenue - p.trailing_avg,
  }));
}

export function toSimulatorProfitLoss(
  baselineDaily: number,
  projectedDaily: number,
  days = 14,
): ProfitLossPoint[] {
  const start = new Date();
  const delta = projectedDaily - baselineDaily;
  return Array.from({ length: days }, (_, i) => {
    const t = days <= 1 ? 1 : i / (days - 1);
    return {
      date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
      pnl: delta * t,
    };
  });
}

export function toMomentumProjectionSeries(
  priorRevenue: number,
  thisRevenue: number,
  projectedMonth: number,
): { actual: AreaPoint[]; projectionPath: ReturnType<typeof buildProjectionPath> } {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const actual = [
    { date: weekAgo, revenue: priorRevenue },
    { date: now, revenue: thisRevenue },
  ];
  const projectionPath = buildProjectionPath({
    sourceData: actual as unknown as Record<string, unknown>[],
    seriesKey: "revenue",
    mode: "target",
    pathDensity: "endpoints",
    horizonPoints: 4,
    endValue: projectedMonth,
  });
  return { actual, projectionPath };
}

export function toSimulatorProjectionSeries(
  dailyAvg: number,
  projectedTotal: number,
  dataDays: number,
): { actual: AreaPoint[]; projectionPath: ReturnType<typeof buildProjectionPath> } {
  const days = Math.max(dataDays, 7);
  const start = new Date();
  start.setDate(start.getDate() - days);
  const actual: AreaPoint[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { date: d, revenue: dailyAvg };
  });
  const projectedDaily = projectedTotal / 30;
  const projectionPath = buildProjectionPath({
    sourceData: actual as unknown as Record<string, unknown>[],
    seriesKey: "revenue",
    mode: "target",
    pathDensity: "endpoints",
    horizonPoints: 7,
    endValue: projectedDaily,
  });
  return { actual, projectionPath };
}

export function toHeatmapColumns(rows: HeatmapCellRow[]): HeatmapColumn[] {
  if (!rows.length) return [];
  const products = [...new Set(rows.map((r) => r.product_name))].slice(0, 8);
  const zones = [...new Set(rows.map((r) => r.zone))].slice(0, 6);
  const maxRev = Math.max(...rows.map((r) => r.revenue), 1);

  return products.map((product, colIdx) => ({
    bin: colIdx,
    bins: zones.map((zone, rowIdx) => {
      const cell = rows.find((r) => r.product_name === product && r.zone === zone);
      const revenue = cell ? cell.revenue : 0;
      const level = Math.min(4, Math.max(0, Math.round((revenue / maxRev) * 4)));
      const date = new Date(2024, 0, 1 + colIdx * 7 + rowIdx);
      return { bin: rowIdx, count: level, date };
    }),
  }));
}

export function simulatorConfidenceScore(
  baseline: number,
  lower: number,
  upper: number,
): number {
  if (baseline <= 0) return 50;
  const width = Math.max(0, upper - lower);
  const relative = width / baseline;
  return Math.round(Math.max(0, Math.min(100, 100 - relative * 50)));
}

function formatCompactINR(v: number): string {
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(1)}Cr`;
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${Math.round(v)}`;
}
