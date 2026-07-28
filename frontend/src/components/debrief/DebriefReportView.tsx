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
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import AnimatedNumber from "@/components/ui/AnimatedNumber";
import SurfaceCard from "@/components/ui/SurfaceCard";
import { cn } from "@/lib/utils";
import { formatINRCompact } from "@/lib/format";

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

function formatInr(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function resolveWeekMetrics(meta: DebriefMetadata) {
  if (meta.insights?.week_metrics) return meta.insights.week_metrics;
  const m = meta.momentum;
  if (m?.this_week_revenue != null && m?.prior_week_revenue != null) {
    return {
      revenue: m.this_week_revenue,
      prior_revenue: m.prior_week_revenue,
      orders: 0,
      prior_orders: 0,
      parties: 0,
      prior_parties: 0,
    };
  }
  return null;
}

function TrendChip({ label, trend }: { label: string; trend?: string }) {
  const t = trend ?? "flat";
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-2.5 py-1 text-xs text-text-secondary">
      <span className="text-text-muted">{label}</span>
      {t === "up" ? (
        <TrendingUp className="h-3 w-3 text-emerald-600" />
      ) : t === "down" ? (
        <TrendingDown className="h-3 w-3 text-red-500" />
      ) : (
        <Minus className="h-3 w-3 text-text-muted" />
      )}
    </span>
  );
}

/** Side-by-side revenue bars — only when both weeks have data */
function RevenueWeekCompare({ current, prior }: { current: number; prior: number }) {
  const max = Math.max(current, prior, 1);
  return (
    <div className="grid grid-cols-2 gap-4 mt-6">
      <div>
        <p className="text-xs text-text-muted mb-2">This week</p>
        <div className="h-3 rounded-full bg-surface-raised overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-700"
            style={{ width: `${(current / max) * 100}%` }}
          />
        </div>
        <p className="text-lg font-bold mt-2 tabular-nums">{formatInr(current)}</p>
      </div>
      <div>
        <p className="text-xs text-text-muted mb-2">Last week</p>
        <div className="h-3 rounded-full bg-surface-raised overflow-hidden">
          <div
            className="h-full rounded-full bg-slate-300 transition-all duration-700"
            style={{ width: `${(prior / max) * 100}%` }}
          />
        </div>
        <p className="text-lg font-semibold text-text-secondary mt-2 tabular-nums">
          {formatInr(prior)}
        </p>
      </div>
    </div>
  );
}

function MetricCompare({
  label,
  current,
  prior,
  formatValue = (n: number) => n.toLocaleString("en-IN"),
}: {
  label: string;
  current: number;
  prior: number;
  formatValue?: (n: number) => string;
}) {
  if (current === 0 && prior === 0) return null;
  const max = Math.max(current, prior, 1);
  const delta = prior ? Math.round(((current - prior) / prior) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline gap-2">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-text-muted"
          )}
        >
          {delta > 0 ? "+" : ""}
          {delta}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-surface-raised overflow-hidden">
          <div
            className="h-full bg-accent rounded-full"
            style={{ width: `${(current / max) * 100}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-text-secondary w-16 text-right">
          {formatValue(current)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-surface-raised overflow-hidden">
          <div
            className="h-full bg-slate-300 rounded-full"
            style={{ width: `${(prior / max) * 100}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-text-muted w-16 text-right">
          {formatValue(prior)}
        </span>
      </div>
    </div>
  );
}

function InsightRow({
  item,
  variant,
  maxImpact,
}: {
  item: DebriefItem;
  variant: "positive" | "negative";
  maxImpact: number;
}) {
  const impact = item.impact_inr ?? 0;
  const barPct = maxImpact > 0 && impact ? Math.min(100, (impact / maxImpact) * 100) : 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        variant === "positive"
          ? "border-emerald-100 bg-emerald-50/30"
          : "border-red-100 bg-red-50/30"
      )}
    >
      <div className="flex justify-between gap-3 items-start">
        <p className="font-semibold text-sm text-text-primary leading-snug">{item.title}</p>
        {impact > 0 && (
          <span
            className={cn(
              "text-xs font-bold tabular-nums shrink-0",
              variant === "positive" ? "text-emerald-700" : "text-red-700"
            )}
          >
            {formatInr(impact)}
          </span>
        )}
      </div>
      {impact > 0 && (
        <div className="mt-2 h-1 rounded-full bg-white/80 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              variant === "positive" ? "bg-emerald-500" : "bg-red-400"
            )}
            style={{ width: `${barPct}%` }}
          />
        </div>
      )}
      <p className="text-sm text-text-secondary mt-2 leading-relaxed line-clamp-3">{item.detail}</p>
      {item.hypothesis && (
        <p className="text-xs text-text-muted mt-2 border-l-2 border-surface-border pl-2">
          {item.hypothesis}
        </p>
      )}
    </div>
  );
}

