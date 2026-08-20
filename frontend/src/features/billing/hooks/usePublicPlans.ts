import { useEffect, useState } from "react";

import {
  fetchPublicPlans,
  formatInrFromMinor,
  type PublicPlan,
} from "@/lib/api/public";

export const FALLBACK_PLANS = [
  {
    code: "free",
    name: "Free",
    price: "₹0",
    period: "/month",
    cta: "Start free →",
    ctaLink: "/signup",
    popular: false,
    features: [
      "10 copilot questions/month",
      "Up to 10,000 rows",
      "1 user",
      "Basic dashboard & reports",
      "CSV / Excel import",
      "Email support",
    ],
  },
  {
    code: "pro",
    name: "Pro",
    price: "₹7,999",
    period: "/month",
    cta: "Upgrade to Pro →",
    ctaLink: "/signup",
    popular: true,
    features: [
      "400 copilot questions/month",
      "Up to 1,00,000 rows",
      "3 users",
      "WhatsApp weekly brief",
      "Secondary sales analytics",
      "Priority support",
    ],
  },
  {
    code: "business",
    name: "Business",
    price: "₹13,999",
    period: "/month",
    cta: "Upgrade to Business →",
    ctaLink: "/signup",
    popular: false,
    features: [
      "Unlimited copilot questions",
      "Unlimited rows",
      "Unlimited users",
      "Everything in Pro",
      "Scheme leakage deep-dive",
      "What-if simulator",
      "Dedicated onboarding",
    ],
  },
];

function planToDisplay(p: PublicPlan) {
  const limits = p.limits ?? {};
  const calls = limits.copilot_calls_per_month;
  const rows = limits.rows_total;
  const features: string[] = [];
  if (typeof calls === "number") {
    features.push(
      calls === -1 ? "Unlimited copilot questions" : `${calls} copilot questions/month`,
    );
  }
  if (typeof rows === "number") {
    features.push(rows === -1 ? "Unlimited rows" : `Up to ${Number(rows).toLocaleString("en-IN")} rows`);
  }
  return {
    code: p.code,
    name: p.display_name,
    price: formatInrFromMinor(p.monthly_price_minor),
    period: "/month",
    cta: p.cta_label || `Upgrade to ${p.display_name} →`,
    ctaLink: "/signup",
    popular: p.code === "pro",
    features: features.length ? features : FALLBACK_PLANS.find((f) => f.code === p.code)?.features ?? [],
  };
}

export function usePublicPlans() {
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [source, setSource] = useState<"fallback" | "api">("fallback");

  useEffect(() => {
    fetchPublicPlans()
      .then((items) => {
        if (items.length > 0) {
          setPlans(items.map(planToDisplay));
          setSource("api");
        }
      })
      .catch(() => setSource("fallback"));
  }, []);

  return { plans, source };
}
