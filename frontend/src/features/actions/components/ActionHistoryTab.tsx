import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";

import { useActionHistory } from "../hooks/useActions";
import { TYPE_BADGE_LABELS } from "../types";

export function ActionHistoryTab() {
  const { data, isLoading, error } = useActionHistory();
  const items = data?.items ?? [];

  if (isLoading) return <p className="text-sm text-text-muted">Loading history…</p>;
  if (error) return <p className="text-sm text-amber-300">Could not load history.</p>;
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">No resolved, rejected, expired, or superseded actions yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((rec) => (
        <li key={rec.id}>
          <GlowSurfaceCard padding="md" hover={false} className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-wide text-text-muted">
                {TYPE_BADGE_LABELS[rec.recommendation_type] ?? rec.recommendation_type} · {rec.status}
              </span>
              <span className="text-xs text-text-muted">
                {rec.created_at ? new Date(rec.created_at).toLocaleDateString() : "—"}
              </span>
            </div>
            <p className="text-sm font-medium">{rec.title || "—"}</p>
            {rec.reject_reason ? (
              <p className="text-xs text-text-muted">Reason: {rec.reject_reason}</p>
            ) : null}
          </GlowSurfaceCard>
        </li>
      ))}
    </ul>
  );
}
