import { Link } from "react-router-dom";

import { formatINR } from "@/lib/format";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";

import type { ActionsSummary } from "../types";

export type PendingActionsWidgetProps = {
  summary: ActionsSummary | null;
  loading: boolean;
};

export function PendingActionsWidget({ summary, loading }: PendingActionsWidgetProps) {
  if (loading && !summary) return null;
  if (!summary) return null;

  const top = summary.highest_confidence;

  return (
    <GlowSurfaceCard padding="md" className="space-y-3" hover={false}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Pending actions</h2>
        <Link to="/actions" className="text-sm text-accent hover:underline">
          Review all recommendations →
        </Link>
      </div>
      <p className="text-sm text-text-secondary">
        <span className="font-semibold text-text-primary">{summary.open_count}</span> open
        {top ? (
          <>
            {" · "}
            {top.title} ({formatINR(top.expected_impact_min ?? 0)}–{formatINR(top.expected_impact_max ?? 0)})
          </>
        ) : null}
      </p>
    </GlowSurfaceCard>
  );
}
