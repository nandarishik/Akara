import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";

import { sa, type AuditLogRow } from "@/lib/api/superadmin";

const PAGE_SIZE = 50;

function detailsSnippet(details: Record<string, unknown> | null | undefined): string {
  if (!details || Object.keys(details).length === 0) return "—";
  const raw = JSON.stringify(details);
  return raw.length > 80 ? `${raw.slice(0, 77)}…` : raw;
}

export function SuperadminAuditPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tenantId, setTenantId] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [ip, setIp] = useState("");
  const [tenantNames, setTenantNames] = useState<Record<string, string>>({});

  useEffect(() => {
    void sa.tenants({ limit: 200 }).then((r) => {
      const map: Record<string, string> = {};
      for (const t of r.items) map[t.id] = t.name;
      setTenantNames(map);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await sa.auditLogs({
        limit: PAGE_SIZE,
        offset,
        tenant_id: tenantId || undefined,
        action: action || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        ip: ip || undefined,
      });
      let items = res.items;
      if (actorEmail.trim()) {
        const q = actorEmail.trim().toLowerCase();
        items = items.filter((r) => (r.actor_email ?? "").toLowerCase().includes(q));
      }
      setRows(items);
      setTotal(actorEmail.trim() ? items.length : res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [offset, tenantId, actorEmail, action, dateFrom, dateTo, ip]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters() {
    if (offset === 0) {
      void load();
    } else {
      setOffset(0);
    }
  }

  const displayRows = useMemo(() => rows, [rows]);

  function exportCsv() {
    const header = ["id", "created_at", "action", "actor_email", "tenant_id", "tenant_name", "ip_address", "details"];
    const lines = [
      header.join(","),
      ...displayRows.map((r) =>
        [
          r.id,
          r.created_at,
          `"${r.action.replace(/"/g, '""')}"`,
          r.actor_email ?? "",
          r.tenant_id ?? "",
          r.tenant_id ? (tenantNames[r.tenant_id] ?? "") : "",
          r.ip_address ?? "",
          `"${detailsSnippet(r.details).replace(/"/g, '""')}"`,
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4 text-sa-text max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Audit log</h2>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded border border-sa-border bg-sa-raised px-3 py-1.5 text-sm hover:border-sa-accent disabled:opacity-50"
          disabled={displayRows.length === 0}
          onClick={exportCsv}
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 rounded-lg border border-sa-border bg-sa-raised p-4">
        <FilterInput label="Tenant ID" value={tenantId} onChange={setTenantId} placeholder="UUID…" />
        <FilterInput label="Actor email" value={actorEmail} onChange={setActorEmail} placeholder="user@…" />
        <FilterInput label="Action" value={action} onChange={setAction} placeholder="e.g. superadmin…" />
        <FilterInput label="Date from" value={dateFrom} onChange={setDateFrom} type="date" />
        <FilterInput label="Date to" value={dateTo} onChange={setDateTo} type="date" />
        <FilterInput label="IP address" value={ip} onChange={setIp} placeholder="203.0.113.1" />
      </div>
      <button
        type="button"
        className="rounded bg-sa-accent px-4 py-2 text-sm text-white"
        onClick={applyFilters}
      >
        Apply filters
      </button>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="overflow-x-auto rounded border border-sa-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-sa-raised text-sa-muted">
            <tr>
              <th className="p-2">Time</th>
              <th className="p-2">Action</th>
              <th className="p-2">Actor</th>
              <th className="p-2">Tenant</th>
              <th className="p-2">Details</th>
              <th className="p-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-4 text-sa-muted">Loading…</td>
              </tr>
            ) : displayRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-sa-muted">No audit events match filters</td>
              </tr>
            ) : (
              displayRows.map((r) => (
                <tr key={r.id} className="border-t border-sa-border">
                  <td className="p-2 whitespace-nowrap text-xs">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="p-2 font-mono text-xs">{r.action}</td>
                  <td className="p-2 text-xs">{r.actor_email || "—"}</td>
                  <td className="p-2 text-xs">
                    {r.tenant_id
                      ? tenantNames[r.tenant_id] ?? `${r.tenant_id.slice(0, 8)}…`
                      : "—"}
                  </td>
                  <td className="p-2 font-mono text-[10px] text-sa-muted max-w-[200px] truncate" title={JSON.stringify(r.details)}>
                    {detailsSnippet(r.details)}
                  </td>
                  <td className="p-2 text-xs">{r.ip_address || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-sa-muted">
        <span>
          {total} event{total !== 1 ? "s" : ""} · page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-sa-border px-3 py-1 disabled:opacity-40"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded border border-sa-border px-3 py-1 disabled:opacity-40"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-sa-muted">{label}</label>
      <input
        type={type}
        className="mt-1 w-full rounded border border-sa-border bg-sa-surface px-2 py-1.5 text-sm text-sa-text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
