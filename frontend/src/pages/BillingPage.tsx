import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle, Loader2 } from "lucide-react";

import GradientMesh from "@/components/ui/GradientMesh";
import LiquidGlassCard from "@/components/ui/LiquidGlassCard";
import GradientButton from "@/components/ui/GradientButton";
import { useBilling } from "@/hooks/useBilling";
import {
  fetchBillingDetails,
  fetchInvoices,
  fetchSubscription,
  cancelSubscription,
  getUsagePct,
  updateBillingDetails,
  downloadInvoice,
  type BillingDetails,
  type InvoiceSummary,
  type SubscriptionInfo,
} from "@/lib/api/billing";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const pct = getUsagePct(used, limit);
  const displayLimit = limit === -1 ? "∞" : limit.toLocaleString("en-IN");
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-[#90CAF9]">
        <span>{label}</span>
        <span>
          {used.toLocaleString("en-IN")} / {displayLimit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[rgba(15,52,96,0.6)] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#1565C0] to-[#42A5F5] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function BillingPage() {
  const { data: usage, isLoading, refetch } = useBilling();
  const [params, setParams] = useSearchParams();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [details, setDetails] = useState<BillingDetails>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const sessionSuccess = params.get("session_id");

  useEffect(() => {
    if (sessionSuccess) {
      refetch();
      const t = setTimeout(() => {
        params.delete("session_id");
        setParams(params, { replace: true });
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [sessionSuccess, params, setParams, refetch]);

  useEffect(() => {
    fetchInvoices().then(setInvoices).catch(() => {});
    fetchBillingDetails().then(setDetails).catch(() => {});
    fetchSubscription().then(setSubscription).catch(() => {});
  }, []);

  async function handleCancelSubscription() {
    if (!window.confirm("Cancel your subscription at the end of this billing cycle?")) return;
    setCancelLoading(true);
    try {
      await cancelSubscription();
      toast.success("Subscription cancellation scheduled");
      const sub = await fetchSubscription();
      setSubscription(sub);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel subscription");
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateBillingDetails(details);
      setDetails(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadInvoice(inv: InvoiceSummary) {
    if (!inv.pdf_storage_path) return;
    setDownloadingId(inv.id);
    try {
      await downloadInvoice(inv.id);
    } catch {
      toast.error("Could not download invoice PDF");
    } finally {
      setDownloadingId(null);
    }
  }

  if (isLoading || !usage) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#42A5F5]" />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-300",
    trialing: "bg-violet-500/20 text-violet-300",
    past_due: "bg-red-500/20 text-red-300",
    cancelled: "bg-amber-500/20 text-amber-300",
  };

  return (
    <div className="relative min-h-full">
      <GradientMesh />
      <div className="relative z-10 p-6 lg:p-10 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Billing & Usage</h1>
          <p className="text-sm text-[#90CAF9] mt-1">
            Manage your plan, usage, and GST details.
          </p>
        </div>

        {sessionSuccess && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-emerald-200 text-sm">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Payment successful — your plan will update shortly.
          </div>
        )}

        <LiquidGlassCard className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-white capitalize">
                  {usage.plan} plan
                </span>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full capitalize",
                    statusColors[usage.plan_status] ?? "bg-white/10 text-[#90CAF9]"
                  )}
                >
                  {usage.plan_status.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-[#5C8FBF] mt-1">
                {usage.retention_days}-day data retention
                {subscription?.current_end && (
                  <>
                    {" "}
                    · Renews{" "}
                    {new Date(subscription.current_end * 1000).toLocaleDateString("en-IN")}
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {usage.plan === "free" ? (
                <Link to="/upgrade">
                  <GradientButton size="sm">Upgrade plan</GradientButton>
                </Link>
              ) : (
                <>
                  <Link to="/upgrade">
                    <GradientButton size="sm" variant="secondary">
                      Change plan
                    </GradientButton>
                  </Link>
                  {usage.plan_status !== "cancelled" && subscription?.has_subscription && (
                    <GradientButton
                      size="sm"
                      variant="secondary"
                      onClick={handleCancelSubscription}
                      disabled={cancelLoading}
                    >
                      {cancelLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Cancel subscription"
                      )}
                    </GradientButton>
                  )}
                </>
              )}
            </div>
          </div>
          {usage.plan_status === "past_due" && (
            <p className="text-sm text-red-300">
              Payment failed. Complete payment via the link in your email or upgrade again to
              restore access.
            </p>
          )}
          {usage.plan_status === "cancelled" && (
            <p className="text-sm text-amber-300">
              Subscription cancelled — access continues until your grace period ends.
            </p>
          )}
        </LiquidGlassCard>

        <LiquidGlassCard className="p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#90CAF9] uppercase tracking-wide">
            Usage this month
          </h2>
          <UsageBar
            label="Copilot questions"
            used={usage.copilot_calls_used}
            limit={usage.copilot_calls_limit}
          />
          <UsageBar label="Rows stored" used={usage.rows_used} limit={usage.rows_limit} />
          {usage.uploads_limit !== -1 && (
            <UsageBar
              label="Uploads this month"
              used={usage.uploads_used}
              limit={usage.uploads_limit}
            />
          )}
          <UsageBar label="Team users" used={usage.users_used} limit={usage.users_limit} />
          <div className="flex gap-4 pt-2 text-xs text-[#5C8FBF]">
            <span>
              Uploads today: {usage.uploads_today}/{usage.uploads_per_day}
            </span>
            <span>
              Undos today: {usage.undos_today}/{usage.undos_per_day}
            </span>
          </div>
        </LiquidGlassCard>

        <LiquidGlassCard className="p-6">
          <h2 className="text-sm font-semibold text-[#90CAF9] uppercase tracking-wide mb-4">
            GST billing details
          </h2>
          <form onSubmit={handleSaveDetails} className="space-y-4">
            <div>
              <Label className="text-[#90CAF9]">Company GSTIN (optional)</Label>
              <Input
                value={details.gstin ?? ""}
                onChange={(e) => setDetails({ ...details, gstin: e.target.value })}
                placeholder="27AAAAA0000A1Z5"
                className="mt-1 bg-[rgba(15,52,96,0.4)] border-[rgba(33,150,243,0.2)] text-white"
              />
            </div>
            <div>
              <Label className="text-[#90CAF9]">Company name</Label>
              <Input
                value={details.company_name ?? ""}
                onChange={(e) => setDetails({ ...details, company_name: e.target.value })}
                className="mt-1 bg-[rgba(15,52,96,0.4)] border-[rgba(33,150,243,0.2)] text-white"
              />
            </div>
            <div>
              <Label className="text-[#90CAF9]">Billing state (for IGST vs CGST/SGST)</Label>
              <Input
                value={details.billing_state ?? ""}
                onChange={(e) => setDetails({ ...details, billing_state: e.target.value })}
                placeholder="Maharashtra"
                className="mt-1 bg-[rgba(15,52,96,0.4)] border-[rgba(33,150,243,0.2)] text-white"
              />
            </div>
            <div>
              <Label className="text-[#90CAF9]">Billing address</Label>
              <Input
                value={details.billing_address ?? ""}
                onChange={(e) => setDetails({ ...details, billing_address: e.target.value })}
                className="mt-1 bg-[rgba(15,52,96,0.4)] border-[rgba(33,150,243,0.2)] text-white"
              />
            </div>
            <GradientButton type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save GST details"}
            </GradientButton>
          </form>
        </LiquidGlassCard>

        {invoices.length > 0 && (
          <LiquidGlassCard className="p-6">
            <h2 className="text-sm font-semibold text-[#90CAF9] uppercase tracking-wide mb-4">
              Invoice history
            </h2>
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex justify-between items-center text-sm py-2 border-b border-white/5 last:border-0"
                >
                  <span className="text-white">{inv.invoice_number}</span>
                  <span className="text-[#90CAF9]">₹{inv.total_amount.toLocaleString("en-IN")}</span>
                  <Badge variant="outline" className="text-[#5C8FBF] border-[#5C8FBF]/30">
                    {inv.tax_type}
                  </Badge>
                  {inv.pdf_storage_path && (
                    <button
                      type="button"
                      onClick={() => handleDownloadInvoice(inv)}
                      disabled={downloadingId === inv.id}
                      className="text-xs text-[#42A5F5] hover:underline disabled:opacity-50"
                    >
                      {downloadingId === inv.id ? "Downloading…" : "Download PDF"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </LiquidGlassCard>
        )}
      </div>
    </div>
  );
}
