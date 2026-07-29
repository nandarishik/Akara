import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle, Loader2 } from "lucide-react";

import ProductPageLayout from "@/components/layout/ProductPageLayout";
import GlowSurfaceCard from "@/components/ui/GlowSurfaceCard";
import GlowCTAButton from "@/components/ui/GlowCTAButton";
import ReflectiveCard from "@/components/effects/ReflectiveCard";
import PrismLazy from "@/components/effects/PrismLazy";
import { PLAN_REFLECTIVE_META } from "@/components/effects/PlanReflectiveCard";
import AkaraButton from "@/components/ui/GradientButton";
import { useBilling } from "@/hooks/useBilling";
import {
  fetchBillingDetails,
  fetchInvoices,
  fetchSubscription,
  syncSubscription,
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
      <div className="flex justify-between text-xs text-text-secondary">
        <span>{label}</span>
        <span>
          {used.toLocaleString("en-IN")} / {displayLimit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-raised overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all"
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
  const upgradedSuccess = params.get("upgraded") === "1";

  useEffect(() => {
    if (sessionSuccess || upgradedSuccess) {
      refetch();
      fetchInvoices().then(setInvoices).catch(() => {});

      let attempts = 0;
      const maxAttempts = 12;
      const poll = async () => {
        try {
          const synced = await syncSubscription();
          setSubscription(synced);
          await refetch();
          if (synced.synced || (synced.plan !== "free" && synced.plan_status === "active")) {
            return;
          }
        } catch {
          fetchSubscription().then(setSubscription).catch(() => {});
        }
        attempts += 1;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2500);
        }
      };
      void poll();

      const t = setTimeout(() => {
        params.delete("session_id");
        params.delete("upgraded");
        setParams(params, { replace: true });
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [sessionSuccess, upgradedSuccess, params, setParams, refetch]);

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
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  const statusVariant: Record<string, "status-active" | "status-trialing" | "status-past_due" | "status-cancelled"> = {
    active: "status-active",
    trialing: "status-trialing",
    past_due: "status-past_due",
    cancelled: "status-cancelled",
  };

  return (
    <ProductPageLayout
      maxWidth="5xl"
      className="space-y-6"
      title="Billing & Usage"
      description="Manage your plan, usage, and GST details."
    >

        {(sessionSuccess || upgradedSuccess) && (
          <GlowSurfaceCard accent="green" padding="sm" hover={false}>
            <div className="flex items-center gap-2 text-emerald-300 text-sm">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Payment received — your plan will update shortly.
            </div>
          </GlowSurfaceCard>
        )}

        <div className="relative min-h-[300px] rounded-2xl overflow-hidden">
          <PrismLazy
            className="absolute inset-0 opacity-40 pointer-events-none"
            animationType="rotate"
            timeScale={0.35}
            suspendWhenOffscreen
          />
          <div className="relative z-10 max-w-md mx-auto p-4">
            <ReflectiveCard
              planName={`AKARA ${usage.plan.charAt(0).toUpperCase()}${usage.plan.slice(1)}`}
              planPrice={
                usage.plan === "free"
                  ? "₹0 / month"
                  : usage.plan === "pro"
                    ? "₹7,999 / month"
                    : "₹13,999 / month"
              }
              planId={
                PLAN_REFLECTIVE_META[
                  usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1) as keyof typeof PLAN_REFLECTIVE_META
                ]?.planId ?? "AKR-****-****-0000"
              }
              badgeText={
                PLAN_REFLECTIVE_META[
                  usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1) as keyof typeof PLAN_REFLECTIVE_META
                ]?.badgeText ?? "ACTIVE PLAN"
              }
            />
          </div>
        </div>

        <GlowSurfaceCard className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold capitalize">
                  {usage.plan} plan
                </span>
                <Badge
                  variant={statusVariant[usage.plan_status] ?? "secondary"}
                  className="capitalize"
                >
                  {usage.plan_status.replace("_", " ")}
                </Badge>
              </div>
              <p className="text-xs text-text-muted mt-1">
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
                <GlowCTAButton size="sm" to="/upgrade">Upgrade plan</GlowCTAButton>
              ) : (
                <>
                  <Link to="/upgrade">
                    <AkaraButton size="sm" variant="secondary">
                      Change plan
                    </AkaraButton>
                  </Link>
                  {usage.plan_status !== "cancelled" && subscription?.has_subscription && (
                    <AkaraButton
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
                    </AkaraButton>
                  )}
                </>
              )}
            </div>
          </div>
          {usage.plan_status === "past_due" && (
            <p className="text-sm text-red-600">
              Payment failed. Complete payment via the link in your email or upgrade again to
              restore access.
            </p>
          )}
          {usage.plan_status === "cancelled" && (
            <p className="text-sm text-amber-700">
              Subscription cancelled — access continues until your grace period ends.
            </p>
          )}
        </GlowSurfaceCard>

        <GlowSurfaceCard className="space-y-4">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
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
          <div className="flex gap-4 pt-2 text-xs text-text-muted">
            <span>
              Uploads today: {usage.uploads_today}/{usage.uploads_per_day}
            </span>
            <span>
              Undos today: {usage.undos_today}/{usage.undos_per_day}
            </span>
          </div>
        </GlowSurfaceCard>

        <GlowSurfaceCard>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
            GST billing details
          </h2>
          <form onSubmit={handleSaveDetails} className="space-y-4">
            <div>
              <Label>Company GSTIN (optional)</Label>
              <Input
                value={details.gstin ?? ""}
                onChange={(e) => setDetails({ ...details, gstin: e.target.value })}
                placeholder="27AAAAA0000A1Z5"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Company name</Label>
              <Input
                value={details.company_name ?? ""}
                onChange={(e) => setDetails({ ...details, company_name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Billing state (for IGST vs CGST/SGST)</Label>
              <Input
                value={details.billing_state ?? ""}
                onChange={(e) => setDetails({ ...details, billing_state: e.target.value })}
                placeholder="Maharashtra"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Billing address</Label>
              <Input
                value={details.billing_address ?? ""}
                onChange={(e) => setDetails({ ...details, billing_address: e.target.value })}
                className="mt-1"
              />
            </div>
            <AkaraButton type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save GST details"}
            </AkaraButton>
          </form>
        </GlowSurfaceCard>

        {invoices.length > 0 && (
          <GlowSurfaceCard>
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
              Invoice history
            </h2>
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex justify-between items-center text-sm py-2 border-b border-white/10 last:border-0"
                >
                  <span>{inv.invoice_number}</span>
                  <span className="text-text-secondary">₹{inv.total_amount.toLocaleString("en-IN")}</span>
                  <Badge variant="outline">{inv.tax_type}</Badge>
                  {inv.pdf_storage_path && (
                    <button
                      type="button"
                      onClick={() => handleDownloadInvoice(inv)}
                      disabled={downloadingId === inv.id}
                      className="text-xs text-accent hover:text-accent-hover hover:underline disabled:opacity-50"
                    >
                      {downloadingId === inv.id ? "Downloading…" : "Download PDF"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </GlowSurfaceCard>
        )}
    </ProductPageLayout>
  );
}
