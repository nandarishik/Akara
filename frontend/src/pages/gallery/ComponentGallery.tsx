import { useState } from "react";
import { BarChart3 } from "lucide-react";

import { UsageBanner, PastDueBanner, TrialWarning } from "@/components/billing";
import { PlanGate } from "@/components/billing/PlanGate";
import { AkaraButton, SecondaryButton, GhostButton } from "@/components/ui/GradientButton";
import SurfaceCard from "@/components/ui/SurfaceCard";
import GlowKPICard, { KPIGrid } from "@/components/ui/GlowKPICard";
import EmptyState from "@/components/ui/EmptyState";
import { PageSkeleton } from "@/components/ui/ShimmerSkeleton";
import { Button } from "@/components/ui/button";
import { Badge, PlanBadge } from "@/components/ui/badge";
import { KPICard, PlanCard } from "@/components/ui/card";
import type { UsageResponse } from "@/lib/api/billing";

const DEMO_USAGE: UsageResponse = {
  plan: "free",
  plan_status: "active",
  copilot_calls_used: 42,
  copilot_calls_limit: 50,
  uploads_today: 1,
  uploads_per_day: 3,
  undos_today: 0,
  undos_per_day: 2,
  features: {
    morning_brief: true,
    scheme_leakage: false,
    simulator: false,
    reports: true,
    custom_language: false,
    secondary_sales: false,
    api_push: false,
    tally_connector: false,
    team_invites: false,
    api_keys: false,
    ask_copilot_debrief: false,
    alerts: false,
  },
  retention_days: 30,
  rows_used: 0,
  rows_limit: 10000,
  uploads_used: 0,
  uploads_limit: 100,
  users_used: 1,
  users_limit: 5,
};

export default function ComponentGallery() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-surface-bg p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-12">
        <header>
          <h1 className="text-display font-display">AKARA Design System</h1>
          <p className="mt-2 text-body">
            FireAI-inspired light product — pills, white cards, token colors.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-h2">AkaraButton (pill)</h2>
          <div className="flex flex-wrap gap-3 items-center">
            <AkaraButton>Primary</AkaraButton>
            <SecondaryButton>Secondary</SecondaryButton>
            <GhostButton>Ghost</GhostButton>
            <AkaraButton size="sm">Small</AkaraButton>
            <AkaraButton size="lg">Large</AkaraButton>
            <AkaraButton loading={loading} onClick={() => setLoading((v) => !v)}>
              Toggle loading
            </AkaraButton>
            <AkaraButton disabled>Disabled</AkaraButton>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-h2">shadcn Button (aligned)</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-h2">SurfaceCard</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <SurfaceCard>
              <p className="text-h2">Default card</p>
              <p className="text-body mt-2">White surface, soft border, shadow.</p>
            </SurfaceCard>
            <SurfaceCard accent="blue" hover>
              <p className="text-h2">Accent bar + hover</p>
              <p className="text-body mt-2">KPI-style left accent.</p>
            </SurfaceCard>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-h2">GlowKPICard</h2>
          <KPIGrid>
            <GlowKPICard
              title="Revenue"
              value={2847500}
              format={{ style: "currency", currency: "INR", maximumFractionDigits: 0 }}
              change={{ value: 125000, percentage: 12.5, period: "vs last month" }}
            />
            <GlowKPICard title="Orders" value={1240} staggerIndex={1} />
            <GlowKPICard title="Loading" value={0} loading staggerIndex={2} />
          </KPIGrid>
        </section>

        <section className="space-y-4">
          <h2 className="text-h2">Badges</h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="plan-free">Free</Badge>
            <Badge variant="plan-pro">Pro</Badge>
            <Badge variant="plan-business">Business</Badge>
            <PlanBadge plan="pro" />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-h2">Billing banners</h2>
          <div className="rounded-xl border border-surface-border overflow-hidden">
            <UsageBanner usage={DEMO_USAGE} />
            <PastDueBanner usage={{ ...DEMO_USAGE, plan_status: "past_due" }} />
            <TrialWarning usage={{ ...DEMO_USAGE, plan_status: "trialing" }} />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-h2">PlanGate</h2>
          <PlanGate feature="simulator" requiredPlan="pro" title="Simulator">
            <SurfaceCard className="h-32 flex items-center justify-center text-text-muted">
              Hidden feature content
            </SurfaceCard>
          </PlanGate>
        </section>

        <section className="space-y-4">
          <h2 className="text-h2">EmptyState</h2>
          <SurfaceCard padding="none">
            <EmptyState
              icon={<BarChart3 className="h-8 w-8" />}
              title="No data yet"
              description="Import your first file to get started."
              primaryAction={{ label: "Import data", href: "/data" }}
            />
          </SurfaceCard>
        </section>

        <section className="space-y-4">
          <h2 className="text-h2">Skeleton</h2>
          <PageSkeleton />
        </section>

        <section className="space-y-4">
          <h2 className="text-h2">Legacy KPICard / PlanCard</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <KPICard label="Revenue" value="₹12.4L" change="+8.2%" changeVariant="positive" />
            <PlanCard
              name="Pro"
              price="₹7,999"
              popular
              features={["500 copilot questions", "Simulator"]}
              cta={<AkaraButton size="sm">Choose Pro</AkaraButton>}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
