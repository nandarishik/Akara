import { useEffect, useState } from "react";

import ProductPageLayout from "@/shared/layout/ProductPageLayout";
import { PlanGate } from "@/features/billing/components/PlanGate";
import { fetchMorningBriefPreview } from "@/features/intelligence/api/intelligenceApi";
import type { MorningBriefPreview as Preview } from "@/features/intelligence/api/types";
import { MorningBriefPreview } from "../components/MorningBriefPreview";

export function MorningBriefSettingsPage() {
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchMorningBriefPreview()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Load failed"));
  }, []);

  return (
    <ProductPageLayout maxWidth="3xl" className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Morning brief preview</h1>
        <p className="text-sm text-text-muted mt-1">
          Today’s assembled context. Sending a test brief is superadmin-only in Phase 10.
        </p>
      </div>
      <PlanGate feature="morning_brief" requiredPlan="pro" mode="hide">
        {error && <p className="text-sm text-red-300">{error}</p>}
        {data && <MorningBriefPreview data={data} />}
        {!data && !error && <p className="text-sm text-text-muted">Loading preview…</p>}
      </PlanGate>
    </ProductPageLayout>
  );
}
