import { useState } from "react";

import { superadminFetch } from "@/lib/api/superadmin";

export function SuperadminDataPage() {
  const [tenantId, setTenantId] = useState("");
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  async function load() {
    if (!tenantId.trim()) return;
    setError("");
    try {
      const data = await superadminFetch<Record<string, unknown>>(
        `/superadmin/tenants/${tenantId.trim()}/data/summary`,
      );
      setSummary(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  return (
    <div className="space-y-4 text-sa-text">
      <h2 className="text-lg font-semibold">Data explorer</h2>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border border-sa-border bg-sa-raised px-3 py-2 text-sm"
          placeholder="Tenant UUID"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
        />
        <button type="button" className="rounded bg-sa-accent px-4 py-2 text-sm text-white" onClick={() => void load()}>
          Load summary
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {summary && (
        <pre className="overflow-auto rounded border border-sa-border bg-sa-raised p-4 text-xs">
          {JSON.stringify(summary, null, 2)}
        </pre>
      )}
    </div>
  );
}
