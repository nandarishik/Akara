import { useEffect, useState } from "react";

import { fetchActionSummary } from "../api/actionsApi";
import type { ActionsSummary } from "../types";
import { PendingActionsWidget } from "./PendingActionsWidget";

export function PendingActionsMount() {
  const [summary, setSummary] = useState<ActionsSummary | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchActionSummary()
      .then(setSummary)
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("403") || msg.toLowerCase().includes("plan")) {
          setHidden(true);
        } else {
          setSummary(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (hidden) return null;
  return <PendingActionsWidget summary={summary} loading={loading} />;
}
