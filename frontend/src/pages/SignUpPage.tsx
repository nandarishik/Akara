/**
 * SignUpPage — Sprint Phase 2, Day 3
 * FireAI light auth — AuthLayout + shared Input + AkaraButton.
 * All fields, 4-segment strength bar, 2 consent checkboxes, Turnstile, social proof.
 */

import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "@/components/ui/toast"
import { AuthLayout } from "@/components/layout/AuthLayout"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AkaraButton } from "@/components/ui/GradientButton"
import { cn } from "@/lib/utils"

// ── Turnstile — conditionally rendered when env key is present ───────────────
let TurnstileWidget: React.ComponentType<{
  siteKey: string
  onSuccess: (token: string) => void
  onError: () => void
}> | null = null

// ── Password strength ────────────────────────────────────────────────────────

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

const STRENGTH_LABELS: Record<Strength, string> = {
  0: "",
  1: "Weak",
  2: "Fair",
  3: "Good",
  4: "Strong",
}
const STRENGTH_COLORS: Record<Strength, string> = {
  0: "bg-surface-raised",
  1: "bg-red-500",
  2: "bg-accent",
  3: "bg-amber-400",
  4: "bg-emerald-500",
}

function PasswordStrengthBar({ strength }: { strength: Strength }) {
  if (strength === 0) return null
  return (
    <div className="mt-2">
      <div className="flex gap-1 h-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-full transition-colors",
              i <= strength ? STRENGTH_COLORS[strength] : "bg-surface-raised"
            )}
          />
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

// ─────────────────────────────────────────────────────────────────────────────

export function SignUpPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [agreedTos, setAgreedTos] = useState(false)
  const [agreedAi, setAgreedAi] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [loading, setLoading] = useState(false)

  const strength = getStrength(password)
  const canSubmit = agreedTos && agreedAi && !loading

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setEmailError("")
    setPasswordError("")

    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters")
      return
    }

    setLoading(true)
    try {
      await signUp(email, password, {
        display_name: fullName,
        company_name: companyName,
        whatsapp: whatsapp || undefined,
        turnstile_token: turnstileToken ?? undefined,
      })
      navigate("/verify-email", { state: { email } })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("user already exists")) {
        setEmailError("This email is already registered. Sign in instead →")
      } else if (msg.toLowerCase().includes("disposable")) {
        setEmailError("Please use a work email address (disposable emails not accepted)")
      } else {
        toast.error("Something went wrong. Please try again.")
      }
      setLoading(false)
    }
  }

  return (
    <AuthLayout subtitle="Create your free account" size="md">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-text-secondary">
            Work email <span className="text-red-500">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError("") }}
            aria-describedby={emailError ? "email-error" : undefined}
            aria-required="true"
            className={emailError ? "border-red-400 bg-red-50" : undefined}
          />
          <p className="text-xs text-text-muted">Use your work email — we&apos;ll send the weekly brief here</p>
          {emailError && (
            <p id="email-error" className="text-xs text-red-600" role="alert">
              {emailError}{" "}
              {emailError.includes("already registered") && (
                <Link to="/login" className="underline">Sign in →</Link>
              )}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-text-secondary">
            Password <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError("") }}
              aria-required="true"
              aria-describedby={passwordError ? "pw-error" : undefined}
              className={cn("pr-10", passwordError && "border-red-400 bg-red-50")}
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
          {passwordError && (
            <p id="pw-error" className="text-xs text-red-600" role="alert">{passwordError}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="full-name" className="text-text-secondary">
            Full name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="full-name"
            type="text"
            required
            autoComplete="name"
            placeholder="Rajan Sharma"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            aria-required="true"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="company" className="text-text-secondary">
            Company name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="company"
            type="text"
            required
            autoComplete="organization"
            placeholder="Sharma Traders"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            aria-required="true"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="whatsapp" className="text-text-secondary">
            WhatsApp number <span className="text-text-muted font-normal">(optional)</span>
          </Label>
          <div className="flex">
            <span className="inline-flex items-center px-3 border border-r-0 border-surface-border rounded-l-md bg-surface-raised text-text-secondary text-sm">
              🇮🇳 +91
            </span>
            <Input
              id="whatsapp"
              type="tel"
              autoComplete="tel"
              placeholder="9876543210"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="rounded-l-none"
            />
          </div>
          <p className="text-xs text-text-muted">We&apos;ll send your weekly brief here. Skip to set up later.</p>
        </div>

        <div className="space-y-3 pt-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedTos}
              onChange={(e) => setAgreedTos(e.target.checked)}
              aria-required="true"
              className="mt-0.5 w-4 h-4 accent-accent flex-shrink-0"
            />
            <span className="text-sm text-text-secondary">
              I agree to the{" "}
              <Link to="/terms" className="text-accent underline" target="_blank">Terms of Service</Link>
              {" "}and{" "}
              <Link to="/privacy" className="text-accent underline" target="_blank">Privacy Policy</Link>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedAi}
              onChange={(e) => setAgreedAi(e.target.checked)}
              aria-required="true"
              className="mt-0.5 w-4 h-4 accent-accent flex-shrink-0"
            />
            <span className="text-sm text-text-secondary">
              I consent to my sales data being processed by AI to generate analytics
              <span className="block text-xs text-text-muted mt-0.5">(Required under DPDP Act 2023)</span>
            </span>
          </label>
        </div>

        <AkaraButton type="submit" disabled={!canSubmit} loading={loading} className="w-full mt-2">
          Create free account →
        </AkaraButton>
      </form>

      {import.meta.env.VITE_CF_TURNSTILE_SITE_KEY && TurnstileWidget && (
        <div className="mt-4 flex justify-center">
          <TurnstileWidget
            siteKey={import.meta.env.VITE_CF_TURNSTILE_SITE_KEY}
            onSuccess={(token) => setTurnstileToken(token)}
            onError={() => setTurnstileToken(null)}
          />
        </div>
      )}

      <p className="text-center text-sm text-text-muted mt-4">
        Already have an account?{" "}
        <Link to="/login" className="text-accent font-medium hover:underline">Sign in</Link>
      </p>

      <p className="text-xs text-center text-text-muted mt-6 border-t border-surface-border pt-4">
        ₹18 Cr revenue analysed · 284 questions answered · 12 distributors
      </p>
    </AuthLayout>
  )
}
