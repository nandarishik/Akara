import { formatINR } from "@/lib/format";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";

import type { RecommendationResponse } from "../types";

export function OutcomeCard({ rec }: { rec: RecommendationResponse }) {
  const outcome = rec.outcome_measured;
  const delta = outcome?.delta_pct;
  const chip =
    delta == null
      ? "—"
      : delta >= 0
        ? `+${delta.toFixed(1)}%`
        : `${delta.toFixed(1)}%`;

  return (
    <GlowSurfaceCard padding="md" hover={false} className="space-y-3">
      <h3 className="text-base font-semibold">{rec.title || "—"}</h3>
      <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
        <span>
          Expected {outcome ? formatINR(outcome.expected_impact_inr) : "—"}
        </span>
        <span>
          Actual {outcome ? formatINR(outcome.actual_impact_inr) : "—"}
        </span>
        <span
          className={
            delta == null
              ? ""
              : delta >= 0
                ? "text-emerald-300"
                : "text-amber-300"
          }
        >
          {chip}
        </span>
      </div>
      <p className="text-xs text-text-muted whitespace-pre-wrap">
        {outcome?.statistical_note ||
          "14-day pre/post revenue comparison for affected items. No control group."}
      </p>
    </GlowSurfaceCard>
  );
}
