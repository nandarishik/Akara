/**
 * ForgotPasswordPage — Sprint Phase 2, Day 3
 * FireAI light auth — AuthLayout + shared Input + AkaraButton.
 * Success state with checkmark, "Link valid for 1 hour", error "No account found".
 */

import { useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import { CheckCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { AuthLayout } from "@/shared/layout/AuthLayout"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { AkaraButton, SecondaryButton } from "@/shared/ui/GradientButton"

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle")

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setStatus("loading")
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) throw err
      setStatus("sent")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      if (msg.toLowerCase().includes("user not found") || msg.toLowerCase().includes("no user found")) {
        setError("No account found with this email")
      } else {
        setError(msg)
      }
      setStatus("idle")
    }
  }

  return (
    <AuthLayout>
      {status === "sent" ? (
        <div className="text-center">
          <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-xl font-extrabold text-text-primary mb-2">Reset link sent</h1>
          <p className="text-text-muted text-sm mb-1">
            Check your email at{" "}
            <span className="font-medium text-text-primary">{email}</span>.
          </p>
          <p className="text-text-muted text-sm mb-6">Link valid for 1 hour.</p>
          <Link to="/login" className="block">
            <SecondaryButton className="w-full">Back to sign in</SecondaryButton>
          </Link>
        </div>
      ) : (
        <>
          <h1 className="text-xl font-extrabold text-text-primary mb-2">Reset your password</h1>
          <p className="text-text-muted text-sm mb-6">Enter your email and we&apos;ll send you a reset link.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-text-secondary">Work email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError("") }}
                aria-describedby={error ? "forgot-error" : undefined}
                className={error ? "border-red-500/50 bg-red-500/10" : undefined}
              />
              {error && (
                <p id="forgot-error" className="text-xs text-red-600" role="alert">{error}</p>
              )}
            </div>

            <AkaraButton type="submit" loading={status === "loading"} className="w-full">
              Send reset link →
            </AkaraButton>
          </form>

          <p className="text-center text-sm text-text-muted mt-4">
            <Link to="/login" className="text-accent hover:underline">Back to sign in</Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}
