import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getDataQuality } from "@/features/data-import/api/cafeImportApi";
import type { DataQuality } from "@/features/data-import/api/types";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";

export function DataQualityWidget() {
  const [quality, setQuality] = useState<DataQuality | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    void getDataQuality()
      .then(setQuality)
      .catch(() => setHidden(true));
  }, []);

  if (hidden || !quality) return null;

  return (
    <GlowSurfaceCard padding="lg" hover={false} className="shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium text-white">Café data quality</h2>
          <p className="text-xs text-text-muted mt-1">
            Last import{" "}
            {quality.last_import_at
              ? new Date(quality.last_import_at).toLocaleString("en-IN")
              : "—"}
          </p>
        </div>
        {quality.quarantine_unresolved > 0 && (
          <Link to="/data/quarantine" className="text-sm text-amber-200 hover:underline shrink-0">
            {quality.quarantine_unresolved} quarantine →
          </Link>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <dt className="text-text-muted">Coverage</dt>
          <dd className="text-white font-medium">{quality.coverage_days}d</dd>
        </div>
        <div>
          <dt className="text-text-muted">Completeness</dt>
          <dd className="text-white font-medium">{quality.completeness_pct.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-text-muted">Channels</dt>
          <dd className="text-white font-medium">
            {quality.channels_mapped}/{quality.channels_total}
          </dd>
        </div>
        <div>
          <dt className="text-text-muted">Quarantine</dt>
          <dd className="text-white font-medium">{quality.quarantine_unresolved}</dd>
        </div>
      </dl>
    </GlowSurfaceCard>
  );
}
