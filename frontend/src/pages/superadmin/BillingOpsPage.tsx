import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, RefreshCw, Send } from "lucide-react";

import { sa, superadminFetch, type TenantRow } from "@/lib/api/superadmin";

type BillingTab = "ops" | "ledger" | "reconciliation" | "coupons";

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
  const [searchParams] = useSearchParams();
  const urlTenant = searchParams.get("tenant") ?? "";
  const [status, setStatus] = useState<WebhookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tenantId, setTenantId] = useState(urlTenant);
  const [selectedTenant, setSelectedTenant] = useState<TenantRow | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [manualPlan, setManualPlan] = useState<"pro" | "business" | "free">("pro");
  const [manualReason, setManualReason] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [trialDays, setTrialDays] = useState(14);
  const [trialReason, setTrialReason] = useState("");
  const [trialLoading, setTrialLoading] = useState(false);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<string>("");
  const reconcileReason = "Billing reconcile check from superadmin ops panel";
  const [opsMessage, setOpsMessage] = useState("");
  const [tab, setTab] = useState<BillingTab>("ops");
  const [ledger, setLedger] = useState<Array<Record<string, unknown>>>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [coupons, setCoupons] = useState<Array<Record<string, unknown>>>([]);
  const [couponForm, setCouponForm] = useState({
    code: "",
    name: "",
    discount_type: "percent",
    discount_value: 10,
  });
  const [promoCouponId, setPromoCouponId] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [reconData, setReconData] = useState<Record<string, unknown> | null>(null);
  const [refundPaymentId, setRefundPaymentId] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundPreview, setRefundPreview] = useState<Record<string, unknown> | null>(null);
  const [ledgerTenantFilter, setLedgerTenantFilter] = useState("");
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState("");
  const [markPaidInvoiceId, setMarkPaidInvoiceId] = useState("");
  const [markPaidBankRef, setMarkPaidBankRef] = useState("");
  const [markPaidMethod, setMarkPaidMethod] = useState<"NEFT" | "UPI" | "CHEQUE">("NEFT");
  const [markPaidEvidence, setMarkPaidEvidence] = useState("");
  const [manualPayAmount, setManualPayAmount] = useState("");
  const [manualPayBankRef, setManualPayBankRef] = useState("");
  const [manualPayEvidence, setManualPayEvidence] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [invoiceRetryId, setInvoiceRetryId] = useState("");
  const [subAction, setSubAction] = useState<"pause" | "resume" | "cancel" | "change_date">("pause");
  const [subNewDate, setSubNewDate] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await superadminFetch<WebhookStatus>("/superadmin/billing/webhooks/status");
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
      const data = await superadminFetch<TimelineResponse>(
        `/superadmin/billing/timeline/${encodeURIComponent(tenantId.trim())}`
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
      const result = await superadminFetch<{ status: string; invoice_number: string }>(
        `/superadmin/billing/resend-invoice/${encodeURIComponent(tenantId.trim())}`,
        {
          method: "POST",
          body: JSON.stringify({
            reason: "Superadmin resend latest invoice from billing ops panel",
          }),
        },
      );
      setResendMessage(`Sent invoice ${result.invoice_number} to tenant admin`);
      await loadTimeline();
    } catch (e) {
      setResendMessage(e instanceof Error ? e.message : "Resend failed");
    } finally {
      setResendLoading(false);
    }
  }

  async function handleManualUpgrade() {
    if (!tenantId.trim() || !manualReason.trim()) return;
    setManualLoading(true);
    setOpsMessage("");
    try {
      const result = await superadminFetch<{ plan: string; plan_status: string }>(
        `/superadmin/billing/manual-upgrade/${encodeURIComponent(tenantId.trim())}`,
        {
          method: "POST",
          body: JSON.stringify({
            plan: manualPlan,
            reason: manualReason.trim(),
            clear_past_due: true,
          }),
        }
      );
      setOpsMessage(`Manual upgrade applied: ${result.plan} (${result.plan_status})`);
      await loadTimeline();
    } catch (e) {
      setOpsMessage(e instanceof Error ? e.message : "Manual upgrade failed");
    } finally {
      setManualLoading(false);
    }
  }

  async function handleExtendTrial() {
    if (!tenantId.trim() || !trialReason.trim()) return;
    setTrialLoading(true);
    setOpsMessage("");
    try {
      const result = await superadminFetch<{ trial_ends_at: string }>(
        `/superadmin/billing/extend-trial/${encodeURIComponent(tenantId.trim())}`,
        {
          method: "POST",
          body: JSON.stringify({ days: trialDays, reason: trialReason.trim() }),
        }
      );
      setOpsMessage(`Trial extended until ${new Date(result.trial_ends_at).toLocaleString()}`);
      await loadTimeline();
    } catch (e) {
      setOpsMessage(e instanceof Error ? e.message : "Trial extension failed");
    } finally {
      setTrialLoading(false);
    }
  }

  async function handleReconcile(apply: boolean) {
    if (!tenantId.trim() || reconcileReason.trim().length < 10) return;
    setReconcileLoading(true);
    setReconcileResult("");
    setOpsMessage("");
    try {
      const result = await superadminFetch<{
        mismatches: string[];
        applied: boolean;
        db: Record<string, unknown>;
        razorpay: Record<string, unknown>;
      }>(
        `/superadmin/billing/reconcile/${encodeURIComponent(tenantId.trim())}`,
        {
          method: "POST",
          body: JSON.stringify({ apply, reason: reconcileReason.trim() }),
        },
      );
      if (result.mismatches.length === 0) {
        setReconcileResult("No mismatches — DB and Razorpay are in sync.");
      } else {
        setReconcileResult(
          `${result.mismatches.join("; ")}${result.applied ? " (sync applied)" : ""}`
        );
      }
    } catch (e) {
      setReconcileResult(e instanceof Error ? e.message : "Reconcile failed");
    } finally {
      setReconcileLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const t = searchParams.get("tenant")?.trim();
    if (!t) return;
    setTenantId(t);
    setTimelineLoading(true);
    setResendMessage("");
    void sa
      .billingTimeline(t)
      .then((d) => setTimeline(d as unknown as TimelineResponse))
      .catch((e) => {
        setTimeline(null);
        setError(e instanceof Error ? e.message : "Failed to load timeline");
      })
      .finally(() => setTimelineLoading(false));
  }, [searchParams]);

  async function loadLedger() {
    setLedgerLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (ledgerTenantFilter.trim()) params.set("tenant_id", ledgerTenantFilter.trim());
      if (ledgerTypeFilter.trim()) params.set("entry_type", ledgerTypeFilter.trim());
      const data = await superadminFetch<{ items: Array<Record<string, unknown>> }>(
        `/superadmin/billing/ledger?${params.toString()}`,
      );
      setLedger(data.items ?? []);
    } catch {
      setLedger([]);
    } finally {
      setLedgerLoading(false);
    }
  }

  async function uploadEvidence(file: File | null): Promise<string | null> {
    if (!file) return null;
    const token = await (async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? "";
    })();
    const csrfMatch = document.cookie.match(/(?:^|;\s*)akara_csrf=([^;]+)/);
    const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : "";
    const form = new FormData();
    form.append("file", file);
    form.append("alt_text", `Billing evidence ${file.name}`);
    form.append("kind", "document");
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/superadmin/content/media/upload`, {
      method: "POST",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      body: form,
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { asset?: { storage_path?: string } };
    return data.asset?.storage_path ?? null;
  }

  async function loadCoupons() {
    try {
      const data = await superadminFetch<{ items: Array<Record<string, unknown>> }>("/superadmin/billing/coupons");
      setCoupons(data.items ?? []);
    } catch {
      setCoupons([]);
    }
  }

  async function loadReconciliation() {
    if (!tenantId.trim()) return;
    try {
      const data = await superadminFetch<Record<string, unknown>>(
        `/superadmin/billing/reconciliation/${encodeURIComponent(tenantId.trim())}`,
      );
      setReconData(data);
    } catch {
      setReconData(null);
    }
  }

  async function handleRefundPreview() {
    if (!refundPaymentId.trim()) return;
    try {
      const data = await superadminFetch<Record<string, unknown>>("/superadmin/billing/refunds/preview", {
        method: "POST",
        body: JSON.stringify({
          payment_id: refundPaymentId.trim(),
          amount_paise: refundAmount ? parseInt(refundAmount, 10) : null,
          partial: Boolean(refundAmount),
        }),
      });
      setRefundPreview(data);
    } catch (e) {
      setRefundPreview({ error: e instanceof Error ? e.message : "Preview failed" });
    }
  }

  useEffect(() => {
    if (tab === "ledger") void loadLedger();
    if (tab === "coupons") void loadCoupons();
    if (tab === "reconciliation" && tenantId.trim()) void loadReconciliation();
  }, [tab, tenantId, ledgerTenantFilter, ledgerTypeFilter]);

  const billingTabs: { id: BillingTab; label: string }[] = [
    { id: "ops", label: "Ops" },
    { id: "ledger", label: "Ledger" },
    { id: "reconciliation", label: "Reconciliation" },
    { id: "coupons", label: "Coupons" },
  ];

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-sa-text">Billing Operations</h1>
          <p className="text-sm text-sa-muted mt-1">
            Razorpay webhooks, ledger, reconciliation, coupons, and manual ops.
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

      <div className="flex gap-2 border-b border-sa-border pb-2">
        {billingTabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 text-sm rounded-lg ${tab === id ? "bg-sa-raised text-sa-text" : "text-sa-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "ledger" && (
        <div className="rounded-lg border border-sa-border bg-sa-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-sa-border flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-sa-text">Billing ledger</span>
            <input
              placeholder="Tenant UUID filter"
              value={ledgerTenantFilter}
              onChange={(e) => setLedgerTenantFilter(e.target.value)}
              className="rounded-md border border-sa-border bg-sa-base px-2 py-1 text-xs text-sa-text"
            />
            <input
              placeholder="Entry type filter"
              value={ledgerTypeFilter}
              onChange={(e) => setLedgerTypeFilter(e.target.value)}
              className="rounded-md border border-sa-border bg-sa-base px-2 py-1 text-xs text-sa-text"
            />
            <button type="button" onClick={() => void loadLedger()} className="text-xs text-sa-accent hover:underline">
              Apply filters
            </button>
          </div>
          {ledgerLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-sa-accent" /></div>
          ) : ledger.length === 0 ? (
            <p className="p-4 text-sm text-sa-muted">No ledger entries yet.</p>
          ) : (
            <div className="divide-y divide-sa-border">
              {ledger.map((row) => (
                <div key={String(row.id)} className="px-4 py-3 text-sm flex justify-between">
                  <span className="text-sa-text">{String(row.entry_type)} · ₹{Number(row.amount_minor || 0) / 100}</span>
                  <span className="text-sa-muted text-xs">{String(row.status)} · {String(row.created_at ?? "").slice(0, 10)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "reconciliation" && (
        <div className="space-y-4">
          <p className="text-sm text-sa-muted">Enter tenant ID in Ops tab or URL ?tenant=… then open Reconciliation.</p>
          {reconData ? (
            <div className="rounded-lg border border-sa-border bg-sa-raised overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-sa-border">
                  <tr className="text-sa-muted text-left">
                    <th className="p-3">Razorpay</th>
                    <th className="p-3">Invoice + GST</th>
                    <th className="p-3">Ledger</th>
                    <th className="p-3">Tenant plan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-sa-border align-top">
                    <td className="p-3 text-sa-text">
                      {(reconData.razorpay as Record<string, unknown>)?.status as string ?? "—"}
                      <br />
                      <span className="text-xs text-sa-muted">
                        ₹{Number((reconData.razorpay as Record<string, unknown>)?.amount_paise ?? 0) / 100}
                      </span>
                    </td>
                    <td className="p-3 text-sa-text">
                      {(reconData.invoice as Record<string, unknown>)?.invoice_number as string ?? "—"}
                      <br />
                      <span className="text-xs text-sa-muted">
                        {(reconData.invoice as Record<string, unknown>)?.status as string ?? ""} · GST ₹
                        {Number((reconData.invoice as Record<string, unknown>)?.gst_amount ?? 0)}
                      </span>
                    </td>
                    <td className="p-3 text-sa-text">
                      {(reconData.ledger as Record<string, unknown>)?.entry_type as string ?? "—"}
                      <br />
                      <span className="text-xs text-sa-muted">
                        {(reconData.ledger as Record<string, unknown>)?.status as string ?? ""}
                      </span>
                    </td>
                    <td className="p-3 text-sa-text">
                      {(reconData.entitlement as Record<string, unknown>)?.plan as string ?? "—"}
                      <br />
                      <span className="text-xs text-sa-muted">
                        {(reconData.entitlement as Record<string, unknown>)?.plan_status as string ?? ""}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="p-3 text-xs text-sa-muted">
                Aligned: {reconData.aligned ? "Yes" : "No — review mismatches in Ops reconcile"}
              </p>
            </div>
          ) : (
            <button type="button" onClick={() => void loadReconciliation()} className="text-sm text-sa-accent hover:underline">
              Load reconciliation for tenant
            </button>
          )}
        </div>
      )}

      {tab === "coupons" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-sa-border bg-sa-raised p-4 grid gap-2 md:grid-cols-4">
            <input
              placeholder="Coupon code"
              value={couponForm.code}
              onChange={(e) => setCouponForm((f) => ({ ...f, code: e.target.value }))}
              className="rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text"
            />
            <input
              placeholder="Name"
              value={couponForm.name}
              onChange={(e) => setCouponForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text"
            />
            <input
              type="number"
              placeholder="Discount value"
              value={couponForm.discount_value}
              onChange={(e) => setCouponForm((f) => ({ ...f, discount_value: parseInt(e.target.value, 10) || 0 }))}
              className="rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text"
            />
            <button
              type="button"
              onClick={() =>
                void superadminFetch("/superadmin/billing/coupons", {
                  method: "POST",
                  body: JSON.stringify(couponForm),
                }).then(() => loadCoupons())
              }
              className="rounded-md bg-sa-accent/20 px-3 py-2 text-sm text-sa-text"
            >
              Create coupon
            </button>
          </div>
          <div className="rounded-lg border border-sa-border bg-sa-raised p-4 grid gap-2 md:grid-cols-3">
            <input
              placeholder="Coupon UUID"
              value={promoCouponId}
              onChange={(e) => setPromoCouponId(e.target.value)}
              className="rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text md:col-span-1"
            />
            <input
              placeholder="Promotion code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text"
            />
            <button
              type="button"
              onClick={() =>
                void superadminFetch("/superadmin/billing/promotion-codes", {
                  method: "POST",
                  body: JSON.stringify({ coupon_id: promoCouponId, code: promoCode }),
                }).then(() => setOpsMessage("Promotion code created"))
              }
              className="rounded-md bg-sa-accent/20 px-3 py-2 text-sm text-sa-text"
            >
              Generate promo code
            </button>
          </div>
          <div className="rounded-lg border border-sa-border bg-sa-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-sa-border text-sm font-medium text-sa-text">Coupons</div>
          {coupons.length === 0 ? (
            <p className="p-4 text-sm text-sa-muted">No coupons configured.</p>
          ) : (
            <div className="divide-y divide-sa-border">
              {coupons.map((c) => (
                <div key={String(c.id)} className="px-4 py-3 text-sm">
                  <span className="text-sa-text font-mono">{String(c.code)}</span>
                  <span className="text-sa-muted ml-2">{String(c.discount_type)} {String(c.discount_value)}</span>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      )}

      {tab === "ops" && loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-sa-accent" />
        </div>
      )}

      {tab === "ops" && error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {tab === "ops" && status && (
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
        <div className="flex flex-wrap gap-2 items-start">
          <TenantSearchAutocomplete
            tenantId={tenantId}
            selectedTenant={selectedTenant}
            onSelect={(t) => {
              setTenantId(t.id);
              setSelectedTenant(t);
            }}
            onClear={() => {
              setTenantId("");
              setSelectedTenant(null);
              setTimeline(null);
            }}
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

      <div className="rounded-lg border border-sa-border bg-sa-raised p-4 space-y-4">
        <h2 className="text-sm font-medium text-sa-text">Manual billing ops</h2>
        <p className="text-xs text-sa-muted">
          Enter tenant UUID above first. Use for NEFT/bank transfer or missed webhooks.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-md border border-sa-border p-3">
            <p className="text-xs font-medium text-sa-text uppercase">Manual upgrade</p>
            <select
              value={manualPlan}
              onChange={(e) => setManualPlan(e.target.value as "pro" | "business" | "free")}
              className="w-full rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text"
            >
              <option value="pro">Pro</option>
              <option value="business">Business</option>
              <option value="free">Free</option>
            </select>
            <input
              type="text"
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              placeholder="Reason (e.g. NEFT ref #123)"
              className="w-full rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text"
            />
            <button
              type="button"
              onClick={handleManualUpgrade}
              disabled={manualLoading || !tenantId.trim() || !manualReason.trim()}
              className="w-full px-4 py-2 rounded-md bg-sa-accent text-white text-sm disabled:opacity-50"
            >
              {manualLoading ? "Applying…" : "Apply manual upgrade"}
            </button>
          </div>

          <div className="space-y-2 rounded-md border border-sa-border p-3">
            <p className="text-xs font-medium text-sa-text uppercase">Extend trial</p>
            <input
              type="number"
              min={1}
              max={90}
              value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
              className="w-full rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text"
            />
            <input
              type="text"
              value={trialReason}
              onChange={(e) => setTrialReason(e.target.value)}
              placeholder="Reason for extension"
              className="w-full rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text"
            />
            <button
              type="button"
              onClick={handleExtendTrial}
              disabled={trialLoading || !tenantId.trim() || !trialReason.trim()}
              className="w-full px-4 py-2 rounded-md border border-sa-border text-sm text-sa-text hover:bg-sa-base disabled:opacity-50"
            >
              {trialLoading ? "Extending…" : "Extend trial"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => handleReconcile(false)}
            disabled={reconcileLoading || !tenantId.trim()}
            className="px-4 py-2 rounded-md border border-sa-border text-sm text-sa-text hover:bg-sa-base disabled:opacity-50"
          >
            {reconcileLoading ? "Checking…" : "Check reconcile"}
          </button>
          <button
            type="button"
            onClick={() => handleReconcile(true)}
            disabled={reconcileLoading || !tenantId.trim()}
            className="px-4 py-2 rounded-md bg-amber-600 text-white text-sm disabled:opacity-50"
          >
            Reconcile & apply
          </button>
        </div>
        {reconcileResult && (
          <p className="text-sm text-sa-muted font-mono text-xs break-all">{reconcileResult}</p>
        )}
        {opsMessage && (
          <p className="text-sm text-emerald-400">{opsMessage}</p>
        )}
      </div>

      {tab === "ops" && (
        <ExtendedBillingOpsPanel
          tenantId={tenantId}
          markPaidInvoiceId={markPaidInvoiceId}
          setMarkPaidInvoiceId={setMarkPaidInvoiceId}
          markPaidBankRef={markPaidBankRef}
          setMarkPaidBankRef={setMarkPaidBankRef}
          markPaidMethod={markPaidMethod}
          setMarkPaidMethod={setMarkPaidMethod}
          markPaidEvidence={markPaidEvidence}
          setMarkPaidEvidence={setMarkPaidEvidence}
          manualPayAmount={manualPayAmount}
          setManualPayAmount={setManualPayAmount}
          manualPayBankRef={manualPayBankRef}
          setManualPayBankRef={setManualPayBankRef}
          manualPayEvidence={manualPayEvidence}
          setManualPayEvidence={setManualPayEvidence}
          creditAmount={creditAmount}
          setCreditAmount={setCreditAmount}
          creditNote={creditNote}
          setCreditNote={setCreditNote}
          invoiceRetryId={invoiceRetryId}
          setInvoiceRetryId={setInvoiceRetryId}
          subAction={subAction}
          setSubAction={setSubAction}
          subNewDate={subNewDate}
          setSubNewDate={setSubNewDate}
          uploadEvidence={uploadEvidence}
          onMessage={setOpsMessage}
          onReloadTimeline={loadTimeline}
        />
      )}

      {tab === "ops" && (
        <div className="rounded-lg border border-sa-border bg-sa-raised p-4 space-y-3">
          <h3 className="font-semibold text-sa-text">Refund preview</h3>
          <div className="flex flex-wrap gap-2">
            <input
              value={refundPaymentId}
              onChange={(e) => setRefundPaymentId(e.target.value)}
              placeholder="Razorpay payment ID"
              className="flex-1 min-w-[200px] rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text"
            />
            <input
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="Amount paise (optional)"
              className="w-40 rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text"
            />
            <button type="button" onClick={() => void handleRefundPreview()} className="px-3 py-2 text-sm border border-sa-border rounded-md text-sa-text">
              Preview
            </button>
          </div>
          {refundPreview && (
            <pre className="text-xs text-sa-muted overflow-auto">{JSON.stringify(refundPreview, null, 2)}</pre>
          )}
        </div>
      )}

      {tab === "ops" && <VoidRefundPanel />}
    </div>
  );
}

function ExtendedBillingOpsPanel({
  tenantId,
  markPaidInvoiceId,
  setMarkPaidInvoiceId,
  markPaidBankRef,
  setMarkPaidBankRef,
  markPaidMethod,
  setMarkPaidMethod,
  markPaidEvidence,
  setMarkPaidEvidence,
  manualPayAmount,
  setManualPayAmount,
  manualPayBankRef,
  setManualPayBankRef,
  manualPayEvidence,
  setManualPayEvidence,
  creditAmount,
  setCreditAmount,
  creditNote,
  setCreditNote,
  invoiceRetryId,
  setInvoiceRetryId,
  subAction,
  setSubAction,
  subNewDate,
  setSubNewDate,
  uploadEvidence,
  onMessage,
  onReloadTimeline,
}: {
  tenantId: string;
  markPaidInvoiceId: string;
  setMarkPaidInvoiceId: (v: string) => void;
  markPaidBankRef: string;
  setMarkPaidBankRef: (v: string) => void;
  markPaidMethod: "NEFT" | "UPI" | "CHEQUE";
  setMarkPaidMethod: (v: "NEFT" | "UPI" | "CHEQUE") => void;
  markPaidEvidence: string;
  setMarkPaidEvidence: (v: string) => void;
  manualPayAmount: string;
  setManualPayAmount: (v: string) => void;
  manualPayBankRef: string;
  setManualPayBankRef: (v: string) => void;
  manualPayEvidence: string;
  setManualPayEvidence: (v: string) => void;
  creditAmount: string;
  setCreditAmount: (v: string) => void;
  creditNote: string;
  setCreditNote: (v: string) => void;
  invoiceRetryId: string;
  setInvoiceRetryId: (v: string) => void;
  subAction: "pause" | "resume" | "cancel" | "change_date";
  setSubAction: (v: "pause" | "resume" | "cancel" | "change_date") => void;
  subNewDate: string;
  setSubNewDate: (v: string) => void;
  uploadEvidence: (file: File | null) => Promise<string | null>;
  onMessage: (msg: string) => void;
  onReloadTimeline: () => Promise<void>;
}) {
  const [markPaidFile, setMarkPaidFile] = useState<File | null>(null);
  const [manualPayFile, setManualPayFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleMarkPaid() {
    if (!markPaidInvoiceId.trim() || !markPaidBankRef.trim()) return;
    setLoading(true);
    try {
      const evidencePath = markPaidEvidence || (await uploadEvidence(markPaidFile));
      await superadminFetch(`/superadmin/billing/invoices/${encodeURIComponent(markPaidInvoiceId.trim())}/mark-paid`, {
        method: "POST",
        body: JSON.stringify({
          reason: "Mark invoice paid from billing ops",
          bank_reference: markPaidBankRef.trim(),
          payment_method: markPaidMethod,
          evidence_storage_path: evidencePath,
        }),
      });
      onMessage("Invoice marked paid");
      await onReloadTimeline();
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Mark paid failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleManualPayment() {
    if (!tenantId.trim() || !manualPayAmount || !manualPayBankRef.trim()) return;
    setLoading(true);
    try {
      const evidencePath = manualPayEvidence || (await uploadEvidence(manualPayFile));
      await superadminFetch("/superadmin/billing/manual-payment", {
        method: "POST",
        body: JSON.stringify({
          reason: "Manual payment from billing ops",
          tenant_id: tenantId.trim(),
          amount_minor: parseInt(manualPayAmount, 10),
          bank_reference: manualPayBankRef.trim(),
          payment_method: "NEFT",
          evidence_storage_path: evidencePath,
        }),
      });
      onMessage("Manual payment recorded");
      await onReloadTimeline();
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Manual payment failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCredit() {
    if (!tenantId.trim() || !creditAmount) return;
    setLoading(true);
    try {
      await superadminFetch("/superadmin/billing/credits", {
        method: "POST",
        body: JSON.stringify({
          reason: "Issue credit from billing ops",
          tenant_id: tenantId.trim(),
          amount_minor: parseInt(creditAmount, 10),
          reason_note: creditNote.trim(),
        }),
      });
      onMessage("Credit issued");
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Credit failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleInvoiceRetry() {
    if (!invoiceRetryId.trim()) return;
    setLoading(true);
    try {
      await superadminFetch(`/superadmin/billing/invoices/${encodeURIComponent(invoiceRetryId.trim())}/retry`, {
        method: "POST",
        body: JSON.stringify({ reason: "Retry invoice from billing ops" }),
      });
      onMessage("Invoice retry submitted");
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscriptionAction() {
    if (!tenantId.trim()) return;
    setLoading(true);
    try {
      await superadminFetch(`/superadmin/billing/subscriptions/${encodeURIComponent(tenantId.trim())}/action`, {
        method: "POST",
        body: JSON.stringify({
          reason: `Subscription ${subAction} from billing ops`,
          action: subAction,
          new_date: subAction === "change_date" && subNewDate ? new Date(subNewDate).toISOString() : null,
        }),
      });
      onMessage(`Subscription action: ${subAction}`);
    } catch (e) {
      onMessage(e instanceof Error ? e.message : "Subscription action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-sa-border bg-sa-raised p-4 space-y-4">
      <h2 className="text-sm font-medium text-sa-text">Payments & credits</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-md border border-sa-border p-3">
          <p className="text-xs font-medium uppercase text-sa-text">Mark invoice paid</p>
          <input placeholder="Invoice UUID" value={markPaidInvoiceId} onChange={(e) => setMarkPaidInvoiceId(e.target.value)} className="w-full rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text" />
          <input placeholder="Bank reference" value={markPaidBankRef} onChange={(e) => setMarkPaidBankRef(e.target.value)} className="w-full rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text" />
          <select value={markPaidMethod} onChange={(e) => setMarkPaidMethod(e.target.value as "NEFT" | "UPI" | "CHEQUE")} className="w-full rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text">
            <option value="NEFT">NEFT</option>
            <option value="UPI">UPI</option>
            <option value="CHEQUE">CHEQUE</option>
          </select>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setMarkPaidFile(e.target.files?.[0] ?? null)} className="text-xs text-sa-muted" />
          <input placeholder="Evidence path (optional override)" value={markPaidEvidence} onChange={(e) => setMarkPaidEvidence(e.target.value)} className="w-full rounded-md border border-sa-border bg-sa-base px-3 py-2 text-xs text-sa-text" />
          <button type="button" disabled={loading} onClick={() => void handleMarkPaid()} className="w-full px-4 py-2 rounded-md bg-sa-accent text-white text-sm disabled:opacity-50">Mark paid</button>
        </div>
        <div className="space-y-2 rounded-md border border-sa-border p-3">
          <p className="text-xs font-medium uppercase text-sa-text">Manual payment</p>
          <input placeholder="Amount (paise)" value={manualPayAmount} onChange={(e) => setManualPayAmount(e.target.value)} className="w-full rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text" />
          <input placeholder="Bank reference" value={manualPayBankRef} onChange={(e) => setManualPayBankRef(e.target.value)} className="w-full rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text" />
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setManualPayFile(e.target.files?.[0] ?? null)} className="text-xs text-sa-muted" />
          <input placeholder="Evidence path (optional override)" value={manualPayEvidence} onChange={(e) => setManualPayEvidence(e.target.value)} className="w-full rounded-md border border-sa-border bg-sa-base px-3 py-2 text-xs text-sa-text" />
          <button type="button" disabled={loading || !tenantId.trim()} onClick={() => void handleManualPayment()} className="w-full px-4 py-2 rounded-md border border-sa-border text-sm text-sa-text disabled:opacity-50">Record manual payment</button>
        </div>
        <div className="space-y-2 rounded-md border border-sa-border p-3">
          <p className="text-xs font-medium uppercase text-sa-text">Issue credit</p>
          <input placeholder="Amount (paise)" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} className="w-full rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text" />
          <input placeholder="Reason note" value={creditNote} onChange={(e) => setCreditNote(e.target.value)} className="w-full rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text" />
          <button type="button" disabled={loading || !tenantId.trim()} onClick={() => void handleCredit()} className="w-full px-4 py-2 rounded-md border border-sa-border text-sm text-sa-text disabled:opacity-50">Issue credit</button>
        </div>
        <div className="space-y-2 rounded-md border border-sa-border p-3">
          <p className="text-xs font-medium uppercase text-sa-text">Invoice retry & subscription</p>
          <input placeholder="Invoice UUID to retry" value={invoiceRetryId} onChange={(e) => setInvoiceRetryId(e.target.value)} className="w-full rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text" />
          <button type="button" disabled={loading} onClick={() => void handleInvoiceRetry()} className="w-full px-4 py-2 rounded-md border border-sa-border text-sm text-sa-text disabled:opacity-50">Retry invoice</button>
          <select value={subAction} onChange={(e) => setSubAction(e.target.value as typeof subAction)} className="w-full rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text">
            <option value="pause">Pause subscription</option>
            <option value="resume">Resume subscription</option>
            <option value="cancel">Cancel subscription</option>
            <option value="change_date">Change billing date</option>
          </select>
          {subAction === "change_date" && (
            <input type="datetime-local" value={subNewDate} onChange={(e) => setSubNewDate(e.target.value)} className="w-full rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text" />
          )}
          <button type="button" disabled={loading || !tenantId.trim()} onClick={() => void handleSubscriptionAction()} className="w-full px-4 py-2 rounded-md bg-amber-600 text-white text-sm disabled:opacity-50">Apply subscription action</button>
        </div>
      </div>
    </div>
  );
}

function TenantSearchAutocomplete({
  tenantId,
  selectedTenant,
  onSelect,
  onClear,
}: {
  tenantId: string;
  selectedTenant: TenantRow | null;
  onSelect: (t: TenantRow) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TenantRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedTenant && selectedTenant.id === tenantId) {
      setQuery(selectedTenant.name);
      return;
    }
    if (tenantId && !selectedTenant) setQuery(tenantId);
  }, [tenantId, selectedTenant]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      void sa
        .tenants({ search: q, limit: 10 })
        .then((r) => setResults(r.items))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-[240px]">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search tenant name or UUID…"
          className="flex-1 rounded-md border border-sa-border bg-sa-base px-3 py-2 text-sm text-sa-text"
        />
        {(tenantId || query) && (
          <button
            type="button"
            onClick={onClear}
            className="px-2 text-xs text-sa-muted hover:text-sa-text"
          >
            Clear
          </button>
        )}
      </div>
      {selectedTenant && (
        <p className="text-xs text-sa-muted mt-1">
          {selectedTenant.name} · {selectedTenant.plan} · {selectedTenant.id.slice(0, 8)}…
        </p>
      )}
      {open && (loading || results.length > 0) && (
        <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-sa-border bg-sa-surface shadow-lg">
          {loading && <li className="px-3 py-2 text-xs text-sa-muted">Searching…</li>}
          {!loading &&
            results.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-sa-raised"
                  onClick={() => {
                    onSelect(t);
                    setQuery(t.name);
                    setOpen(false);
                  }}
                >
                  <span className="text-sa-text">{t.name}</span>
                  <span className="text-sa-muted ml-2 text-xs capitalize">{t.plan}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function VoidRefundPanel() {
  const [invoiceRef, setInvoiceRef] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [refundAmountPaise, setRefundAmountPaise] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [msg, setMsg] = useState("");

  async function voidInvoice(apply: boolean) {
    setMsg("");
    setPreview(null);
    try {
      const result = await superadminFetch<Record<string, unknown>>(
        `/superadmin/billing/void-invoice/${encodeURIComponent(invoiceRef)}`,
        {
          method: "POST",
          body: JSON.stringify({
            reason: "Void from billing ops UI",
            dry_run: !apply,
          }),
        },
      );
      if (!apply) {
        setPreview(result);
        setMsg("Preview ready — review impact before applying");
      } else {
        setMsg("Invoice voided");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Void failed");
    }
  }

  async function refundPayment(apply: boolean) {
    setMsg("");
    setPreview(null);
    try {
      if (!apply) {
        const result = await superadminFetch<Record<string, unknown>>("/superadmin/billing/refunds/preview", {
          method: "POST",
          body: JSON.stringify({
            payment_id: paymentId,
            amount_paise: refundAmountPaise ? parseInt(refundAmountPaise, 10) : null,
            partial: Boolean(refundAmountPaise),
          }),
        });
        setPreview(result);
        setMsg("Preview ready — review impact before applying");
        return;
      }
      const idempotencyKey = crypto.randomUUID();
      const token = await (async () => {
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? "";
      })();
      const csrfMatch = document.cookie.match(/(?:^|;\s*)akara_csrf=([^;]+)/);
      const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : "";
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/superadmin/billing/refund`, {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({
          payment_id: paymentId,
          reason: "Refund from billing ops UI",
          dry_run: false,
          amount_paise: refundAmountPaise ? parseInt(refundAmountPaise, 10) : null,
          partial: Boolean(refundAmountPaise),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMsg("Refund submitted with idempotency key");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Refund failed");
    }
  }

  return (
    <div className="rounded-lg border border-sa-border bg-sa-raised p-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold text-sa-text">Void &amp; refund</h3>
        <label className="flex items-center gap-2 text-xs text-sa-muted cursor-pointer">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          Preview impact (dry run) before apply
        </label>
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <input
          className="rounded border border-sa-border bg-sa-surface px-3 py-2 text-sm flex-1 min-w-[180px]"
          placeholder="Invoice ref / number"
          value={invoiceRef}
          onChange={(e) => setInvoiceRef(e.target.value)}
        />
        <button
          type="button"
          className="text-sm text-sa-accent underline disabled:opacity-50"
          disabled={!invoiceRef.trim()}
          onClick={() => void voidInvoice(!dryRun)}
        >
          {dryRun ? "Preview void" : "Void invoice"}
        </button>
        {dryRun && preview && (
          <button
            type="button"
            className="text-sm text-red-400 underline"
            onClick={() => {
              if (window.confirm("Void this invoice? This cannot be undone.")) {
                void voidInvoice(true);
              }
            }}
          >
            Apply void
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <input
          className="rounded border border-sa-border bg-sa-surface px-3 py-2 text-sm flex-1 min-w-[180px]"
          placeholder="Razorpay payment ID"
          value={paymentId}
          onChange={(e) => setPaymentId(e.target.value)}
        />
        <input
          className="rounded border border-sa-border bg-sa-surface px-3 py-2 text-sm w-40"
          placeholder="Amount paise (partial)"
          value={refundAmountPaise}
          onChange={(e) => setRefundAmountPaise(e.target.value)}
        />
        <button
          type="button"
          className="text-sm text-sa-accent underline disabled:opacity-50"
          disabled={!paymentId.trim()}
          onClick={() => void refundPayment(!dryRun)}
        >
          {dryRun ? "Preview refund" : "Refund payment"}
        </button>
        {dryRun && preview && paymentId && (
          <button
            type="button"
            className="text-sm text-red-400 underline"
            onClick={() => {
              if (window.confirm("Submit refund to Razorpay?")) {
                void refundPayment(true);
              }
            }}
          >
            Apply refund
          </button>
        )}
      </div>
      {preview && (
        <pre className="text-xs text-sa-muted bg-sa-base rounded p-2 overflow-x-auto max-h-32">
          {JSON.stringify(preview, null, 2)}
        </pre>
      )}
      {msg && <p className="text-xs text-sa-muted">{msg}</p>}
    </div>
  );
}
