import type { MetricEvidencePayload } from "../types";

type Props = {
  evidence: MetricEvidencePayload | null | undefined;
  orderCount?: number;
  dataFrom?: string;
  dataTo?: string;
  lastImportAt?: string | null;
  metricVersion?: number | null;
  confidence?: string | null;
};

export function MetricEvidence({
  evidence,
  orderCount,
  dataFrom,
  dataTo,
  lastImportAt,
  metricVersion,
  confidence,
}: Props) {
  const orders = orderCount ?? evidence?.order_count ?? 0;
  const range =
    evidence?.data_range ?? ([dataFrom, dataTo].filter(Boolean).join(" – ") || "—");
  const last = lastImportAt ?? evidence?.last_import_at;
  const mins = evidence?.last_updated_minutes_ago;
  const versions = evidence?.metric_versions ?? {};
  const ver =
    metricVersion ??
    versions.revenue ??
    versions.food_cost_pct ??
    Object.values(versions)[0] ??
    null;

  return (
    <div className="mt-2 text-xs text-text-muted" data-testid="metric-evidence">
      <p>
        Based on {orders.toLocaleString()} orders
        {range ? ` · ${range}` : ""}
        {last ? ` · last import ${new Date(last).toLocaleString()}` : ""}
        {mins != null ? ` · updated ${mins} min ago` : ""}
        {ver != null ? ` · metric v${ver}` : ""}
        {confidence ? ` · ${confidence}` : ""}
      </p>
      {evidence?.partial ? (
        <p className="mt-1 text-amber-600 dark:text-amber-400" role="status">
          {evidence.partial_message || "Showing partial data (query timed out)"}
        </p>
      ) : null}
    </div>
  );
}
