"use client";

import {
  HeatmapChart,
  HeatmapCells,
  HeatmapXAxis,
  HeatmapYAxis,
  HeatmapTooltip,
  HeatmapLegend,
  HeatmapInteractionProvider,
  HeatmapInteractionBoundary,
  HEATMAP_DEFAULT_LEVEL_STYLES,
} from "@/charts/heatmap";
import type { HeatmapColumn } from "@/charts/heatmap/heatmap-context";
import { toHeatmapColumns, type HeatmapCellRow } from "@/lib/charts/chartAdapters";
import { CHART_LOADING_LABEL } from "@/lib/charts/chartTheme";

interface Props {
  rows?: HeatmapCellRow[];
  columns?: HeatmapColumn[];
  loading?: boolean;
  className?: string;
}

export function SalesHeatmapChart({ rows, columns, loading, className }: Props) {
  const data = columns ?? (rows ? toHeatmapColumns(rows) : []);

  if (!loading && data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        No product × zone activity yet
      </div>
    );
  }

  return (
    <HeatmapInteractionProvider>
      <HeatmapInteractionBoundary>
        <div className={`flex w-full flex-col items-stretch gap-3 ${className ?? ""}`}>
          <HeatmapChart
            className="w-full"
            data={data.length ? data : [{ bin: 0, bins: [{ bin: 0, count: 0, date: new Date() }] }]}
            layout="fluid"
            status={loading ? "loading" : "ready"}
            loadingLabel={loading ? CHART_LOADING_LABEL : undefined}
          >
            <HeatmapCells inactiveOpacity={1} inactiveScale={1} />
            <HeatmapXAxis />
            <HeatmapYAxis />
            <HeatmapTooltip instant />
          </HeatmapChart>
          <HeatmapLegend
            inactiveOpacity={1}
            inactiveScale={1}
            levelStyles={HEATMAP_DEFAULT_LEVEL_STYLES}
          />
        </div>
      </HeatmapInteractionBoundary>
    </HeatmapInteractionProvider>
  );
}
