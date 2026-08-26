import { useEffect, useState } from "react";

import { sa } from "@/lib/api/superadmin";
import { MutationReasonField } from "@/features/superadmin/components/MutationReasonField";

interface CronTask {
  task_name: string;
  status: string | null;
  last_run?: string | null;
  details?: Record<string, unknown>;
}

type CronLogRow = {
  task_name?: string;
  status?: string;
  details?: Record<string, unknown>;
  started_at?: string;
  finished_at?: string;
};

export function CronPage() {
  const [tasks, setTasks] = useState<CronTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("Manual cron trigger from superadmin cron UI");
  const [running, setRunning] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<Record<string, string>>({});
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const [logs, setLogs] = useState<CronLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  async function loadTasks() {
    setLoading(true);
    try {
      const d = await sa.cronHealth();
      setTasks(d.tasks || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTasks();
  }, []);

  const reasonOk = reason.trim().length >= 10;

  async function runTask(name: string) {
    if (!reasonOk) return;
    setRunning(name);
    setRunStatus((s) => ({ ...s, [name]: "Triggering…" }));
    try {
      await sa.runCron(name, reason.trim());
      setRunStatus((s) => ({ ...s, [name]: "Triggered — check back in ~30s" }));
      setTimeout(() => void loadTasks(), 3000);
    } catch (e) {
      setRunStatus((s) => ({
        ...s,
        [name]: e instanceof Error ? e.message : "Run failed",
      }));
    } finally {
      setRunning(null);
    }
  }

  async function viewLogs(taskName: string) {
    setLogsFor(taskName);
    setLogsLoading(true);
    try {
      const res = await sa.cronLogs(taskName, 20);
      setLogs(res.items as CronLogRow[]);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }

  function founderBriefSnippet(details: Record<string, unknown> | undefined): string | null {
    if (!details) return null;
    const text = (details.text as string | undefined) ?? (details.brief_text as string | undefined);
    if (!text) return null;
    return text.length > 200 ? `${text.slice(0, 197)}…` : text;
  }

  function detailsSummary(details: Record<string, unknown> | undefined): string {
    if (!details || Object.keys(details).length === 0) return "—";
    const snippet = founderBriefSnippet(details);
    if (snippet) return snippet;
    const raw = JSON.stringify(details);
    return raw.length > 100 ? `${raw.slice(0, 97)}…` : raw;
  }

  return (
    <div className="space-y-6 text-sa-text max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-xl font-semibold">Cron health</h2>
        <div className="w-72">
          <MutationReasonField value={reason} onChange={setReason} />
        </div>
      </div>

      <div className="rounded-lg border border-sa-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sa-raised text-left text-xs text-sa-muted">
            <tr>
              <th className="p-3">Task</th>
              <th className="p-3">Status</th>
              <th className="p-3">Last run</th>
              <th className="p-3">Details</th>
              <th className="p-3 w-36">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.task_name} className="border-t border-sa-border">
                <td className="p-3 font-medium">{task.task_name.replace(/_/g, " ")}</td>
                <td
                  className={`p-3 capitalize text-xs ${
                    task.status === "failed" ? "text-red-400" : "text-sa-muted"
                  }`}
                >
                  {task.status || "never run"}
                </td>
                <td className="p-3 text-xs text-sa-muted whitespace-nowrap">
                  {task.last_run
                    ? new Date(task.last_run).toLocaleString("en-IN")
                    : "—"}
                </td>
                <td className="p-3 text-xs text-sa-muted max-w-xs">
                  {task.task_name === "founder_brief" && founderBriefSnippet(task.details) ? (
                    <pre className="whitespace-pre-wrap font-mono text-[10px]">
                      {founderBriefSnippet(task.details)}
                    </pre>
                  ) : (
                    <span className="truncate block">{detailsSummary(task.details)}</span>
                  )}
                </td>
                <td className="p-3 space-x-2">
                  <button
                    type="button"
                    className="text-xs text-sa-accent underline disabled:opacity-40"
                    disabled={!reasonOk || running === task.task_name}
                    onClick={() => void runTask(task.task_name)}
                  >
                    {running === task.task_name ? "Running…" : "Run"}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-sa-muted hover:text-sa-text underline"
                    onClick={() => void viewLogs(task.task_name)}
                  >
                    Logs
                  </button>
                </td>
              </tr>
            ))}
            {!loading && tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-sa-muted">No cron tasks configured</td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={5} className="p-4 text-sa-muted">Loading cron tasks…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {Object.entries(runStatus).map(([name, msg]) => (
        <p key={name} className="text-xs text-sa-muted">
          {name}: {msg}
        </p>
      ))}

      {logsFor && (
        <section className="rounded-lg border border-sa-border bg-sa-raised p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Logs: {logsFor.replace(/_/g, " ")}</h3>
            <button
              type="button"
              className="text-xs text-sa-muted hover:text-sa-text"
              onClick={() => setLogsFor(null)}
            >
              Close
            </button>
          </div>
          {logsLoading ? (
            <p className="text-sm text-sa-muted">Loading logs…</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-sa-muted">No log entries</p>
          ) : (
            <ul className="text-xs space-y-2 max-h-64 overflow-y-auto">
              {logs.map((log, i) => (
                <li key={i} className="border-b border-sa-border pb-2">
                  <div className="flex justify-between gap-2">
                    <span className={log.status === "failed" ? "text-red-400" : ""}>
                      {log.status ?? "—"}
                    </span>
                    <span className="text-sa-muted shrink-0">
                      {log.finished_at
                        ? new Date(log.finished_at).toLocaleString("en-IN")
                        : "—"}
                    </span>
                  </div>
                  <p className="text-sa-muted mt-1 font-mono text-[10px] whitespace-pre-wrap">
                    {logsFor === "founder_brief" && founderBriefSnippet(log.details)
                      ? founderBriefSnippet(log.details)
                      : detailsSummary(log.details)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
