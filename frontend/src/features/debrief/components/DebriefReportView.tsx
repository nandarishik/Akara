import type { ReactNode } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Phone,
  Package,
  Wallet,
  ListChecks,
  IndianRupee,
  ShoppingCart,
  Target,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import AnimatedNumber from "@/shared/ui/AnimatedNumber";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import { WeekdayBarChart, ProductMoverBarChart } from "@/shared/charts/composed/akara/BarCharts";
import {
  DebriefMomentumProjectionChart,
  WeekdayPnLChart,
} from "@/shared/charts/composed/akara/LineCharts";
import { GlassIcon } from "@/shared/effects/GlassIcon";
import type { GlassIconColor } from "@/shared/effects/GlassIcons";
import { DEBRIEF_METRIC_GLASS } from "@/lib/glassIconMap";
import { cn } from "@/lib/utils";
import {
  enrichDebriefMetrics,
  formatInrDisplay,
  impactFromItem,
  sanitizeDebriefNarrative,
} from "@/features/debrief/lib/debriefMetrics";

export type DebriefItem = {
  title: string;
  detail: string;
  impact_inr?: number;
  hypothesis?: string;
  urgency?: string;
};

export type DebriefMetadata = {
  headline: string;
  week_start: string;
  week_end: string;
  limited_mode: boolean;
  went_right: DebriefItem[];
  went_wrong: DebriefItem[];
  actions: DebriefItem[];
  momentum: {
    this_week_revenue_fmt?: string;
    this_week_revenue?: number;
    prior_week_revenue?: number;
    prior_week_revenue_fmt?: string;
    wow_change_pct: number;
    wow_direction?: string;
    projected_month_fmt?: string;
    projected_month?: number;
    trend_30d?: string;
    trend_60d?: string;
    trend_90d?: string;
    projection_note?: string;
  };
  insights?: {
    week_metrics?: {
      revenue: number;
      prior_revenue: number;
      orders: number;
      prior_orders: number;
      parties: number;
      prior_parties: number;
    };
    weekday_pulse?: {
      day: string;
      weekday: string;
      revenue: number;
      trailing_avg: number;
    }[];
    product_movers?: {
      name: string;
      change_inr: number;
      change_pct: number;
      direction: "up" | "down";
    }[];
    churn_watch?: { party: string; zone?: string }[];
    win_back?: { party: string; zone?: string }[];
    outstanding?: { party: string; amount: number; amount_fmt: string }[];
    next_hook?: string;
    next_drop?: string;
  };
  days_of_data: number;
  data_freshness?: string;
};

function TrendChip({ label, trend }: { label: string; trend?: string }) {
  const t = trend ?? "flat";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
        t === "up" && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
        t === "down" && "bg-red-50 text-red-700 ring-1 ring-red-100",
        t === "flat" && "bg-surface-raised text-text-secondary"
      )}
    >
      <span className="text-text-muted">{label}</span>
      {t === "up" ? (
        <TrendingUp className="h-3.5 w-3.5" />
      ) : t === "down" ? (
        <TrendingDown className="h-3.5 w-3.5" />
      ) : (
        <Minus className="h-3.5 w-3.5" />
      )}
    </span>
  );
}

function KpiTile({
  label,
  value,
  sub,
  icon,
  glassColor = "blue",
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  glassColor?: GlassIconColor;
  tone?: "up" | "down" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 bg-[#0a0a0a]/40 backdrop-blur-sm",
        tone === "up" && "border-emerald-500/30",
        tone === "down" && "border-red-500/30",
        tone === "neutral" && "border-white/10"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
          {label}
        </span>
        <GlassIcon
          decorative
          size="md"
          color={glassColor}
          icon={<span className="glass-icon-slot-inner text-white">{icon}</span>}
          label={label}
        />
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums leading-none">
        {value}
      </p>
      {sub && <div className="mt-2 text-xs text-white/60">{sub}</div>}
    </div>
  );
}

function WeekComparePanel({
  label,
  current,
  prior,
  formatValue,
}: {
  label: string;
  current: number;
  prior: number;
  formatValue: (n: number) => string;
}) {
  const max = Math.max(current, prior, 1);
  const delta = prior ? Math.round(((current - prior) / prior) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text-primary">{label}</span>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-xs font-bold tabular-nums rounded-full px-2 py-0.5",
            delta > 0 && "bg-emerald-50 text-emerald-700",
            delta < 0 && "bg-red-50 text-red-700",
            delta === 0 && "bg-surface-raised text-text-muted"
          )}
        >
          {delta > 0 ? <ArrowUp className="h-3 w-3" /> : delta < 0 ? <ArrowDown className="h-3 w-3" /> : null}
          {delta > 0 ? "+" : ""}
          {delta}%
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-text-muted mb-1.5">This week</p>
          <div className="h-2.5 rounded-full bg-surface-raised overflow-hidden mb-1.5">
            <div
              className="h-full rounded-full bg-accent transition-all duration-700"
              style={{ width: `${(current / max) * 100}%` }}
            />
          </div>
          <p className="text-sm font-bold tabular-nums">{formatValue(current)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-text-muted mb-1.5">Last week</p>
          <div className="h-2.5 rounded-full bg-surface-raised overflow-hidden mb-1.5">
            <div
              className="h-full rounded-full bg-slate-300 transition-all duration-700"
              style={{ width: `${(prior / max) * 100}%` }}
            />
          </div>
          <p className="text-sm font-semibold text-text-secondary tabular-nums">
            {formatValue(prior)}
          </p>
        </div>
      </div>
    </div>
  );
}

