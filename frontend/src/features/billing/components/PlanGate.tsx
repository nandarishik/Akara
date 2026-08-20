/**
 * PlanGate â€” unified light overlay for Pro/Business features.
 */

import { Lock } from "lucide-react";
import { Link } from "react-router-dom";

import { useBilling } from "@/features/billing/hooks/useBilling";
import type { UsageResponse } from "@/lib/api/billing";
import { AkaraButton } from "@/shared/ui/GradientButton";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import { cn } from "@/lib/utils";

type FeatureKey = keyof UsageResponse["features"];

interface PlanGateProps {
  feature: FeatureKey;
  requiredPlan: "pro" | "business";
  mode?: "lock" | "hide";
  title?: string;
  description?: string;
  priceHint?: string;
  children: React.ReactNode;
  className?: string;
}

const PLAN_LABELS = { pro: "Pro", business: "Business" } as const;
const PLAN_PRICES = { pro: "â‚¹7,999/month", business: "â‚¹13,999/month" } as const;

export function PlanGate({
  feature,
  requiredPlan,
  mode = "lock",
  title,
  description,
  priceHint,
  children,
  className,
}: PlanGateProps) {
  const { data: usage, isLoading } = useBilling();

  if (isLoading || !usage) {
    return <>{children}</>;
  }

  if (usage.features[feature]) {
    return <>{children}</>;
  }

  if (mode === "hide") {
    return null;
  }

  const displayTitle = title ?? `${PLAN_LABELS[requiredPlan]} feature`;
  const displayDesc =
    description ??
    `Upgrade to ${PLAN_LABELS[requiredPlan]} to unlock this capability.`;
  const price = priceHint ?? `From ${PLAN_PRICES[requiredPlan]}`;

  return (
    <div className={cn("relative min-h-[200px]", className)}>
      <div className="pointer-events-none select-none opacity-30 blur-[2px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <GlowSurfaceCard className="max-w-md w-full text-center shadow-card-hover">
          <Lock className="h-10 w-10 text-text-muted mx-auto mb-4" aria-hidden />
          <h3 className="text-h2">{displayTitle}</h3>
          <p className="mt-2 text-body text-sm">{displayDesc}</p>
          <p className="mt-1 text-caption">{price}</p>
          <Link to="/upgrade" className="inline-block mt-6">
            <AkaraButton>Upgrade to {PLAN_LABELS[requiredPlan]} â†’</AkaraButton>
          </Link>
        </GlowSurfaceCard>
      </div>
    </div>
  );
}

export function SimulatorPlanGate({ children }: { children: React.ReactNode }) {
  return (
    <PlanGate
      feature="simulator"
      requiredPlan="pro"
      mode="lock"
      title="What-If Simulator"
      description="Model revenue scenarios with sliders and projections."
    >
      {children}
    </PlanGate>
  );
}
