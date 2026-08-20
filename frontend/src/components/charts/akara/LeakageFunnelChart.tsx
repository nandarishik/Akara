import { FunnelChart } from "@/charts";
import type { FunnelStageRow } from "@/lib/charts/chartAdapters";
import { toLeakageFunnel } from "@/lib/charts/chartAdapters";
import type { SchemeLeakageRow } from "@/features/reports/hooks/useReports";
import { chartColors } from "@/lib/charts/chartTheme";

interface Props {
  rows?: SchemeLeakageRow[];
  stages?: FunnelStageRow[];
  className?: string;
}

export function LeakageFunnelChart({ rows, stages, className }: Props) {
  const data = stages ?? (rows ? toLeakageFunnel(rows) : []);

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        No scheme leakage data
      </div>
    );
  }

  return (
    <FunnelChart
      className={className}
      data={data}
      color={chartColors.primary}
      layers={3}
      orientation="vertical"
    />
  );
}
