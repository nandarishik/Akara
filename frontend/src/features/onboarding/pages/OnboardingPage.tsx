/**
 * Phase 4 onboarding: workspace_setup → file_upload → processing (+ skip).
 */
import { useEffect, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/features/auth/contexts/AuthContext"
import { AuthLayout } from "@/shared/layout/AuthLayout"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { AkaraButton, GhostButton } from "@/shared/ui/GradientButton"
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard"
import { cn } from "@/lib/utils"
import { useImportJobPoller } from "@/features/onboarding/hooks/useImportJobPoller"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ""

type Step = "workspace_setup" | "file_upload" | "processing"

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-surface-border bg-surface-card px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"

export function OnboardingPage() {
  const { session, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const emailPrefix = (session?.user?.email ?? "workspace").split("@")[0] || "workspace"

  const [step, setStep] = useState<Step>("workspace_setup")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [workspaceName, setWorkspaceName] = useState(`${emailPrefix}'s Café`)
  const [businessType, setBusinessType] = useState("cafe")
  const [language, setLanguage] = useState("en")
  const [currency, setCurrency] = useState("INR")
  const [timezone, setTimezone] = useState("Asia/Kolkata")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const { result: job, error: pollError } = useImportJobPoller(
    step === "processing" ? jobId : null,
  )

  useEffect(() => {
    if (job?.status === "completed") {
      navigate(
        "/copilot?q=" + encodeURIComponent("What were my top-selling products last week?"),
        { replace: true },
      )
    }
  }, [job?.status, navigate])

  async function handleSetup() {
    setError("")
    if (!workspaceName.trim() || !businessType) {
      setError("Please fill in workspace name and business type")
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
          workspace_name: workspaceName.trim(),
          company_name: workspaceName.trim(),
          business_type: businessType,
          industry: businessType,
          language,
          currency,
          timezone,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.detail?.message ?? `Setup failed: ${res.status}`)
      }
      const data = (await res.json()) as { redirect_hint?: string }
      await refreshProfile()
      if (data.redirect_hint === "dashboard") {
        navigate("/dashboard", { replace: true })
        return
      }
      setStep("file_upload")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Setup failed")
    } finally {
      setLoading(false)
    }
  }

  async function handleSkip() {
    setLoading(true)
    setError("")
    try {
      const token = session?.access_token
      await fetch(`${API_BASE}/onboarding/skip`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      await refreshProfile()
      navigate("/dashboard", { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Skip failed")
    } finally {
      setLoading(false)
    }
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 50 * 1024 * 1024) {
      setError("File must be under 50MB")
      return
    }
    setFile(f)
    setError("")
  }

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    setError("")
    try {
      const token = session?.access_token
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`${API_BASE}/data/import/async`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const data = (await res.json()) as { job_id?: string; id?: string }
      const id = data.job_id ?? data.id
      if (!id) throw new Error("No job id returned")
      setJobId(id)
      setStep("processing")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout size="lg">
      <GlowSurfaceCard className="space-y-4 p-6">
        {step === "workspace_setup" && (
          <>
            <h1 className="text-xl font-semibold text-text-primary">Set up your workspace</h1>
            <div className="space-y-3">
              <div>
                <Label htmlFor="workspace_name">Workspace name</Label>
                <Input
                  id="workspace_name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="business_type">Business type</Label>
                <select
                  id="business_type"
                  className={SELECT_CLASS}
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                >
                  <option value="cafe">Café</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="cloud_kitchen">Cloud kitchen</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <button
                type="button"
                className="text-xs text-accent underline"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? "Hide" : "Advanced"} settings
              </button>
              {showAdvanced && (
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <Label>Language</Label>
                    <Input value={language} onChange={(e) => setLanguage(e.target.value)} />
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
                  </div>
                  <div>
                    <Label>Timezone</Label>
                    <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <AkaraButton onClick={() => void handleSetup()} loading={loading}>
                Continue
              </AkaraButton>
              <GhostButton onClick={() => void handleSkip()} disabled={loading}>
                Skip for now
              </GhostButton>
            </div>
          </>
        )}

        {step === "file_upload" && (
          <>
            <h1 className="text-xl font-semibold">Upload your sales file</h1>
            <p className="text-sm text-text-muted">CSV or Excel (.csv, .xlsx, .xls) — max 50MB.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
            <AkaraButton variant="secondary" onClick={() => fileInputRef.current?.click()}>
              {file ? file.name : "Choose file"}
            </AkaraButton>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2">
              <AkaraButton onClick={() => void handleUpload()} disabled={!file || loading} loading={loading}>
                Upload & analyze
              </AkaraButton>
              <GhostButton onClick={() => void handleSkip()}>Skip for now</GhostButton>
            </div>
          </>
        )}

        {step === "processing" && (
          <>
            <h1 className="text-xl font-semibold">Processing import…</h1>
            <p className={cn("text-sm text-text-muted")}>
              Status: {job?.status ?? "queued"}
              {pollError ? ` — ${pollError}` : ""}
            </p>
            {job?.status === "failed" && (
              <div className="space-y-2">
                <p className="text-sm text-red-500">{job.error ?? "Import failed"}</p>
                <AkaraButton
                  onClick={() => {
                    setJobId(null)
                    setStep("file_upload")
                  }}
                >
                  Retry upload
                </AkaraButton>
              </div>
            )}
            <p className="text-xs text-text-muted">
              Or <Link className="underline text-accent" to="/dashboard">go to dashboard</Link>
            </p>
          </>
        )}
      </GlowSurfaceCard>
    </AuthLayout>
  )
}
