import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { curveLinear } from "@visx/curve";

import { LineChart, Line, Grid, XAxis, ChartTooltip } from "@/charts";
import { formatINRCompact } from "@/lib/format";
import {
  chartAspect,
  chartColors,
  chartMargins,
  CHART_LOADING_LABEL,
} from "@/lib/charts/chartTheme";
import {
  sa,
  type CostsSummary,
  type RecentPaymentRow,
  type RevenueSnapshotRow,
  type RevenueSummary,
  type TenantCostRow,
} from "@/lib/api/superadmin";
import { DeltaBadge, DeltaPpBadge } from "@/features/superadmin/components/DeltaBadge";

const PLAN_MRR_INR: Record<string, number> = {
  free: 0,
  pro: 7999,
  business: 13999,
};

const USD_INR = 85;

export function SuperadminAnalyticsPage() {
  const navigate = useNavigate();
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [costs, setCosts] = useState<CostsSummary | null>(null);
  const [snapshots, setSnapshots] = useState<RevenueSnapshotRow[]>([]);
  const [payments, setPayments] = useState<RecentPaymentRow[]>([]);
  const [tenantCosts, setTenantCosts] = useState<TenantCostRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      sa.revenue(),
      sa.costs(),
      sa.revenueSnapshots(6),
      sa.recentPayments(10),
      sa.tenantCostDiagnostics(),
    ]).then(([rev, cst, snap, pay, tc]) => {
      setRevenue(rev);
      setCosts(cst);
      setSnapshots(snap.items);
      setPayments(pay.items);
      setTenantCosts(tc);
      setLoading(false);
    });
  }, []);

  const totalTenants = revenue
    ? Object.values(revenue.tenants_by_plan).reduce((a, b) => a + b, 0)
    : 0;

  const planBreakdown = useMemo(() => {
    if (!revenue) return [];
    const llmByPlan: Record<string, number> = { free: 0, pro: 0, business: 0 };
    for (const t of tenantCosts) {
      const plan = t.plan in llmByPlan ? t.plan : "free";
      llmByPlan[plan] += t.cost_usd_this_month;
    }
    return Object.entries(revenue.tenants_by_plan).map(([plan, count]) => {
      const mrr = (PLAN_MRR_INR[plan] ?? 0) * count;
      const llmUsd = llmByPlan[plan] ?? 0;
      const llmInr = llmUsd * USD_INR;
      const marginPct = mrr > 0 ? Math.round((1 - llmInr / mrr) * 100) : null;
      return { plan, count, mrr, llmUsd, marginPct };
    });
  }, [revenue, tenantCosts]);

  const underwater = useMemo(
    () =>
      tenantCosts.filter((t) => {
        const planMrr = PLAN_MRR_INR[t.plan] ?? 0;
        if (planMrr <= 0) return false;
        return t.cost_usd_this_month * USD_INR > planMrr * 0.15;
      }),
    [tenantCosts],
  );

  const chartData = useMemo(
    () =>
      [...snapshots]
        .sort(
          (a, b) =>
            new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime(),
        )
        .map((s) => ({
          date: new Date(s.snapshot_date),
          mrr: s.mrr_inr,
        })),
    [snapshots],
  );

  return (
    <div className="space-y-6 text-sa-text max-w-5xl">
      <h2 className="text-xl font-semibold">Revenue &amp; analytics</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="MRR"
          value={revenue ? `â‚¹${revenue.mrr_inr.toLocaleString("en-IN")}` : "â€”"}
          delta={revenue?.mrr_mom_pct != null ? <DeltaBadge value={revenue.mrr_mom_pct} /> : null}
        />
        <StatCard label="Total tenants" value={String(totalTenants || "â€”")} />
        <StatCard
          label="Gross margin est."
          value={revenue ? `${revenue.estimated_gross_margin_pct}%` : "â€”"}
          delta={
            revenue?.margin_delta_pp != null ? (
              <DeltaPpBadge value={revenue.margin_delta_pp} />
            ) : null
          }
        />
      </div>

      <section>
        <h3 className="font-medium mb-2">Plan breakdown</h3>
        <div className="rounded-lg border border-sa-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sa-raised text-left text-xs text-sa-muted">
              <tr>
                <th className="p-3">Plan</th>
                <th className="p-3">Tenants</th>
                <th className="p-3">MRR</th>
                <th className="p-3">LLM cost</th>
                <th className="p-3">Margin</th>
              </tr>
            </thead>
            <tbody>
              {planBreakdown.map((row) => (
                <tr key={row.plan} className="border-t border-sa-border">
                  <td className="p-3 capitalize">{row.plan}</td>
                  <td className="p-3 tabular-nums">{row.count}</td>
                  <td className="p-3 tabular-nums">â‚¹{row.mrr.toLocaleString("en-IN")}</td>
                  <td className="p-3 tabular-nums">${row.llmUsd.toFixed(2)}</td>
                  <td className="p-3 tabular-nums">
                    {row.marginPct != null ? `${row.marginPct}%` : "â€”"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="font-medium mb-2">MRR trend (6 months)</h3>
        <div className="rounded-lg border border-sa-border bg-sa-raised p-4 h-52">
          {chartData.length === 0 ? (
            <p className="text-sm text-sa-muted">{loading ? "Loadingâ€¦" : "No snapshot data"}</p>
          ) : (
            <LineChart
              data={chartData as unknown as Record<string, unknown>[]}
              aspectRatio={chartAspect.wide}
              margin={chartMargins.line}
              status={loading ? "loading" : "ready"}
              loadingLabel={loading ? CHART_LOADING_LABEL : undefined}
            >
              <Grid horizontal stroke={chartColors.grid} />
              <Line
                curve={curveLinear}
                dataKey="mrr"
                stroke={chartColors.primary}
                strokeWidth={2}
                fadeEdges={false}
                showHighlight
              />
              <XAxis />
              <ChartTooltip
                rows={(point) => [
                  {
                    label: "MRR",
                    value: formatINRCompact(Number(point.mrr) || 0),
                    color: chartColors.primary,
                  },
                ]}
              />
            </LineChart>
          )}
        </div>
      </section>

      {underwater.length > 0 && (
        <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <h3 className="font-medium text-amber-400 mb-2">Underwater tenants (LLM &gt; 15% plan MRR)</h3>
          <ul className="text-sm space-y-1">
            {underwater.map((t) => (
              <li key={t.tenant_id}>
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => navigate(`/superadmin/tenants?open=${t.tenant_id}`)}
                >
                  {t.tenant_name} â€” ${t.cost_usd_this_month.toFixed(2)} USD ({t.plan})
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="font-medium mb-2">Recent payments</h3>
        <div className="rounded-lg border border-sa-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sa-raised text-left text-xs text-sa-muted">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Tenant</th>
                <th className="p-3">Invoice</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-sa-border cursor-pointer hover:bg-white/5"
                  onClick={() => navigate(`/superadmin/tenants?open=${p.tenant_id}`)}
                >
                  <td className="p-3 whitespace-nowrap text-xs">
                    {new Date(p.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="p-3">{p.tenant_name ?? p.tenant_id.slice(0, 8)}</td>
                  <td className="p-3 text-xs font-mono">{p.invoice_number ?? "â€”"}</td>
                  <td className="p-3 tabular-nums">â‚¹{p.amount_inr.toLocaleString("en-IN")}</td>
                  <td className="p-3 capitalize text-xs">{p.status}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-sa-muted">No recent payments</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <h3 className="font-medium">LLM costs by feature</h3>
      <div className="rounded-lg border border-sa-border bg-sa-raised p-4 text-sm">
        {costs &&
          Object.entries(costs.cost_by_feature).map(([feat, usd]) => (
            <div key={feat} className="flex justify-between py-1 border-b border-sa-border last:border-0">
              <span className="capitalize">{feat}</span>
              <span className="tabular-nums">${usd.toFixed(4)}</span>
            </div>
          ))}
        {!costs && <p className="text-sa-muted">Loadingâ€¦</p>}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-sa-border bg-sa-raised p-4">
      <p className="text-xs text-sa-muted">{label}</p>
      <p className="text-2xl font-semibold mt-1 tabular-nums">{value}</p>
      {delta && <div className="mt-1">{delta}</div>}
    </div>
  );
}
