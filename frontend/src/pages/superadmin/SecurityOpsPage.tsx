import { useEffect, useState } from "react";
import { Loader2, Shield, Play } from "lucide-react";

import { apiFetch } from "@/lib/api";

type DeliveryLogRow = {
  id: string;
  channel: string;
  template: string;
  status: string;
  created_at: string;
  tenant_id?: string | null;
  error_message?: string | null;
};

type SecuritySummary = {
  alert_triggers_24h: number;
  last_alert_trigger_at: string | null;
  residency_note: string;
  delivery_logs_24h?: number;
  whatsapp_skipped_24h?: number;
  activation_pending_day1?: number;
  activation_pending_day3?: number;
  recent_deliveries?: DeliveryLogRow[];
};

type TenantOption = { id: string; name: string };

export function SecurityOpsPage() {
  const [data, setData] = useState<SecuritySummary | null>(null);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [triggerMsg, setTriggerMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<SecuritySummary>("/admin/security/communications")
      .then(setData)
      .catch(() =>
        apiFetch<SecuritySummary>("/admin/security/summary")
          .then(setData)
          .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      )
      .finally(() => setLoading(false));

    apiFetch<TenantOption[]>("/admin/tenants/")
      .then((list) => {
        setTenants(list);
        if (list[0]) setSelectedTenant(list[0].id);
      })
      .catch(() => null);
  }, []);

  async function triggerMorningBrief() {
    if (!selectedTenant || !recipientEmail) return;
    setTriggerMsg("");
    try {
      await apiFetch("/admin/reports/morning-brief", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: selectedTenant,
          recipient_email: recipientEmail,
        }),
      });
      setTriggerMsg("Morning brief triggered.");
    } catch (e) {
      setTriggerMsg(e instanceof Error ? e.message : "Trigger failed");
    }
  }

  async function triggerWeeklyDebrief() {
    if (!selectedTenant) return;
    setTriggerMsg("");
    try {
      await apiFetch(`/admin/reports/weekly-debrief/${selectedTenant}`, {
        method: "POST",
        body: JSON.stringify({ reason: "Superadmin manual trigger from Security Ops" }),
      });
      setTriggerMsg("Weekly debrief triggered.");
    } catch (e) {
      setTriggerMsg(e instanceof Error ? e.message : "Trigger failed");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-sa-text flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security &amp; compliance
        </h1>
        <p className="text-sm text-sa-muted mt-1">Rate limits, alert evaluator, and delivery diagnostics.</p>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-sa-muted" />
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-sa-border bg-sa-raised p-4">
              <p className="text-xs uppercase text-sa-muted">Alert triggers (24h)</p>
              <p className="text-2xl font-semibold text-sa-text mt-1">{data.alert_triggers_24h}</p>
              <p className="text-xs text-sa-muted mt-2">
                Last: {data.last_alert_trigger_at ? new Date(data.last_alert_trigger_at).toLocaleString() : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-sa-border bg-sa-raised p-4">
              <p className="text-xs uppercase text-sa-muted">Delivery logs (24h)</p>
              <p className="text-2xl font-semibold text-sa-text mt-1">{data.delivery_logs_24h ?? "—"}</p>
              <p className="text-xs text-sa-muted mt-2">
                WhatsApp skipped: {data.whatsapp_skipped_24h ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-sa-border bg-sa-raised p-4">
              <p className="text-xs uppercase text-sa-muted">Activation pending</p>
              <p className="text-sm text-sa-text mt-2">
                Day 1 (no import): {data.activation_pending_day1 ?? "—"}<br />
                Day 3 (no copilot): {data.activation_pending_day3 ?? "—"}
              </p>
            </div>
            <div className="rounded-lg border border-sa-border bg-sa-raised p-4">
              <p className="text-xs uppercase text-sa-muted">Data residency</p>
              <p className="text-sm text-sa-text mt-2">{data.residency_note}</p>
            </div>
          </div>

          <div className="rounded-lg border border-sa-border bg-sa-raised p-4 space-y-3">
            <h2 className="text-sm font-semibold text-sa-text">Manual report triggers</h2>
            <select
              className="w-full max-w-md text-sm border border-sa-border rounded px-2 py-1.5 bg-sa-canvas text-sa-text"
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <input
              type="email"
              placeholder="Recipient email (morning brief)"
              className="w-full max-w-md text-sm border border-sa-border rounded px-2 py-1.5 bg-sa-canvas text-sa-text"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={triggerMorningBrief}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-sa-accent text-white"
              >
                <Play className="h-3 w-3" /> Trigger morning brief
              </button>
              <button
                type="button"
                onClick={triggerWeeklyDebrief}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-sa-border text-sa-text"
              >
                <Play className="h-3 w-3" /> Trigger weekly debrief
              </button>
            </div>
            {triggerMsg && <p className="text-xs text-sa-muted">{triggerMsg}</p>}
          </div>

          {(data.recent_deliveries?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-sa-border bg-sa-raised overflow-hidden">
              <div className="px-4 py-3 border-b border-sa-border">
                <h2 className="text-sm font-semibold text-sa-text">Recent delivery logs</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-sa-text">
                  <thead>
                    <tr className="text-sa-muted border-b border-sa-border">
                      <th className="text-left p-2">Time</th>
                      <th className="text-left p-2">Channel</th>
                      <th className="text-left p-2">Template</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_deliveries!.map((row) => (
                      <tr key={row.id} className="border-b border-sa-border/50">
                        <td className="p-2">{new Date(row.created_at).toLocaleString()}</td>
                        <td className="p-2">{row.channel}</td>
                        <td className="p-2">{row.template}</td>
                        <td className="p-2">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
