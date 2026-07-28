import { useEffect, useState } from "react";

import { superadminFetch } from "@/lib/api/superadmin";

export function SuperadminOpsPage() {
  const [cron, setCron] = useState<Record<string, { status: string; last_run?: string }>>({});
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    superadminFetch<{ tasks: Array<{ task_name: string; status: string | null; last_run?: string | null }> }>(
      "/superadmin/system/cron-health",
    ).then((d) => {
      const map: Record<string, { status: string; last_run?: string }> = {};
      for (const t of d.tasks || []) {
        map[t.task_name] = { status: t.status || "unknown", last_run: t.last_run || undefined };
      }
      setCron(map);
    });
    void superadminFetch<Record<string, unknown>>("/superadmin/system/health").then(setHealth);
  }, []);

  async function runTask(name: string) {
    await superadminFetch(`/superadmin/system/cron-run/${name}`, {
      method: "POST",
      body: JSON.stringify({ reason: "Manual cron trigger from superadmin ops UI panel" }),
    });
  }

  return (
    <div className="space-y-6 text-sa-text">
      <h2 className="text-lg font-semibold">Cron health</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(cron).map(([name, info]) => (
          <div key={name} className="rounded border border-sa-border bg-sa-raised p-4">
            <p className="font-medium">{name}</p>
            <p className="text-xs text-sa-muted">Status: {info.status}</p>
            <button
              type="button"
              className="mt-2 text-xs text-sa-accent underline"
              onClick={() => void runTask(name)}
            >
              Run now
            </button>
          </div>
        ))}
      </div>
      {health && (
        <>
          <h3 className="font-semibold">System health</h3>
          <pre className="overflow-auto rounded border border-sa-border bg-sa-raised p-4 text-xs">
            {JSON.stringify(health, null, 2)}
          </pre>
        </>
      )}
    </div>
  );
}
