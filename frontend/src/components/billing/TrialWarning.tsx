/**
 * TrialWarning — sticky top banner for tenants in trial (plan_status === 'trialing').
 *
 * Shows a countdown to trial expiry and an upgrade CTA.
 * Dismissible per session (stored in sessionStorage, not localStorage —
 * so it reappears on each new browser session).
 */

import { useState } from "react";

import { Clock, X } from "lucide-react";

import type { UsageResponse } from "@/lib/api/billing";

interface TrialWarningProps {
  usage: UsageResponse;
  trialEndsAt?: string | null; // ISO date string from tenant metadata
}

function getDaysRemaining(trialEndsAt: string): number {
  const end = new Date(trialEndsAt);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function TrialWarning({ usage, trialEndsAt }: TrialWarningProps) {
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== "undefined"
      ? sessionStorage.getItem("trial_warning_dismissed") === "1"
      : false
  );

  if (usage.plan_status !== "trialing" || dismissed) return null;

  const daysLeft = trialEndsAt ? getDaysRemaining(trialEndsAt) : null;
  const urgency = daysLeft !== null && daysLeft <= 3;

  const handleDismiss = () => {
    sessionStorage.setItem("trial_warning_dismissed", "1");
    setDismissed(true);
  };

  return (
    <div
      role="banner"
      aria-label="Trial period notice"
      className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm
        ${urgency
          ? "bg-orange-50 border-b border-orange-200 text-orange-800"
          : "bg-violet-50 border-b border-violet-200 text-violet-800"
        }`}
    >
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          {daysLeft !== null ? (
            <>
              Your free trial ends in{" "}
              <strong>
                {daysLeft} day{daysLeft !== 1 ? "s" : ""}
              </strong>
              .{" "}
            </>
          ) : (
            "You're on a free trial. "
          )}
          <a
            href="/upgrade"
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Upgrade to Pro
          </a>{" "}
          to keep your data and features.
        </span>
      </div>

      <button
        onClick={handleDismiss}
        aria-label="Dismiss trial warning"
        className="shrink-0 rounded-full p-0.5 hover:bg-black/10 transition-colors"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
