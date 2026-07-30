import { cn } from "@/lib/utils";

type DeltaBadgeProps = {
  value: number | null | undefined;
  suffix?: string;
  className?: string;
};

/** Signed percent or pp change with up/down/neutral styling. */
export function DeltaBadge({ value, suffix = "MoM", className }: DeltaBadgeProps) {
  if (value == null || Number.isNaN(value)) return null;

  const positive = value > 0;
  const negative = value < 0;
  const arrow = positive ? "↑" : negative ? "↓" : "→";
  const label = `${arrow}${Math.abs(value).toFixed(1)}%${suffix ? ` ${suffix}` : ""}`;

  return (
    <span
      className={cn(
        "text-xs font-medium tabular-nums",
        positive && "text-emerald-400",
        negative && "text-red-400",
        !positive && !negative && "text-sa-muted",
        className,
      )}
    >
      {label}
    </span>
  );
}

type DeltaPpProps = {
  value: number | null | undefined;
  label?: string;
  className?: string;
};

/** Percentage-point delta (e.g. margin vs last month). */
export function DeltaPpBadge({ value, label = "vs last month", className }: DeltaPpProps) {
  if (value == null || Number.isNaN(value)) return null;

  const positive = value > 0;
  const negative = value < 0;
  const arrow = positive ? "↑" : negative ? "↓" : "→";

  return (
    <span
      className={cn(
        "text-xs font-medium tabular-nums",
        positive && "text-emerald-400",
        negative && "text-red-400",
        !positive && !negative && "text-sa-muted",
        className,
      )}
    >
      {arrow}
      {Math.abs(value).toFixed(1)}pp {label}
    </span>
  );
}
