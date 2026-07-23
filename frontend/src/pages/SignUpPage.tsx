/**
 * SignUpPage -- Sprint Phase 2, Day 3
 * UI Bible P2: all fields, 4-segment strength bar, 2 consent checkboxes,
 * Cloudflare Turnstile, social proof, all error states.
 */

import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "@/components/ui/toast"

// -- Turnstile -- conditionally rendered when env key is present --
let TurnstileWidget: React.ComponentType<{
  siteKey: string
  onSuccess: (token: string) => void
  onError: () => void
}> | null = null

if (import.meta.env.VITE_CF_TURNSTILE_SITE_KEY) {
  import("@marsidev/react-turnstile").then((m) => {
    TurnstileWidget = m.Turnstile as typeof TurnstileWidget
  })
}

// -- Password strength --

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

const STRENGTH_LABELS: Record<Strength, string> = { 0: "", 1: "Weak", 2: "Fair", 3: "Good", 4: "Strong" }
const STRENGTH_COLORS: Record<Strength, string> = {
  0: "bg-slate-200", 1: "bg-red-500", 2: "bg-orange-400", 3: "bg-amber-400", 4: "bg-emerald-500",
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
      <p className={`text-xs mt-1 ${strength <= 1 ? "text-red-500" : strength === 2 ? "text-orange-500" : strength === 3 ? "text-amber-600" : "text-emerald-600"}`}>
        {STRENGTH_LABELS[strength]}
      </p>
    </div>
  )
}

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
    <div className="min-h-screen bg-violet-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-extrabold text-violet-700 font-display">AKARA</Link>
          <p className="text-slate-600 mt-2 text-lg font-medium">Create your free account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* Work email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Work email <span className="text-red-500">*</span></label>
              <input id="email" type="email" required autoComplete="email" placeholder="you@company.com" value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError("") }}
                aria-describedby={emailError ? "email-error" : undefined}
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 ${emailError ? "border-red-400 bg-red-50" : "border-slate-300"}`}
              />
              <p className="text-xs text-slate-400 mt-1">Use your work email -- we'll send the weekly brief here</p>
              {emailError && (
                <p id="email-error" className="text-xs text-red-600 mt-1" role="alert">
                  {emailError}{" "}
                  {emailError.includes("already registered") && <Link to="/login" className="underline">Sign in →</Link>}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <input id="password" type={showPassword ? "text" : "password"} required autoComplete="new-password"
                  placeholder="Min 8 characters" value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError("") }}
                  className={`w-full border rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 ${passwordError ? "border-red-400 bg-red-50" : "border-slate-300"}`}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrengthBar strength={strength} />
              {passwordError && <p id="pw-error" className="text-xs text-red-600 mt-1" role="alert">{passwordError}</p>}
            </div>

            {/* Full name */}
            <div>
              <label htmlFor="full-name" className="block text-sm font-medium text-slate-700 mb-1">Full name <span className="text-red-500">*</span></label>
              <input id="full-name" type="text" required autoComplete="name" placeholder="Rajan Sharma" value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>

            {/* Company name */}
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-1">Company name <span className="text-red-500">*</span></label>
              <input id="company" type="text" required autoComplete="organization" placeholder="Sharma Traders" value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>

            {/* WhatsApp (optional) */}
            <div>
              <label htmlFor="whatsapp" className="block text-sm font-medium text-slate-700 mb-1">WhatsApp number <span className="text-slate-400 font-normal">(optional)</span></label>
              <div className="flex">
                <span className="inline-flex items-center px-3 border border-r-0 border-slate-300 rounded-l-lg bg-slate-50 text-slate-600 text-sm">+91</span>
                <input id="whatsapp" type="tel" autoComplete="tel" placeholder="9876543210" value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="flex-1 border border-slate-300 rounded-r-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">We'll send your weekly brief here. Skip to set up later.</p>
            </div>

            {/* Consent checkboxes */}
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agreedTos} onChange={(e) => setAgreedTos(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-violet-600 flex-shrink-0" />
                <span className="text-sm text-slate-700">
                  I agree to the <Link to="/terms" className="text-violet-600 underline" target="_blank">Terms of Service</Link>
                  {" "}and{" "}<Link to="/privacy" className="text-violet-600 underline" target="_blank">Privacy Policy</Link>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agreedAi} onChange={(e) => setAgreedAi(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-violet-600 flex-shrink-0" />
                <span className="text-sm text-slate-700">
                  I consent to my sales data being processed by AI to generate analytics
                  <span className="block text-xs text-slate-400 mt-0.5">(Required under DPDP Act 2023)</span>
                </span>
              </label>
            </div>

            {/* Submit */}
            <button type="submit" disabled={!canSubmit}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white py-3 rounded-lg font-semibold transition-colors mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : "Create free account →"}
            </button>
          </form>

          {/* Turnstile */}
          {import.meta.env.VITE_CF_TURNSTILE_SITE_KEY && TurnstileWidget && (
            <div className="mt-4 flex justify-center">
              <TurnstileWidget
                siteKey={import.meta.env.VITE_CF_TURNSTILE_SITE_KEY}
                onSuccess={(token) => setTurnstileToken(token)}
                onError={() => setTurnstileToken(null)}
              />
            </div>
          )}

          <p className="text-center text-sm text-slate-500 mt-4">
            Already have an account?{" "}
            <Link to="/login" className="text-violet-600 font-medium hover:underline">Sign in</Link>
          </p>

          {/* Social proof */}
          <p className="text-xs text-center text-slate-400 mt-6 border-t border-slate-100 pt-4">
            Rs.18 Cr revenue analysed . 284 questions answered . 12 distributors
          </p>
        </div>
      </div>
    </div>
  )
}
