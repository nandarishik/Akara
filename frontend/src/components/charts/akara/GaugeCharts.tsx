import { Gauge } from "@/charts";
import { chartColors } from "@/lib/charts/chartTheme";
import { toBillingGauge } from "@/lib/charts/chartAdapters";
import type { UsageResponse } from "@/lib/api/billing";

interface Props {
  usage?: UsageResponse | null;
  label?: string;
  className?: string;
}

export function PlanHealthGauge({ usage, label = "Plan utilization", className }: Props) {
  const value = usage ? toBillingGauge(usage) : 0;

  return (
    <div className={className}>
      <Gauge
        value={value}
        centerValue={value}
        defaultLabel={label}
        suffix="%"
        activeFill={chartColors.primary}
        inactiveFillOpacity={0.35}
        minWidth={200}
      />
    </div>
  );
}

interface ConfidenceProps {
  score: number;
  className?: string;
}

export function ConfidenceGauge({ score, className }: ConfidenceProps) {
  return (
    <div className={className}>
      <Gauge
        value={score}
        centerValue={score}
        defaultLabel="Confidence"
        suffix="%"
        activeFill={chartColors.primary}
        inactiveFillOpacity={0.35}
        minWidth={200}
      />
    </div>
  );
}
