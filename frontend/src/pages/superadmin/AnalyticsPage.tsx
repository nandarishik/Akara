import { useEffect, useState } from "react";

import { superadminFetch } from "@/lib/api/superadmin";

export function SuperadminAnalyticsPage() {
  const [revenue, setRevenue] = useState<Record<string, unknown> | null>(null);
  const [costs, setCosts] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void superadminFetch<Record<string, unknown>>("/superadmin/revenue").then(setRevenue);
    void superadminFetch<Record<string, unknown>>("/superadmin/costs").then(setCosts);
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-2 text-sa-text">
      <div>
        <h2 className="mb-2 text-lg font-semibold">Revenue</h2>
        <pre className="overflow-auto rounded border border-sa-border bg-sa-raised p-4 text-xs">
          {JSON.stringify(revenue, null, 2)}
        </pre>
      </div>
      <div>
        <h2 className="mb-2 text-lg font-semibold">LLM costs</h2>
        <pre className="overflow-auto rounded border border-sa-border bg-sa-raised p-4 text-xs">
          {JSON.stringify(costs, null, 2)}
        </pre>
      </div>
    </div>
  );
}
