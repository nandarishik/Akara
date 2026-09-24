import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";

import ProductPageLayout from "@/shared/layout/ProductPageLayout";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import GlowCTAButton from "@/shared/ui/GlowCTAButton";
import { PlanGate } from "@/features/billing/components/PlanGate";
import { useBilling } from "@/features/billing/hooks/useBilling";
import {
  createAlert,
  deleteAlert,
  fetchAlerts,
  updateAlert,
} from "@/features/intelligence/api/intelligenceApi";
import { METRIC_LABELS } from "@/features/intelligence/api/types";
import type { CafeAlert } from "@/features/intelligence/api/types";

import { AlertRuleModal } from "../components/AlertRuleModal";
import { AlertRulesList } from "../components/AlertRulesList";

export function AlertSettingsPage() {
  const { data: usage } = useBilling();
  const plan = usage?.plan ?? "free";
  const maxSlots = plan === "business" ? null : plan === "pro" ? 5 : 0;

  const [alerts, setAlerts] = useState<CafeAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CafeAlert | null>(null);
  const [saving, setSaving] = useState(false);

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
    if (plan !== "free") void load();
    else setLoading(false);
  }, [plan]);

  if (plan === "free") {
    return (
      <ProductPageLayout maxWidth="5xl">
        <PlanGate feature="alerts" requiredPlan="pro">
          <p className="text-text-secondary">Upgrade to Pro to create café alert rules.</p>
        </PlanGate>
      </ProductPageLayout>
    );
  }

  return (
    <ProductPageLayout maxWidth="5xl" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Café alert rules
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Threshold and anomaly alerts for café metrics.
            {maxSlots != null && (
              <span className="ml-1">
                {alerts.length} of {maxSlots} slots used
              </span>
            )}
          </p>
        </div>
        <GlowCTAButton
          size="sm"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          New alert
        </GlowCTAButton>
      </div>

      <p className="sr-only">
        {Object.values(METRIC_LABELS).join(" ")}
      </p>

      {error && (
        <GlowSurfaceCard accent="red" padding="sm" hover={false}>
          <p className="text-sm text-red-300">{error}</p>
        </GlowSurfaceCard>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : (
        <AlertRulesList
          alerts={alerts}
          onEdit={(a) => {
            setEditing(a);
            setModalOpen(true);
          }}
          onDelete={async (a) => {
            await deleteAlert(a.id);
            setAlerts((prev) => prev.filter((x) => x.id !== a.id));
          }}
        />
      )}

      {modalOpen && (
        <AlertRuleModal
          initial={editing}
          saving={saving}
          onClose={() => setModalOpen(false)}
          onSubmit={async (payload) => {
            setSaving(true);
            try {
              if (editing) {
                const updated = await updateAlert(editing.id, payload);
                setAlerts((prev) => prev.map((a) => (a.id === editing.id ? updated : a)));
              } else {
                const created = await createAlert(payload);
                setAlerts((prev) => [created, ...prev]);
              }
              setModalOpen(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Save failed");
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </ProductPageLayout>
  );
}