function InsightCard({
  item,
  variant,
  index,
  maxImpact,
}: {
  item: DebriefItem;
  variant: "positive" | "negative";
  index: number;
  maxImpact: number;
}) {
  const impact = impactFromItem(item.detail, item.impact_inr);
  const barPct = maxImpact > 0 && impact ? Math.min(100, (impact / maxImpact) * 100) : 0;

  return (
    <div
      className={cn(
        "group relative rounded-xl border p-4 transition-shadow hover:shadow-md",
        variant === "positive"
          ? "border-emerald-500/20 bg-gradient-to-br from-emerald-950/50 to-[#111111]"
          : "border-red-500/20 bg-gradient-to-br from-red-950/40 to-[#111111]"
      )}
    >
      <div className="flex gap-3">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            variant === "positive"
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-red-500/20 text-red-300"
          )}
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between gap-2 items-start">
            <p className="font-semibold text-sm text-text-primary leading-snug">{item.title}</p>
            {impact > 0 && (
              <span
                className={cn(
                  "text-xs font-bold tabular-nums shrink-0",
                  variant === "positive" ? "text-emerald-400" : "text-red-400"
                )}
              >
                {formatInrDisplay(impact)}
              </span>
            )}
          </div>
          {impact > 0 && (
            <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  variant === "positive" ? "bg-emerald-500" : "bg-red-400"
                )}
                style={{ width: `${barPct}%` }}
              />
            </div>
          )}
          <p className="text-sm text-text-secondary mt-2 leading-relaxed">{item.detail}</p>
        </div>
      </div>
    </div>
  );
}

const URGENCY_STYLE: Record<string, { border: string; badge: string; num: string }> = {
  high: {
    border: "border-l-red-500",
    badge: "bg-red-100 text-red-800",
    num: "bg-red-500 text-white",
  },
  medium: {
    border: "border-l-amber-500",
    badge: "bg-amber-100 text-amber-900",
    num: "bg-amber-500 text-white",
  },
  low: {
    border: "border-l-slate-400",
    badge: "bg-surface-raised text-text-secondary",
    num: "bg-slate-400 text-white",
  },
};

