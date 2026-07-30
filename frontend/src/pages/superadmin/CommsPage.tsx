import { useEffect, useState } from "react";
import { Play } from "lucide-react";

import { sa, superadminFetch, type BroadcastHistoryRow } from "@/lib/api/superadmin";

type SecuritySummary = {
  alert_triggers_24h: number;
  delivery_logs_24h?: number;
  whatsapp_skipped_24h?: number;
};

type TenantOption = { id: string; name: string };

const CHANNELS = ["email", "whatsapp"] as const;

export function SuperadminCommsPage() {
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("info");
  const [bannerExpiresAt, setBannerExpiresAt] = useState("");
  const [status, setStatus] = useState("");

  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyWhatsapp, setBodyWhatsapp] = useState("");
  const [channels, setChannels] = useState<string[]>(["email"]);
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [broadcastStatus, setBroadcastStatus] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const [history, setHistory] = useState<BroadcastHistoryRow[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);

  const [diagData, setDiagData] = useState<SecuritySummary | null>(null);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [triggerMsg, setTriggerMsg] = useState("");

  useEffect(() => {
    void sa.broadcastHistory().then((r) => {
      setHistory(r.items);
      setHistoryTotal(r.total);
    });
    void superadminFetch<SecuritySummary>("/superadmin/security/communications")
      .then(setDiagData)
      .catch(() => null);
    void superadminFetch<{ items: TenantOption[] }>("/superadmin/tenants?limit=200")
      .then((page) => {
        const list = page.items || [];
        setTenants(list);
        if (list[0]) setSelectedTenant(list[0].id);
      })
      .catch(() => null);
  }, []);

  function toggleChannel(ch: string) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  }

  async function saveBanner() {
    await superadminFetch("/superadmin/notifications/system-banner", {
      method: "POST",
      body: JSON.stringify({
        message,
        severity,
        expires_at: bannerExpiresAt ? new Date(bannerExpiresAt).toISOString() : null,
        reason: "System banner update from superadmin comms UI",
      }),
    });
    setStatus("Banner saved");
  }

  async function clearBanner() {
    await superadminFetch("/superadmin/notifications/system-banner", {
      method: "DELETE",
      body: JSON.stringify({ reason: "Clear system banner from superadmin comms UI" }),
    });
    setMessage("");
    setBannerExpiresAt("");
    setStatus("Banner cleared");
  }

  async function sendBroadcast(schedule = false) {
    setBroadcastStatus(schedule ? "Scheduling…" : "Sending…");
    try {
      const payload: Record<string, unknown> = {
        subject,
        body_html: bodyHtml,
        body_whatsapp: bodyWhatsapp,
        channels,
        plan_filter: planFilter || null,
        status_filter: statusFilter || null,
        dry_run: dryRun,
        reason: dryRun
          ? "Broadcast dry-run preview"
          : schedule
            ? "Scheduled broadcast from comms UI"
            : "Broadcast send from comms UI",
      };
      if (schedule && scheduledAt) {
        payload.scheduled_at = new Date(scheduledAt).toISOString();
        payload.dry_run = false;
      }
      const res = await sa.broadcast(payload) as {
        tenant_count?: number;
        sent?: number;
        scheduled?: boolean;
        scheduled_at?: string;
        impact?: { tenant_count?: number };
      };
      const count = res.tenant_count ?? res.impact?.tenant_count ?? res.sent;
      if (res.scheduled) {
        setBroadcastStatus(`Scheduled for ${new Date(res.scheduled_at ?? scheduledAt).toLocaleString()}`);
        const h = await sa.broadcastHistory();
        setHistory(h.items);
        setHistoryTotal(h.total);
      } else {
        setBroadcastStatus(
          dryRun ? `Dry run: would reach ${count ?? "?"} tenant(s)` : `Sent to ${res.sent ?? 0} admin(s)`,
        );
        if (!dryRun) {
          const h = await sa.broadcastHistory();
          setHistory(h.items);
          setHistoryTotal(h.total);
        }
      }
    } catch (err) {
      setBroadcastStatus(err instanceof Error ? err.message : "Broadcast failed");
    }
  }

  function reuseBroadcast(h: BroadcastHistoryRow) {
    setSubject(h.subject);
    setBodyHtml(h.body_html ?? "");
    setBodyWhatsapp(h.whatsapp_body ?? "");
    setPlanFilter(h.plan_filter ?? "");
    setStatusFilter(h.status_filter ?? "");
    setChannels(h.channels.length > 0 ? [...h.channels] : ["email"]);
    setDryRun(false);
    setBroadcastStatus(`Prefilled from "${h.subject}" — review and send`);
  }

  async function cancelScheduled(id: string) {
    try {
      await sa.cancelBroadcast(id, "Cancelled from comms UI");
      const h = await sa.broadcastHistory();
      setHistory(h.items);
      setHistoryTotal(h.total);
      setBroadcastStatus("Scheduled broadcast cancelled");
    } catch (e) {
      setBroadcastStatus(e instanceof Error ? e.message : "Cancel failed");
    }
  }

  async function triggerMorningBrief() {
    if (!selectedTenant) return;
    setTriggerMsg("");
    try {
      await superadminFetch(`/superadmin/reports/morning-brief/${selectedTenant}`, {
        method: "POST",
        body: JSON.stringify({
          channel: "email",
          recipient_email: recipientEmail || undefined,
          reason: "Superadmin manual morning brief trigger from Comms diagnostics",
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
      await superadminFetch(`/superadmin/reports/weekly-debrief/${selectedTenant}`, {
        method: "POST",
        body: JSON.stringify({
          reason: "Superadmin manual weekly debrief trigger from Comms diagnostics",
        }),
      });
      setTriggerMsg("Weekly debrief triggered.");
    } catch (e) {
      setTriggerMsg(e instanceof Error ? e.message : "Trigger failed");
    }
  }

  return (
    <div className="max-w-3xl space-y-8 text-sa-text">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">System banner</h2>
        <textarea
          className="w-full rounded border border-sa-border bg-sa-raised p-3 text-sm"
          rows={3}
          placeholder="Maintenance message…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded border border-sa-border bg-sa-raised px-3 py-2 text-sm"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          <div>
            <label className="text-xs text-sa-muted block mb-1">Expires at (optional)</label>
            <input
              type="datetime-local"
              className="rounded border border-sa-border bg-sa-raised px-3 py-2 text-sm"
              value={bannerExpiresAt}
              onChange={(e) => setBannerExpiresAt(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded bg-sa-accent px-4 py-2 text-sm text-white" onClick={() => void saveBanner()}>
            Publish banner
          </button>
          <button type="button" className="rounded border border-sa-border px-4 py-2 text-sm" onClick={() => void clearBanner()}>
            Clear
          </button>
        </div>
        {status && <p className="text-sm text-sa-muted">{status}</p>}
      </section>

      <section className="space-y-4 border-t border-sa-border pt-6">
        <h2 className="text-lg font-semibold">Email broadcast</h2>
        <input
          className="w-full rounded border border-sa-border bg-sa-raised px-3 py-2 text-sm"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <textarea
          className="w-full rounded border border-sa-border bg-sa-raised p-3 text-sm font-mono"
          rows={5}
          placeholder="HTML body (email)"
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
        />
        <textarea
          className="w-full rounded border border-sa-border bg-sa-raised p-3 text-sm"
          rows={3}
          placeholder="WhatsApp message (plain text)"
          value={bodyWhatsapp}
          onChange={(e) => setBodyWhatsapp(e.target.value)}
        />
        {bodyHtml && (
          <div>
            <button
              type="button"
              className="text-xs text-sa-accent underline"
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? "Hide" : "Show"} email preview
            </button>
            {showPreview && (
              <div
                className="mt-2 rounded border border-sa-border bg-white text-black p-4 text-sm prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-4">
          {CHANNELS.map((ch) => (
            <label key={ch} className="flex items-center gap-2 text-sm capitalize">
              <input
                type="checkbox"
                checked={channels.includes(ch)}
                onChange={() => toggleChannel(ch)}
              />
              {ch}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded border border-sa-border bg-sa-raised px-3 py-2 text-sm"
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
          >
            <option value="">All plans</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
          </select>
          <select
            className="rounded border border-sa-border bg-sa-raised px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="past_due">Past due</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          Dry run (preview recipient count)
        </label>
        <div>
          <label className="text-xs text-sa-muted block mb-1">Schedule send (optional)</label>
          <input
            type="datetime-local"
            className="rounded border border-sa-border bg-sa-raised px-3 py-2 text-sm"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-sa-accent px-4 py-2 text-sm text-white disabled:opacity-50"
            disabled={!subject || channels.length === 0 || (!bodyHtml && !bodyWhatsapp)}
            onClick={() => void sendBroadcast(false)}
          >
            {dryRun ? "Preview broadcast" : "Send now"}
          </button>
          {scheduledAt && !dryRun && (
            <button
              type="button"
              className="rounded border border-sa-border px-4 py-2 text-sm disabled:opacity-50"
              disabled={!subject || channels.length === 0 || (!bodyHtml && !bodyWhatsapp)}
              onClick={() => void sendBroadcast(true)}
            >
              Schedule broadcast
            </button>
          )}
        </div>
        {broadcastStatus && <p className="text-sm text-sa-muted">{broadcastStatus}</p>}
      </section>

      <section className="space-y-3 border-t border-sa-border pt-6">
        <h2 className="text-lg font-semibold">Broadcast history</h2>
        <div className="rounded-lg border border-sa-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sa-raised text-left text-xs text-sa-muted">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Filters</th>
                <th className="p-3">Status</th>
                <th className="p-3">Sent</th>
                <th className="p-3 w-28" />
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-sa-border">
                  <td className="p-3 whitespace-nowrap">
                    {new Date(h.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="p-3">{h.subject}</td>
                  <td className="p-3 text-xs text-sa-muted">
                    {[h.plan_filter, h.status_filter].filter(Boolean).join(" · ") || "All"}
                  </td>
                  <td className="p-3 text-xs capitalize">
                    {h.status ?? "sent"}
                    {h.scheduled_at && h.status === "scheduled" && (
                      <span className="block text-sa-muted">
                        {new Date(h.scheduled_at).toLocaleString("en-IN")}
                      </span>
                    )}
                  </td>
                  <td className="p-3 tabular-nums">
                    {h.sent_count}/{h.tenant_count}
                  </td>
                  <td className="p-3 space-x-2">
                    <button
                      type="button"
                      className="text-xs text-sa-accent underline"
                      onClick={() => reuseBroadcast(h)}
                    >
                      Resend
                    </button>
                    {h.status === "scheduled" && (
                      <button
                        type="button"
                        className="text-xs text-red-400 underline"
                        onClick={() => void cancelScheduled(h.id)}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-sa-muted">No broadcasts yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {historyTotal > history.length && (
          <p className="text-xs text-sa-muted">Showing {history.length} of {historyTotal}</p>
        )}
      </section>

      <section className="space-y-4 border-t border-sa-border pt-6">
        <h2 className="text-lg font-semibold">Delivery diagnostics</h2>
        {diagData && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-sa-border bg-sa-raised p-4">
              <p className="text-xs uppercase text-sa-muted">Alert triggers (24h)</p>
              <p className="text-2xl font-semibold mt-1">{diagData.alert_triggers_24h}</p>
            </div>
            <div className="rounded-lg border border-sa-border bg-sa-raised p-4">
              <p className="text-xs uppercase text-sa-muted">Delivery logs (24h)</p>
              <p className="text-2xl font-semibold mt-1">{diagData.delivery_logs_24h ?? "—"}</p>
              <p className="text-xs text-sa-muted mt-2">
                WhatsApp skipped: {diagData.whatsapp_skipped_24h ?? 0}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-sa-border bg-sa-raised p-4 space-y-3">
          <h3 className="text-sm font-semibold">Test report triggers</h3>
          <select
            className="w-full max-w-md text-sm border border-sa-border rounded px-2 py-1.5 bg-sa-surface text-sa-text"
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
            className="w-full max-w-md text-sm border border-sa-border rounded px-2 py-1.5 bg-sa-surface text-sa-text"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void triggerMorningBrief()}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-sa-accent text-white"
            >
              <Play className="h-3 w-3" /> Trigger morning brief
            </button>
            <button
              type="button"
              onClick={() => void triggerWeeklyDebrief()}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-sa-border text-sa-text"
            >
              <Play className="h-3 w-3" /> Trigger weekly debrief
            </button>
          </div>
          {triggerMsg && <p className="text-xs text-sa-muted">{triggerMsg}</p>}
        </div>
      </section>
    </div>
  );
}
