import type { CafeAlert } from "@/features/intelligence/api/types";

import { AlertRuleCard } from "./AlertRuleCard";

export function AlertRulesList({
  alerts,
  onEdit,
  onDelete,
}: {
  alerts: CafeAlert[];
  onEdit: (alert: CafeAlert) => void;
  onDelete: (alert: CafeAlert) => void;
}) {
  if (alerts.length === 0) {
    return <p className="text-sm text-text-muted">No café alert rules yet.</p>;
  }
  return (
    <div className="grid gap-3">
      {alerts.map((alert) => (
        <AlertRuleCard key={alert.id} alert={alert} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
