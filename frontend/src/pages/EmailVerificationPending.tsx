/**
 * EmailVerificationPending — Sprint Phase 2, Day 3
 * UI Bible P3: envelope icon, email shown, 60s resend countdown,
 * "Use a different email" link, "Already verified?" link, cross-device callback.
 */

import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { supabase } from "@/lib/supabase"

const RESEND_COOLDOWN_SECONDS = 60

export function EmailVerificationPending() {
  const location = useLocation()
  const email: string = (location.state as { email?: string })?.email ?? ""

  const [cooldown, setCooldown] = useState(0)
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")

  // Start countdown when resend is triggered
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  async function handleResend() {
    if (!email || cooldown > 0) return
    setResendStatus("sending")
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email })
      if (error) throw error
      setResendStatus("sent")
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch {
      setResendStatus("error")
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFCFF] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 p-10 text-center">

        {/* Envelope icon */}
        <div className="mx-auto mb-6 w-16 h-16 bg-[#EBF5FF] rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-[#1565C0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900 mb-3">Check your email</h1>
        <p className="text-slate-500 mb-2 leading-relaxed">
          We sent a verification link to{" "}
          {email ? (
            <span className="font-medium text-slate-800">{email}</span>
          ) : (
            "your email address"
          )}.
        </p>
        <p className="text-slate-500 mb-8 text-sm">
          Click the link in the email to activate your account.
        </p>

        {/* Resend button with countdown */}
        <button
          onClick={handleResend}
          disabled={cooldown > 0 || resendStatus === "sending" || !email}
          aria-disabled={cooldown > 0}
          className="w-full border-2 border-[#1565C0] text-[#0F3460] hover:bg-[#FAFCFF] disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed py-2.5 rounded-lg font-semibold transition-colors mb-3"
        >
          {resendStatus === "sending" ? "Sending..." :
           cooldown > 0 ? `Resend in ${cooldown}s` :
           "Resend verification email"}
        </button>

        {resendStatus === "sent" && (
          <p className="text-sm text-emerald-600 mb-3" role="status">✓ Verification email resent!</p>
        )}
        {resendStatus === "error" && (
          <p className="text-sm text-red-600 mb-3" role="alert">Failed to resend. Please try again.</p>
        )}

        {/* Use different email */}
        <Link
          to="/signup"
          className="block text-sm text-slate-500 hover:text-[#0F3460] transition-colors mb-4"
        >
          Use a different email →
        </Link>

        {/* Already verified */}
        <p className="text-sm text-slate-400">
          Already verified?{" "}
          <Link to="/login" className="text-[#1565C0] font-medium hover:underline">Sign in →</Link>
        </p>
      </div>
    </div>
  )
}
