import { useState } from "react";
import { BarChart3, MessageSquare, Bell } from "lucide-react";

import { UsageBanner, PastDueBanner, TrialWarning } from "@/features/billing/components";
import { PlanGate } from "@/features/billing/components/PlanGate";
import { AkaraButton, SecondaryButton, GhostButton } from "@/shared/ui/GradientButton";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import GlowKPICard, { KPIGrid } from "@/shared/ui/GlowKPICard";
import EmptyState from "@/shared/ui/EmptyState";
import { PageSkeleton } from "@/shared/ui/ShimmerSkeleton";
import { Button } from "@/shared/ui/button";
import { Badge, PlanBadge } from "@/shared/ui/badge";
import { KPICard, PlanCard } from "@/shared/ui/card";
import GlassIcons from "@/shared/effects/GlassIcons";
import { GlassIcon } from "@/shared/effects/GlassIcon";
import BorderGlow from "@/shared/effects/BorderGlow";
import DarkMeshBackground from "@/shared/effects/DarkMeshBackground";
import DecryptedText from "@/shared/effects/DecryptedText";
import SpecularButton from "@/shared/effects/SpecularButton";
import GlowCTAButton from "@/shared/ui/GlowCTAButton";
import ReflectiveCard from "@/shared/effects/ReflectiveCard";
import PlanReflectiveCard, { PLAN_REFLECTIVE_META } from "@/shared/effects/PlanReflectiveCard";
import DashboardPreviewBento from "@/features/landing/components/DashboardPreviewBento";
import PrismLazy from "@/shared/effects/PrismLazy";
import CopilotStrandsLoader from "@/features/copilot/components/CopilotStrandsLoader";
import AITextLoading from "@/features/copilot/components/AITextLoading";
import Loader from "@/shared/ui/Loader";
import ProfileDropdown from "@/shared/layout/ProfileDropdown";
import AvatarPicker from "@/features/settings/components/AvatarPicker";
import TeamSeatVisualizer, { buildSeatSlots } from "@/features/team/components/TeamSeatVisualizer";
import { RevenueAreaChart } from "@/shared/charts/composed/akara/RevenueAreaChart";
import { ZoneBarChart } from "@/shared/charts/composed/akara/ZoneBarChart";
import { WeekdayBarChart, ProductMoverBarChart } from "@/shared/charts/composed/akara/BarCharts";
import { QuotaRingChart } from "@/shared/charts/composed/akara/QuotaRingChart";
import { PlanHealthGauge, ConfidenceGauge } from "@/shared/charts/composed/akara/GaugeCharts";
import { LeakageFunnelChart } from "@/shared/charts/composed/akara/LeakageFunnelChart";
import { ZoneRadarChart } from "@/shared/charts/composed/akara/ZoneRadarChart";
import { SalesHeatmapChart } from "@/shared/charts/composed/akara/SalesHeatmapChart";
import {
  MomentumProjectionChart,
  WeekdayPnLChart,
} from "@/shared/charts/composed/akara/LineCharts";
import {
  fixtureAreaSeries,
  fixtureBarRows,
  fixtureFunnel,
  fixtureHeatmapRows,
  fixtureUsage,
  fixtureZones,
  fixtureWeekdayPulse,
  fixtureMovers,
} from "@/lib/charts/fixtures";
import Folder from "@/shared/effects/Folder";
import LineSidebar from "@/shared/effects/LineSidebar";
import { LINE_SIDEBAR_AKARA } from "@/shared/effects/presets";
import { BORDER_GLOW_DEFAULTS } from "@/shared/effects/presets";
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
  debrief_count_used: 0,
  debrief_lifetime_limit: 1,
};

