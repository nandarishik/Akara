import { Link } from "react-router-dom";
import { CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import AkaraButton from "@/components/ui/GradientButton";
import GlowSurfaceCard from "@/components/ui/GlowSurfaceCard";
import { PlanCard } from "@/components/ui/card";
import { createCheckoutSession, BillingApiError } from "@/lib/api/billing";
import { openRazorpaySubscriptionCheckout } from "@/lib/razorpayCheckout";
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
  const { session, user } = useAuth();
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
      const checkout = await createCheckoutSession(plan, interval, key);
      try {
        await openRazorpaySubscriptionCheckout({
          keyId: checkout.razorpay_key_id,
          subscriptionId: checkout.subscription_id,
          email: session.user.email,
          name: user?.displayName ?? undefined,
          onSuccess: () => {
            window.location.href = "/billing?upgraded=1";
          },
        });
      } catch (checkoutErr) {
        if (
          checkoutErr instanceof Error &&
          checkoutErr.message === "Checkout closed"
        ) {
          setLoadingPlan(null);
          return;
        }
        window.location.href = checkout.checkout_url;
      }
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
    <div className="min-h-screen bg-surface-bg text-text-primary">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <Link to="/dashboard" className="text-sm text-accent hover:text-accent-hover">
            ← Back to app
          </Link>
          <h1 className="mt-6 text-4xl font-bold text-text-primary tracking-tight">
            Choose your plan
          </h1>
          <p className="mt-3 text-text-secondary">
            Start free, upgrade when you&apos;re ready. No long-term contracts.
          </p>
          <p className="mt-2 text-xs text-text-muted">
            GST invoice included · Cancel anytime · India data residency
          </p>
        </div>

        {cancelled && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm text-center">
            Checkout cancelled. You can try again anytime.
          </div>
        )}
        {alreadySubscribed && (
          <div className="mb-6 rounded-xl border border-accent/30 bg-accent-soft px-4 py-4 text-sm text-center">
            <p className="text-text-primary font-medium">You already have an active subscription.</p>
            <p className="text-text-secondary mt-1">Manage your plan, payment method, or cancellation from Billing.</p>
            <Link to="/billing" className="inline-block mt-3">
              <AkaraButton size="sm">
                <CreditCard className="h-4 w-4 mr-2 inline" />
                Manage subscription
              </AkaraButton>
            </Link>
          </div>
        )}
        {error && !alreadySubscribed && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm text-center">
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
                  ? "bg-accent text-white"
                  : "bg-surface-raised text-text-secondary hover:bg-surface-border"
              )}
            >
              {iv === "month" ? "Monthly" : "Annual (save ~17%)"}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <GlowSurfaceCard padding="lg">
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
                <button disabled className="w-full py-2 rounded-full bg-surface-raised text-text-muted text-sm">
                  {currentPlan === "free" ? "Current plan" : "Included"}
                </button>
              }
              className="border-0 bg-transparent shadow-none p-0"
            />
          </GlowSurfaceCard>

          <GlowSurfaceCard
            padding="lg"
            className="border-2 border-accent ring-1 ring-accent/20 shadow-card-hover"
          >
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
                    <AkaraButton className="w-full" variant="secondary">
                      <CreditCard className="h-4 w-4 mr-2 inline" />
                      Manage subscription
                    </AkaraButton>
                  </Link>
                ) : (
                  <AkaraButton
                    className="w-full"
                    onClick={() => handleUpgrade("pro")}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === "pro" ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      "Upgrade to Pro"
                    )}
                  </AkaraButton>
                )
              }
              className="border-0 bg-transparent shadow-none p-0"
            />
          </GlowSurfaceCard>

          <GlowSurfaceCard padding="lg">
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
                    <AkaraButton className="w-full" variant="secondary">
                      Manage subscription
                    </AkaraButton>
                  </Link>
                ) : (
                  <AkaraButton
                    className="w-full"
                    onClick={() => handleUpgrade("business")}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === "business" ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      "Upgrade to Business"
                    )}
                  </AkaraButton>
                )
              }
              className="border-0 bg-transparent shadow-none p-0"
            />
          </GlowSurfaceCard>
        </div>

        <GlowSurfaceCard className="mt-12 text-center" padding="lg">
          <p className="text-text-secondary text-sm">
            Pay via bank transfer / NEFT? Email{" "}
            <a href="mailto:billing@akara.ai" className="text-accent hover:text-accent-hover underline">
              billing@akara.ai
            </a>{" "}
            with your company GSTIN and plan choice.
          </p>
        </GlowSurfaceCard>

        <div className="mt-16 max-w-2xl mx-auto space-y-4">
          <h2 className="text-lg font-semibold text-center text-text-primary">FAQ</h2>
          {FAQ.map(({ q, a }) => (
            <GlowSurfaceCard key={q} padding="sm">
              <details>
                <summary className="cursor-pointer font-medium text-sm text-text-primary">{q}</summary>
                <p className="mt-2 text-sm text-text-secondary">{a}</p>
              </details>
            </GlowSurfaceCard>
          ))}
        </div>
      </div>
    </div>
  );
}
