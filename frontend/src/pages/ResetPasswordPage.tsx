/**
 * ResetPasswordPage — Sprint Phase 2, Day 3
 * UI Bible P5: reads access_token from URL hash, strength bar, loading state,
 * success with 2s auto-redirect, expired-token error state.
 */

import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"

// ── Password strength (same as SignUpPage) ───────────────────────────────────

type Strength = 0 | 1 | 2 | 3 | 4

function getStrength(pw: string): Strength {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score as Strength
}

const STRENGTH_COLORS: Record<Strength, string> = {
  0: "bg-slate-200",
  1: "bg-red-500",
  2: "bg-[#42A5F5]",
  3: "bg-amber-400",
  4: "bg-emerald-500",
}
const STRENGTH_LABELS: Record<Strength, string> = {
  0: "", 1: "Weak", 2: "Fair", 3: "Good", 4: "Strong",
}

function PasswordStrengthBar({ strength }: { strength: Strength }) {
  if (strength === 0) return null
  return (
    <div className="mt-2">
      <div className="flex gap-1 h-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`flex-1 rounded-full transition-colors ${i <= strength ? STRENGTH_COLORS[strength] : "bg-slate-200"}`} />
        ))}
      </div>
      <p className={`text-xs mt-1 ${strength <= 1 ? "text-red-500" : strength === 2 ? "text-[#42A5F5]" : strength === 3 ? "text-amber-600" : "text-emerald-600"}`}>
        {STRENGTH_LABELS[strength]}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [tokenValid, setTokenValid] = useState<boolean | null>(null) // null = checking
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [confirmError, setConfirmError] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle")

  const strength = getStrength(password)

  // Supabase puts access_token in the URL hash after clicking reset link.
  // We check for an active session (Supabase auto-signs in on token click).
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setTokenValid(!!session)
    })
  }, [])

  // Auto-redirect after success
  useEffect(() => {
    if (status !== "success") return
    const id = setTimeout(() => navigate("/dashboard", { replace: true }), 2000)
    return () => clearTimeout(id)
  }, [status, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setConfirmError("")

    if (password.length < 8) {
      setConfirmError("Password must be at least 8 characters")
      return
    }
    if (password !== confirm) {
      setConfirmError("Passwords do not match")
      return
    }

    setStatus("loading")
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setStatus("success")
    } catch (err: unknown) {
      setConfirmError(err instanceof Error ? err.message : "Failed to update password. Please try again.")
      setStatus("idle")
    }
  }

  // Loading while checking token
  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-[#FAFCFF] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFCFF] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-extrabold text-[#0F3460] font-display">AKARA</Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">

          {/* Expired / invalid token */}
          {!tokenValid && status !== "success" && (
            <div className="text-center">
              <AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-4" aria-hidden="true" />
              <h1 className="text-xl font-extrabold text-slate-900 mb-2">Reset link expired</h1>
              <p className="text-slate-500 text-sm mb-6">
                This reset link has expired or has already been used.
              </p>
              <Link
                to="/forgot-password"
                className="block w-full text-center bg-[#1565C0] hover:bg-[#1976D2] text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Request a new link →
              </Link>
              <p className="text-center text-sm text-slate-400 mt-4">
                <Link to="/login" className="text-[#1565C0] hover:underline">Back to sign in</Link>
              </p>
            </div>
          )}

          {/* Success state */}
          {status === "success" && (
            <div className="text-center">
              <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4" aria-hidden="true" />
              <h1 className="text-xl font-extrabold text-slate-900 mb-2">Password updated</h1>
              <p className="text-slate-500 text-sm" role="status">
                Signing you in...
              </p>
              <div className="mt-4 w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          )}

          {/* Form state */}
          {tokenValid && status !== "success" && (
            <>
              <h1 className="text-xl font-extrabold text-slate-900 mb-6">Set your new password</h1>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 mb-1">
                    New password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                  <PasswordStrengthBar strength={strength} />
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 mb-1">
                    Confirm password <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setConfirmError("") }}
                    aria-describedby={confirmError ? "confirm-error" : undefined}
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                      confirmError ? "border-red-400 bg-red-50" : "border-slate-300"
                    }`}
                  />
                  {confirmError && (
                    <p id="confirm-error" className="text-xs text-red-600 mt-1" role="alert">{confirmError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full bg-[#1565C0] hover:bg-[#1976D2] disabled:opacity-50 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  {status === "loading" ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating password...
                    </span>
                  ) : "Set new password →"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
