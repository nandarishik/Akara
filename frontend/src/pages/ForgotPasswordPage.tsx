/**
 * ForgotPasswordPage — Sprint Phase 2, Day 3
 * UI Bible P4: email field, success state with checkmark, "Link valid for 1 hour",
 * error state "No account found".
 */

import { useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import { CheckCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"

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
    <div className="min-h-screen bg-violet-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-extrabold text-violet-700 font-display">AKARA</Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          {status === "sent" ? (
            /* Success state */
            <div className="text-center">
              <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-4" aria-hidden="true" />
              <h1 className="text-xl font-extrabold text-slate-900 mb-2">Reset link sent</h1>
              <p className="text-slate-500 text-sm mb-1">
                Check your email at <span className="font-medium text-slate-800">{email}</span>.
              </p>
              <p className="text-slate-400 text-sm mb-6">Link valid for 1 hour.</p>
              <Link to="/login" className="block w-full text-center border-2 border-violet-600 text-violet-700 hover:bg-violet-50 py-2.5 rounded-lg font-semibold transition-colors">
                Back to sign in
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <h1 className="text-xl font-extrabold text-slate-900 mb-2">Reset your password</h1>
              <p className="text-slate-500 text-sm mb-6">Enter your email and we'll send you a reset link.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Work email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError("") }}
                    aria-describedby={error ? "forgot-error" : undefined}
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 ${error ? "border-red-400 bg-red-50" : "border-slate-300"}`}
                  />
                  {error && <p id="forgot-error" className="text-xs text-red-600 mt-1" role="alert">{error}</p>}
                </div>

                <button type="submit" disabled={status === "loading"} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-3 rounded-lg font-semibold transition-colors">
                  {status === "loading" ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </span>
                  ) : "Send reset link →"}
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-4">
                <Link to="/login" className="text-violet-600 hover:underline">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
