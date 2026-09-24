import { Trash2 } from "lucide-react";

import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import { metricLabel } from "@/lib/api/alerts";
import type { CafeAlert } from "@/features/intelligence/api/types";

import { EscalationBadge } from "./EscalationBadge";

export function AlertRuleCard({
  alert,
  onEdit,
  onDelete,
}: {
  alert: CafeAlert;
  onEdit: (alert: CafeAlert) => void;
  onDelete: (alert: CafeAlert) => void;
}) {
  const level = alert.escalation_level ?? "daily_digest";
  return (
    <GlowSurfaceCard padding="md" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{alert.name}</p>
          <p className="text-sm text-text-secondary mt-1">
            {metricLabel(alert.metric)} · {alert.condition} {alert.threshold}
          </p>
        </div>
        <EscalationBadge level={level} />
      </div>
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>
          {[
            alert.channel_email !== false && "Email",
            alert.channel_whatsapp && "WhatsApp",
            alert.channel_in_app !== false && "In-app",
          ]
            .filter(Boolean)
            .join(" · ") || "No channels"}
        </span>
        <div className="flex gap-3">
          <button type="button" className="text-accent underline" onClick={() => onEdit(alert)}>
            Edit
          </button>
          <button type="button" aria-label="Delete alert" onClick={() => onDelete(alert)}>
            <Trash2 className="h-4 w-4 hover:text-red-400" />
          </button>
        </div>
      </div>
    </GlowSurfaceCard>
  );
}
