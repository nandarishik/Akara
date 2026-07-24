/**
 * PlanGate — lock overlay for Pro/Business features (uirehaul §5.4–5.5).
 */

import { Lock } from "lucide-react";
import { Link } from "react-router-dom";

import { useBilling } from "@/hooks/useBilling";
import type { UsageResponse } from "@/lib/api/billing";
import GradientButton from "@/components/ui/GradientButton";
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
const PLAN_PRICES = { pro: "₹7,999/month", business: "₹13,999/month" } as const;

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
    <div className={cn("relative rounded-2xl overflow-hidden", className)}>
      <div className="pointer-events-none select-none blur-sm opacity-40">{children}</div>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center
          bg-[rgba(5,27,55,0.88)] backdrop-blur-lg border border-[rgba(33,150,243,0.15)] rounded-2xl"
      >
        <Lock
          className="h-12 w-12 text-[#42A5F5] mb-4 drop-shadow-[0_0_20px_rgba(66,165,245,0.5)]"
          aria-hidden
        />
        <h3 className="text-xl font-bold bg-gradient-to-r from-[#42A5F5] to-[#80D8FF] bg-clip-text text-transparent">
          {displayTitle}
        </h3>
        <p className="mt-2 text-sm text-[#90CAF9] max-w-md">{displayDesc}</p>
        <p className="mt-1 text-xs text-[#5C8FBF]">{price}</p>
        <Link to="/upgrade" className="mt-6">
          <GradientButton>
            Upgrade to {PLAN_LABELS[requiredPlan]} →
          </GradientButton>
        </Link>
      </div>
    </div>
  );
}

export function SimulatorPlanGate({ children }: { children: React.ReactNode }) {
  return (
    <PlanGate
      feature="simulator"
      requiredPlan="pro"
      mode="hide"
      title="What-If Simulator"
      description="Model revenue scenarios with sliders and projections."
    >
      {children}
    </PlanGate>
  );
}
