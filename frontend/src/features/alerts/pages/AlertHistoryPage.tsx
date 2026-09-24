import { useEffect, useState } from "react";

import ProductPageLayout from "@/shared/layout/ProductPageLayout";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import { fetchAlertHistory } from "@/features/intelligence/api/intelligenceApi";
import type { AlertHistoryItem } from "@/features/intelligence/api/types";
import { EscalationBadge } from "../components/EscalationBadge";

export function AlertHistoryPage() {
  const [items, setItems] = useState<AlertHistoryItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchAlertHistory()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Load failed"));
  }, []);

  return (
    <ProductPageLayout maxWidth="5xl" className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Alert history</h1>
        <p className="text-sm text-text-muted mt-1">Fires from the last 30 days.</p>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <GlowSurfaceCard padding="md" hover={false} className="overflow-x-auto">
        {items.length === 0 ? (
          <p className="text-sm text-text-muted">No fires yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-text-muted">
              <tr>
                <th className="p-2">Metric</th>
                <th className="p-2">Value</th>
                <th className="p-2">Channel</th>
                <th className="p-2">Escalation</th>
                <th className="p-2">When</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-white/10">
                  <td className="p-2">{row.metric_label}</td>
                  <td className="p-2">{row.value}</td>
                  <td className="p-2">{row.channel}</td>
                  <td className="p-2">
                    <EscalationBadge level={row.escalation_level} />
                  </td>
                  <td className="p-2 text-text-muted">
                    {new Date(row.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlowSurfaceCard>
    </ProductPageLayout>
  );
}
