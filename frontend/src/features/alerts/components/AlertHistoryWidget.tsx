import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import { fetchAlertHistory } from "@/features/intelligence/api/intelligenceApi";
import type { AlertHistoryItem } from "@/features/intelligence/api/types";

export function AlertHistoryWidget() {
  const [items, setItems] = useState<AlertHistoryItem[] | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    void fetchAlertHistory()
      .then((rows) => setItems(rows.slice(0, 10)))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "";
        if (msg.toLowerCase().includes("403") || msg.toLowerCase().includes("plan")) {
          setHidden(true);
        } else {
          setItems([]);
        }
      });
  }, []);

  if (hidden || items === null) return null;

  return (
    <GlowSurfaceCard padding="md" className="space-y-3" hover={false}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Recent alerts</h2>
        <Link to="/alerts/history" className="text-sm text-accent hover:underline">
          View all
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">No alert fires in the last 30 days.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((row) => (
            <li key={row.id} className="flex justify-between gap-3 text-text-secondary">
              <span>{row.metric_label}</span>
              <span className="text-text-muted shrink-0">
                {new Date(row.timestamp).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </GlowSurfaceCard>
  );
}
