import { useState } from "react";

import { formatINR, toNum } from "@/lib/format";
import { Button } from "@/shared/ui/button";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";

import { TYPE_BADGE_LABELS, type RecommendationResponse } from "../types";
import { EvidenceDrillDown } from "./EvidenceDrillDown";

export type RecommendationCardProps = {
  rec: RecommendationResponse;
  onAccept: () => void;
  onSnooze: () => void;
  onReject: () => void;
};

function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function showUncertainty(rec: RecommendationResponse): boolean {
  const days = rec.data_days;
  const label = rec.uncertainty_label ?? "";
  return (typeof days === "number" && days < 30) || label.startsWith("⚠");
}

function confidenceTone(score: number): { bar: string; text: string } {
  if (score > 0.7) return { bar: "bg-emerald-400", text: "text-emerald-300" };
  return { bar: "bg-amber-400", text: "text-amber-300" };
}

export function RecommendationCard({ rec, onAccept, onSnooze, onReject }: RecommendationCardProps) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const score = toNum(rec.confidence_score);
  const pct = Math.round(score * 100);
  const tone = confidenceTone(score);
  const impactMin = rec.expected_impact_min;
  const impactMax = rec.expected_impact_max;
  const typeLabel = TYPE_BADGE_LABELS[rec.recommendation_type] ?? rec.recommendation_type ?? "—";
  const evidence = Array.isArray(rec.evidence) ? rec.evidence : [];

  return (
    <GlowSurfaceCard
      padding="md"
      hover={false}
      accent={score > 0.7 ? "green" : "amber"}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <span className="inline-flex rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium text-text-secondary">
            {typeLabel}
          </span>
          <h3 className="text-base font-semibold text-text-primary">{dash(rec.title)}</h3>
        </div>
        <p className="text-sm font-medium text-text-secondary shrink-0">
          {impactMin == null && impactMax == null
            ? "—"
            : `${formatINR(impactMin ?? 0)} – ${formatINR(impactMax ?? 0)}`}
        </p>
      </div>

      <p className="text-sm text-text-secondary whitespace-pre-wrap">{dash(rec.description)}</p>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Confidence</span>
          <span className={tone.text}>{Number.isFinite(pct) ? `${pct}%` : "—"}</span>
        </div>
        <div
          role="meter"
          aria-label="Confidence"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Number.isFinite(pct) ? pct : 0}
          className="h-2 overflow-hidden rounded-full bg-white/10"
        >
          <div className={`h-full ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
        <span>{rec.data_days == null ? "—" : `${rec.data_days} days of data`}</span>
        {showUncertainty(rec) ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200">
            Limited data
          </span>
        ) : null}
      </div>

      {evidence.length > 0 ? (
        <EvidenceDrillDown evidence={evidence} open={evidenceOpen} onOpenChange={setEvidenceOpen} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onAccept}>
          Accept
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onSnooze}>
          Snooze
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onReject}>
          Reject
        </Button>
      </div>
    </GlowSurfaceCard>
  );
}
