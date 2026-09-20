import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { formatINR } from "@/lib/format";
import type { MetricValue } from "../types";
import { metricTooltip } from "../lib/metricTooltips";

function fmtValue(m: MetricValue | undefined, asPct = false): string {
  if (!m || m.value == null) return "—";
  if (asPct) return `${m.value.toFixed(1)}%`;
  if (m.currency === "INR") return formatINR(m.value);
  return m.value.toLocaleString();
}

function Delta({ label, vs }: { label: string; vs?: { value: number | null; change_pct: number | null } }) {
  if (!vs || vs.change_pct == null) return null;
  const up = vs.change_pct >= 0;
  return (
    <p className={`text-xs ${up ? "text-emerald-600" : "text-red-600"}`}>
      {label} {up ? "+" : ""}
      {vs.change_pct.toFixed(1)}%
    </p>
  );
}

type CardShellProps = {
  title: string;
  tooltip?: string;
  children: ReactNode;
  alert?: boolean;
};

function CardShell({ title, tooltip, children, alert }: CardShellProps) {
  return (
    <article
      className={`rounded-lg border p-4 ${
        alert ? "border-amber-500/50 bg-amber-500/5" : "border-border-subtle"
      }`}
    >
      <h3 className="text-sm font-medium text-text-muted" title={tooltip}>
        {title}
      </h3>
      {children}
    </article>
  );
}

export function RevenueHeroCard({
  metric,
  defs,
}: {
  metric?: MetricValue;
  defs?: { metric_id: string; description: string }[];
}) {
  return (
    <CardShell title="Revenue" tooltip={metricTooltip("revenue", defs)}>
      <p className="mt-1 text-2xl font-semibold text-text-primary" data-testid="revenue-hero">
        {fmtValue(metric)}
      </p>
      <Delta label="vs yesterday" vs={metric?.vs_yesterday} />
      <Delta label="vs same day last week" vs={metric?.vs_same_day_last_week} />
    </CardShell>
  );
}

export function FoodCostAlertCard({
  metric,
  defs,
}: {
  metric?: MetricValue;
  defs?: { metric_id: string; description: string }[];
}) {
  return (
    <CardShell
      title="Food cost %"
      tooltip={metricTooltip("food_cost_pct", defs)}
      alert={Boolean(metric?.alert)}
    >
      <p className="mt-1 text-2xl font-semibold text-text-primary" data-testid="food-cost-card">
        {fmtValue(metric, true)}
      </p>
      {metric?.alert_message ? (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{metric.alert_message}</p>
      ) : null}
      {metric?.value == null && metric?.setup_cta === "expense_tracking" ? (
        <p className="mt-2 text-xs text-text-muted">
          Track expenses to unlock food cost.{" "}
          <Link to="/data" className="text-accent underline">
            Upload expenses
          </Link>
        </p>
      ) : null}
    </CardShell>
  );
}

export function OrdersCard({
  metric,
  defs,
}: {
  metric?: MetricValue;
  defs?: { metric_id: string; description: string }[];
}) {
  return (
    <CardShell title="Orders" tooltip={metricTooltip("orders", defs)}>
      <p className="mt-1 text-2xl font-semibold text-text-primary">{fmtValue(metric)}</p>
    </CardShell>
  );
}

export function AOVCard({
  metric,
  defs,
}: {
  metric?: MetricValue;
  defs?: { metric_id: string; description: string }[];
}) {
  return (
    <CardShell title="AOV" tooltip={metricTooltip("aov", defs)}>
      <p className="mt-1 text-2xl font-semibold text-text-primary">{fmtValue(metric)}</p>
    </CardShell>
  );
}
