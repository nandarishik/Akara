import { RingChart, Ring, RingCenter } from "@/charts";
import type { RingData } from "@/charts/ring-context";import { toBillingRings } from "@/lib/charts/chartAdapters";
import type { UsageResponse } from "@/lib/api/billing";

interface Props {
  usage?: UsageResponse | null;
  className?: string;
}

export function QuotaRingChart({ usage, className }: Props) {
  if (!usage) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        Loading usage…
      </div>
    );
  }

  const rings: RingData[] = toBillingRings(usage);
  if (rings.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        No quota limits configured
      </div>
    );
  }

  return (
    <RingChart className={className} data={rings} size={260}>
      {rings.map((item, index) => (
        <Ring key={item.label} index={index} />
      ))}
      <RingCenter defaultLabel="Plan usage" />
    </RingChart>
  );
}
