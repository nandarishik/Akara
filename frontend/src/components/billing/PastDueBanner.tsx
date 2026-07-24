/**
 * PastDueBanner — sticky top banner for plan_status === 'past_due'.
 *
 * This renders as a non-dismissible critical alert at the top of the app.
 * It blocks actions gracefully — the user can still see their dashboard
 * and data, but cannot use copilot or run new imports until payment is resolved.
 */

import { AlertCircle } from "lucide-react";

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
      aria-label="Payment overdue notice"
      className="flex items-center justify-between gap-3 px-4 py-3 text-sm
        bg-red-50/95 border-b border-red-200 text-red-900"
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
        <span>
          <strong>Payment overdue.</strong> Your account is on hold — new
          copilot questions and imports are paused.{" "}
          <a
            href="/billing"
            className="font-semibold underline underline-offset-2 hover:opacity-80 text-[#1565C0]"
          >
            Update payment method
          </a>{" "}
          to restore full access. Your data is safe.
        </span>
      </div>
    </div>
  );
}
