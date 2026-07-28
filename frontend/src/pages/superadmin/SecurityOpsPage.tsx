import { useEffect, useState } from "react";
import { Loader2, Shield, Play } from "lucide-react";

import { superadminFetch } from "@/lib/api/superadmin";

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

type DebriefGenerateResult = {
  status: string;
  message?: string;
  report_id?: string;
};

type TenantOption = { id: string; name: string };

const DEBRIEF_TRIGGER_MESSAGES: Record<string, string> = {
  ok: "Weekly debrief generated.",
  skipped: "Debrief already exists for this week — no action taken.",
  skipped_insufficient_data: "Need at least 7 days of sales data.",
  already_generated: "Debrief already exists for this week — no action taken.",
  lifetime_limit_reached: "Lifetime debrief limit reached.",
};

function debriefTriggerMessage(res: DebriefGenerateResult): string {
  if (res.message && DEBRIEF_TRIGGER_MESSAGES[res.message]) {
    return DEBRIEF_TRIGGER_MESSAGES[res.message];
  }
  if (res.message) return res.message;
  return DEBRIEF_TRIGGER_MESSAGES[res.status] ?? `Status: ${res.status}`;
}

export function SecurityOpsPage() {
  const [data, setData] = useState<SecuritySummary | null>(null);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [triggerMsg, setTriggerMsg] = useState("");
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    superadminFetch<SecuritySummary>("/superadmin/security/communications")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));

    superadminFetch<{ items: TenantOption[] }>("/superadmin/tenants?limit=200")
      .then((page) => {
        const list = page.items || [];
        setTenants(list);
        if (list[0]) setSelectedTenant(list[0].id);
      })
      .catch(() => null);
  }, []);

  async function triggerMorningBrief() {
    if (!selectedTenant) return;
    setTriggerMsg("");
    try {
      await superadminFetch(`/superadmin/reports/morning-brief/${selectedTenant}`, {
        method: "POST",
        body: JSON.stringify({
          channel: "email",
          recipient_email: recipientEmail || undefined,
          reason: "Superadmin manual morning brief trigger from Security Ops",
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
      const res = await superadminFetch<DebriefGenerateResult>(
        `/superadmin/reports/weekly-debrief/${selectedTenant}`,
        {
          method: "POST",
          body: JSON.stringify({
            force_regenerate: forceRegenerate,
            reason: "Superadmin manual weekly debrief trigger from Security Ops",
          }),
        },
      );
      setTriggerMsg(debriefTriggerMessage(res));
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
            </div>
            <div className="rounded-lg border border-sa-border bg-sa-raised p-4">
              <p className="text-xs uppercase text-sa-muted">Delivery logs (24h)</p>
              <p className="text-2xl font-semibold text-sa-text mt-1">{data.delivery_logs_24h ?? "—"}</p>
              <p className="text-xs text-sa-muted mt-2">WhatsApp skipped: {data.whatsapp_skipped_24h ?? 0}</p>
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
            <label className="flex items-center gap-2 text-xs text-sa-muted">
              <input type="checkbox" checked={forceRegenerate} onChange={(e) => setForceRegenerate(e.target.checked)} />
              Force regenerate weekly debrief (may replace existing report)
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void triggerMorningBrief()} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-sa-accent text-white">
                <Play className="h-3 w-3" /> Trigger morning brief
              </button>
              <button type="button" onClick={() => void triggerWeeklyDebrief()} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-sa-border text-sa-text">
                <Play className="h-3 w-3" /> Trigger weekly debrief
              </button>
            </div>
            {triggerMsg && <p className="text-xs text-sa-muted">{triggerMsg}</p>}
          </div>
        </>
      )}
    </div>
  );
}
