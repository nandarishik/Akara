import { ConfidenceIndicator, type ConfidenceLevel } from "./ConfidenceIndicator";

export type CopilotEvidencePayload = {
  data_range?: string | null;
  order_count?: number | null;
  last_import_at?: string | null;
  last_updated_minutes_ago?: number | null;
  sql_summary?: string | null;
  metric_versions?: Record<string, number> | null;
  confidence?: ConfidenceLevel | string | null;
  confidence_reason?: string | null;
  warnings?: string[] | null;
};

type Props = {
  evidence: CopilotEvidencePayload;
};

function isConfidence(v: unknown): v is ConfidenceLevel {
  return v === "high" || v === "medium" || v === "low";
}

export function CopilotEvidence({ evidence }: Props) {
  const confidence = isConfidence(evidence.confidence) ? evidence.confidence : null;
  const warnings = evidence.warnings?.filter(Boolean) ?? [];

  return (
    <footer className="mt-2 space-y-1 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
      <div className="flex flex-wrap items-center gap-2">
        {confidence ? (
          <ConfidenceIndicator
            confidence={confidence}
            reason={evidence.confidence_reason}
          />
        ) : null}
        {evidence.order_count != null ? (
          <span>Based on {evidence.order_count.toLocaleString()} orders</span>
        ) : null}
        {evidence.data_range ? <span>Range: {evidence.data_range}</span> : null}
        {evidence.last_updated_minutes_ago != null ? (
          <span>Updated {evidence.last_updated_minutes_ago}m ago</span>
        ) : null}
      </div>
      {evidence.sql_summary ? (
        <p className="text-[11px] leading-snug">{evidence.sql_summary}</p>
      ) : null}
      {warnings.map((w) => (
        <p key={w} className="text-amber-700">
          {w}
        </p>
      ))}
    </footer>
  );
}
