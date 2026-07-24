/**
 * TrialWarning — trial countdown banner (light, dismissible per session).
 */

import { useState } from "react";
import { Clock, X } from "lucide-react";
import { Link } from "react-router-dom";

import type { UsageResponse } from "@/lib/api/billing";

interface TrialWarningProps {
  usage: UsageResponse;
  trialEndsAt?: string | null;
}

function getDaysRemaining(trialEndsAt: string): number {
  const end = new Date(trialEndsAt);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
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
      className={`flex items-center justify-between gap-3 px-4 py-2 text-sm border-b ${
        urgency
          ? "bg-orange-50/80 border-orange-200/60 text-orange-800"
          : "bg-accent-soft border-surface-border text-accent-hover"
      }`}
    >
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          {daysLeft !== null ? (
            <>
              Trial ends in{" "}
              <strong>
                {daysLeft} day{daysLeft !== 1 ? "s" : ""}
              </strong>
              .{" "}
            </>
          ) : (
            "You're on a free trial. "
          )}
          <Link to="/upgrade" className="font-semibold underline underline-offset-2">
            Upgrade to Pro
          </Link>
        </span>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss trial warning"
        className="shrink-0 rounded-full p-1 hover:bg-black/5 transition-colors"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
