/**
 * PastDueBanner — payment overdue notice (light subtle alert).
 */

import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

import type { UsageResponse } from "@/lib/api/billing";

interface PastDueBannerProps {
  usage: UsageResponse;
}

export function PastDueBanner({ usage }: PastDueBannerProps) {
  if (usage.plan_status !== "past_due") return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-center gap-2 px-4 py-2.5 text-sm border-b border-red-200/60 bg-red-50/70 text-red-800"
    >
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        <strong>Payment overdue.</strong> Copilot and imports are paused.{" "}
        <Link to="/billing" className="font-semibold text-accent underline underline-offset-2">
          Update payment
        </Link>{" "}
        — your data is safe.
      </span>
    </div>
  );
}
