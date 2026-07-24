import { useEffect, useState } from "react";
import { Loader2, Shield } from "lucide-react";

import { apiFetch } from "@/lib/api";

type SecuritySummary = {
  alert_triggers_24h: number;
  last_alert_trigger_at: string | null;
  residency_note: string;
};

export function SecurityOpsPage() {
  const [data, setData] = useState<SecuritySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<SecuritySummary>("/admin/security/summary")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-sa-text flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security &amp; compliance
        </h1>
        <p className="text-sm text-sa-muted mt-1">Rate limits, alert evaluator, and residency status.</p>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-sa-muted" />
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-sa-border bg-sa-raised p-4">
            <p className="text-xs uppercase text-sa-muted">Alert triggers (24h)</p>
            <p className="text-2xl font-semibold text-sa-text mt-1">{data.alert_triggers_24h}</p>
            <p className="text-xs text-sa-muted mt-2">
              Last: {data.last_alert_trigger_at ? new Date(data.last_alert_trigger_at).toLocaleString() : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-sa-border bg-sa-raised p-4">
            <p className="text-xs uppercase text-sa-muted">Data residency</p>
            <p className="text-sm text-sa-text mt-2">{data.residency_note}</p>
          </div>
        </div>
      )}
    </div>
  );
}