export default function ComponentGallery() {
  const [loading, setLoading] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState("Alex");

  const demoTeamSlots = buildSeatSlots(
    [
      { id: "1", email: "a@co.com", display_name: "Alex", membership_status: "active" },
      { id: "2", email: "b@co.com", display_name: "Blair", membership_status: "active" },
    ],
    [{ id: "inv-1", email_normalized: "pending@co.com" }],
    5
  );

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
          <h2 className="text-h2">GlassIcons + BorderGlow (React Bits)</h2>
          <GlassIcons
            className="icon-btns--compact max-w-2xl"
            columns={3}
            items={[
              { icon: <BarChart3 className="h-6 w-6 text-white" />, color: "blue", label: "Dashboard" },
              { icon: <MessageSquare className="h-6 w-6 text-white" />, color: "purple", label: "Copilot" },
              { icon: <Bell className="h-6 w-6 text-white" />, color: "red", label: "Alerts" },
            ]}
          />
          <div className="flex flex-wrap gap-6 items-end">
            <GlassIcon size="sm" color="blue" icon={<BarChart3 className="h-3.5 w-3.5" />} label="Small nav" />
            <GlassIcon size="md" color="green" icon={<BarChart3 className="h-4 w-4" />} label="KPI md" />
            <GlassIcon size="lg" color="purple" icon={<BarChart3 className="h-6 w-6" />} label="Empty lg" />
          </div>
          <BorderGlow {...BORDER_GLOW_DEFAULTS} borderRadius={16} className="max-w-md">
            <div className="p-6 text-white/90">
              <p className="font-semibold">BorderGlow card</p>
              <p className="text-sm text-white/60 mt-1">Hover near edges for mesh glow (spec defaults).</p>
            </div>
          </BorderGlow>
        </section>

        <section className="space-y-4">
          <h2 className="text-h2">Landing effects (React Bits)</h2>
          <div className="relative h-48 rounded-xl overflow-hidden border border-surface-border">
            <DarkMeshBackground />
            <div className="relative z-10 p-6 text-white">
              <DecryptedText
                text="Know your business"
                animateOn="view"
                sequential
                revealDirection="center"
                className="text-white font-bold text-xl"
                encryptedClassName="text-white/30"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <GlowCTAButton size="sm">Glow CTA</GlowCTAButton>
            <SpecularButton size="md" onClick={() => undefined}>Specular only</SpecularButton>
          </div>
          <div className="relative min-h-[420px] flex items-center justify-center rounded-xl border border-surface-border overflow-hidden bg-[#0a0a0a]">
            <PrismLazy
              className="absolute inset-0 opacity-40 pointer-events-none"
              animationType="rotate"
              timeScale={0.35}
              suspendWhenOffscreen
            />
            <ReflectiveCard className="relative z-10" />
          </div>
          <div className="space-y-3">
            <p className="text-body text-text-secondary">PlanReflectiveCard (pricing tier)</p>
            <BorderGlow {...BORDER_GLOW_DEFAULTS} borderRadius={20} glowRadius={28} animated className="max-w-sm overflow-visible">
              <div className="p-2">
                <PlanReflectiveCard
                  plan={{
                    name: "Pro",
                    price: "₹7,999",
                    period: "/month",
                    cta: "Upgrade to Pro →",
                    popular: true,
                    features: ["Unlimited copilot", "Morning brief", "Scheme leakage"],
                    badgeText: PLAN_REFLECTIVE_META.Pro.badgeText,
                    planId: PLAN_REFLECTIVE_META.Pro.planId,
                    ctaLink: PLAN_REFLECTIVE_META.Pro.ctaLink,
                  }}
                />
              </div>
            </BorderGlow>
          </div>
          <div className="space-y-3">
            <p className="text-body text-text-secondary">Dashboard preview (MagicBento)</p>
            <div className="rounded-xl border border-surface-border bg-[#0a0a0a] p-4 min-h-[420px] overflow-hidden">
              <DashboardPreviewBento />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-body text-text-secondary">LineSidebar (product nav)</p>
            <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 max-w-xs">
              <LineSidebar
                {...LINE_SIDEBAR_AKARA}
                items={["Dashboard", "Copilot", "Data", "Reports", "Debrief"]}
                defaultActive={1}
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <p className="text-body text-text-secondary">Copilot Strands loader</p>
              <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 flex items-center justify-center min-h-[140px]">
                <CopilotStrandsLoader variant="hero" />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-body text-text-secondary">Folder empty state</p>
              <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 flex items-center justify-center min-h-[140px]">
                <Folder color="#03B3C3" size={1.5} />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-h2">GlowSurfaceCard</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <GlowSurfaceCard>
              <p className="text-h2">Default card</p>
              <p className="text-body mt-2">White surface, soft border, shadow.</p>
            </GlowSurfaceCard>
            <GlowSurfaceCard accent="blue" hover>
              <p className="text-h2">Accent bar + hover</p>
              <p className="text-body mt-2">KPI-style left accent.</p>
            </GlowSurfaceCard>
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
            <GlowSurfaceCard className="h-32 flex items-center justify-center text-text-muted">
              Hidden feature content
            </GlowSurfaceCard>
          </PlanGate>
        </section>

        <section className="space-y-4">
          <h2 className="text-h2">EmptyState</h2>
          <GlowSurfaceCard padding="none">
            <EmptyState
              icon={<BarChart3 className="h-8 w-8" />}
              title="No data yet"
              description="Import your first file to get started."
              primaryAction={{ label: "Import data", href: "/data" }}
            />
          </GlowSurfaceCard>
        </section>

        <section className="space-y-4">
          <h2 className="text-h2">Skeleton</h2>
          <PageSkeleton />
        </section>

        <section className="space-y-4">
          <h2 className="text-h2">Premium UI (matte black)</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6">
              <p className="text-sm text-white/60 mb-4">AITextLoading</p>
              <AITextLoading compact />
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 flex justify-center">
              <Loader size="sm" title="Loading…" subtitle="" />
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 max-w-xs">
              <ProfileDropdown
                data={{
                  name: "Demo User",
                  email: "demo@akara.ai",
                  avatarUrl: `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${avatarSeed}`,
                  subscription: "PRO",
                }}
                onSignOut={() => undefined}
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6">
              <AvatarPicker value={avatarSeed} onChange={setAvatarSeed} />
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 md:col-span-2 flex justify-center">
              <TeamSeatVisualizer slots={demoTeamSlots} occupied={3} seatLimit={5} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-h2">Analytics charts (Bklit)</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <GlowSurfaceCard padding="md">
              <h3 className="text-sm font-medium mb-3">Area — revenue trend</h3>
              <div className="h-[220px]">
                <RevenueAreaChart data={fixtureAreaSeries} />
              </div>
            </GlowSurfaceCard>
            <GlowSurfaceCard padding="md">
              <h3 className="text-sm font-medium mb-3">Bar — zones</h3>
              <div className="h-[220px]">
                <ZoneBarChart data={fixtureBarRows} />
              </div>
            </GlowSurfaceCard>
            <GlowSurfaceCard padding="md">
              <h3 className="text-sm font-medium mb-3">Funnel — scheme leakage</h3>
              <div className="h-[240px]">
                <LeakageFunnelChart stages={fixtureFunnel} />
              </div>
            </GlowSurfaceCard>
            <GlowSurfaceCard padding="md">
              <h3 className="text-sm font-medium mb-3">Radar — zone comparison</h3>
              <div className="h-[280px]">
                <ZoneRadarChart zones={fixtureZones} />
              </div>
            </GlowSurfaceCard>
            <GlowSurfaceCard padding="md">
              <h3 className="text-sm font-medium mb-3">Ring + gauge — billing</h3>
              <div className="grid gap-4 sm:grid-cols-2 h-[260px]">
                <QuotaRingChart usage={fixtureUsage} />
                <PlanHealthGauge usage={fixtureUsage} />
              </div>
            </GlowSurfaceCard>
            <GlowSurfaceCard padding="md">
              <h3 className="text-sm font-medium mb-3">Heatmap — product × zone</h3>
              <div className="h-[240px]">
                <SalesHeatmapChart rows={fixtureHeatmapRows} />
              </div>
            </GlowSurfaceCard>
            <GlowSurfaceCard padding="md">
              <h3 className="text-sm font-medium mb-3">Projection + P/L</h3>
              <div className="space-y-4">
                <div className="h-[180px]">
                  <MomentumProjectionChart
                    actual={[
                      { date: new Date(Date.now() - 7 * 86400000), revenue: 280000 },
                      { date: new Date(), revenue: 320000 },
                    ]}
                    endValue={1400000}
                  />
                </div>
                <div className="h-[140px]">
                  <WeekdayPnLChart pulse={fixtureWeekdayPulse} />
                </div>
              </div>
            </GlowSurfaceCard>
            <GlowSurfaceCard padding="md">
              <h3 className="text-sm font-medium mb-3">Bar — weekday + movers</h3>
              <div className="space-y-4">
                <WeekdayBarChart pulse={fixtureWeekdayPulse} className="h-[120px]" />
                <ProductMoverBarChart movers={fixtureMovers} className="h-[120px]" />
              </div>
            </GlowSurfaceCard>
            <GlowSurfaceCard padding="md" className="lg:col-span-2">
              <h3 className="text-sm font-medium mb-3">Simulator confidence gauge</h3>
              <ConfidenceGauge score={78} />
            </GlowSurfaceCard>
          </div>
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
