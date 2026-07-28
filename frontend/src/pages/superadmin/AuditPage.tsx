import { useEffect, useState } from "react";

import { superadminFetch } from "@/lib/api/superadmin";

interface AuditRow {
  id: string;
  action: string;
  created_at: string;
  actor_email?: string;
  tenant_id?: string;
}

export function SuperadminAuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    superadminFetch<{ items: AuditRow[] }>("/superadmin/audit-logs?limit=50")
      .then((d) => setRows(d.items || []))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  return (
    <div className="space-y-4 text-sa-text">
      <h2 className="text-lg font-semibold">Audit log</h2>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="overflow-x-auto rounded border border-sa-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-sa-raised text-sa-muted">
            <tr>
              <th className="p-2">Time</th>
              <th className="p-2">Action</th>
              <th className="p-2">Actor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-sa-border">
                <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-2">{r.action}</td>
                <td className="p-2">{r.actor_email || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