export function DebriefReportView({
  meta,
  headerActions,
}: {
  meta: DebriefMetadata;
  headerActions?: ReactNode;
}) {
  const safeMeta = sanitizeDebriefNarrative(meta);
  const metrics = enrichDebriefMetrics(safeMeta);
  const { wowPct, wowUp, wowDown } = metrics;

  const monthFmt =
    safeMeta.momentum?.projected_month_fmt ??
    (safeMeta.momentum?.projected_month != null
      ? formatInrDisplay(safeMeta.momentum.projected_month)
      : null);

  const weekdayPulse = safeMeta.insights?.weekday_pulse ?? [];
  const movers = safeMeta.insights?.product_movers ?? [];
  const churn = safeMeta.insights?.churn_watch ?? [];
  const winback = safeMeta.insights?.win_back ?? [];
  const outstanding = safeMeta.insights?.outstanding ?? [];
  const parties = safeMeta.insights?.week_metrics;

  const maxPositiveImpact = Math.max(
    0,
    ...safeMeta.went_right.map((i) => impactFromItem(i.detail, i.impact_inr))
  );
  const maxNegativeImpact = Math.max(
    0,
    ...safeMeta.went_wrong.map((i) => impactFromItem(i.detail, i.impact_inr))
  );

  const moverChartData = movers.slice(0, 5);

  const projectedMonth = safeMeta.momentum?.projected_month ?? 0;
  const priorRevenue = parties?.prior_revenue ?? metrics.priorWeekRevenue;
  const thisRevenue = parties?.revenue ?? metrics.thisWeekRevenue;
  const showMomentumCharts =
    projectedMonth > 0 && (priorRevenue > 0 || thisRevenue > 0);

  const revenueDisplay =
    metrics.thisWeekRevenue > 0 ? (
      <AnimatedNumber value={metrics.thisWeekRevenue} formatter={formatInrDisplay} />
    ) : metrics.thisWeekRevenueDisplay ? (
      metrics.thisWeekRevenueDisplay
    ) : metrics.revenueKnown || safeMeta.momentum?.this_week_revenue === 0 ? (
      formatInrDisplay(metrics.thisWeekRevenue)
    ) : (
      "â€”"
    );

  const ordersDisplay =
    metrics.orders > 0
      ? metrics.orders.toLocaleString("en-IN")
      : metrics.ordersKnown
        ? "0"
        : "â€”";

  const showWeekSnapshot =
    metrics.hasRevenueCompare || metrics.hasOrdersCompare || weekdayPulse.length > 0;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-surface-border shadow-card">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-[#111111] to-[#0a0a0a] pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
                Weekly debrief
              </p>
              <p className="text-sm text-text-muted mt-1.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {safeMeta.week_start} â€“ {safeMeta.week_end}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
          </div>

          <h2 className="text-xl sm:text-2xl lg:text-[1.65rem] font-bold text-text-primary mt-4 leading-snug max-w-3xl">
            {safeMeta.headline}
          </h2>

          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiTile
              label="This week"
              value={revenueDisplay}
              sub={
                metrics.priorWeekRevenue > 0
                  ? `vs ${formatInrDisplay(metrics.priorWeekRevenue)} last week`
                  : undefined
              }
              icon={<IndianRupee className="h-4 w-4" />}
              glassColor={DEBRIEF_METRIC_GLASS.revenue}
              tone={wowUp ? "up" : wowDown ? "down" : "neutral"}
            />
            <KpiTile
              label="Week on week"
              value={
                <span className={cn(wowUp && "text-emerald-400", wowDown && "text-red-400")}>
                  {wowUp ? "+" : ""}
                  {wowPct}%
                </span>
              }
              sub={wowDown ? "Revenue slipped" : wowUp ? "Revenue grew" : "Flat vs last week"}
              icon={
                wowUp ? (
                  <TrendingUp className="h-4 w-4" />
                ) : wowDown ? (
                  <TrendingDown className="h-4 w-4" />
                ) : (
                  <Minus className="h-4 w-4" />
                )
              }
              glassColor={DEBRIEF_METRIC_GLASS.wow}
              tone={wowUp ? "up" : wowDown ? "down" : "neutral"}
            />
            <KpiTile
              label="Orders"
              value={ordersDisplay}
              sub={
                metrics.hasOrdersCompare
                  ? `vs ${metrics.priorOrders} last week`
                  : undefined
              }
              icon={<ShoppingCart className="h-4 w-4" />}
              glassColor={DEBRIEF_METRIC_GLASS.orders}
              tone={
                metrics.hasOrdersCompare && metrics.orders >= metrics.priorOrders
                  ? "up"
                  : metrics.hasOrdersCompare
                    ? "down"
                    : "neutral"
              }
            />
            <KpiTile
              label="Month pace"
              value={monthFmt ?? "â€”"}
              sub={safeMeta.momentum?.projection_note ?? "At this week's run-rate"}
              icon={<Target className="h-4 w-4" />}
              glassColor={DEBRIEF_METRIC_GLASS.month}
            />
          </div>

          <div className="mt-5 pt-4 border-t border-surface-border/80 flex flex-wrap gap-2">
            <TrendChip label="30d" trend={safeMeta.momentum?.trend_30d} />
            <TrendChip label="60d" trend={safeMeta.momentum?.trend_60d} />
            <TrendChip label="90d" trend={safeMeta.momentum?.trend_90d} />
          </div>

          {(showMomentumCharts || weekdayPulse.length > 0) && (
            <div className="mt-5 grid gap-4 border-t border-surface-border/80 pt-5 lg:grid-cols-2">
              {showMomentumCharts ? (
                <div className="h-[220px]">
                  <h4 className="mb-2 text-xs font-semibold text-text-secondary">Month projection</h4>
                  <DebriefMomentumProjectionChart
                    priorRevenue={priorRevenue}
                    thisRevenue={thisRevenue}
                    projectedMonth={projectedMonth}
                    aspectRatio={null}
                    className="h-full w-full"
                  />
                </div>
              ) : null}
              {weekdayPulse.length > 0 ? (
                <div className="h-[220px]">
                  <h4 className="mb-2 text-xs font-semibold text-text-secondary">Daily variance</h4>
                  <WeekdayPnLChart pulse={weekdayPulse} aspectRatio={null} className="h-full w-full" />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Week snapshot â€” always when we can derive or have chart data */}
      {showWeekSnapshot && (
        <div className="grid lg:grid-cols-2 gap-4">
          {(metrics.hasRevenueCompare || metrics.hasOrdersCompare) && (
            <GlowSurfaceCard padding="md" hover={false}>
              <h3 className="text-sm font-semibold text-text-primary mb-5">Week vs week</h3>
              <div className="space-y-6">
                {metrics.hasRevenueCompare && (
                  <WeekComparePanel
                    label="Revenue"
                    current={metrics.thisWeekRevenue}
                    prior={metrics.priorWeekRevenue}
                    formatValue={formatInrDisplay}
                  />
                )}
                {metrics.hasOrdersCompare && (
                  <WeekComparePanel
                    label="Orders"
                    current={metrics.orders}
                    prior={metrics.priorOrders}
                    formatValue={(n) => n.toLocaleString("en-IN")}
                  />
                )}
                {parties && (parties.parties > 0 || parties.prior_parties > 0) && (
                  <WeekComparePanel
                    label="Active parties"
                    current={parties.parties}
                    prior={parties.prior_parties}
                    formatValue={(n) => n.toLocaleString("en-IN")}
                  />
                )}
              </div>
            </GlowSurfaceCard>
          )}

          {weekdayPulse.length > 0 ? (
            <GlowSurfaceCard padding="md" hover={false} className="overflow-hidden">
              <h3 className="text-sm font-semibold text-text-primary">Daily pulse</h3>
              <p className="text-xs text-text-muted mt-1 mb-4">
                Green = beat your usual weekday
              </p>
              <div className="h-[200px] overflow-hidden">
                <WeekdayBarChart pulse={weekdayPulse} className="h-full w-full" aspectRatio={null} />
              </div>
            </GlowSurfaceCard>
          ) : metrics.hasRevenueCompare ? (
            <GlowSurfaceCard padding="md" hover={false} className="flex flex-col justify-center">
              <h3 className="text-sm font-semibold text-text-primary mb-4">Revenue shift</h3>
              <div className="flex items-end justify-center gap-6 h-40 px-4">
                <div className="flex flex-col items-center gap-2 flex-1 max-w-[120px]">
                  <div
                    className="w-full rounded-t-lg bg-accent transition-all duration-700"
                    style={{
                      height: `${Math.max(24, (metrics.thisWeekRevenue / Math.max(metrics.priorWeekRevenue, metrics.thisWeekRevenue)) * 120)}px`,
                    }}
                  />
                  <span className="text-xs font-medium text-text-muted">This wk</span>
                  <span className="text-sm font-bold tabular-nums">
                    {formatInrDisplay(metrics.thisWeekRevenue)}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-2 flex-1 max-w-[120px]">
                  <div
                    className="w-full rounded-t-lg bg-slate-300 transition-all duration-700"
                    style={{
                      height: `${Math.max(24, (metrics.priorWeekRevenue / Math.max(metrics.priorWeekRevenue, metrics.thisWeekRevenue)) * 120)}px`,
                    }}
                  />
                  <span className="text-xs font-medium text-text-muted">Last wk</span>
                  <span className="text-sm font-semibold text-text-secondary tabular-nums">
                    {formatInrDisplay(metrics.priorWeekRevenue)}
                  </span>
                </div>
              </div>
            </GlowSurfaceCard>
          ) : null}
        </div>
      )}

      {moverChartData.length >= 1 && (
        <GlowSurfaceCard padding="md" hover={false}>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-accent" />
            Product shifts
          </h3>
          <div className="h-[200px] overflow-hidden">
            <ProductMoverBarChart movers={moverChartData} className="h-full w-full" aspectRatio={null} />
          </div>
        </GlowSurfaceCard>
      )}

      {(churn.length > 0 || winback.length > 0) && (
        <GlowSurfaceCard padding="md" hover={false}>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Customer signals</h3>
          <div className="flex flex-wrap gap-2">
            {churn.map((c) => (
              <span
                key={c.party}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-50 text-red-800 px-3 py-1.5 text-xs font-medium ring-1 ring-red-100"
              >
                <Phone className="h-3 w-3" />
                {c.party} Â· quiet
              </span>
            ))}
            {winback.map((c) => (
              <span
                key={c.party}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-800 px-3 py-1.5 text-xs font-medium ring-1 ring-emerald-100"
              >
                <TrendingUp className="h-3 w-3" />
                {c.party} Â· returned
              </span>
            ))}
          </div>
        </GlowSurfaceCard>
      )}

      {/* Narrative */}
      <div className="grid md:grid-cols-2 gap-4">
        <GlowSurfaceCard padding="md" accent="green" hover={false}>
          <h3 className="text-sm font-semibold text-emerald-400 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Went right
            <span className="ml-auto text-xs font-normal bg-emerald-100 text-emerald-800 rounded-full px-2 py-0.5">
              {safeMeta.went_right.length}
            </span>
          </h3>
          <div className="space-y-3">
            {safeMeta.went_right?.map((item, i) => (
              <InsightCard
                key={i}
                item={item}
                variant="positive"
                index={i}
                maxImpact={maxPositiveImpact}
              />
            ))}
          </div>
        </GlowSurfaceCard>

        <GlowSurfaceCard padding="md" accent="red" hover={false}>
          <h3 className="text-sm font-semibold text-red-400 mb-4 flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Went wrong
            <span className="ml-auto text-xs font-normal bg-red-100 text-red-800 rounded-full px-2 py-0.5">
              {safeMeta.went_wrong.length}
            </span>
          </h3>
          <div className="space-y-3">
            {safeMeta.went_wrong?.map((item, i) => (
              <InsightCard
                key={i}
                item={item}
                variant="negative"
                index={i}
                maxImpact={maxNegativeImpact}
              />
            ))}
          </div>
        </GlowSurfaceCard>
      </div>

      {safeMeta.actions?.length > 0 && (
        <GlowSurfaceCard padding="md" accent="blue" hover={false}>
          <h3 className="text-sm font-semibold text-text-primary mb-5 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-accent" />
            Do these three this week
          </h3>
          <div className="grid sm:grid-cols-3 gap-3">
            {safeMeta.actions.map((action, i) => {
              const style = URGENCY_STYLE[action.urgency ?? "medium"] ?? URGENCY_STYLE.medium;
              return (
                <div
                  key={i}
                  className={cn(
                    "relative rounded-xl border border-white/10 border-l-4 bg-white/5 p-4",
                    style.border
                  )}
                >
                  <span
                    className={cn(
                      "absolute -top-2 -left-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow-sm",
                      style.num
                    )}
                  >
                    {i + 1}
                  </span>
                  <p className="font-semibold text-sm text-text-primary pt-1">{action.title}</p>
                  <p className="text-xs text-text-secondary mt-2 leading-relaxed">{action.detail}</p>
                  {action.urgency && (
                    <span
                      className={cn(
                        "inline-block mt-3 text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5",
                        style.badge
                      )}
                    >
                      {action.urgency}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </GlowSurfaceCard>
      )}

      {outstanding.length > 0 && (
        <GlowSurfaceCard padding="md" hover={false}>
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-amber-600" />
            Outstanding to collect
          </h3>
          <ul className="divide-y divide-surface-border">
            {outstanding.map((o) => (
              <li key={o.party} className="flex justify-between py-2.5 text-sm">
                <span className="font-medium text-text-primary">{o.party}</span>
                <span className="font-semibold tabular-nums text-amber-800">{o.amount_fmt}</span>
              </li>
            ))}
          </ul>
        </GlowSurfaceCard>
      )}

      {safeMeta.insights?.next_hook && (
        <div className="rounded-xl border border-accent/25 bg-gradient-to-r from-accent/10 to-[#111111] px-5 py-4">
          <p className="text-sm text-white/80 leading-relaxed font-medium">
            {safeMeta.insights.next_hook}
          </p>
        </div>
      )}
    </div>
  );
}
