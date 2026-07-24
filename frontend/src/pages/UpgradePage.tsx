import { Link } from "react-router-dom";
import { CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import GradientMesh from "@/components/ui/GradientMesh";
import GradientButton from "@/components/ui/GradientButton";
import { PlanCard } from "@/components/ui/card";
import { createCheckoutSession, BillingApiError } from "@/lib/api/billing";
import { useBilling } from "@/hooks/useBilling";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Your data is preserved for 30 days after cancellation.",
  },
  {
    q: "What happens when I hit the free limit?",
    a: "Copilot stops answering. Dashboard and weekly debrief still work.",
  },
  {
    q: "Can I get a GST invoice?",
    a: "Yes. Every payment generates a GST-compliant invoice emailed to you.",
  },
];

export function UpgradePage() {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const { data: usage } = useBilling();
  const { session } = useAuth();
  const [params] = useSearchParams();
  const cancelled = params.get("cancelled") === "1";

  async function handleUpgrade(plan: "pro" | "business") {
    if (!session) {
      window.location.href = "/login?redirect=/upgrade";
      return;
    }
    setError("");
    setAlreadySubscribed(false);
    setLoadingPlan(plan);
    try {
      const key = crypto.randomUUID();
      const { checkout_url } = await createCheckoutSession(plan, interval, key);
      window.location.href = checkout_url;
    } catch (e) {
      if (e instanceof BillingApiError && e.status === 409) {
        setAlreadySubscribed(true);
        setError("");
      } else {
        setError(
          e instanceof Error
            ? e.message
            : "Payment provider unavailable. Email billing@akara.ai for NEFT."
        );
      }
      setLoadingPlan(null);
    }
  }

  const currentPlan = usage?.plan ?? "free";

  return (
    <div className="relative min-h-screen text-white">
      <GradientMesh />
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <Link to="/dashboard" className="text-sm text-[#90CAF9] hover:text-white">
            ← Back to app
          </Link>
          <h1 className="mt-6 text-4xl font-bold bg-gradient-to-r from-white to-[#90CAF9] bg-clip-text text-transparent">
            Choose your plan
          </h1>
          <p className="mt-3 text-[#90CAF9]">
            Start free, upgrade when you&apos;re ready. No long-term contracts.
          </p>
          <p className="mt-2 text-xs text-[#5C8FBF]">
            GST invoice included · Cancel anytime · India data residency
          </p>
        </div>

        {cancelled && (
          <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm text-center">
            Checkout cancelled. You can try again anytime.
          </div>
        )}
        {alreadySubscribed && (
          <div className="mb-6 rounded-xl border border-[#42A5F5]/30 bg-[#1565C0]/20 px-4 py-4 text-sm text-center">
            <p className="text-white font-medium">You already have an active subscription.</p>
            <p className="text-[#90CAF9] mt-1">Manage your plan, payment method, or cancellation from Billing.</p>
            <Link to="/billing" className="inline-block mt-3">
              <GradientButton size="sm">
                <CreditCard className="h-4 w-4 mr-2 inline" />
                Manage subscription
              </GradientButton>
            </Link>
          </div>
        )}
        {error && !alreadySubscribed && (
          <div className="mb-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-100 text-sm text-center">
            {error}
          </div>
        )}

        <div className="flex justify-center gap-2 mb-10">
          {(["month", "year"] as const).map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => setInterval(iv)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                interval === iv
                  ? "bg-[#1565C0] text-white"
                  : "bg-white/10 text-[#90CAF9] hover:bg-white/15"
              )}
            >
              {iv === "month" ? "Monthly" : "Annual (save ~17%)"}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
            <PlanCard
              name="Free"
              price="₹0"
              description="Try AKARA with your data"
              current={currentPlan === "free"}
              features={[
                "10 copilot questions/month",
                "10,000 rows storage",
                "5 uploads/month",
                "30-day retention",
              ]}
              cta={
                <button disabled className="w-full py-2 rounded-lg bg-white/10 text-[#5C8FBF] text-sm">
                  {currentPlan === "free" ? "Current plan" : "Included"}
                </button>
              }
              className="border-0 bg-transparent shadow-none p-0"
            />
          </div>

          <div className="rounded-2xl border border-[#42A5F5]/40 bg-[rgba(15,52,96,0.5)] backdrop-blur p-6 ring-1 ring-[#42A5F5]/20">
            <PlanCard
              name="Pro"
              price={interval === "month" ? "₹7,999" : "₹79,999"}
              period={interval === "month" ? "/ month" : "/ year"}
              description="For growing distributors"
              popular
              current={currentPlan === "pro"}
              features={[
                "400 copilot questions/month",
                "Simulator & secondary sales",
                "Unlimited monthly uploads",
                "365-day retention",
              ]}
              cta={
                currentPlan === "pro" ? (
                  <Link to="/billing" className="block">
                    <GradientButton className="w-full" variant="secondary">
                      <CreditCard className="h-4 w-4 mr-2 inline" />
                      Manage subscription
                    </GradientButton>
                  </Link>
                ) : (
                  <GradientButton
                    className="w-full"
                    onClick={() => handleUpgrade("pro")}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === "pro" ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      "Upgrade to Pro"
                    )}
                  </GradientButton>
                )
              }
              className="border-0 bg-transparent shadow-none p-0 text-white"
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
            <PlanCard
              name="Business"
              price={interval === "month" ? "₹13,999" : "₹1,39,999"}
              period={interval === "month" ? "/ month" : "/ year"}
              description="Full intelligence stack"
              current={currentPlan === "business"}
              features={[
                "800 copilot questions/month",
                "Scheme leakage detection",
                "Team invites & API keys",
                "3-year retention",
              ]}
              cta={
                currentPlan === "business" ? (
                  <Link to="/billing" className="block">
                    <GradientButton className="w-full" variant="secondary">
                      Manage subscription
                    </GradientButton>
                  </Link>
                ) : (
                  <GradientButton
                    className="w-full"
                    onClick={() => handleUpgrade("business")}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === "business" ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      "Upgrade to Business"
                    )}
                  </GradientButton>
                )
              }
              className="border-0 bg-transparent shadow-none p-0 text-white"
            />
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 text-center">
          <p className="text-[#90CAF9] text-sm">
            Pay via bank transfer / NEFT? Email{" "}
            <a href="mailto:billing@akara.ai" className="text-[#42A5F5] underline">
              billing@akara.ai
            </a>{" "}
            with your company GSTIN and plan choice.
          </p>
        </div>

        <div className="mt-16 max-w-2xl mx-auto space-y-4">
          <h2 className="text-lg font-semibold text-center text-[#90CAF9]">FAQ</h2>
          {FAQ.map(({ q, a }) => (
            <details
              key={q}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <summary className="cursor-pointer font-medium text-sm">{q}</summary>
              <p className="mt-2 text-sm text-[#5C8FBF]">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
