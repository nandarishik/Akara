import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  sa,
  type ActivityRow,
  type AtRiskResponse,
  type OverviewStats,
  type RevenueSummary,
  type CostsSummary,
  type TenantRow,
} from "@/lib/api/superadmin";
import { DeltaBadge, DeltaPpBadge } from "@/features/superadmin/components/DeltaBadge";

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN");
}

export function OverviewPage() {
  const navigate = useNavigate();
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [costs, setCosts] = useState<CostsSummary | null>(null);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskResponse | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [failedCrons, setFailedCrons] = useState<string[]>([]);
  const [staleCrons, setStaleCrons] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [rev, cst, st, act, risk, tnt, cron] = await Promise.all([
      sa.revenue(),
      sa.costs(),
      sa.overviewStats(),
      sa.overviewActivity(20),
      sa.atRiskTenants(),
      sa.tenants({ limit: 200 }),
      sa.cronHealth(),
    ]);
    setRevenue(rev);
    setCosts(cst);
    setStats(st);
    setActivity(act.items);
    setAtRisk(risk);
    setTenants(tnt.items);
    setFailedCrons(
      (cron.tasks || [])
        .filter((t) => t.status === "failed")
        .map((t) => t.task_name),
    );
    const staleThresholdMs = 18 * 60 * 60 * 1000;
    setStaleCrons(
      (cron.tasks || [])
        .filter((t) => {
          if (t.status === "failed" || !t.last_run) return false;
          return Date.now() - new Date(t.last_run).getTime() > staleThresholdMs;
        })
        .map((t) => t.task_name),
    );
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const activeTenants =
    revenue?.total_active_tenants ??
    (revenue
      ? Object.values(revenue.tenants_by_plan).reduce((a, b) => a + b, 0)
      : null);

  const highQuotaTenants = useMemo(
    () =>
      tenants.filter((t) => {
        if (t.copilot_limit <= 0 || t.copilot_limit === -1) return false;
        return (t.copilot_calls_this_month / t.copilot_limit) * 100 >= 80;
      }),
    [tenants],
  );

  const hasAttention =
    (atRisk?.past_due.length ?? 0) > 0 ||
    highQuotaTenants.length > 0 ||
    failedCrons.length > 0 ||
    staleCrons.length > 0 ||
    (revenue?.churned_this_month ?? 0) > 0;

  return (
    <div className="space-y-6 text-sa-text max-w-6xl">
      <h2 className="text-xl font-semibold">Overview</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Kpi
          label="MRR"
          value={revenue ? `â‚¹${revenue.mrr_inr.toLocaleString("en-IN")}` : "â€”"}
          delta={revenue?.mrr_mom_pct != null ? <DeltaBadge value={revenue.mrr_mom_pct} /> : null}
        />
        <Kpi label="ARR" value={revenue ? `â‚¹${revenue.arr_inr.toLocaleString("en-IN")}` : "â€”"} />
        <Kpi
          label="Active tenants"
          value={activeTenants != null ? String(activeTenants) : "â€”"}
          delta={
            revenue?.active_tenants_delta != null && revenue.active_tenants_delta !== 0 ? (
              <span
                className={`text-xs tabular-nums ${
                  revenue.active_tenants_delta > 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {revenue.active_tenants_delta > 0 ? "+" : ""}
                {revenue.active_tenants_delta} vs last month
              </span>
            ) : null
          }
        />
        <Kpi
          label="Margin est."
          value={revenue ? `${revenue.estimated_gross_margin_pct}%` : "â€”"}
          delta={
            revenue?.margin_delta_pp != null ? (
              <DeltaPpBadge value={revenue.margin_delta_pp} />
            ) : null
          }
        />
        <Kpi label="LLM cost (mo)" value={costs ? `$${costs.total_cost_usd_this_month.toFixed(2)}` : "â€”"} />
        <Kpi label="Questions today" value={stats != null ? String(stats.questions_today) : "â€”"} />
      </div>

      {stats && (
        <div className="rounded-lg border border-sa-border bg-sa-raised p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-sm">New this week</h3>
            <Link
              to="/superadmin/tenants?filter=new"
              className="text-xs text-sa-accent hover:underline"
            >
              View signups
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{stats.new_this_week.signups}</p>
              <p className="text-xs text-sa-muted">Signups</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-emerald-400">
                {stats.new_this_week.upgrades}
              </p>
              <p className="text-xs text-sa-muted">Upgrades</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-amber-400">
                {stats.new_this_week.churns}
              </p>
              <p className="text-xs text-sa-muted">Churns</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-sa-border bg-sa-raised p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Attention</h3>
            <div className="flex gap-2 text-xs">
              <Link to="/superadmin/users" className="text-sa-accent hover:underline">
                Users
              </Link>
              <span className="text-sa-muted">Â·</span>
              <Link to="/superadmin/cron" className="text-sa-accent hover:underline">
                Cron
              </Link>
            </div>
          </div>
          <ul className="text-sm space-y-1.5 text-sa-muted">
            {(atRisk?.past_due ?? []).map((t) => (
              <li key={t.id} className="text-amber-400">
                <button
                  type="button"
                  className="hover:underline text-left"
                  onClick={() => navigate(`/superadmin/tenants?open=${t.id}`)}
                >
                  Past due: {t.name}
                </button>
              </li>
            ))}
            {highQuotaTenants.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="hover:underline text-left"
                  onClick={() => navigate(`/superadmin/tenants?open=${t.id}`)}
                >
                  â‰¥80% quota: {t.name} ({t.copilot_calls_this_month}/{t.copilot_limit})
                </button>
              </li>
            ))}
            {failedCrons.map((name) => (
              <li key={name} className="text-red-400">
                Cron failed: {name.replace(/_/g, " ")}
              </li>
            ))}
            {staleCrons.map((name) => (
              <li key={`stale-${name}`} className="text-amber-400">
                <Link to="/superadmin/cron" className="hover:underline">
                  Cron stale: {name.replace(/_/g, " ")} (last ran &gt;18h ago)
                </Link>
              </li>
            ))}
            {revenue && revenue.churned_this_month > 0 && (
              <li>{revenue.churned_this_month} tenant(s) churned this month</li>
            )}
            {!hasAttention && <li>No critical alerts</li>}
          </ul>
        </div>

        <div className="rounded-lg border border-sa-border bg-sa-raised p-4">
          <h3 className="font-medium mb-2">Activity feed</h3>
          <ul className="text-xs space-y-2 max-h-64 overflow-y-auto">
            {activity.map((a) => (
              <li
                key={a.id}
                className={`flex justify-between gap-2 rounded px-2 py-1 ${
                  a.highlight ? "bg-amber-500/10 border border-amber-500/30" : ""
                } ${a.tenant_id ? "cursor-pointer hover:bg-white/5" : ""}`}
                onClick={() => {
                  if (a.tenant_id) navigate(`/superadmin/tenants?open=${a.tenant_id}`);
                }}
              >
                <div className="min-w-0">
                  <span className="truncate block">{a.action}</span>
                  {(a.tenant_name || a.actor_email) && (
                    <span className="text-sa-muted truncate block">
                      {[a.tenant_name, a.tenant_plan?.toUpperCase(), a.actor_email]
                        .filter(Boolean)
                        .join(" Â· ")}
                    </span>
                  )}
                </div>
                <span className="text-sa-muted shrink-0">{formatRelative(a.created_at)}</span>
              </li>
            ))}
            {activity.length === 0 && <li className="text-sa-muted">No recent activity</li>}
          </ul>
          <p className="text-[10px] text-sa-muted mt-2">Auto-refreshes every 30s</p>
        </div>
      </div>
    </div>
  );
}

function Kpi({
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
      <p className="text-xs text-sa-muted uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold mt-1 tabular-nums">{value}</p>
      {delta && <div className="mt-1">{delta}</div>}
    </div>
  );
}
