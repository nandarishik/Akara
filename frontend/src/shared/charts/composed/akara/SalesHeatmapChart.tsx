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
} from "@/shared/charts/heatmap";
import type { HeatmapColumn } from "@/shared/charts/heatmap/heatmap-context";
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

  if (loading && data.length === 0) {
    return (
      <div className={`flex h-full min-h-[200px] items-center justify-center ${className ?? ""}`}>
        <div className="skeleton h-full w-full rounded-lg" aria-label={CHART_LOADING_LABEL} />
      </div>
    );
  }

  if (!loading && data.length === 0) {
    return (
      <div className={`flex h-full items-center justify-center text-sm text-text-muted ${className ?? ""}`}>
        No product × zone activity yet
      </div>
    );
  }

  return (
    <HeatmapInteractionProvider>
      <HeatmapInteractionBoundary>
        <div className={`flex h-full min-h-0 w-full flex-col gap-3 ${className ?? ""}`}>
          <HeatmapChart
            className="h-full min-h-0 w-full flex-1"
            data={data}
            layout="fill"
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
            className="shrink-0"
          />
        </div>
      </HeatmapInteractionBoundary>
    </HeatmapInteractionProvider>
  );
}
