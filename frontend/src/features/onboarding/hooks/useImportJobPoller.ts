import { useEffect, useRef, useState } from "react"
import { apiFetch } from "@/lib/api"

export type ImportJobStatus = "queued" | "running" | "completed" | "failed" | string

export type ImportJobPollResult = {
  id: string
  status: ImportJobStatus
  error?: string
}

/**
 * Poll GET /data/import/jobs/{job_id} every 5s until completed or failed.
 */
export function useImportJobPoller(jobId: string | null) {
  const [result, setResult] = useState<ImportJobPollResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const stopped = useRef(false)

  useEffect(() => {
    stopped.current = false
    if (!jobId) {
      setResult(null)
      return
    }

    async function tick() {
      try {
        const data = await apiFetch<ImportJobPollResult>(`/data/import/jobs/${jobId}`)
        if (stopped.current) return
        setResult(data)
        setError(null)
        if (data.status === "completed" || data.status === "failed") {
          return
        }
        window.setTimeout(() => {
          if (!stopped.current) void tick()
        }, 5000)
      } catch (e) {
        if (stopped.current) return
        setError(e instanceof Error ? e.message : "Poll failed")
        window.setTimeout(() => {
          if (!stopped.current) void tick()
        }, 5000)
      }
    }

    void tick()
    return () => {
      stopped.current = true
    }
  }, [jobId])

  return { result, error }
}
