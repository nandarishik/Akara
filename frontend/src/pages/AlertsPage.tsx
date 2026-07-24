import { useEffect, useState } from "react";
import { Bell, Loader2, Plus, Trash2 } from "lucide-react";

import { PlanGate } from "@/components/billing/PlanGate";
import { useBilling } from "@/hooks/useBilling";
import {
  createAlert,
  deleteAlert,
  fetchAlerts,
  metricLabel,
  updateAlert,
  type AlertSummary,
} from "@/lib/api/alerts";

const METRICS = [
  "secondary_sales_total",
  "primary_sales_total",
  "outstanding_amount",
  "beat_adherence_pct",
] as const;

export function AlertsPage() {
  const { data: usage } = useBilling();
  const plan = usage?.plan ?? "free";
  const maxSlots = plan === "business" ? null : plan === "pro" ? 5 : 0;

  const [alerts, setAlerts] = useState<AlertSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [metric, setMetric] = useState<string>(METRICS[0]);
  const [condition, setCondition] = useState<"below" | "above" | "equals">("below");
  const [threshold, setThreshold] = useState(50000);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setAlerts(await fetchAlerts());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load alerts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (plan !== "free") load();
    else setLoading(false);
  }, [plan]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await createAlert({ name, metric, condition, threshold });
      setAlerts((prev) => [created, ...prev]);
      setShowForm(false);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(alert: AlertSummary) {
    const updated = await updateAlert(alert.id, { is_active: !alert.is_active });
    setAlerts((prev) => prev.map((a) => (a.id === alert.id ? updated : a)));
  }

  async function remove(alert: AlertSummary) {
    await deleteAlert(alert.id);
    setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
  }

  if (plan === "free") {
    return (
      <div className="p-8">
        <PlanGate feature="alerts" requiredPlan="pro">
          <p className="text-text-secondary">Upgrade to Pro to create threshold alerts.</p>
        </PlanGate>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Alerts
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Get emailed when metrics cross your thresholds.
            {maxSlots != null && (
              <span className="ml-1">
                {alerts.length} of {maxSlots} slots used
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm"
        >
          <Plus className="h-4 w-4" />
          New alert
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-surface-border bg-surface-raised p-4 space-y-3">
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Alert name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div className="grid gap-3 md:grid-cols-3">
            <select value={metric} onChange={(e) => setMetric(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              {METRICS.map((m) => (
                <option key={m} value={m}>{metricLabel(m)}</option>
              ))}
            </select>
            <select value={condition} onChange={(e) => setCondition(e.target.value as typeof condition)} className="rounded-lg border px-3 py-2 text-sm">
              <option value="below">falls below</option>
              <option value="above">rises above</option>
              <option value="equals">equals</option>
            </select>
            <input
              type="number"
              className="rounded-lg border px-3 py-2 text-sm"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              required
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-accent text-white text-sm disabled:opacity-50">
              {saving ? "Saving…" : "Save alert"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : alerts.length === 0 ? (
        <p className="text-text-muted text-sm">No alerts yet. Create one to get notified by email.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-raised text-text-muted text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Rule</th>
                <th className="p-3">Last triggered</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="border-t border-surface-border">
                  <td className="p-3 font-medium">{a.name}</td>
                  <td className="p-3 text-text-secondary">
                    {metricLabel(a.metric)} {a.condition} {a.threshold}
                  </td>
                  <td className="p-3 text-text-muted">
                    {a.last_triggered ? new Date(a.last_triggered).toLocaleString() : "—"}
                  </td>
                  <td className="p-3">
                    <button type="button" onClick={() => toggleActive(a)} className="text-accent text-xs underline">
                      {a.is_active ? "Active" : "Paused"}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <button type="button" onClick={() => remove(a)} aria-label="Delete alert">
                      <Trash2 className="h-4 w-4 text-text-muted hover:text-red-600" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
