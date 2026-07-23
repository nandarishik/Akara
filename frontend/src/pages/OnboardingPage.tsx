/**
 * OnboardingPage — Sprint Phase 2, Day 3
 * UI Bible P7: mandatory 3-step wizard (no skip to dashboard without completing).
 * Step 1: business details → POST /onboarding/setup
 * Step 2: file upload with skip option
 * Step 3: success + Slot I "Invite your team" nudge → POST /auth/onboarding-complete
 */

import { useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ""

// ── Progress dots ─────────────────────────────────────────────────────────────

function ProgressDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-10" aria-label={`Step ${step} of 3`}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full transition-colors ${
            i <= step ? "bg-violet-600" : "bg-slate-200"
          }`}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function OnboardingPage() {
  const { session, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Step 1 fields
  const companyDefault = (session?.user?.user_metadata?.company_name as string | undefined) ?? ""
  const [companyName, setCompanyName] = useState(companyDefault)
  const [industry, setIndustry] = useState("")
  const [currency, setCurrency] = useState("INR")
  const [language, setLanguage] = useState("en")
  const [monthlyRevenue, setMonthlyRevenue] = useState("")

  // Step 2 state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle")
  const [uploadResult, setUploadResult] = useState<{ rows: number; dateRange: string; zones: number } | null>(null)

  // Slot I dismissed
  const [slotIDismissed, setSlotIDismissed] = useState(
    () => localStorage.getItem("akara_slot_I_dismissed") === "true"
  )

  // ── Step 1: Submit ──────────────────────────────────────────────────────────
  async function handleStep1() {
    setError("")
    if (!companyName.trim() || !industry) {
      setError("Please fill in all required fields")
      return
    }
    setLoading(true)
    try {
      const token = session?.access_token
      const res = await fetch(`${API_BASE}/onboarding/setup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          company_name: companyName,
          industry,
          currency,
          language,
          monthly_revenue_range: monthlyRevenue || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.detail?.message ?? `Setup failed: ${res.status}`)
      }
      await refreshProfile()
      setStep(2)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: File select ──────────────────────────────────────────────────────
  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setUploadStatus("idle")
    setUploadProgress(0)
    setUploadResult(null)
  }

  async function handleUpload() {
    if (!file) return
    setUploadStatus("uploading")
    setUploadProgress(10)

    try {
      // Simulate progress ticks
      const progressInterval = setInterval(() => {
        setUploadProgress((p) => Math.min(p + 10, 80))
      }, 400)

      const token = session?.access_token
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(`${API_BASE}/data/import`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const data = await res.json()
      setUploadResult({
        rows: data.rows_inserted ?? 0,
        dateRange: data.date_range ?? "—",
        zones: data.zones ?? 0,
      })
      setUploadStatus("done")
    } catch {
      setUploadStatus("error")
      setUploadProgress(0)
    }
  }

  function handleSkip() {
    setStep(3)
  }

  // ── Step 3: Complete ─────────────────────────────────────────────────────────
  async function handleComplete() {
    setLoading(true)
    try {
      const token = session?.access_token
      await fetch(`${API_BASE}/auth/onboarding-complete`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      await refreshProfile()
    } catch {
      // Non-fatal — navigate anyway
    } finally {
      setLoading(false)
    }
    navigate("/dashboard", { replace: true })
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-violet-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Back button */}
        {step > 1 && step < 3 && (
          <button
            className="mb-6 text-slate-500 hover:text-violet-700 text-sm font-medium"
            onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
          >
            ← Back
          </button>
        )}

        <ProgressDots step={step} />

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">

          {/* ── STEP 1 ─────────────────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <div className="text-center mb-6">
                <span className="text-5xl" aria-hidden="true">🏭</span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 text-center mb-1">Tell us about your business</h1>
              <p className="text-slate-500 text-center mb-8 text-sm">So AKARA speaks your language from day one.</p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="ob-company" className="block text-sm font-medium text-slate-700 mb-1">
                    Company name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="ob-company"
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>

                <div>
                  <label htmlFor="ob-industry" className="block text-sm font-medium text-slate-700 mb-1">
                    Industry <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="ob-industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                  >
                    <option value="">Select industry</option>
                    <option value="fmcg_distribution">FMCG Distribution</option>
                    <option value="restaurant_qsr">Restaurant / QSR</option>
                    <option value="pharma_distribution">Pharma Distribution</option>
                    <option value="industrial_distribution">Industrial Distribution</option>
                    <option value="retail_chain">Retail Chain</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ob-currency" className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <select
                    id="ob-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                  >
                    <option value="INR">₹ INR — Indian Rupee</option>
                    <option value="USD">$ USD — US Dollar</option>
                    <option value="AED">AED — UAE Dirham</option>
                    <option value="GBP">£ GBP — British Pound</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ob-language" className="block text-sm font-medium text-slate-700 mb-1">Language</label>
                  <select
                    id="ob-language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="hinglish">Hinglish</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ob-revenue" className="block text-sm font-medium text-slate-700 mb-1">
                    Monthly revenue <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <select
                    id="ob-revenue"
                    value={monthlyRevenue}
                    onChange={(e) => setMonthlyRevenue(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="lt_1cr">Less than ₹1 Cr</option>
                    <option value="1_10cr">₹1–10 Cr</option>
                    <option value="10_50cr">₹10–50 Cr</option>
                    <option value="50_200cr">₹50–200 Cr</option>
                    <option value="gt_200cr">More than ₹200 Cr</option>
                  </select>
                </div>
              </div>

              {error && <p className="text-sm text-red-600 mt-4" role="alert">{error}</p>}

              <button
                onClick={handleStep1}
                disabled={loading}
                className="w-full mt-6 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Setting up...
                  </span>
                ) : "Continue →"}
              </button>
            </>
          )}

          {/* ── STEP 2 ─────────────────────────────────────────────────────── */}
          {step === 2 && (
            <>
              <div className="text-center mb-6">
                <span className="text-5xl" aria-hidden="true">📂</span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 text-center mb-1">Import your sales data</h1>
              <p className="text-slate-500 text-center mb-2 text-sm">
                Export from Tally: Gateway → Export Data → Sales Register. Or drag your Excel file.
              </p>

              {uploadStatus === "idle" && !file && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const f = e.dataTransfer.files?.[0]
                    if (f) { setFile(f); setUploadStatus("idle") }
                  }}
                  className="mt-6 border-2 border-dashed border-violet-300 rounded-xl p-10 text-center cursor-pointer hover:bg-violet-50 transition-colors"
                  role="button"
                  aria-label="Click or drag to upload file"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                >
                  <div className="text-4xl mb-3">📤</div>
                  <p className="font-semibold text-slate-700">Drop your CSV or Excel file here</p>
                  <p className="text-sm text-slate-400 mt-1">or click to browse</p>
                  <p className="text-xs text-slate-400 mt-3">Supported: .xlsx, .xls, .csv · Max 20MB</p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
                aria-label="Upload sales file"
              />

              {file && uploadStatus === "idle" && (
                <div className="mt-6">
                  <div className="bg-slate-50 rounded-lg p-4 flex items-center justify-between mb-4">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{file.name}</p>
                      <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button className="text-slate-400 hover:text-red-500 text-xs" onClick={() => setFile(null)}>Remove</button>
                  </div>
                  <button
                    onClick={handleUpload}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    Start import →
                  </button>
                </div>
              )}

              {uploadStatus === "uploading" && (
                <div className="mt-6">
                  <p className="text-sm text-slate-500 mb-2 text-center">Analysing your data... (may take 30 seconds for large files)</p>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-600 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadStatus === "done" && uploadResult && (
                <div className="mt-6 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="font-bold text-slate-900">{uploadResult.rows.toLocaleString("en-IN")} rows imported from {file?.name}</p>
                  {uploadResult.dateRange !== "—" && (
                    <p className="text-sm text-slate-500 mt-1">
                      Dates: {uploadResult.dateRange} · {uploadResult.zones} zones
                    </p>
                  )}
                  <button
                    onClick={() => setStep(3)}
                    className="mt-6 w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors"
                  >
                    See your dashboard →
                  </button>
                </div>
              )}

              {uploadStatus === "error" && (
                <div className="mt-4 text-center">
                  <p className="text-red-600 text-sm mb-3">Upload failed. Please try again.</p>
                  <button onClick={() => { setUploadStatus("idle"); setFile(null) }} className="text-violet-600 text-sm underline">
                    Try again
                  </button>
                </div>
              )}

              <div className="mt-6 text-center">
                <button
                  onClick={handleSkip}
                  className="text-sm text-slate-400 hover:text-violet-700 transition-colors"
                >
                  Skip for now — explore with sample data
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3 ─────────────────────────────────────────────────────── */}
          {step === 3 && (
            <>
              <div className="text-center mb-6 relative overflow-hidden">
                <div className="text-6xl mb-2 animate-bounce">🎉</div>
                <style>{`
                  @keyframes confettiDrop { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(120px) rotate(720deg); opacity: 0; } }
                  .confetti-piece { position: absolute; width: 8px; height: 8px; animation: confettiDrop 1.5s ease-in forwards; }
                `}</style>
                {["#7C3AED", "#F97316", "#10B981", "#F59E0B", "#3B82F6"].map((c, i) => (
                  <div
                    key={i}
                    className="confetti-piece"
                    style={{ left: `${15 + i * 15}%`, top: "10px", backgroundColor: c, animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>

              <h1 className="text-2xl font-extrabold text-slate-900 text-center mb-2">You're all set!</h1>
              <p className="text-slate-500 text-center mb-8 text-sm">Your dashboard is live. Here's what you can do:</p>

              <div className="grid grid-cols-3 gap-3 mb-8">
                {[
                  { icon: "📊", title: "Ask anything", desc: "Type any question about your sales" },
                  { icon: "📱", title: "WhatsApp brief", desc: "Add your number in Settings" },
                  { icon: "🔔", title: "Set alerts", desc: "Get notified when KPIs drop (Pro)" },
                ].map((card) => (
                  <div key={card.title} className="bg-violet-50 rounded-xl p-4 text-center">
                    <p className="text-2xl mb-2">{card.icon}</p>
                    <p className="text-xs font-bold text-slate-800">{card.title}</p>
                    <p className="text-xs text-slate-400 mt-1">{card.desc}</p>
                  </div>
                ))}
              </div>

              {!slotIDismissed && (
                <div className="bg-gradient-to-r from-violet-50 to-violet-100 border border-violet-200 rounded-xl p-4 mb-6 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-violet-800 text-sm">👥 Invite your team</p>
                    <p className="text-xs text-violet-600 mt-0.5">Add team members and collaborate. Available on Pro & Business plans.</p>
                  </div>
                  <button
                    onClick={() => { localStorage.setItem("akara_slot_I_dismissed", "true"); setSlotIDismissed(true) }}
                    className="text-violet-400 hover:text-violet-600 flex-shrink-0"
                    aria-label="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              )}

              <button
                onClick={handleComplete}
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-3 rounded-lg font-semibold transition-colors text-lg"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Setting up dashboard...
                  </span>
                ) : "Go to my dashboard →"}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
