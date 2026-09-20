import { useMemo } from "react";
import { Bar } from "@visx/shape";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Pie } from "@visx/shape";
import { Group } from "@visx/group";

import { formatINR } from "@/lib/format";
import type { ChannelSlice, ItemRow, TrendPoint } from "../types";

const DAYPARTS = ["breakfast", "lunch", "evening", "dinner", "late_night"] as const;

export function CafeRevenueTrendChart({
  points,
  width = 480,
  height = 160,
}: {
  points: TrendPoint[];
  width?: number;
  height?: number;
}) {
  const xScale = scaleBand({
    domain: points.map((p) => p.date),
    range: [32, width - 8],
    padding: 0.2,
  });
  const max = Math.max(
    ...points.map((p) => Math.max(p.revenue ?? 0, p.prior_week_revenue ?? 0)),
    1,
  );
  const yScale = scaleLinear({ domain: [0, max], range: [height - 20, 8] });

  return (
    <div data-testid="cafe-revenue-trend">
      <h3 className="mb-2 text-sm font-medium text-text-primary">Revenue (7 days)</h3>
      <svg width={width} height={height} role="img" aria-label="7-day revenue trend">
        {points.map((p) => {
          const x = xScale(p.date) ?? 0;
          const bw = xScale.bandwidth() / 2;
          const h = height - 20 - (yScale(p.revenue ?? 0) ?? 0);
          const h2 = height - 20 - (yScale(p.prior_week_revenue ?? 0) ?? 0);
          return (
            <g key={p.date}>
              <Bar
                x={x}
                y={yScale(p.prior_week_revenue ?? 0)}
                width={bw}
                height={Math.max(h2, 0)}
                fill="#94a3b8"
                opacity={0.45}
              />
              <Bar
                x={x + bw}
                y={yScale(p.revenue ?? 0)}
                width={bw}
                height={Math.max(h, 0)}
                fill="#03B3C3"
              />
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-text-muted">Teal = this week · Grey = prior week</p>
    </div>
  );
}

const DONUT_COLORS = ["#03B3C3", "#22c55e", "#f97316", "#a855f7", "#64748b"];

export function ChannelBreakdownDonut({
  channels,
  width = 200,
  height = 200,
}: {
  channels: ChannelSlice[];
  width?: number;
  height?: number;
}) {
  const data = useMemo(
    () => channels.filter((c) => (c.revenue ?? 0) > 0 || (c.pct ?? 0) > 0),
    [channels],
  );
  const radius = Math.min(width, height) / 2 - 8;
  const center = { x: width / 2, y: height / 2 };

  if (data.length === 0) {
    return <p className="text-sm text-text-muted">No channel mix yet.</p>;
  }

  return (
    <div data-testid="channel-donut">
      <h3 className="mb-2 text-sm font-medium text-text-primary">Channel mix</h3>
      <svg width={width} height={height}>
        <Group top={center.y} left={center.x}>
          <Pie
            data={data}
            pieValue={(d) => d.pct ?? d.revenue ?? 0}
            outerRadius={radius}
            innerRadius={radius * 0.55}
          >
            {(pie) =>
              pie.arcs.map((arc, i) => (
                <path
                  key={arc.data.channel}
                  d={pie.path(arc) || undefined}
                  fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                />
              ))
            }
          </Pie>
        </Group>
      </svg>
      <ul className="mt-1 space-y-0.5 text-xs text-text-muted">
        {data.map((c, i) => (
          <li key={c.channel}>
            <span
              className="mr-1 inline-block h-2 w-2 rounded-full"
              style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            {c.channel} {c.pct != null ? `${c.pct.toFixed(0)}%` : formatINR(c.revenue ?? 0)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ItemPerformanceTable({ items }: { items: ItemRow[] }) {
  const top = items.filter((i) => i.rank === "top").slice(0, 5);
  const bottom = items.filter((i) => i.rank === "bottom").slice(0, 5);

  return (
    <div data-testid="item-performance" className="grid gap-4 sm:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-medium text-text-primary">Top items</h3>
        <ItemList rows={top} />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium text-text-primary">Bottom items</h3>
        <ItemList rows={bottom} />
      </div>
    </div>
  );
}

function ItemList({ rows }: { rows: ItemRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-text-muted">No items yet.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {rows.map((r) => (
        <li key={`${r.rank}-${r.item_name}`} className="flex justify-between gap-2">
          <span className="text-text-primary">{r.item_name}</span>
          <span className="text-text-muted">
            {r.contribution_margin != null ? formatINR(r.contribution_margin) : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DaypartHeatmap({
  cells,
}: {
  cells: { daypart: string; day_of_week: number; orders: number | null; revenue: number | null }[];
}) {
  const max = Math.max(...cells.map((c) => c.orders ?? 0), 1);
  const byKey = new Map(cells.map((c) => [`${c.daypart}-${c.day_of_week}`, c]));

  return (
    <div data-testid="daypart-heatmap" className="overflow-x-auto">
      <h3 className="mb-2 text-sm font-medium text-text-primary">Daypart heatmap</h3>
      <table className="text-xs">
        <thead>
          <tr>
            <th className="p-1 text-left text-text-muted" />
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <th key={d} className="p-1 font-medium text-text-muted">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYPARTS.map((dp) => (
            <tr key={dp}>
              <td className="p-1 capitalize text-text-muted">{dp.replace("_", " ")}</td>
              {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                const cell = byKey.get(`${dp}-${d}`);
                const v = cell?.orders ?? 0;
                const intensity = v / max;
                return (
                  <td key={d} className="p-0.5">
                    <div
                      className="flex h-8 w-10 items-center justify-center rounded-sm text-[10px] text-white"
                      style={{
                        backgroundColor: `rgba(3, 179, 195, ${0.15 + intensity * 0.85})`,
                      }}
                      title={`${v} orders`}
                    >
                      {v || ""}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LabourCostTrend({ points }: { points: TrendPoint[] }) {
  const width = 420;
  const height = 100;
  const xScale = scaleBand({
    domain: points.map((p) => p.date),
    range: [0, width],
    padding: 0.2,
  });
  const max = Math.max(...points.map((p) => p.labour_cost_pct ?? 0), 1);
  const yScale = scaleLinear({ domain: [0, max], range: [height, 0] });

  return (
    <div data-testid="labour-cost-trend">
      <h3 className="mb-2 text-sm font-medium text-text-primary">Labour cost %</h3>
      <svg width={width} height={height}>
        {points.map((p) => {
          const v = p.labour_cost_pct;
          if (v == null) return null;
          return (
            <Bar
              key={p.date}
              x={xScale(p.date)}
              y={yScale(v)}
              width={xScale.bandwidth()}
              height={height - (yScale(v) ?? 0)}
              fill="#a855f7"
              opacity={0.8}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function InventoryMetricsRow({
  waste,
  turnover,
  stockout,
}: {
  waste?: number | null;
  turnover?: number | null;
  stockout?: number | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-3" data-testid="inventory-metrics">
      <InvCard label="Waste" value={waste} suffix="" />
      <InvCard label="Inventory turnover" value={turnover} suffix="x" />
      <InvCard label="Stockout rate" value={stockout} suffix="%" />
    </div>
  );
}

function InvCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value?: number | null;
  suffix: string;
}) {
  return (
    <div className="rounded-lg border border-border-subtle p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-lg font-medium text-text-primary">
        {value == null ? "—" : `${value}${suffix}`}
      </p>
    </div>
  );
}
