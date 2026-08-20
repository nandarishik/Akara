/**
 * CookieBanner â€” minimal light bar (DPDP / analytics consent).
 */

import { useState } from "react";
import { X } from "lucide-react";
import { AkaraButton, SecondaryButton } from "@/shared/ui/GradientButton";

type ConsentState = "accepted" | "declined" | null;

export function CookieBanner() {
  const [consent, setConsent] = useState<ConsentState>(() => {
    const stored = localStorage.getItem("cookie_consent");
    if (stored === "accepted" || stored === "declined") return stored;
    return null;
  });

  function handleAccept() {
    localStorage.setItem("cookie_consent", "accepted");
    setConsent("accepted");
  }

  function handleDecline() {
    localStorage.setItem("cookie_consent", "declined");
    setConsent("declined");
    try {
      const ph = (window as { posthog?: { opt_out_capturing?: () => void } }).posthog;
      ph?.opt_out_capturing?.();
    } catch {
      /* PostHog not loaded */
    }
  }

  if (consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-surface-border px-4 py-4 shadow-card"
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="flex-1 text-sm text-text-secondary leading-relaxed">
          <span className="font-semibold text-text-primary">We use cookies for product analytics.</span>{" "}
          No advertising cookies.{" "}
          <a href="/privacy" className="text-accent underline underline-offset-2">
            Privacy Policy
          </a>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <SecondaryButton size="sm" onClick={handleDecline}>
            Decline
          </SecondaryButton>
          <AkaraButton size="sm" onClick={handleAccept}>
            Accept
          </AkaraButton>
          <button
            onClick={handleDecline}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-full"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
