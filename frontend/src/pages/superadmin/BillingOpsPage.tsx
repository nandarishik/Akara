import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw, Send } from "lucide-react";

import { apiFetch } from "@/lib/api";

interface WebhookStatus {
  last_24h_total: number;
  last_24h_processed: number;
  last_24h_errors: number;
  recent_events: Array<{
    event_id: string;
    event_type: string;
    processed_at: string | null;
    error_message: string | null;
    created_at: string;
  }>;
}

interface TimelineEvent {
  type: string;
  invoice_number?: string;
  total_amount?: number;
  status?: string;
  created_at?: string;
  day_offset?: number;
  channel?: string;
  sent_at?: string;
}

interface TimelineResponse {
  tenant_id: string;
  events: TimelineEvent[];
}

export function BillingOpsPage() {
  const [status, setStatus] = useState<WebhookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<WebhookStatus>("/admin/billing/webhooks/status");
      setStatus(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function loadTimeline() {
    if (!tenantId.trim()) return;
    setTimelineLoading(true);
    setResendMessage("");
    try {
      const data = await apiFetch<TimelineResponse>(
        `/admin/billing/timeline/${encodeURIComponent(tenantId.trim())}`
      );
      setTimeline(data);
    } catch (e) {
      setTimeline(null);
      setError(e instanceof Error ? e.message : "Failed to load timeline");
    } finally {
      setTimelineLoading(false);
    }
  }

  async function handleResendInvoice() {
    if (!tenantId.trim()) return;
    setResendLoading(true);
    setResendMessage("");
    try {
      const result = await apiFetch<{ status: string; invoice_number: string }>(
        `/admin/billing/resend-invoice/${encodeURIComponent(tenantId.trim())}`,
        { method: "POST" }
      );
      setResendMessage(`Sent invoice ${result.invoice_number} to tenant admin`);
      await loadTimeline();
    } catch (e) {
      setResendMessage(e instanceof Error ? e.message : "Resend failed");
    } finally {
      setResendLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-sa-text">Billing Operations</h1>
          <p className="text-sm text-sa-muted mt-1">
            Razorpay webhook health, payment timeline, and invoice resend.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 text-sm text-sa-accent hover:underline"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-sa-accent" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {status && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-sa-border bg-sa-raised p-4">
              <p className="text-xs text-sa-muted uppercase">Webhooks (24h)</p>
              <p className="text-2xl font-bold text-sa-text mt-1">{status.last_24h_total}</p>
            </div>
            <div className="rounded-lg border border-sa-border bg-sa-raised p-4">
              <p className="text-xs text-sa-muted uppercase">Processed</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{status.last_24h_processed}</p>
            </div>
            <div className="rounded-lg border border-sa-border bg-sa-raised p-4">
              <p className="text-xs text-sa-muted uppercase">Errors</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{status.last_24h_errors}</p>
            </div>
          </div>

          <div className="rounded-lg border border-sa-border bg-sa-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-sa-border text-sm font-medium text-sa-text">
              Recent webhook events
            </div>
            <div className="divide-y divide-sa-border">
              {status.recent_events.length === 0 ? (
                <p className="p-4 text-sm text-sa-muted">No events in the last 24 hours.</p>
              ) : (
                status.recent_events.map((ev) => (
                  <div key={ev.event_id} className="px-4 py-3 text-sm flex justify-between gap-4">
                    <div>
                      <span className="text-sa-text font-mono text-xs">{ev.event_type}</span>
                      {ev.error_message && (
                        <p className="text-red-400 text-xs mt-1">{ev.error_message}</p>
                      )}
                    </div>
                    <span className="text-sa-muted text-xs shrink-0">
                      {ev.processed_at ? "OK" : "pending"}{" "}
                      {new Date(ev.created_at).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      <div className="rounded-lg border border-sa-border bg-sa-raised p-4 space-y-4">
        <h2 className="text-sm font-medium text-sa-text">Tenant payment timeline</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="Tenant UUID"
            className="flex-1 min-w-[200px] rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text"
          />
          <button
            type="button"
            onClick={loadTimeline}
            disabled={timelineLoading || !tenantId.trim()}
            className="px-4 py-2 rounded-md bg-sa-accent text-white text-sm disabled:opacity-50"
          >
            {timelineLoading ? "Loading…" : "Load timeline"}
          </button>
          <button
            type="button"
            onClick={handleResendInvoice}
            disabled={resendLoading || !tenantId.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-sa-border text-sm text-sa-text hover:bg-sa-base disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {resendLoading ? "Sending…" : "Resend latest invoice"}
          </button>
        </div>
        {resendMessage && (
          <p className="text-sm text-sa-muted">{resendMessage}</p>
        )}
        {timeline && (
          <div className="divide-y divide-sa-border border border-sa-border rounded-md overflow-hidden">
            {timeline.events.length === 0 ? (
              <p className="p-4 text-sm text-sa-muted">No billing events for this tenant.</p>
            ) : (
              timeline.events.map((ev, i) => (
                <div key={i} className="px-4 py-3 text-sm flex justify-between gap-4">
                  <div>
                    <span className="text-sa-text capitalize">{ev.type}</span>
                    {ev.type === "invoice" && (
                      <span className="text-sa-muted ml-2">
                        {ev.invoice_number} — ₹{ev.total_amount?.toLocaleString("en-IN")}
                      </span>
                    )}
                    {ev.type === "dunning" && (
                      <span className="text-sa-muted ml-2">
                        Day {ev.day_offset} · {ev.channel} · {ev.status}
                      </span>
                    )}
                  </div>
                  <span className="text-sa-muted text-xs shrink-0">
                    {new Date(ev.created_at ?? ev.sent_at ?? "").toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-sa-border bg-sa-raised p-4 text-sm text-sa-muted">
        <p>
          Manual NEFT reconciliation and trial extension —{" "}
          <Link to="/superadmin/tenants" className="text-sa-accent hover:underline">
            manage via Tenants
          </Link>{" "}
          (full ops in Day 8).
        </p>
      </div>
    </div>
  );
}
