/**
 * UsageBanner — slim copilot quota strip (shell only; no upload/undo counters).
 */

import { AlertTriangle, ArrowRight, Ban } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

import {
  getMonthResetDate,
  getQuotaLevel,
  getUsagePct,
} from "@/lib/api/billing";
import type { UsageResponse } from "@/lib/api/billing";
import { dismissSlot, isSlotDismissed, SLOT_KEYS } from "@/lib/promoSlots";
import { cn } from "@/lib/utils";

interface UsageBannerProps {
  usage: UsageResponse;
  className?: string;
}

const LEVEL_STYLES = {
  ok: {
    bar: "bg-accent",
    track: "bg-surface-raised",
    message: "text-text-muted",
    wrap: "bg-surface-card border-b border-surface-border",
  },
  warning: {
    bar: "bg-amber-500",
    track: "bg-amber-100",
    message: "text-amber-800",
    wrap: "bg-amber-50/80 border-b border-amber-200/60",
  },
  critical: {
    bar: "bg-orange-500",
    track: "bg-orange-100",
    message: "text-orange-800",
    wrap: "bg-orange-50/80 border-b border-orange-200/60",
  },
  blocked: {
    bar: "bg-red-500",
    track: "bg-red-100",
    message: "text-red-800",
    wrap: "bg-red-50/80 border-b border-red-200/60",
  },
};

export function UsageBanner({ usage, className }: UsageBannerProps) {
  const [slotNDismissed, setSlotNDismissed] = useState(() => isSlotDismissed(SLOT_KEYS.N));
  const level = getQuotaLevel(
    usage.copilot_calls_used,
    usage.copilot_calls_limit
  );
  const pct = getUsagePct(usage.copilot_calls_used, usage.copilot_calls_limit);
  const styles = LEVEL_STYLES[level];
  const resetDate = getMonthResetDate();
  const remaining = Math.max(
    0,
    usage.copilot_calls_limit === -1
      ? Infinity
      : usage.copilot_calls_limit - usage.copilot_calls_used
  );
  const displayLimit =
    usage.copilot_calls_limit === -1
      ? "∞"
      : usage.copilot_calls_limit.toLocaleString("en-IN");

  return (
    <div
      className={cn(
        "px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4",
        styles.wrap,
        className
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-caption mb-1">
          <span>Copilot questions</span>
          <span className="tabular-nums">
            {usage.copilot_calls_used.toLocaleString("en-IN")} / {displayLimit}
          </span>
        </div>
        <div
          className={cn("h-1.5 w-full rounded-full overflow-hidden", styles.track)}
        >
          <div
            className={cn("h-full rounded-full transition-all", styles.bar)}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Copilot quota: ${pct}% used`}
          />
        </div>
      </div>

      {level === "ok" && usage.copilot_calls_limit !== -1 && (
        <p className={cn("text-xs shrink-0", styles.message)}>
          {remaining} left · resets {resetDate}
        </p>
      )}

      {level === "warning" && !slotNDismissed && (
        <p className={cn("text-xs flex items-center gap-1.5 shrink-0", styles.message)}>
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {pct}% used · resets {resetDate}
          <button
            type="button"
            className="ml-1 opacity-70 hover:underline"
            onClick={() => {
              dismissSlot(SLOT_KEYS.N);
              setSlotNDismissed(true);
            }}
            aria-label="Dismiss quota warning"
          >
            Dismiss
          </button>
        </p>
      )}

      {level === "critical" && !slotNDismissed && (
        <p className={cn("text-xs flex items-center gap-1.5 shrink-0", styles.message)}>
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {remaining} left ·{" "}
          <Link to="/upgrade" className="font-semibold inline-flex items-center gap-0.5 underline">
            Upgrade <ArrowRight className="h-3 w-3" />
          </Link>
        </p>
      )}

      {level === "blocked" && (
        <p className={cn("text-xs flex items-center gap-1.5 shrink-0 font-medium", styles.message)}>
          <Ban className="h-3.5 w-3.5" aria-hidden />
          Copilot blocked ·{" "}
          <Link to="/upgrade" className="font-semibold underline">
            Upgrade to Pro
          </Link>
        </p>
      )}
    </div>
  );
}
