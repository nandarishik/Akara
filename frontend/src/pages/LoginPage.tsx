/**
 * LoginPage — Sprint Phase 2, Day 3
 * UI Bible P6: desktop split layout (navy→blue gradient left / white form right),
 * links to /signup and /forgot-password,
 * error states: wrong password, account locked, email not verified + resend.
 */

import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"

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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setNotVerified(false)
    setLoading(true)

    try {
      await signIn(email, password)
      navigate("/dashboard")
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
    <div className="min-h-screen flex">
      {/* ── Left panel (desktop only) ─────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-center px-12 flex-1 text-white"
        style={{ background: "linear-gradient(160deg, #020B18 0%, #0F3460 45%, #1565C0 100%)" }}
      >
        <div className="max-w-md">
          <h1
            className="text-4xl font-extrabold mb-4 font-display"
            style={{
              background: "linear-gradient(135deg, #42A5F5, #90CAF9)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            AKARA
          </h1>
          <blockquote className="text-3xl font-bold leading-tight mb-4">
            &quot;Know your business in 30 seconds.&quot;
          </blockquote>
          <p className="mb-8 text-lg" style={{ color: "#90CAF9" }}>AI analytics built for Indian distributors.</p>

          <ul className="space-y-3 mb-10">
            {[
              "Ask in Hindi or English",
              "Weekly brief on WhatsApp",
              "Free to start",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-blue-100">
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-sm flex-shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>

          {/* Phone mockup */}
          <div className="w-36 h-64 rounded-3xl border-4 border-white/20 bg-white/10 flex items-center justify-center text-white/40 text-sm text-center p-3">
            📱 WhatsApp brief
          </div>
        </div>
      </div>

      {/* ── Right panel — form ────────────────────────────────────────────── */}
      <div className="flex flex-col justify-center items-center flex-1 px-4 py-12 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile-only logo */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="text-3xl font-extrabold text-[#0F3460] font-display">AKARA</Link>
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 mb-8">Welcome back</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); setNotVerified(false) }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError("") }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Generic error */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded" role="alert">{error}</p>
            )}

            {/* Email not verified */}
            {notVerified && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded" role="alert">
                <p>Please verify your email first.</p>
                {resendStatus === "sent" ? (
                  <p className="mt-1 text-emerald-600">✓ Verification email resent!</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendStatus === "sending"}
                    className="mt-1 text-[#0F3460] underline font-medium disabled:opacity-50"
                  >
                    {resendStatus === "sending" ? "Sending..." : "Resend verification →"}
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1565C0] hover:bg-[#1976D2] disabled:opacity-50 text-white py-3 rounded-lg font-semibold transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : "Sign in →"}
            </button>
          </form>

          {/* Links */}
          <div className="mt-5 space-y-2 text-center text-sm">
            <p>
              <Link to="/forgot-password" className="text-slate-500 hover:text-[#0F3460] transition-colors">
                Forgot your password?
              </Link>
            </p>
            <p>
              <span className="text-slate-400">Don't have an account? </span>
              <Link to="/signup" className="text-blue-600 font-medium hover:underline">
                Start free →
              </Link>
            </p>
          </div>

          <p className="text-xs text-center text-slate-300 mt-8">
            By signing in, you agree to our{" "}
            <Link to="/terms" className="underline hover:text-slate-500">Terms</Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline hover:text-slate-500">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
