import { useMemo } from "react";
import { Bar } from "@visx/shape";
import { scaleBand, scaleLinear } from "@visx/scale";

import type { SyncLogRow } from "../api/types";

type Props = {
  logs: SyncLogRow[];
  width?: number;
  height?: number;
};

type DayBucket = { day: string; rows: number; failures: number };

function bucketLast30Days(logs: SyncLogRow[]): DayBucket[] {
  const now = new Date();
  const days: DayBucket[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ day: key, rows: 0, failures: 0 });
  }
  const map = new Map(days.map((b) => [b.day, b]));
  for (const log of logs) {
    const key = log.started_at.slice(0, 10);
    const bucket = map.get(key);
    if (!bucket) continue;
    bucket.rows += log.rows_synced ?? 0;
    bucket.failures += log.rows_failed ?? 0;
  }
  return days;
}

export function SyncHealthChart({ logs, width = 560, height = 120 }: Props) {
  const buckets = useMemo(() => bucketLast30Days(logs), [logs]);
  const xScale = scaleBand({
    domain: buckets.map((b) => b.day),
    range: [0, width],
    padding: 0.15,
  });
  const max = Math.max(...buckets.map((b) => b.rows), 1);
  const yScale = scaleLinear({ domain: [0, max], range: [height, 0] });

  return (
    <div data-testid="sync-health-chart" className="overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label="30-day sync health">
        {buckets.map((b) => {
          const barH = height - (yScale(b.rows) ?? 0);
          const x = xScale(b.day) ?? 0;
          const bw = xScale.bandwidth();
          const fill = b.failures > 0 ? "#ef4444" : "#22c55e";
          return (
            <Bar
              key={b.day}
              x={x}
              y={yScale(b.rows)}
              width={bw}
              height={Math.max(barH, 0)}
              fill={fill}
              opacity={b.rows === 0 ? 0.2 : 0.85}
            />
          );
        })}
      </svg>
      <p className="mt-1 text-xs text-text-muted">Last 30 days — green success volume, red when failures</p>
    </div>
  );
}
