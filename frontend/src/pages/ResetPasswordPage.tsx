/**
 * ResetPasswordPage — Sprint Phase 2, Day 3
 * FireAI light auth — AuthLayout + shared Input + AkaraButton.
 * Reads access_token from URL hash, strength bar, success auto-redirect, expired-token error.
 */

import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { AuthLayout } from "@/components/layout/AuthLayout"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AkaraButton } from "@/components/ui/GradientButton"
import { cn } from "@/lib/utils"

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
  0: "bg-surface-raised",
  1: "bg-red-500",
  2: "bg-accent",
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
          <div key={i} className={cn("flex-1 rounded-full transition-colors", i <= strength ? STRENGTH_COLORS[strength] : "bg-surface-raised")} />
        ))}
      </div>
      <p className={cn(
        "text-xs mt-1",
        strength <= 1 ? "text-red-500" : strength === 2 ? "text-accent" : strength === 3 ? "text-amber-600" : "text-emerald-600"
      )}>
        {STRENGTH_LABELS[strength]}
      </p>
    </div>
  )
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [confirmError, setConfirmError] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle")

  const strength = getStrength(password)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setTokenValid(!!session)
    })
  }, [])

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

  if (tokenValid === null) {
    return (
      <AuthLayout>
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      {!tokenValid && status !== "success" && (
        <div className="text-center">
          <AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-xl font-extrabold text-text-primary mb-2">Reset link expired</h1>
          <p className="text-text-muted text-sm mb-6">
            This reset link has expired or has already been used.
          </p>
          <Link to="/forgot-password" className="block">
            <AkaraButton className="w-full">Request a new link →</AkaraButton>
          </Link>
          <p className="text-center text-sm text-text-muted mt-4">
            <Link to="/login" className="text-accent hover:underline">Back to sign in</Link>
          </p>
        </div>
      )}

      {status === "success" && (
        <div className="text-center">
          <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-xl font-extrabold text-text-primary mb-2">Password updated</h1>
          <p className="text-text-muted text-sm" role="status">Signing you in...</p>
          <div className="mt-4 w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      )}

      {tokenValid && status !== "success" && (
        <>
          <h1 className="text-xl font-extrabold text-text-primary mb-6">Set your new password</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-text-secondary">
                New password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              <PasswordStrengthBar strength={strength} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-text-secondary">
                Confirm password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="Repeat password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setConfirmError("") }}
                aria-describedby={confirmError ? "confirm-error" : undefined}
                className={confirmError ? "border-red-400 bg-red-50" : undefined}
              />
              {confirmError && (
                <p id="confirm-error" className="text-xs text-red-600" role="alert">{confirmError}</p>
              )}
            </div>

            <AkaraButton type="submit" loading={status === "loading"} className="w-full">
              Set new password →
            </AkaraButton>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
