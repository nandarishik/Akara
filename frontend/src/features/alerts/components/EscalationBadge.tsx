import { cn } from "@/lib/utils";
import type { EscalationLevel } from "@/features/intelligence/api/types";

const STYLES: Record<EscalationLevel, string> = {
  immediate: "bg-red-500/20 text-red-300 border-red-500/40",
  daily_digest: "bg-white/10 text-text-secondary border-white/15",
  weekly_trend: "bg-white/5 text-text-muted border-white/10",
};

const LABELS: Record<EscalationLevel, string> = {
  immediate: "Immediate",
  daily_digest: "Daily digest",
  weekly_trend: "Weekly trend",
};

export function EscalationBadge({ level }: { level: EscalationLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        STYLES[level],
      )}
    >
      {LABELS[level]}
    </span>
  );
}
