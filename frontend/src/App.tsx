import { useEffect, useState } from "react"

import { AppProviders } from "@/app/providers"
import { AppRouter } from "@/app/router"
import { EnvironmentBanner } from "@/shared/EnvironmentBanner"
import { onApiError, type ApiErrorEvent } from "@/lib/api"
import { AkaraButton } from "@/shared/ui/GradientButton"

/**
 * Phase 4 error overlays — subscribed via onApiError (must stay in App.tsx per contract).
 * Uses location assign for session_expired so we do not require a Router parent.
 */
function ApiErrorOverlays() {
  const [event, setEvent] = useState<ApiErrorEvent | null>(null)

  useEffect(() => {
    return onApiError((e) => setEvent(e))
  }, [])

  if (!event) return null

  if (event.type === "session_expired") {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">
        <div className="max-w-md rounded-xl border border-white/10 bg-[#0a0a0a] p-6 text-center space-y-4">
          <p className="text-white font-medium">Your session expired. Sign in again.</p>
          <AkaraButton
            onClick={() => {
              setEvent(null)
              window.location.assign("/login")
            }}
          >
            Sign in
          </AkaraButton>
        </div>
      </div>
    )
  }

  const bannerText =
    event.type === "quota_exceeded"
      ? "Plan limit reached — upgrade to continue."
      : event.type === "plan_feature_blocked"
        ? "This feature is not on your plan."
        : event.type === "role_forbidden"
          ? event.message
          : event.type === "rate_limited"
            ? `Too many requests. Try again in ${event.retry_after}s.`
            : null

  const href =
    event.type === "quota_exceeded"
      ? event.upgrade_url || "/upgrade"
      : event.type === "plan_feature_blocked"
        ? "/upgrade"
        : null

  if (!bannerText) return null

  return (
    <div className="fixed top-0 inset-x-0 z-[190] bg-amber-600 text-white text-center text-sm py-2 px-4 font-mono">
      {bannerText}{" "}
      {href && (
        <a href={href} className="underline font-semibold" onClick={() => setEvent(null)}>
          Continue
        </a>
      )}
      <button type="button" className="ml-3 underline" onClick={() => setEvent(null)}>
        Dismiss
      </button>
    </div>
  )
}

export default function App() {
  return (
    <AppProviders>
      <EnvironmentBanner />
      <ApiErrorOverlays />
      <AppRouter />
    </AppProviders>
  )
}
