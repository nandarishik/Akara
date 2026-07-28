/**
 * LoginPage — Sprint Phase 2, Day 3
 * FireAI light auth — AuthLayout + shared Input + AkaraButton.
 * Error states: wrong password, account locked, email not verified + resend.
 */

import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { AuthLayout } from "@/components/layout/AuthLayout"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AkaraButton } from "@/components/ui/GradientButton"

import { acceptPendingInvite, persistInviteTokenFromSearch } from "@/lib/teamInvite"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ""

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [notVerified, setNotVerified] = useState(false)
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle")

  useEffect(() => {
    persistInviteTokenFromSearch(window.location.search)
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setNotVerified(false)
    setLoading(true)

    try {
      await signIn(email, password)
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (token) {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const profile = await res.json()
          const invite = await acceptPendingInvite()
          if (invite.ok || profile.tenant_id) {
            navigate("/dashboard", { replace: true })
          } else {
            navigate("/onboarding", { replace: true })
          }
          return
        }
      }
      navigate("/dashboard", { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed"
      const lower = msg.toLowerCase()

      if (lower.includes("email not confirmed") || lower.includes("email_not_confirmed")) {
        setNotVerified(true)
      } else if (lower.includes("too many") || lower.includes("rate limit") || lower.includes("locked")) {
        setError("Too many attempts. Try again in 10 minutes.")
      } else {
        setError("Incorrect email or password")
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleResendVerification() {
    setResendStatus("sending")
    try {
      await supabase.auth.resend({ type: "signup", email })
      setResendStatus("sent")
    } catch {
      setResendStatus("idle")
    }
  }

  return (
    <AuthLayout title="Welcome back">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-text-secondary">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); setNotVerified(false) }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-text-secondary">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError("") }}
              className="pr-10"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 p-2 rounded-md" role="alert">{error}</p>
        )}

        {notVerified && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-md" role="alert">
            <p>Please verify your email first.</p>
            {resendStatus === "sent" ? (
              <p className="mt-1 text-emerald-600">✓ Verification email resent!</p>
            ) : (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendStatus === "sending"}
                className="mt-1 text-accent underline font-medium disabled:opacity-50"
              >
                {resendStatus === "sending" ? "Sending..." : "Resend verification →"}
              </button>
            )}
          </div>
        )}

        <AkaraButton type="submit" loading={loading} className="w-full">
          Sign in →
        </AkaraButton>
      </form>

      <div className="mt-5 space-y-2 text-center text-sm">
        <p>
          <Link to="/forgot-password" className="text-text-muted hover:text-accent transition-colors">
            Forgot your password?
          </Link>
        </p>
        <p>
          <span className="text-text-muted">Don&apos;t have an account? </span>
          <Link to="/signup" className="text-accent font-medium hover:underline">
            Start free →
          </Link>
        </p>
      </div>

      <p className="text-xs text-center text-text-faint mt-8">
        By signing in, you agree to our{" "}
        <Link to="/terms" className="underline hover:text-text-muted">Terms</Link>{" "}
        and{" "}
        <Link to="/privacy" className="underline hover:text-text-muted">Privacy Policy</Link>.
      </p>
    </AuthLayout>
  )
}
