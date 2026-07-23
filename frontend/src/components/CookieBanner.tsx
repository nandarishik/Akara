/**
 * CookieBanner — Sprint Phase 2, Day 3
 * DPDP Act 2023 / GDPR compliant cookie consent banner.
 * "We use cookies for product analytics. No advertising cookies."
 * Stores choice in localStorage under "cookie_consent".
 * On decline: calls posthog.opt_out_capturing() if PostHog is available (wired Day 13).
 */

import { useEffect, useState } from "react"
import { X } from "lucide-react"

type ConsentState = "accepted" | "declined" | null

export function CookieBanner() {
  const [consent, setConsent] = useState<ConsentState>(() => {
    const stored = localStorage.getItem("cookie_consent")
    if (stored === "accepted" || stored === "declined") return stored
    return null
  })

  useEffect(() => {
    if (consent !== null) return
  }, [consent])

  function handleAccept() {
    localStorage.setItem("cookie_consent", "accepted")
    setConsent("accepted")
  }

  function handleDecline() {
    localStorage.setItem("cookie_consent", "declined")
    setConsent("declined")

    // Opt out of PostHog analytics.
    // PostHog is integrated on Day 13; guard prevents a crash before then.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ph = (window as any).posthog
      if (ph && typeof ph.opt_out_capturing === "function") {
        ph.opt_out_capturing()
      }
    } catch {
      // Ignore -- PostHog not loaded yet
    }
  }

  // Don't render if consent is already recorded
  if (consent !== null) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 text-white px-4 py-4 shadow-lg"
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 text-sm leading-relaxed">
          <p>
            <span className="font-semibold">We use cookies for product analytics.</span>
            {" "}No advertising cookies. We use PostHog to understand how you use AKARA so we can improve it.{" "}
            <a href="/privacy" className="underline hover:text-violet-300">Learn more in our Privacy Policy</a>.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={handleDecline} className="text-sm text-slate-300 hover:text-white border border-slate-600 px-4 py-2 rounded-lg transition-colors">
            Decline analytics
          </button>
          <button onClick={handleAccept} className="text-sm bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors">
            Accept
          </button>
          {/* Dismiss (treated as decline) */}
          <button onClick={handleDecline} className="text-slate-400 hover:text-white" aria-label="Dismiss cookie banner">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