const URGENCY_BORDER: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-slate-300",
};

export function DebriefReportView({
  meta,
  headerActions,
}: {
  meta: DebriefMetadata;
  headerActions?: ReactNode;
}) {
  const wow = meta.momentum?.wow_change_pct ?? 0;
  const wowUp = wow > 0;
  const wowDown = wow < 0;
  const thisWeek = meta.momentum?.this_week_revenue ?? meta.insights?.week_metrics?.revenue ?? 0;
  const priorWeek =
    meta.momentum?.prior_week_revenue ?? meta.insights?.week_metrics?.prior_revenue ?? 0;
  const monthFmt =
    meta.momentum?.projected_month_fmt ??
    (meta.momentum?.projected_month != null ? formatInr(meta.momentum.projected_month) : null);

  const wm = resolveWeekMetrics(meta);
  const weekdayPulse = meta.insights?.weekday_pulse ?? [];
  const movers = meta.insights?.product_movers ?? [];
  const churn = meta.insights?.churn_watch ?? [];
  const winback = meta.insights?.win_back ?? [];
  const outstanding = meta.insights?.outstanding ?? [];

  const maxPositiveImpact = Math.max(0, ...meta.went_right.map((i) => i.impact_inr ?? 0));
  const maxNegativeImpact = Math.max(0, ...meta.went_wrong.map((i) => i.impact_inr ?? 0));

  const moverChartData = movers.slice(0, 5).map((m) => ({
    name: m.name.length > 14 ? `${m.name.slice(0, 14)}…` : m.name,
    fullName: m.name,
    change: m.change_inr,
    fill: m.direction === "up" ? "#059669" : "#dc2626",
  }));

  const showOrdersParties = wm && (wm.orders > 0 || wm.prior_orders > 0);

  return (
    <div className="space-y-8">
      {/* Hero — light premium, matches rest of app */}
      <SurfaceCard padding="lg" accent="blue" hover={false} className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              Weekly debrief
            </p>
            <p className="text-sm text-text-muted mt-1 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {meta.week_start} – {meta.week_end}
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-text-primary mt-3 leading-snug max-w-2xl">
              {meta.headline}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-bold tabular-nums",
                wowUp && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
                wowDown && "bg-red-50 text-red-700 ring-1 ring-red-200",
                !wowUp && !wowDown && "bg-surface-raised text-text-secondary"
              )}
            >
              {wowUp ? "▲" : wowDown ? "▼" : "—"} {wow > 0 ? "+" : ""}
              {wow}% vs last week
            </span>
            {headerActions}
          </div>
        </div>

        {thisWeek > 0 && (
          <p className="text-4xl sm:text-5xl font-bold text-text-primary mt-6 tabular-nums">
            <AnimatedNumber value={thisWeek} formatter={formatInr} />
          </p>
        )}

        {priorWeek > 0 && thisWeek > 0 && (
          <RevenueWeekCompare current={thisWeek} prior={priorWeek} />
        )}

        <div className="mt-6 pt-5 border-t border-surface-border flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-2">
            <TrendChip label="30d" trend={meta.momentum?.trend_30d} />
            <TrendChip label="60d" trend={meta.momentum?.trend_60d} />
            <TrendChip label="90d" trend={meta.momentum?.trend_90d} />
          </div>
          {monthFmt && (
            <p className="text-sm text-text-secondary">
              Month pace: <span className="font-semibold text-text-primary">{monthFmt}</span>
            </p>
          )}
        </div>
      </SurfaceCard>

      {/* Charts row — only when we have data */}
      {(showOrdersParties || weekdayPulse.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {showOrdersParties && wm && (
            <SurfaceCard padding="md" hover={false}>
              <h3 className="text-sm font-semibold text-text-primary mb-4">Volume vs last week</h3>
              <div className="space-y-5">
                <MetricCompare label="Orders" current={wm.orders} prior={wm.prior_orders} />
                <MetricCompare label="Active parties" current={wm.parties} prior={wm.prior_parties} />
              </div>
            </SurfaceCard>
          )}

          {weekdayPulse.length > 0 && (
            <SurfaceCard padding="md" hover={false}>
              <h3 className="text-sm font-semibold text-text-primary">Which days carried the week</h3>
              <p className="text-xs text-text-muted mt-1 mb-4">
                Green = beat your usual weekday · grey bar = 30-day average
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={weekdayPulse.map((d) => ({
                    ...d,
                    beat: d.revenue >= d.trailing_avg,
                  }))}
                  margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={formatINRCompact}
                    width={44}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      formatINRCompact(v),
                      name === "revenue" ? "This week" : "Usual avg",
                    ]}
                  />
                  <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                    {weekdayPulse.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.revenue >= d.trailing_avg ? "#059669" : "#6366f1"}
                      />
                    ))}
                  </Bar>
                  <Bar dataKey="trailing_avg" fill="#e2e8f0" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SurfaceCard>
          )}
        </div>
      )}

      {/* Product movers — chart only when 2+ products */}
      {moverChartData.length >= 2 && (
        <SurfaceCard padding="md" hover={false}>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Package className="h-4 w-4 text-accent" />
            Biggest product shifts
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(120, moverChartData.length * 36)}>
            <BarChart
              data={moverChartData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
            >
              <XAxis type="number" tickFormatter={formatINRCompact} tick={{ fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <Tooltip
                formatter={(v: number) => [formatINRCompact(Math.abs(v)), "WoW change"]}
              />
              <Bar dataKey="change" radius={[0, 4, 4, 0]}>
                {moverChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SurfaceCard>
      )}

      {/* People signals — compact chips, only when actionable */}
      {(churn.length > 0 || winback.length > 0) && (
        <SurfaceCard padding="md" hover={false}>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Customer signals</h3>
          <div className="flex flex-wrap gap-2">
            {churn.map((c) => (
              <span
                key={c.party}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-50 text-red-800 px-3 py-1.5 text-xs font-medium ring-1 ring-red-100"
              >
                <Phone className="h-3 w-3" />
                {c.party} · quiet
              </span>
            ))}
            {winback.map((c) => (
              <span
                key={c.party}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-800 px-3 py-1.5 text-xs font-medium ring-1 ring-emerald-100"
              >
                <TrendingUp className="h-3 w-3" />
                {c.party} · returned
              </span>
            ))}
          </div>
        </SurfaceCard>
      )}

      {/* Narrative — impact-proportional bars */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Went right
          </h3>
          <div className="space-y-3">
            {meta.went_right?.map((item, i) => (
              <InsightRow
                key={i}
                item={item}
                variant="positive"
                maxImpact={maxPositiveImpact}
              />
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Went wrong
          </h3>
          <div className="space-y-3">
            {meta.went_wrong?.map((item, i) => (
              <InsightRow
                key={i}
                item={item}
                variant="negative"
                maxImpact={maxNegativeImpact}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Actions — priority queue */}
      {meta.actions?.length > 0 && (
        <SurfaceCard padding="md" hover={false}>
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-accent" />
            Do these three this week
          </h3>
          <ol className="space-y-2">
            {meta.actions.map((action, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-lg border border-surface-border border-l-4 bg-surface-canvas px-4 py-3",
                  URGENCY_BORDER[action.urgency ?? "medium"]
                )}
              >
                <p className="font-semibold text-sm text-text-primary">{action.title}</p>
                <p className="text-sm text-text-secondary mt-1">{action.detail}</p>
              </li>
            ))}
          </ol>
        </SurfaceCard>
      )}

      {outstanding.length > 0 && (
        <SurfaceCard padding="md" hover={false}>
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
        </SurfaceCard>
      )}

      {meta.insights?.next_hook && (
        <div className="rounded-xl border border-accent/20 bg-accent-soft/40 px-5 py-4 text-center">
          <p className="text-sm text-text-primary leading-relaxed">{meta.insights.next_hook}</p>
        </div>
      )}
    </div>
  );
}
