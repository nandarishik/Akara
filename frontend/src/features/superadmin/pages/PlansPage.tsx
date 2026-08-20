import { useEffect, useState } from "react";
import { Loader2, Package, Plus } from "lucide-react";

import { superadminFetch } from "@/lib/api/superadmin";

interface PlanRow {
  code: string;
  display_name: string;
  description?: string;
  monthly_price_minor: number;
  annual_price_minor?: number | null;
  limits?: Record<string, unknown>;
  entitlements?: Record<string, unknown>;
  draft_limits?: Record<string, unknown> | null;
  draft_entitlements?: Record<string, unknown> | null;
  draft_monthly_price_minor?: number | null;
  draft_annual_price_minor?: number | null;
  cta_label?: string;
  is_public: boolean;
  is_active: boolean;
  sort_order?: number;
  version: number;
  affected_tenants?: number;
}

interface PublishPreview {
  impact?: {
    diff?: Record<string, { current: unknown; draft: unknown }>;
    affected_tenants?: number;
    price_migration_scheduled?: boolean;
  };
}

const DEFAULT_LIMITS = { copilot_calls_per_month: 10, rows_total: 10000, users: 1 };

const FEATURE_KEYS = [
  "morning_brief",
  "scheme_leakage",
  "simulator",
  "reports",
  "custom_language",
  "secondary_sales",
  "api_push",
  "tally_connector",
  "team_invites",
  "api_keys",
  "ask_copilot_debrief",
  "alerts",
] as const;

const LIMIT_NUMERIC_KEYS = ["copilot_calls_per_month", "rows_total", "users", "uploads_per_month", "alerts_max"] as const;

