import { cn } from "@/lib/utils";

export type ConfidenceLevel = "high" | "medium" | "low";

const LABELS: Record<ConfidenceLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const STYLES: Record<ConfidenceLevel, string> = {
  high: "text-emerald-700 bg-emerald-50 border-emerald-200",
  medium: "text-amber-800 bg-amber-50 border-amber-200",
  low: "text-stone-700 bg-stone-100 border-stone-300",
};

type Props = {
  confidence: ConfidenceLevel;
  reason?: string | null;
  className?: string;
};

export function ConfidenceIndicator({ confidence, reason, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium",
        STYLES[confidence],
        className,
      )}
      title={reason ?? undefined}
    >
      Confidence: {LABELS[confidence]}
    </span>
  );
}
