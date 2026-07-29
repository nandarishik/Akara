/**
 * OnboardingPage — Sprint Phase 2, Day 3
 * FireAI light auth — AuthLayout + shared Input + AkaraButton.
 * Mandatory 3-step wizard: business details → file upload → success.
 */

import { useEffect, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { AuthLayout } from "@/components/layout/AuthLayout"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AkaraButton, GhostButton } from "@/components/ui/GradientButton"
import GlowSurfaceCard from "@/components/ui/GlowSurfaceCard"
import PageLoader from "@/components/ui/PageLoader"
import { cn } from "@/lib/utils"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ""
const ONBOARDING_STEP_KEY = "akara_onboarding_step"

function readStoredStep(): 1 | 2 | 3 {
  const raw = sessionStorage.getItem(ONBOARDING_STEP_KEY)
  if (raw === "2") return 2
  if (raw === "3") return 3
  return 1
}

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-surface-border bg-surface-card px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"

function ProgressDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-6" aria-label={`Step ${step} of 3`}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            "w-3 h-3 rounded-full transition-colors",
            i <= step ? "bg-accent" : "bg-surface-raised"
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

export function OnboardingPage() {
  const { session, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [step, setStepState] = useState<1 | 2 | 3>(() => readStoredStep())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function setStep(next: 1 | 2 | 3) {
    setStepState(next)
    sessionStorage.setItem(ONBOARDING_STEP_KEY, String(next))
  }

  useEffect(() => {
    void (async () => {
      const token = session?.access_token
      if (!token) return
      await refreshProfile()
      const stored = readStoredStep()
      if (stored < 2) return
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        if (data.tenant_id) {
          setStepState(stored)
        } else {
          sessionStorage.removeItem(ONBOARDING_STEP_KEY)
        }
      } catch {
        // ignore — user stays on default step
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- restore once on mount

  const companyDefault = (session?.user?.user_metadata?.company_name as string | undefined) ?? ""
  const [companyName, setCompanyName] = useState(companyDefault)
  const [industry, setIndustry] = useState("")
  const [currency, setCurrency] = useState("INR")
  const [language, setLanguage] = useState("en")
  const [monthlyRevenue, setMonthlyRevenue] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle")
  const [uploadResult, setUploadResult] = useState<{ rows: number; dateRange: string; zones: number } | null>(null)

  const [slotIDismissed, setSlotIDismissed] = useState(
    () => localStorage.getItem("akara_slot_I_dismissed") === "true"
  )

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

  async function handleComplete() {
    setLoading(true)
    try {
      const token = session?.access_token
      await fetch(`${API_BASE}/auth/onboarding-complete`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      await refreshProfile()
      sessionStorage.removeItem(ONBOARDING_STEP_KEY)
      navigate("/dashboard", { replace: true })
    } catch {
      await refreshProfile()
      sessionStorage.removeItem(ONBOARDING_STEP_KEY)
      navigate("/dashboard", { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      size="lg"
      above={
        <>
          {step > 1 && step < 3 && (
            <button
              type="button"
              className="mb-4 text-text-muted hover:text-accent text-sm font-medium"
              onClick={() => setStep((step - 1) as 1 | 2 | 3)}
            >
              ← Back
            </button>
          )}
          <ProgressDots step={step} />
        </>
      }
    >
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/80 backdrop-blur-sm">
          <PageLoader title="Setting up your business…" subtitle="" minHeight="min-h-0" />
        </div>
      )}
      {step === 1 && (
        <>
          <div className="text-center mb-6">
            <span className="text-5xl" aria-hidden="true">🏭</span>
          </div>
          <h1 className="text-2xl font-extrabold text-text-primary text-center mb-1">Tell us about your business</h1>
          <p className="text-text-muted text-center mb-8 text-sm">So AKARA speaks your language from day one.</p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ob-company" className="text-text-secondary">
                Company name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ob-company"
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ob-industry" className="text-text-secondary">
                Industry <span className="text-red-500">*</span>
              </Label>
              <select
                id="ob-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className={SELECT_CLASS}
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

            <div className="space-y-1.5">
              <Label htmlFor="ob-currency" className="text-text-secondary">Currency</Label>
              <select id="ob-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={SELECT_CLASS}>
                <option value="INR">₹ INR — Indian Rupee</option>
                <option value="USD">$ USD — US Dollar</option>
                <option value="AED">AED — UAE Dirham</option>
                <option value="GBP">£ GBP — British Pound</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ob-language" className="text-text-secondary">Language</Label>
              <select id="ob-language" value={language} onChange={(e) => setLanguage(e.target.value)} className={SELECT_CLASS}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="hinglish">Hinglish</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ob-revenue" className="text-text-secondary">
                Monthly revenue <span className="text-text-muted font-normal">(optional)</span>
              </Label>
              <select id="ob-revenue" value={monthlyRevenue} onChange={(e) => setMonthlyRevenue(e.target.value)} className={SELECT_CLASS}>
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

          <AkaraButton onClick={handleStep1} loading={loading} className="w-full mt-6">
            Continue →
          </AkaraButton>
        </>
      )}

      {step === 2 && (
        <>
          <div className="text-center mb-6">
            <span className="text-5xl" aria-hidden="true">📂</span>
          </div>
          <h1 className="text-2xl font-extrabold text-text-primary text-center mb-1">Import your sales data</h1>
          <p className="text-text-muted text-center mb-2 text-sm">
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
              className="mt-6 border-2 border-dashed border-accent/40 rounded-xl p-10 text-center cursor-pointer hover:bg-accent-soft/50 transition-colors"
              role="button"
              aria-label="Click or drag to upload file"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            >
              <div className="text-4xl mb-3">📤</div>
              <p className="font-semibold text-text-primary">Drop your CSV or Excel file here</p>
              <p className="text-sm text-text-muted mt-1">or click to browse</p>
              <p className="text-xs text-text-muted mt-3">Supported: .xlsx, .xls, .csv · Max 20MB</p>
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
              <div className="bg-surface-raised rounded-lg p-4 flex items-center justify-between mb-4">
                <div>
                  <p className="font-medium text-text-primary text-sm">{file.name}</p>
                  <p className="text-xs text-text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button className="text-text-muted hover:text-red-500 text-xs" onClick={() => setFile(null)}>Remove</button>
              </div>
              <AkaraButton onClick={handleUpload} className="w-full">
                Start import →
              </AkaraButton>
            </div>
          )}

          {uploadStatus === "uploading" && (
            <div className="mt-6">
              <p className="text-sm text-text-muted mb-2 text-center">Analysing your data... (may take 30 seconds for large files)</p>
              <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {uploadStatus === "done" && uploadResult && (
            <div className="mt-6 text-center">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-bold text-text-primary">{uploadResult.rows.toLocaleString("en-IN")} rows imported from {file?.name}</p>
              {uploadResult.dateRange !== "—" && (
                <p className="text-sm text-text-muted mt-1">
                  Dates: {uploadResult.dateRange} · {uploadResult.zones} zones
                </p>
              )}
              <AkaraButton onClick={() => setStep(3)} className="w-full mt-6">
                See your dashboard →
              </AkaraButton>
            </div>
          )}

          {uploadStatus === "error" && (
            <div className="mt-4 text-center">
              <p className="text-red-600 text-sm mb-3">Upload failed. Please try again.</p>
              <button onClick={() => { setUploadStatus("idle"); setFile(null) }} className="text-accent text-sm underline">
                Try again
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <GhostButton type="button" onClick={handleSkip} className="text-sm">
              Skip for now — explore with sample data
            </GhostButton>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="text-center mb-6">
            <span className="text-6xl mb-2 inline-block">🎉</span>
          </div>

          <h1 className="text-2xl font-extrabold text-text-primary text-center mb-2">You&apos;re all set!</h1>
          <p className="text-text-muted text-center mb-8 text-sm">Your dashboard is live. Here&apos;s what you can do:</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            {[
              { icon: "📊", title: "Ask anything", desc: "Type any question about your sales" },
              { icon: "📱", title: "WhatsApp brief", desc: "Add your number in Settings" },
              { icon: "🔔", title: "Set alerts", desc: "Get notified when KPIs drop (Pro)" },
            ].map((card) => (
              <GlowSurfaceCard key={card.title} padding="sm" className="text-center">
                <p className="text-2xl mb-2">{card.icon}</p>
                <p className="text-xs font-bold text-text-primary">{card.title}</p>
                <p className="text-xs text-text-muted mt-1">{card.desc}</p>
              </GlowSurfaceCard>
            ))}
          </div>

          {!slotIDismissed && (
            <GlowSurfaceCard accent="blue" padding="sm" className="mb-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-text-primary text-sm">👥 Invite your team</p>
                  <p className="text-xs text-text-muted mt-0.5">Add team members and collaborate. Available on Pro & Business plans.</p>
                </div>
                <button
                  onClick={() => { localStorage.setItem("akara_slot_I_dismissed", "true"); setSlotIDismissed(true) }}
                  className="text-text-muted hover:text-text-secondary flex-shrink-0"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </GlowSurfaceCard>
          )}

          <AkaraButton onClick={handleComplete} loading={loading} size="lg" className="w-full">
            Go to my dashboard →
          </AkaraButton>
        </>
      )}
    </AuthLayout>
  )
}
