import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { DangerousActionDialog } from "@/features/superadmin/components/DangerousActionDialog";
import {
  getJobHistory,
  listJobs,
  pauseJob,
  resumeJob,
  triggerJob,
  type JobRow,
} from "@/lib/api/superadmin";
import { Button } from "@/shared/ui/button";

type JobAction = "trigger" | "pause" | "resume";

function normalizeJobs(data: { items: JobRow[] } | JobRow[]): JobRow[] {
  return Array.isArray(data) ? data : (data.items ?? []);
}

export function JobControlsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<unknown[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [action, setAction] = useState<{ job: JobRow; kind: JobAction } | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listJobs();
      setJobs(normalizeJobs(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load jobs");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadHistory(jobName: string) {
    setHistoryFor(jobName);
    setHistoryLoading(true);
    try {
      const res = await getJobHistory(jobName);
      setHistory(res.items ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleConfirm(reason: string) {
    if (!action) return;
    setActing(true);
    setError("");
    try {
      const name = action.job.job_name;
      if (action.kind === "trigger") {
        await triggerJob(name, reason);
      } else if (action.kind === "pause") {
        const pausedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await pauseJob(name, reason, pausedUntil);
      } else {
        await resumeJob(name, reason);
      }
      setAction(null);
      await load();
      if (historyFor === name) await loadHistory(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(false);
    }
  }

  const actionTitle =
    action?.kind === "trigger"
      ? `Trigger ${action.job.job_name}`
      : action?.kind === "pause"
        ? `Pause ${action.job.job_name}`
        : action
          ? `Resume ${action.job.job_name}`
          : "";

  const actionSummary =
    action?.kind === "trigger"
      ? "Queue a one-off run of this job now. Confirm with a reason."
      : action?.kind === "pause"
        ? "Pause this job for 1 hour. Confirm with a reason."
        : action
          ? "Resume this paused job. Confirm with a reason."
          : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-sa-text">Job controls</h1>
          <p className="mt-1 text-sm text-sa-muted">
            Trigger, pause, or resume platform jobs. For cron health and manual task runs, see{" "}
            <Link to="/superadmin/cron" className="text-sa-accent underline-offset-2 hover:underline">
              Cron
            </Link>
            .
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          className="border-sa-border text-sa-text"
        >
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sa-accent border-t-transparent" />
        </div>
      ) : jobs.length === 0 ? (
        <p className="rounded-lg border border-sa-border bg-sa-raised px-4 py-6 text-sm text-sa-muted">
          No jobs returned.
        </p>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.job_name}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sa-border bg-sa-raised p-4"
            >
              <div>
                <p className="font-mono text-sm text-sa-text">{job.job_name}</p>
                <p className="mt-1 text-xs text-sa-muted">
                  {job.paused ? "Paused" : "Active"}
                  {job.paused_until ? ` until ${new Date(job.paused_until).toLocaleString()}` : ""}
                  {job.last_status ? ` · last ${job.last_status}` : ""}
                  {job.last_run_at
                    ? ` · ran ${new Date(job.last_run_at).toLocaleString()}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-sa-border text-sa-text"
                  onClick={() => void loadHistory(job.job_name)}
                >
                  History
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setAction({ job, kind: "trigger" })}
                >
                  Trigger
                </Button>
                {job.paused ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setAction({ job, kind: "resume" })}
                  >
                    Resume
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setAction({ job, kind: "pause" })}
                  >
                    Pause
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {historyFor && (
        <section className="rounded-xl border border-sa-border bg-sa-surface p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-sa-text">
              History · <span className="font-mono text-sa-accent">{historyFor}</span>
            </h2>
            <button
              type="button"
              className="text-xs text-sa-muted hover:text-sa-text"
              onClick={() => {
                setHistoryFor(null);
                setHistory([]);
              }}
            >
              Close
            </button>
          </div>
          {historyLoading ? (
            <p className="text-xs text-sa-muted">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-sa-muted">No history rows.</p>
          ) : (
            <pre className="max-h-72 overflow-auto rounded border border-sa-border bg-sa-raised p-3 text-[10px] text-sa-text">
              {JSON.stringify(history, null, 2)}
            </pre>
          )}
        </section>
      )}

      <DangerousActionDialog
        open={!!action}
        onOpenChange={(open) => !open && setAction(null)}
        title={actionTitle}
        summary={actionSummary}
        minReasonLength={10}
        loading={acting}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