export function PlansPage() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PlanRow | null>(null);
  const [publishMsg, setPublishMsg] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishPreview, setPublishPreview] = useState<PublishPreview | null>(null);
  const [scheduleMigration, setScheduleMigration] = useState(false);

  const [editor, setEditor] = useState({
    display_name: "",
    description: "",
    monthly_price_minor: 0,
    annual_price_minor: 0,
    cta_label: "",
    is_public: false,
    sort_order: 99,
    limitsJson: "{}",
    entitlementsJson: "{}",
    featureToggles: {} as Record<string, boolean>,
    limitFields: {} as Record<string, number>,
  });

  const [createForm, setCreateForm] = useState({
    code: "",
    display_name: "",
    monthly_price_minor: 0,
    is_public: false,
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await superadminFetch<{ items: PlanRow[] }>("/superadmin/catalog/plans?include_inactive=true");
      setPlans(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function syncEditor(plan: PlanRow) {
    const limits = plan.draft_limits ?? plan.limits ?? DEFAULT_LIMITS;
    const entitlements = plan.draft_entitlements ?? plan.entitlements ?? { features: {} };
    const features = (entitlements.features ?? {}) as Record<string, boolean>;
    const limitFields: Record<string, number> = {};
    for (const key of LIMIT_NUMERIC_KEYS) {
      const val = (limits as Record<string, unknown>)[key];
      if (typeof val === "number") limitFields[key] = val;
    }
    setEditor({
      display_name: plan.display_name,
      description: plan.description ?? "",
      monthly_price_minor: plan.draft_monthly_price_minor ?? plan.monthly_price_minor ?? 0,
      annual_price_minor: plan.draft_annual_price_minor ?? plan.annual_price_minor ?? 0,
      cta_label: plan.cta_label ?? "",
      is_public: plan.is_public,
      sort_order: plan.sort_order ?? 99,
      limitsJson: JSON.stringify(limits, null, 2),
      entitlementsJson: JSON.stringify(entitlements, null, 2),
      featureToggles: FEATURE_KEYS.reduce(
        (acc, k) => ({ ...acc, [k]: Boolean(features[k]) }),
        {} as Record<string, boolean>,
      ),
      limitFields,
    });
  }

  async function openDetail(code: string) {
    try {
      const plan = await superadminFetch<PlanRow>(`/superadmin/catalog/plans/${code}`);
      setSelected(plan);
      syncEditor(plan);
      setPublishMsg("");
      setShowPublishModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plan");
    }
  }

  async function saveDraft() {
    if (!selected) return;
    setSaving(true);
    setPublishMsg("");
    try {
      let limits: Record<string, unknown>;
      let entitlements: Record<string, unknown>;
      try {
        limits = JSON.parse(editor.limitsJson) as Record<string, unknown>;
        entitlements = JSON.parse(editor.entitlementsJson) as Record<string, unknown>;
      } catch {
        setPublishMsg("Invalid JSON in limits or entitlements");
        return;
      }
      for (const [key, val] of Object.entries(editor.limitFields)) {
        if (val !== undefined && !Number.isNaN(val)) limits[key] = val;
      }
      entitlements.features = editor.featureToggles;
      await superadminFetch(`/superadmin/catalog/plans/${selected.code}`, {
        method: "PATCH",
        body: JSON.stringify({
          reason: "Update plan draft from Plans & Limits editor",
          expected_version: selected.version,
          draft: true,
          display_name: editor.display_name,
          description: editor.description,
          monthly_price_minor: editor.monthly_price_minor,
          annual_price_minor: editor.annual_price_minor || null,
          cta_label: editor.cta_label || null,
          is_public: editor.is_public,
          sort_order: editor.sort_order,
          limits,
          entitlements,
        }),
      });
      setPublishMsg("Draft saved.");
      await load();
      await openDetail(selected.code);
    } catch (e) {
      setPublishMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function dryRunPublish() {
    if (!selected) return;
    setPublishing(true);
    setPublishMsg("");
    try {
      const res = await superadminFetch<PublishPreview>(
        `/superadmin/catalog/plans/${selected.code}/publish`,
        {
          method: "POST",
          body: JSON.stringify({
            reason: "Publish plan catalog changes from Plans & Limits",
            dry_run: true,
            schedule_price_migration: scheduleMigration,
          }),
        },
      );
      setPublishPreview(res);
      setShowPublishModal(true);
    } catch (e) {
      setPublishMsg(e instanceof Error ? e.message : "Dry run failed");
    } finally {
      setPublishing(false);
    }
  }

  async function confirmPublish() {
    if (!selected) return;
    setPublishing(true);
    try {
      await superadminFetch(`/superadmin/catalog/plans/${selected.code}/publish`, {
        method: "POST",
        body: JSON.stringify({
          reason: "Publish plan catalog changes from Plans & Limits",
          dry_run: false,
          expected_version: selected.version,
          schedule_price_migration: scheduleMigration,
        }),
      });
      setPublishMsg("Published successfully.");
      setShowPublishModal(false);
      await load();
      await openDetail(selected.code);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Publish failed";
      setPublishMsg(msg.includes("409") || msg.toLowerCase().includes("conflict")
        ? "Version conflict — refresh the plan and try again (expected_version stale)."
        : msg);
    } finally {
      setPublishing(false);
    }
  }

  async function syncRazorpay(dryRun: boolean) {
    if (!selected) return;
    setPublishing(true);
    try {
      const res = await superadminFetch<{ synced?: boolean; message?: string; razorpay_ids?: Record<string, string> }>(
        `/superadmin/catalog/plans/${selected.code}/sync-razorpay`,
        {
          method: "POST",
          body: JSON.stringify({
            reason: "Sync Razorpay plan IDs from Plans & Limits",
            dry_run: dryRun,
          }),
        },
      );
      setPublishMsg(dryRun ? "Razorpay sync dry run OK" : `Synced: ${JSON.stringify(res.razorpay_ids ?? {})}`);
    } catch (e) {
      setPublishMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setPublishing(false);
    }
  }

  async function createPlan() {
    setSaving(true);
    try {
      await superadminFetch("/superadmin/catalog/plans", {
        method: "POST",
        body: JSON.stringify({
          code: createForm.code.toLowerCase(),
          display_name: createForm.display_name,
          monthly_price_minor: createForm.monthly_price_minor,
          is_public: createForm.is_public,
        }),
      });
      setShowCreate(false);
      setCreateForm({ code: "", display_name: "", monthly_price_minor: 0, is_public: false });
      await load();
      await openDetail(createForm.code.toLowerCase());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold sa-text">Plans & Limits</h1>
          <p className="text-sm sa-text-muted mt-1">Dynamic plan catalog — publish updates without deploy</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="sa-border sa-raised px-3 py-1.5 text-sm sa-text rounded-lg flex items-center gap-1"
          >
            <Plus className="h-4 w-4" /> New plan
          </button>
          <button type="button" onClick={() => void load()} className="sa-border sa-raised px-3 py-1.5 text-sm sa-text rounded-lg">
            Refresh
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="sa-border sa-raised rounded-xl p-4 grid gap-3 md:grid-cols-4">
          <input
            placeholder="code (e.g. enterprise)"
            value={createForm.code}
            onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))}
            className="sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
          />
          <input
            placeholder="Display name"
            value={createForm.display_name}
            onChange={(e) => setCreateForm((f) => ({ ...f, display_name: e.target.value }))}
            className="sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
          />
          <input
            type="number"
            placeholder="Monthly price (paise)"
            value={createForm.monthly_price_minor || ""}
            onChange={(e) => setCreateForm((f) => ({ ...f, monthly_price_minor: parseInt(e.target.value, 10) || 0 }))}
            className="sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
          />
          <button
            type="button"
            disabled={saving || !createForm.code || !createForm.display_name}
            onClick={() => void createPlan()}
            className="bg-emerald-600/80 px-3 py-2 text-sm text-white rounded-lg disabled:opacity-50"
          >
            Create
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 sa-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading plans…
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="sa-border sa-raised rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="sa-border-b">
              <tr className="sa-text-muted text-left">
                <th className="p-3">Plan</th>
                <th className="p-3">Price/mo</th>
                <th className="p-3">Status</th>
                <th className="p-3">Ver</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr
                  key={p.code}
                  className="sa-border-b cursor-pointer hover:bg-white/5"
                  onClick={() => void openDetail(p.code)}
                >
                  <td className="p-3 sa-text font-medium">{p.display_name}</td>
                  <td className="p-3 sa-text">₹{(p.monthly_price_minor / 100).toLocaleString("en-IN")}</td>
                  <td className="p-3">
                    <span className={p.is_active ? "text-emerald-400" : "text-amber-400"}>
                      {p.is_active ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td className="p-3 sa-text-muted">v{p.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sa-border sa-raised rounded-xl p-4 space-y-4">
          {!selected ? (
            <div className="flex flex-col items-center justify-center py-12 sa-text-muted">
              <Package className="h-8 w-8 mb-2 opacity-50" />
              <p>Select a plan to edit or publish</p>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-semibold sa-text">{selected.display_name}</h2>
                <p className="text-sm sa-text-muted">Code: {selected.code} · v{selected.version}</p>
                {selected.affected_tenants != null && (
                  <p className="text-sm sa-text-muted mt-1">{selected.affected_tenants} active subscriber(s)</p>
                )}
              </div>

              <div className="grid gap-2">
                <input
                  value={editor.display_name}
                  onChange={(e) => setEditor((ed) => ({ ...ed, display_name: e.target.value }))}
                  className="sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
                  placeholder="Display name"
                />
                <textarea
                  value={editor.description}
                  onChange={(e) => setEditor((ed) => ({ ...ed, description: e.target.value }))}
                  rows={2}
                  className="sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
                  placeholder="Description"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={editor.monthly_price_minor}
                    onChange={(e) => setEditor((ed) => ({ ...ed, monthly_price_minor: parseInt(e.target.value, 10) || 0 }))}
                    className="sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
                    placeholder="Monthly (paise)"
                  />
                  <input
                    type="number"
                    value={editor.annual_price_minor}
                    onChange={(e) => setEditor((ed) => ({ ...ed, annual_price_minor: parseInt(e.target.value, 10) || 0 }))}
                    className="sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
                    placeholder="Annual (paise)"
                  />
                </div>
                <input
                  value={editor.cta_label}
                  onChange={(e) => setEditor((ed) => ({ ...ed, cta_label: e.target.value }))}
                  className="sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
                  placeholder="CTA label"
                />
                <label className="flex items-center gap-2 text-sm sa-text">
                  <input
                    type="checkbox"
                    checked={editor.is_public}
                    onChange={(e) => setEditor((ed) => ({ ...ed, is_public: e.target.checked }))}
                  />
                  Public (show on landing / upgrade)
                </label>
                <div>
                  <p className="text-xs sa-text-muted mb-1">Limits</p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {LIMIT_NUMERIC_KEYS.map((key) => (
                      <label key={key} className="text-xs sa-text-muted">
                        {key}
                        <input
                          type="number"
                          value={editor.limitFields[key] ?? ""}
                          onChange={(e) =>
                            setEditor((ed) => ({
                              ...ed,
                              limitFields: { ...ed.limitFields, [key]: parseInt(e.target.value, 10) || 0 },
                            }))
                          }
                          className="w-full sa-border rounded-lg px-2 py-1 text-sm sa-text bg-transparent mt-0.5"
                        />
                      </label>
                    ))}
                  </div>
                  <p className="text-xs sa-text-muted mb-1">Limits (JSON — advanced)</p>
                  <textarea
                    value={editor.limitsJson}
                    onChange={(e) => setEditor((ed) => ({ ...ed, limitsJson: e.target.value }))}
                    rows={4}
                    className="w-full sa-border rounded-lg px-3 py-2 text-xs font-mono sa-text bg-transparent"
                  />
                </div>
                <div>
                  <p className="text-xs sa-text-muted mb-1">Feature toggles</p>
                  <div className="grid grid-cols-2 gap-1 max-h-40 overflow-auto">
                    {FEATURE_KEYS.map((key) => (
                      <label key={key} className="flex items-center gap-2 text-xs sa-text">
                        <input
                          type="checkbox"
                          checked={editor.featureToggles[key] ?? false}
                          onChange={(e) =>
                            setEditor((ed) => ({
                              ...ed,
                              featureToggles: { ...ed.featureToggles, [key]: e.target.checked },
                            }))
                          }
                        />
                        {key}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs sa-text-muted mb-1">Entitlements (JSON — advanced)</p>
                  <textarea
                    value={editor.entitlementsJson}
                    onChange={(e) => setEditor((ed) => ({ ...ed, entitlementsJson: e.target.value }))}
                    rows={3}
                    className="w-full sa-border rounded-lg px-3 py-2 text-xs font-mono sa-text bg-transparent"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveDraft()}
                  className="sa-border sa-raised px-3 py-1.5 text-sm sa-text rounded-lg disabled:opacity-50"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={publishing}
                  onClick={() => void dryRunPublish()}
                  className="sa-border sa-raised px-3 py-1.5 text-sm sa-text rounded-lg disabled:opacity-50"
                >
                  Preview publish
                </button>
                <button
                  type="button"
                  disabled={publishing}
                  onClick={() => void syncRazorpay(true)}
                  className="sa-border sa-raised px-3 py-1.5 text-sm sa-text rounded-lg disabled:opacity-50"
                >
                  Sync Razorpay (dry run)
                </button>
                <button
                  type="button"
                  disabled={publishing}
                  onClick={() => void syncRazorpay(false)}
                  className="sa-border sa-raised px-3 py-1.5 text-sm sa-text rounded-lg disabled:opacity-50"
                >
                  Sync Razorpay
                </button>
              </div>
              {publishMsg && <p className="text-sm sa-text-muted">{publishMsg}</p>}
            </>
          )}
        </div>
      </div>

      {showPublishModal && publishPreview && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="sa-border sa-raised rounded-xl p-6 max-w-lg w-full space-y-4">
            <h3 className="text-lg font-semibold sa-text">Publish {selected.display_name}</h3>
            <p className="text-sm sa-text-muted">
              {publishPreview.impact?.affected_tenants ?? 0} tenant(s) affected
            </p>
            {publishPreview.impact?.diff && Object.keys(publishPreview.impact.diff).length > 0 ? (
              <pre className="text-xs sa-text-muted overflow-auto max-h-48 sa-border rounded-lg p-3">
                {JSON.stringify(publishPreview.impact.diff, null, 2)}
              </pre>
            ) : (
              <p className="text-sm sa-text-muted">No draft changes to publish.</p>
            )}
            <label className="flex items-center gap-2 text-sm sa-text">
              <input
                type="checkbox"
                checked={scheduleMigration}
                onChange={(e) => setScheduleMigration(e.target.checked)}
              />
              Schedule Razorpay price migration for existing subscriptions
            </label>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowPublishModal(false)} className="sa-border px-3 py-1.5 text-sm sa-text rounded-lg">
                Cancel
              </button>
              <button
                type="button"
                disabled={publishing}
                onClick={() => void confirmPublish()}
                className="bg-emerald-600/80 px-3 py-1.5 text-sm text-white rounded-lg disabled:opacity-50"
              >
                Confirm publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
