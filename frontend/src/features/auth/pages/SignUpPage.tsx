/**
 * SignUpPage â€” Sprint Phase 2, Day 3
 * FireAI light auth â€” AuthLayout + shared Input + AkaraButton.
 * All fields, 4-segment strength bar, 2 consent checkboxes, Turnstile, social proof.
 */

import { useEffect, useState } from "react"
import type { ComponentType, FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { useAuth } from "@/features/auth/contexts/AuthContext"
import { PremiumAuthLayout } from "@/shared/layout/PremiumAuthLayout"
import { PageSEO } from "@/shared/PageSEO"
import PageLoader from "@/shared/ui/PageLoader"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { AkaraButton } from "@/shared/ui/GradientButton"
import { formatAuthError } from "@/lib/formatAuthError"
import { cn } from "@/lib/utils"

import { persistInviteTokenFromSearch } from "@/lib/teamInvite"

const BASE = import.meta.env.VITE_API_BASE_URL as string

const TURNSTILE_SITE_KEY =
  import.meta.env.VITE_CF_TURNSTILE_SITE_KEY ||
  import.meta.env.VITE_TURNSTILE_SITE_KEY ||
  ""

type TurnstileProps = {
  siteKey: string
  onSuccess: (token: string) => void
  onError: () => void
}

function mapSignUpError(message: string): {
  field: "email" | "password" | "form"
  message: string
} {
  const lower = message.toLowerCase()

  if (
    lower.includes("already registered") ||
    lower.includes("user already exists") ||
    lower.includes("already been registered")
  ) {
    return {
      field: "email",
      message: "This email is already registered. Sign in instead.",
    }
  }
  if (lower.includes("disposable")) {
    return {
      field: "email",
      message: "Please use a work email address (disposable emails not accepted)",
    }
  }
  if (lower.includes("invalid email") || lower.includes("valid email")) {
    return { field: "email", message: message }
  }
  if (lower.includes("password")) {
    return { field: "password", message: message }
  }
  if (lower.includes("database error")) {
    return {
      field: "form",
      message:
        "We couldn't create your account right now. Please try again in a moment.",
    }
  }

  return { field: "form", message: message }
}

// â”€â”€ Password strength â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function SignUpPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    persistInviteTokenFromSearch(searchParams.toString())
  }, [searchParams])

  useEffect(() => {
    fetch(`${BASE}/system/settings`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.signup_open === false) {
          navigate("/signup-closed", { replace: true })
        }
      })
      .catch(() => undefined)
  }, [navigate])

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
  const [formError, setFormError] = useState("")
  const [loading, setLoading] = useState(false)
  const [TurnstileWidget, setTurnstileWidget] = useState<ComponentType<TurnstileProps> | null>(null)

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return

    import("@marsidev/react-turnstile")
      .then((mod) => setTurnstileWidget(() => mod.Turnstile))
      .catch(() => {
        setFormError("Security check failed to load. Refresh the page and try again.")
      })
  }, [])

  const strength = getStrength(password)
  const turnstileRequired = Boolean(TURNSTILE_SITE_KEY)
  const canSubmit =
    agreedTos &&
    agreedAi &&
    fullName.trim().length > 0 &&
    companyName.trim().length > 0 &&
    (!turnstileRequired || Boolean(turnstileToken))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setEmailError("")
    setPasswordError("")
    setFormError("")

    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters")
      return
    }

    if (turnstileRequired && !turnstileToken) {
      setFormError("Please complete the security check below.")
      return
    }

    setLoading(true)
    try {
      const normalizedEmail = email.trim().toLowerCase()
      await signUp(normalizedEmail, password, {
        display_name: fullName.trim(),
        company_name: companyName.trim(),
        whatsapp: whatsapp.trim() || undefined,
        turnstile_token: turnstileToken ?? undefined,
      })
      navigate("/verify-email", { state: { email: normalizedEmail } })
    } catch (err: unknown) {
      const mapped = mapSignUpError(formatAuthError(err))
      if (mapped.field === "email") setEmailError(mapped.message)
      else if (mapped.field === "password") setPasswordError(mapped.message)
      else setFormError(mapped.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PremiumAuthLayout subtitle="Create your free account">
      <PageSEO
        title="Sign up"
        description="Create your free AKARA account â€” import sales data and unlock AI copilot insights for Indian FMCG."
        path="/signup"
        noindex
      />
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/80 backdrop-blur-sm">
          <PageLoader title="Creating your accountâ€¦" subtitle="" minHeight="min-h-0" />
        </div>
      )}
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
            className={emailError ? "border-red-500/50 bg-red-500/10" : undefined}
          />
          <p className="text-xs text-text-muted">Use your work email â€” we&apos;ll send the weekly brief here</p>
          {emailError && (
            <p id="email-error" className="text-xs text-red-600" role="alert">
              {emailError}{" "}
              {emailError.includes("already registered") && (
                <Link to="/login" className="underline">Sign in â†’</Link>
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
              className={cn("pr-10", passwordError && "border-red-500/50 bg-red-500/10")}
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
              ðŸ‡®ðŸ‡³ +91
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
              I consent to my sales data (revenue figures, party names, product names) being
              processed by AI systems to generate analytics. Personal contact information is
              automatically removed before processing. My data is not shared with other organisations.{" "}
              <Link to="/privacy#ai-processing" className="text-accent underline" target="_blank">
                Learn more
              </Link>
              <span className="block text-xs text-text-muted mt-0.5">(Required under DPDP Act 2023)</span>
            </span>
          </label>
        </div>

        {formError && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2" role="alert">
            {formError}
          </p>
        )}

        {TURNSTILE_SITE_KEY && TurnstileWidget && (
          <div className="flex justify-center pt-1">
            <TurnstileWidget
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={(token) => {
                setTurnstileToken(token)
                setFormError("")
              }}
              onError={() => setTurnstileToken(null)}
            />
          </div>
        )}

        <AkaraButton type="submit" disabled={!canSubmit || loading} loading={loading} className="w-full mt-2">
          Create free account â†’
        </AkaraButton>
      </form>

      <p className="text-center text-sm text-text-muted mt-4">
        Already have an account?{" "}
        <Link to="/login" className="text-accent font-medium hover:underline">Sign in</Link>
      </p>

      <p className="text-xs text-center text-text-muted mt-6 border-t border-white/10 pt-4">
        â‚¹18 Cr revenue analysed Â· 284 questions answered Â· 12 distributors
      </p>
    </PremiumAuthLayout>
  )
}
