import { Link } from "react-router-dom";

import ReflectiveCard from "@/components/effects/ReflectiveCard";

export type PlanReflectiveCardPlan = {
  name: string;
  price: string;
  period: string;
  cta: string;
  ctaLink: string;
  popular: boolean;
  features: string[];
  badgeText: string;
  planId: string;
};

type Props = {
  plan: PlanReflectiveCardPlan;
};

export default function PlanReflectiveCard({ plan }: Props) {
  return (
    <ReflectiveCard
      variant="plan"
      popular={plan.popular}
      badgeText={plan.badgeText}
      planName={`AKARA ${plan.name}`}
      planPrice={`${plan.price}${plan.period}`}
      planId={plan.planId}
      features={plan.features}
      footer={
        <Link
          to={plan.ctaLink}
          className={`plan-reflective-cta ${plan.popular ? "plan-reflective-cta--primary" : "plan-reflective-cta--secondary"}`}
        >
          {plan.cta}
        </Link>
      }
    />
  );
}

export const PLAN_REFLECTIVE_META: Record<string, { badgeText: string; planId: string; ctaLink: string }> = {
  Free: { badgeText: "FREE TIER", planId: "AKR-FREE-****-0001", ctaLink: "/signup" },
  Pro: { badgeText: "SECURE BILLING", planId: "AKR-8901-****-6789", ctaLink: "/signup?plan=pro" },
  Business: { badgeText: "ENTERPRISE", planId: "AKR-BIZ-****-4521", ctaLink: "/signup?plan=business" },
};
