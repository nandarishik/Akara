import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";

import { AdminDrawer } from "@/features/superadmin/components/AdminDrawer";
import { ConfirmDialog } from "@/features/superadmin/components/ConfirmDialog";
import { MutationReasonField } from "@/features/superadmin/components/MutationReasonField";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { sa } from "@/lib/api/superadmin";
import { cn } from "@/lib/utils";

const FEATURE_KEYS = [
  "morning_brief",
  "scheme_leakage",
  "simulator",
  "reports",
  "team_invites",
  "alerts",
  "tally_connector",
  "api_keys",
] as const;

type Tab = "overview" | "plan" | "features" | "quota" | "billing" | "data" | "danger";

interface TenantDrawerProps {
  tenantId: string | null;
  onClose: () => void;
  initialTab?: Tab;
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN");
}

function quotaPct(used: number, limit: number): number {
  if (limit === -1) return 0;
  if (limit <= 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
}

function QuotaBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const pct = quotaPct(used, limit);
  const displayLimit = limit === -1 ? "∞" : limit.toLocaleString("en-IN");
  const barColor =
    pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-sa-accent";

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span className="tabular-nums">
          {used.toLocaleString("en-IN")} / {displayLimit}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-sa-raised overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: limit === -1 ? "8%" : `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

export function TenantDrawer({ tenantId, onClose, initialTab }: TenantDrawerProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>(initialTab ?? "overview");
  const [reason, setReason] = useState("Support action from tenant drawer");
  const [notes, setNotes] = useState("");
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [plan, setPlan] = useState("free");
  const [planStatus, setPlanStatus] = useState("active");
  const [featureOverrides, setFeatureOverrides] = useState<Record<string, boolean>>({});
  const [bonusCopilot, setBonusCopilot] = useState("");
  const [expandedConvo, setExpandedConvo] = useState<string | null>(null);
  const [wipePreview, setWipePreview] = useState<Record<string, unknown> | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    phrase: string;
    impactPreview?: React.ReactNode;
    action: () => Promise<void>;
  } | null>(null);
  const [status, setStatus] = useState("");

  const reasonOk = reason.trim().length >= 10;

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab, tenantId]);

  const { data: tenant, refetch } = useQuery({
    queryKey: ["superadmin", "tenant", tenantId],
    queryFn: () => sa.getTenant(tenantId!),
    enabled: !!tenantId,
  });

  const { data: planLimits } = useQuery({
    queryKey: ["superadmin", "plan-limits"],
    queryFn: () => sa.planLimits(),
  });

  const { data: timeline } = useQuery({
    queryKey: ["superadmin", "tenant", tenantId, "timeline"],
    queryFn: () => sa.billingTimeline(tenantId!),
    enabled: !!tenantId && tab === "billing",
  });

  const { data: razorpay } = useQuery({
    queryKey: ["superadmin", "tenant", tenantId, "razorpay"],
    queryFn: () => sa.razorpayStatus(tenantId!),
    enabled: !!tenantId && (tab === "billing" || tab === "plan"),
  });

  const { data: dataSummary } = useQuery({
    queryKey: ["superadmin", "tenant", tenantId, "data-summary"],
    queryFn: () => sa.dataSummary(tenantId!),
    enabled: !!tenantId && tab === "data",
  });

  const { data: dataPreview } = useQuery({
    queryKey: ["superadmin", "tenant", tenantId, "data-preview"],
    queryFn: () => sa.dataPreview(tenantId!),
    enabled: !!tenantId && tab === "data",
  });

  const { data: conversations } = useQuery({
    queryKey: ["superadmin", "tenant", tenantId, "conversations"],
    queryFn: () => sa.conversations(tenantId!),
    enabled: !!tenantId && tab === "overview",
  });

  const { data: convoMessages } = useQuery({
    queryKey: ["superadmin", "conversation", expandedConvo, "messages"],
    queryFn: () => sa.conversationMessages(expandedConvo!),
    enabled: !!expandedConvo,
  });

  const { data: debriefStatus } = useQuery({
    queryKey: ["superadmin", "tenant", tenantId, "debrief"],
    queryFn: () => sa.debriefStatus(tenantId!),
    enabled: !!tenantId,
  });

  const { data: quotaHistory } = useQuery({
    queryKey: ["superadmin", "tenant", tenantId, "quota-history"],
    queryFn: () => sa.quotaHistory(tenantId!),
    enabled: !!tenantId && tab === "quota",
  });

  const { data: opsDetail } = useQuery({
    queryKey: ["superadmin", "tenant", tenantId, "ops-detail"],
    queryFn: () => sa.tenantOpsDetail(tenantId!),
    enabled: !!tenantId && tab === "overview",
  });

  const { data: allCosts } = useQuery({
    queryKey: ["superadmin", "tenant-costs"],
    queryFn: () => sa.tenantCostDiagnostics(),
    enabled: !!tenantId && tab === "overview",
  });

  useEffect(() => {
    if (tenant) {
      setNotes(tenant.internal_notes ?? "");
      setEditName(tenant.name);
      setEditSlug(tenant.slug);
      setPlan(tenant.plan);
      setPlanStatus(tenant.plan_status);
      setFeatureOverrides(tenant.feature_overrides ?? {});
    }
  }, [tenant]);

  if (!tenantId) return null;

  const limits = planLimits?.plans?.[plan] as Record<string, unknown> | undefined;
  const planFeatures = (limits?.features ?? {}) as Record<string, boolean>;
  const copilotLimit =
    tenant?.copilot_limit ?? (limits?.copilot_calls_per_month as number | undefined) ?? 10;
  const rowsLimit = (limits?.rows_total as number | undefined) ?? 10_000;
  const tenantCost = allCosts?.find((c) => c.tenant_id === tenantId);
  const gstin =
    (razorpay?.gstin as string | undefined) ??
    (timeline as { gstin?: string } | undefined)?.gstin ??
    null;

  async function downgradePlan() {
    if (!reasonOk || !tenant) return;
    const order = ["free", "pro", "business"];
    const idx = order.indexOf(tenant.plan);
    const next = idx > 0 ? order[idx - 1] : "free";
    if (next === tenant.plan) return;
    await sa.patchPlan(tenantId!, { plan: next, reason });
    setPlan(next);
    setStatus(`Downgraded to ${next}`);
    await invalidate();
  }

  async function resendInvoice() {
    if (!reasonOk) return;
    const r = await sa.resendInvoice(tenantId!, reason);
    setStatus(`Invoice ${r.invoice_number} resent`);
  }

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["superadmin", "tenants"] });
    await refetch();
  }

  async function saveNotes() {
    if (!reasonOk) return;
    await sa.patchTenantNotes(tenantId!, notes, reason);
    setStatus("Notes saved");
    await invalidate();
  }

  async function saveHeader() {
    if (!reasonOk || !tenant) return;
    const patch: { name?: string; slug?: string; reason: string } = { reason };
    if (editName !== tenant.name) patch.name = editName;
    if (editSlug !== tenant.slug) patch.slug = editSlug;
    if (!patch.name && !patch.slug) return;
    await sa.patchTenant(tenantId!, patch);
    setStatus("Tenant updated");
    await invalidate();
  }

  async function savePlan() {
    if (!reasonOk) return;
    await sa.patchPlan(tenantId!, { plan, plan_status: planStatus, reason });
    setStatus("Plan updated");
    await invalidate();
  }

  async function saveFeatures() {
    if (!reasonOk) return;
    await sa.patchFeatures(tenantId!, { features: featureOverrides, reason });
    setStatus("Features updated");
    await invalidate();
  }

  async function addBonus() {
    if (!reasonOk || !bonusCopilot) return;
    await sa.patchQuota(tenantId!, {
      copilot_bonus: parseInt(bonusCopilot, 10),
      reason,
    });
    setStatus("Bonus added");
    setBonusCopilot("");
    await invalidate();
  }

  async function resetMonth() {
    if (!reasonOk) return;
    await sa.patchQuota(tenantId!, { reset_month: true, reason });
    setStatus("Month reset");
    await invalidate();
  }

  async function loadWipePreview() {
    if (!reasonOk) return;
    const preview = await sa.wipeTenantData(tenantId!, { reason, dry_run: true });
    setWipePreview(preview as Record<string, unknown>);
  }

  function featureEffective(key: string): boolean {
    if (key in featureOverrides) return !!featureOverrides[key];
    return !!planFeatures[key];
  }

  function featureOverridden(key: string): boolean {
    return key in featureOverrides;
  }

  function toggleFeature(key: string) {
    const effective = featureEffective(key);
    setFeatureOverrides((prev) => ({ ...prev, [key]: !effective }));
  }

  function clearFeatureOverride(key: string) {
    setFeatureOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "plan", label: "Plan" },
    { id: "features", label: "Features" },
    { id: "quota", label: "Quota" },
    { id: "billing", label: "Billing" },
    { id: "data", label: "Data" },
    { id: "danger", label: "Danger" },
  ];

  const previewColumns =
    dataPreview?.rows?.[0] != null
      ? Object.keys(dataPreview.rows[0]).slice(0, 6)
      : [];

  return (
    <>
      <AdminDrawer
        open={!!tenantId}
        onClose={onClose}
        title={tenant?.name ?? "Tenant"}
        description={tenant ? `${tenant.slug} · ${tenant.plan} · ${tenant.plan_status}` : undefined}
        width="lg"
        footer={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!reasonOk}
              onClick={() =>
                void sa.impersonate(tenantId, reason).then((r) => {
                  if (r.magic_link) window.open(r.magic_link, "_blank", "noopener,noreferrer");
                })
              }
            >
              Impersonate
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!reasonOk}
              onClick={() => void sa.nudgeUpgrade(tenantId, reason).then(() => setStatus("Nudge sent"))}
            >
              Nudge upgrade
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!reasonOk}
              onClick={() =>
                void sa
                  .manualUpgrade(tenantId, { plan: "pro", reason, clear_past_due: true })
                  .then(() => {
                    setStatus("Manual upgrade applied");
                    void invalidate();
                  })
              }
            >
              Manual upgrade
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!reasonOk || tenant?.plan === "free"}
              onClick={() => void downgradePlan()}
            >
              Downgrade plan
            </Button>
            {[7, 14, 30].map((days) => (
              <Button
                key={days}
                type="button"
                variant="outline"
                size="sm"
                disabled={!reasonOk}
                onClick={() =>
                  void sa.extendTrial(tenantId, { days, reason }).then(() => {
                    setStatus(`Trial extended ${days}d`);
                    void invalidate();
                  })
                }
              >
                +{days}d trial
              </Button>
            ))}
          </div>
        }
      >
        <div className="space-y-4 text-sa-text text-sm">
          {tenant && (
            <div className="space-y-2 border-b border-sa-border pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => void saveHeader()}
                  className="flex-1 min-w-[140px] bg-sa-raised border-sa-border text-sm font-medium"
                />
                <Badge variant="outline" className="capitalize">
                  {tenant.plan}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "capitalize",
                    tenant.is_active ? "text-emerald-400" : "text-red-400",
                  )}
                >
                  {tenant.is_active ? tenant.plan_status : "inactive"}
                </Badge>
              </div>
              <Input
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
                onBlur={() => void saveHeader()}
                className="bg-sa-raised border-sa-border text-xs text-sa-muted"
              />
            </div>
          )}

          <MutationReasonField value={reason} onChange={setReason} />
          {status && <p className="text-xs text-emerald-400">{status}</p>}

          <div className="flex flex-wrap gap-1 border-b border-sa-border pb-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`rounded px-2 py-1 text-xs ${tab === t.id ? "bg-sa-accent/20 text-sa-accent" : "text-sa-muted hover:text-sa-text"}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" && tenant && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Users: {tenant.user_count}</div>
                <div>Rows: {tenant.rows_stored.toLocaleString("en-IN")}</div>
                <div>Last active: {formatRelative(tenant.last_active_at)}</div>
                <div>Questions today: {tenant.questions_today}</div>
              </div>

              <QuotaBar
                label="Copilot this month"
                used={tenant.copilot_calls_this_month}
                limit={copilotLimit}
              />

              {tenantCost && (
                <div className="rounded border border-sa-border bg-sa-raised/50 p-3 text-xs space-y-1">
                  <p className="font-medium">LLM cost this month</p>
                  <p>${tenantCost.cost_usd_this_month.toFixed(4)} USD</p>
                  {opsDetail?.margin_pct != null && (
                    <p className="text-emerald-400">Margin: {opsDetail.margin_pct}%</p>
                  )}
                  <p className="text-sa-muted">
                    {tenantCost.copilot_calls_used} questions · retention {tenantCost.retention_days}d
                  </p>
                </div>
              )}

              {opsDetail && opsDetail.delivery_events.length > 0 && (
                <div className="rounded border border-sa-border bg-sa-raised/50 p-3 text-xs space-y-1">
                  <p className="font-medium">Delivery &amp; activation timeline</p>
                  <ul className="space-y-1 max-h-32 overflow-y-auto text-sa-muted">
                    {opsDetail.delivery_events.map((ev, i) => (
                      <li key={i}>
                        <span className="text-sa-text">{ev.action}</span> ·{" "}
                        {formatRelative(ev.created_at)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {debriefStatus && (
                <div className="rounded border border-sa-border bg-sa-raised/50 p-3 text-xs space-y-1">
                  <p className="font-medium">Debrief delivery</p>
                  <p>
                    {debriefStatus.debrief_count} lifetime
                    {debriefStatus.last_debrief_at &&
                      ` · last ${formatRelative(debriefStatus.last_debrief_at)}`}
                  </p>
                  <p className="text-sa-muted">
                    Email: {debriefStatus.last_email_status ?? "—"} · WhatsApp:{" "}
                    {debriefStatus.last_whatsapp_status ?? "—"}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-xs">Internal notes</Label>
                <textarea
                  className="mt-1 w-full rounded border border-sa-border bg-sa-raised p-2 text-xs min-h-[80px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => void saveNotes()}
                />
                <p className="text-xs text-sa-muted mt-1">Auto-saves on blur</p>
              </div>

              {conversations && conversations.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-xs">Recent conversations</p>
                    <Link to="/copilot" className="text-xs text-sa-accent hover:underline">
                      View all
                    </Link>
                  </div>
                  <ul className="text-xs space-y-1">
                    {conversations.slice(0, 5).map((c) => (
                      <li key={c.id} className="border border-sa-border rounded">
                        <button
                          type="button"
                          className="flex w-full items-center gap-1 px-2 py-1.5 text-left hover:bg-sa-raised"
                          onClick={() =>
                            setExpandedConvo(expandedConvo === c.id ? null : c.id)
                          }
                        >
                          {expandedConvo === c.id ? (
                            <ChevronDown className="h-3 w-3 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3 w-3 shrink-0" />
                          )}
                          <span className="flex-1 truncate">{c.title || "Untitled"}</span>
                          <span className="text-sa-muted shrink-0">
                            {formatRelative(c.last_message_at ?? c.updated_at)}
                          </span>
                        </button>
                        {expandedConvo === c.id && convoMessages && (
                          <div className="border-t border-sa-border px-2 py-2 space-y-2 max-h-48 overflow-y-auto">
                            {convoMessages.map((m) => (
                              <div
                                key={m.id}
                                className={cn(
                                  "rounded p-1.5",
                                  m.role === "user" ? "bg-sa-raised" : "bg-sa-accent/10",
                                )}
                              >
                                <p className="text-[10px] uppercase text-sa-muted">{m.role}</p>
                                <p className="whitespace-pre-wrap">{m.content.slice(0, 500)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {tab === "plan" && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Plan</Label>
                  <select
                    className="mt-1 w-full rounded border border-sa-border bg-sa-raised p-2 text-xs"
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="business">Business</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <select
                    className="mt-1 w-full rounded border border-sa-border bg-sa-raised p-2 text-xs"
                    value={planStatus}
                    onChange={(e) => setPlanStatus(e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="trialing">Trialing</option>
                    <option value="past_due">Past due</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <Button type="button" size="sm" disabled={!reasonOk} onClick={() => void savePlan()}>
                  Save plan
                </Button>
              </div>

              <PlanAssignmentSection tenantId={tenantId} reason={reason} reasonOk={reasonOk} onStatus={setStatus} />

              {razorpay && (
                <div className="rounded border border-sa-border bg-sa-raised/50 p-3 text-xs space-y-1">
                  <p className="font-medium">Razorpay</p>
                  <p>
                    Subscription:{" "}
                    {razorpay.has_subscription
                      ? String(razorpay.subscription_status ?? razorpay.razorpay_status ?? "active")
                      : "None"}
                  </p>
                  {razorpay.current_period_end != null && (
                    <p>Next billing: {formatRelative(String(razorpay.current_period_end))}</p>
                  )}
                  {(tenant?.trial_ends_at ?? razorpay.trial_ends_at) != null && (
                    <p>
                      Trial ends:{" "}
                      {new Date(
                        String(tenant?.trial_ends_at ?? razorpay.trial_ends_at),
                      ).toLocaleDateString("en-IN")}
                    </p>
                  )}
                  <p>GSTIN: {gstin ?? "Not on file"}</p>
                </div>
              )}
            </div>
          )}

          {tab === "features" && (
            <div className="space-y-2">
              {FEATURE_KEYS.map((key) => {
                const effective = featureEffective(key);
                const overridden = featureOverridden(key);
                const planDefault = !!planFeatures[key];
                return (
                  <div key={key} className="flex items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="text-sa-muted ml-1">
                        (plan: {planDefault ? "on" : "off"})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {overridden && (
                        <button
                          type="button"
                          className="text-sa-muted hover:text-sa-text"
                          onClick={() => clearFeatureOverride(key)}
                          title="Reset to plan default"
                        >
                          ↺
                        </button>
                      )}
                      <button
                        type="button"
                        className={cn(
                          "rounded px-2 py-0.5 min-w-[44px]",
                          overridden
                            ? "bg-sa-accent/30 text-sa-accent"
                            : "bg-sa-raised text-sa-muted",
                        )}
                        onClick={() => toggleFeature(key)}
                      >
                        {effective ? "ON" : "OFF"}
                      </button>
                    </div>
                  </div>
                );
              })}
              <Button type="button" size="sm" disabled={!reasonOk} onClick={() => void saveFeatures()}>
                Save overrides
              </Button>
            </div>
          )}

          {tab === "quota" && tenant && (
            <div className="space-y-4">
              <QuotaBar
                label="Copilot calls"
                used={tenant.copilot_calls_this_month}
                limit={copilotLimit}
              />
              <QuotaBar label="Rows stored" used={tenant.rows_stored} limit={rowsLimit} />
              {opsDetail && (
                <QuotaBar
                  label="Imports this month"
                  used={opsDetail.imports_this_month}
                  limit={opsDetail.imports_limit}
                />
              )}

              {quotaHistory && quotaHistory.length > 0 && (
                <div>
                  <p className="font-medium text-xs mb-1">Quota history</p>
                  <ul className="text-xs space-y-1 text-sa-muted">
                    {quotaHistory.map((h) => (
                      <li key={h.month}>
                        {h.month}: {h.copilot_calls} copilot calls
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs">Bonus copilot calls</Label>
                  <Input
                    type="number"
                    min={0}
                    value={bonusCopilot}
                    onChange={(e) => setBonusCopilot(e.target.value)}
                    className="mt-1 bg-sa-raised border-sa-border"
                  />
                </div>
                <Button type="button" size="sm" disabled={!reasonOk} onClick={() => void addBonus()}>
                  Add bonus
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!reasonOk}
                onClick={() => void resetMonth()}
              >
                Reset month counters
              </Button>
            </div>
          )}

          {tab === "billing" && (
            <div className="space-y-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!reasonOk}
                onClick={() => void resendInvoice()}
              >
                Resend latest GST invoice
              </Button>
              {razorpay && (
                <div className="rounded border border-sa-border bg-sa-raised/50 p-3 text-xs space-y-1">
                  <p className="font-medium">Razorpay status</p>
                  <p>
                    {razorpay.has_subscription
                      ? `Active · ${String(razorpay.subscription_status ?? razorpay.razorpay_status ?? "—")}`
                      : "No subscription"}
                  </p>
                  {(tenant?.trial_ends_at ?? razorpay.trial_ends_at) != null && (
                    <p>
                      Trial:{" "}
                      {new Date(
                        String(tenant?.trial_ends_at ?? razorpay.trial_ends_at),
                      ).toLocaleDateString("en-IN")}
                    </p>
                  )}
                  <p>GSTIN: {gstin ?? "Not on file"}</p>
                </div>
              )}
              <ul className="text-xs space-y-2 max-h-64 overflow-y-auto">
                {(timeline?.events ?? []).map((ev, i) => (
                  <li key={i} className="border-b border-sa-border pb-1">
                    <span className="text-sa-muted capitalize">{String(ev.type)}</span>{" "}
                    {ev.type === "invoice" && (
                      <>
                        {String(ev.invoice_number ?? "")} · ₹
                        {Number(ev.total_amount ?? 0).toLocaleString("en-IN")} ·{" "}
                        {String(ev.status ?? "")}
                      </>
                    )}
                    {ev.type === "dunning" && (
                      <>
                        Day {String(ev.day_offset ?? "")} · {String(ev.channel ?? "")} ·{" "}
                        {String(ev.status ?? "")}
                      </>
                    )}
                  </li>
                ))}
                {(!timeline?.events || timeline.events.length === 0) && (
                  <li className="text-sa-muted">No billing events</li>
                )}
              </ul>
            </div>
          )}

          {tab === "data" && (
            <div className="space-y-3">
              {dataSummary && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Rows: {dataSummary.row_count.toLocaleString("en-IN")}</div>
                  <div>Parties: {dataSummary.distinct_parties}</div>
                  <div>Routes: {dataSummary.distinct_routes}</div>
                  <div>Zones: {dataSummary.distinct_zones}</div>
                  <div>
                    Date range:{" "}
                    {dataSummary.oldest_record_date
                      ? `${dataSummary.oldest_record_date} – ${dataSummary.newest_record_date ?? "—"}`
                      : "—"}
                  </div>
                  <div>Last import: {formatRelative(dataSummary.last_import_at)}</div>
                </div>
              )}
              {dataPreview && dataPreview.rows.length > 0 && (
                <div className="overflow-x-auto max-h-64 border border-sa-border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-sa-raised sticky top-0">
                      <tr>
                        {previewColumns.map((col) => (
                          <th key={col} className="px-2 py-1 text-left font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataPreview.rows.slice(0, 20).map((row, ri) => (
                        <tr key={ri} className="border-t border-sa-border">
                          {previewColumns.map((col) => (
                            <td key={col} className="px-2 py-1 max-w-[120px] truncate">
                              {String(row[col] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {dataPreview && dataPreview.rows.length === 0 && (
                <p className="text-xs text-sa-muted">No preview rows</p>
              )}
            </div>
          )}

          {tab === "danger" && tenant && (
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!reasonOk}
                onClick={() => void loadWipePreview()}
              >
                Preview wipe (dry run)
              </Button>
              {wipePreview && (
                <pre className="text-xs overflow-auto max-h-32 rounded border border-sa-border bg-sa-raised p-2">
                  {JSON.stringify(wipePreview, null, 2)}
                </pre>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!reasonOk}
                onClick={() =>
                  setConfirm({
                    title: tenant.is_active ? "Suspend tenant" : "Activate tenant",
                    description: tenant.is_active
                      ? "Users will not be able to log in."
                      : "Restore tenant access.",
                    phrase: "CONFIRM",
                    action: async () => {
                      if (tenant.is_active) await sa.deactivateTenant(tenantId!, reason);
                      else await sa.activateTenant(tenantId!, reason);
                      await invalidate();
                    },
                  })
                }
              >
                {tenant.is_active ? "Suspend tenant" : "Activate tenant"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-amber-400"
                disabled={!reasonOk}
                onClick={() =>
                  setConfirm({
                    title: "Wipe tenant data",
                    description: "Deletes sales data but keeps the account.",
                    phrase: "CONFIRM",
                    impactPreview: wipePreview ? (
                      <pre className="text-xs whitespace-pre-wrap">
                        {JSON.stringify(wipePreview, null, 2)}
                      </pre>
                    ) : undefined,
                    action: async () => {
                      await sa.wipeTenantData(tenantId!, { reason });
                      await invalidate();
                    },
                  })
                }
              >
                Wipe data
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={!reasonOk}
                onClick={() =>
                  setConfirm({
                    title: "Delete tenant",
                    description: "Permanent. All users and data removed.",
                    phrase: `DELETE ${tenant.name}`,
                    action: async () => {
                      await sa.deleteTenant(tenantId!, {
                        reason,
                        confirm: `DELETE ${tenant.name}`,
                      });
                      onClose();
                      await invalidate();
                    },
                  })
                }
              >
                Delete tenant
              </Button>
            </div>
          )}
        </div>
      </AdminDrawer>

      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={() => setConfirm(null)}
          title={confirm.title}
          description={confirm.description}
          confirmPhrase={confirm.phrase}
          impactPreview={confirm.impactPreview}
          onConfirm={async () => {
            await confirm.action();
            setConfirm(null);
          }}
        />
      )}
    </>
  );
}

function PlanAssignmentSection({
  tenantId,
  reason,
  reasonOk,
  onStatus,
}: {
  tenantId: string;
  reason: string;
  reasonOk: boolean;
  onStatus: (msg: string) => void;
}) {
  const [planCode, setPlanCode] = useState("pro");
  const [customLimitsJson, setCustomLimitsJson] = useState("{}");
  const [source, setSource] = useState("manual");
  const [notes, setNotes] = useState("");
  const [customPriceMinor, setCustomPriceMinor] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [contractStart, setContractStart] = useState("");
  const [contractEnd, setContractEnd] = useState("");
  const [loading, setLoading] = useState(false);

  function buildPayload(dryRun: boolean) {
    let custom_limits: Record<string, unknown> = {};
    try {
      custom_limits = JSON.parse(customLimitsJson) as Record<string, unknown>;
    } catch {
      throw new Error("Invalid custom_limits JSON");
    }
    const contract_metadata =
      source === "contract"
        ? {
            po_number: poNumber.trim() || undefined,
            start_date: contractStart || undefined,
            end_date: contractEnd || undefined,
          }
        : {};
    return {
      reason,
      dry_run: dryRun,
      plan_code: planCode,
      custom_limits,
      source,
      notes,
      custom_price_minor: customPriceMinor ? parseInt(customPriceMinor, 10) : null,
      contract_metadata,
    };
  }

  async function dryRun() {
    setLoading(true);
    try {
      await sa.assignPlan(tenantId, buildPayload(true));
      onStatus("Dry run OK — review impact before applying assignment");
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Dry run failed");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!reasonOk) return;
    setLoading(true);
    try {
      await sa.assignPlan(tenantId, buildPayload(false));
      onStatus(`Plan assignment applied: ${planCode}`);
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded border border-sa-border bg-sa-raised/50 p-3 text-xs space-y-2">
      <p className="font-medium">Custom plan assignment</p>
      <select
        className="w-full rounded border border-sa-border bg-sa-base p-2"
        value={planCode}
        onChange={(e) => setPlanCode(e.target.value)}
      >
        <option value="free">free</option>
        <option value="pro">pro</option>
        <option value="business">business</option>
      </select>
      <textarea
        rows={3}
        placeholder='Custom limits JSON e.g. {"users": 5}'
        value={customLimitsJson}
        onChange={(e) => setCustomLimitsJson(e.target.value)}
        className="w-full rounded border border-sa-border bg-sa-base p-2 font-mono"
      />
      <select
        className="w-full rounded border border-sa-border bg-sa-base p-2"
        value={source}
        onChange={(e) => setSource(e.target.value)}
      >
        <option value="manual">manual</option>
        <option value="contract">contract</option>
        <option value="promotion">promotion</option>
        <option value="razorpay">razorpay</option>
      </select>
      <input
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full rounded border border-sa-border bg-sa-base p-2"
      />
      {source === "contract" && (
        <div className="space-y-2 border border-sa-border rounded p-2">
          <p className="font-medium text-sa-text">Enterprise contract</p>
          <input
            type="number"
            placeholder="Custom price (paise)"
            value={customPriceMinor}
            onChange={(e) => setCustomPriceMinor(e.target.value)}
            className="w-full rounded border border-sa-border bg-sa-base p-2"
          />
          <input
            placeholder="PO number"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            className="w-full rounded border border-sa-border bg-sa-base p-2"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={contractStart}
              onChange={(e) => setContractStart(e.target.value)}
              className="rounded border border-sa-border bg-sa-base p-2"
            />
            <input
              type="date"
              value={contractEnd}
              onChange={(e) => setContractEnd(e.target.value)}
              className="rounded border border-sa-border bg-sa-base p-2"
            />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void dryRun()}>
          Dry run
        </Button>
        <Button type="button" size="sm" disabled={!reasonOk || loading} onClick={() => void apply()}>
          Apply assignment
        </Button>
      </div>
    </div>
  );
}
