/**
 * EmailVerificationPending — Sprint Phase 2, Day 3
 * FireAI light auth — AuthLayout + AkaraButton.
 * Envelope icon, email shown, 60s resend countdown, cross-device callback.
 */

import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { AuthLayout } from "@/shared/layout/AuthLayout"
import { SecondaryButton } from "@/shared/ui/GradientButton"

const RESEND_COOLDOWN_SECONDS = 60

export function EmailVerificationPending() {
  const location = useLocation()
  const email: string = (location.state as { email?: string })?.email ?? ""

  const [cooldown, setCooldown] = useState(0)
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  async function handleResend() {
    if (!email || cooldown > 0) return
    setResendStatus("sending")
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      })
      if (error) throw error
      setResendStatus("sent")
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch {
      setResendStatus("error")
    }
  }

  return (
    <AuthLayout size="md">
      <div className="text-center">
        <div className="mx-auto mb-6 w-16 h-16 bg-accent-soft rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>

        <h1 className="text-2xl font-extrabold text-text-primary mb-3">Check your email</h1>
        <p className="text-text-muted mb-2 leading-relaxed">
          We sent a verification link to{" "}
          {email ? (
            <span className="font-medium text-text-primary">{email}</span>
          ) : (
            "your email address"
          )}.
        </p>
        <p className="text-text-muted mb-8 text-sm">
          Click the link in the email to activate your account.
        </p>

        <SecondaryButton
          onClick={handleResend}
          disabled={cooldown > 0 || resendStatus === "sending" || !email}
          loading={resendStatus === "sending"}
          className="w-full mb-3"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
        </SecondaryButton>

        {resendStatus === "sent" && (
          <p className="text-sm text-emerald-600 mb-3" role="status">✓ Verification email resent!</p>
        )}
        {resendStatus === "error" && (
          <p className="text-sm text-red-600 mb-3" role="alert">Failed to resend. Please try again.</p>
        )}

        <Link
          to="/signup"
          className="block text-sm text-text-muted hover:text-accent transition-colors mb-4"
        >
          Use a different email →
        </Link>

        <p className="text-sm text-text-muted">
          Already verified?{" "}
          <Link to="/login" className="text-accent font-medium hover:underline">Sign in →</Link>
        </p>
      </div>
    </AuthLayout>
  )
}
