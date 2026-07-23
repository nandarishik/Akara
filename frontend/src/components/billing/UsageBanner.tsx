/**
 * UsageBanner — quota progress bar and warning messages for the copilot.
 *
 * States:
 *   < 80%   → green bar, no message (default healthy state)
 *   80–89%  → amber bar + "You've used X% of your monthly questions."
 *   90–99%  → orange bar + "Only N questions left. Reset on {date}. [Upgrade →]"
 *   100%    → red bar + "Copilot blocked. Dashboard still works. [Upgrade →]"
 *
 * Also shows daily upload and undo counters below the main bar.
 *
 * All limits come from the backend via useBilling() — none are hardcoded here.
 */

import { AlertTriangle, ArrowRight, Ban, CheckCircle2 } from "lucide-react";

import {
  getMonthResetDate,
  getQuotaLevel,
  getUsagePct,
} from "@/lib/api/billing";
import type { UsageResponse } from "@/lib/api/billing";
import { cn } from "@/lib/utils";

interface UsageBannerProps {
  usage: UsageResponse;
  className?: string;
}

const LEVEL_STYLES = {
  ok:       { bar: "bg-emerald-500", text: "text-emerald-700", bg: "" },
  warning:  { bar: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50 border border-amber-200" },
  critical: { bar: "bg-orange-500",  text: "text-orange-700",  bg: "bg-orange-50 border border-orange-200" },
  blocked:  { bar: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50 border border-red-200" },
};

function QuotaBar({
  used,
  limit,
  label,
}: {
  used: number;
  limit: number;
  label: string;
}) {
  const level = getQuotaLevel(used, limit);
  const pct = getUsagePct(used, limit);
  const styles = LEVEL_STYLES[level];
  const displayLimit = limit === -1 ? "∞" : limit.toLocaleString("en-IN");

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-text-muted">
        <span>{label}</span>
        <span>
          {used.toLocaleString("en-IN")} / {displayLimit}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-neutral-200 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", styles.bar)}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${pct}% used`}
        />
      </div>
    </div>
  );
}

export function UsageBanner({ usage, className }: UsageBannerProps) {
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

  return (
    <div
      className={cn(
        "rounded-xl p-4 space-y-3",
        level !== "ok" && styles.bg,
        className
      )}
    >
      {/* Main copilot quota bar */}
      <QuotaBar
        used={usage.copilot_calls_used}
        limit={usage.copilot_calls_limit}
        label="Copilot questions this month"
      />

      {/* Warning message */}
      {level === "warning" && (
        <div
          className={cn("flex items-start gap-2 text-sm", styles.text)}
          role="status"
          aria-live="polite"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
          <span>
            You've used {pct}% of your monthly copilot questions. Reset on{" "}
            {resetDate}.
          </span>
        </div>
      )}

      {level === "critical" && (
        <div
          className={cn("flex items-start gap-2 text-sm", styles.text)}
          role="alert"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
          <span>
            Only{" "}
            <strong>
              {remaining} question{remaining !== 1 ? "s" : ""}
            </strong>{" "}
            left this month. Reset on {resetDate}.{" "}
            <a
              href="/upgrade"
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              Upgrade <ArrowRight className="h-3 w-3" />
            </a>
          </span>
        </div>
      )}

      {level === "blocked" && (
        <div
          className={cn("flex items-start gap-2 text-sm font-medium", styles.text)}
          role="alert"
          aria-live="assertive"
        >
          <Ban className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
          <span>
            Copilot blocked for this month.{" "}
            <span className="font-normal">
              Your dashboard still works.
            </span>{" "}
            <a
              href="/upgrade"
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              Upgrade to Pro <ArrowRight className="h-3 w-3" />
            </a>
          </span>
        </div>
      )}

      {level === "ok" && usage.copilot_calls_limit !== -1 && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          <span>
            {remaining} question{remaining !== 1 ? "s" : ""} remaining this
            month
          </span>
        </div>
      )}

      {/* Daily counters */}
      <div className="grid grid-cols-2 gap-3 pt-1 text-xs text-text-muted">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">Uploads today</span>
          <span
            className={cn(
              usage.uploads_today >= usage.uploads_per_day && "text-orange-600 font-semibold"
            )}
          >
            {usage.uploads_today} / {usage.uploads_per_day}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">Undos today</span>
          <span
            className={cn(
              usage.undos_today >= usage.undos_per_day && "text-orange-600 font-semibold"
            )}
          >
            {usage.undos_today} / {usage.undos_per_day}
          </span>
        </div>
      </div>
    </div>
  );
}
