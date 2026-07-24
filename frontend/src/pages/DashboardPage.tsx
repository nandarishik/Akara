import { useState } from "react";
import {
  IndianRupee,
  ShoppingCart,
  Users,
  TrendingUp,
  Package,
  AlertTriangle,
  Calendar,
  ExternalLink,
  BarChart3,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useKPIs } from "@/hooks/useKPIs";
import { toNum, formatINR as fmtINR } from "@/lib/format";
import { RevenueTrendChart } from "@/components/dashboard/RevenueTrendChart";
import { ZoneChart } from "@/components/dashboard/ZoneChart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";

function getDateRange(period: string): [string, string] {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case "7d": start.setDate(end.getDate() - 7); break;
    case "30d": start.setDate(end.getDate() - 30); break;
    case "90d": start.setDate(end.getDate() - 90); break;
    case "ytd": start.setMonth(0, 1); break;
    default: start.setDate(end.getDate() - 30);
  }
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

const formatINR = fmtINR;

export function DashboardPage() {
  const [period, setPeriod] = useState("30d");
  const [start, end] = getDateRange(period);
  const { data, isLoading, error } = useKPIs(start, end);

  const dataAge = data ? Math.floor((Date.now() - new Date(data.last_import || 0).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const isStale = dataAge > 7;

  if (!isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[500px] p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
            <BarChart3 className="h-8 w-8 text-slate-300" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No data yet</h2>
          <p className="text-slate-500 text-sm mb-6">Import your sales data to see your dashboard come alive.</p>
          <Link
            to="/data"
            className="inline-flex items-center gap-2 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all hover:shadow-lg hover:shadow-blue-500/20"
            style={{ background: "linear-gradient(135deg, #1565C0, #1E88E5)" }}
          >
            Import Data →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0A1628] tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <p className="text-sm text-slate-500">{start} → {end}</p>
          </div>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40 bg-white border-slate-200 text-slate-700 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white border-slate-200">
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="ytd">Year to date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="text-red-700 font-medium text-sm">Failed to load dashboard</p>
            <p className="text-red-500 text-xs mt-0.5">{error.message}</p>
          </div>
        </div>
      )}

      {isStale && !isLoading && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50 border border-amber-100">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-amber-800 font-medium text-sm">Data is {dataAge} days old</p>
              <p className="text-amber-600 text-xs">Import fresh data for current metrics</p>
            </div>
          </div>
          <Link
            to="/data"
            className="text-sm font-semibold text-[#1565C0] hover:underline"
          >
            Import →
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse">
              <div className="h-3 w-20 bg-slate-100 rounded mb-3" />
              <div className="h-7 w-24 bg-slate-100 rounded mb-2" />
              <div className="h-3 w-16 bg-slate-50 rounded" />
            </div>
          ))
        ) : (
          <>
            <KPICard
              title="Total Revenue"
              value={formatINR(data?.summary.total_revenue || 0)}
              change={data?.summary.revenue_change_pct}
              icon={<IndianRupee className="h-4 w-4" />}
            />
            <KPICard
              title="Total Orders"
              value={(data?.summary.total_orders || 0).toLocaleString("en-IN")}
              change={data?.summary.orders_change_pct}
              icon={<ShoppingCart className="h-4 w-4" />}
            />
            <KPICard
              title="Unique Parties"
              value={(data?.summary.unique_parties || 0).toLocaleString("en-IN")}
              change={data?.summary.parties_change_pct}
              icon={<Users className="h-4 w-4" />}
            />
            <KPICard
              title="Avg Order Value"
              value={formatINR(data?.summary.avg_order_value || 0)}
              change={data?.summary.aov_change_pct}
              icon={<TrendingUp className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="h-4 w-4 text-[#1976D2]" />
            <h2 className="font-semibold text-[#0A1628]">Revenue Trend</h2>
          </div>
          {isLoading ? (
            <div className="h-64 bg-slate-50 rounded-lg animate-pulse" />
          ) : (data?.revenue_trend?.length || 0) > 0 ? (
            <RevenueTrendChart data={data?.revenue_trend || []} />
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">No data</div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 mb-5">
            <Package className="h-4 w-4 text-[#1976D2]" />
            <h2 className="font-semibold text-[#0A1628]">Revenue by Zone</h2>
          </div>
          {isLoading ? (
            <div className="h-48 bg-slate-50 rounded-lg animate-pulse" />
          ) : (data?.zone_breakdown?.length || 0) > 0 ? (
            <ZoneChart data={data?.zone_breakdown || []} />
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No data</div>
          )}
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 mb-5">
          <Package className="h-4 w-4 text-[#1976D2]" />
          <h2 className="font-semibold text-[#0A1628]">Top Products</h2>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-50 rounded animate-pulse" />
            ))}
          </div>
        ) : (data?.top_products?.length || 0) > 0 ? (
          <div className="divide-y divide-slate-50">
            {data!.top_products.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-slate-800">{p.product_name}</span>
                </div>
                <span className="text-sm font-semibold text-[#0A1628]">{formatINR(p.total_revenue)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">No product data</div>
        )}
      </div>

      {/* Route Performance */}
      {(data?.route_performance?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-[#1976D2]" />
              <h2 className="font-semibold text-[#0A1628]">Route Performance</h2>
            </div>
          </div>
          <div className="space-y-4">
            {data!.route_performance.slice(0, 5).map((r) => {
              const maxRev = Math.max(...data!.route_performance.map(p => toNum(p.revenue)));
              const pct = (toNum(r.revenue) / maxRev) * 100;
              return (
                <div key={r.route}>
                  <div className="flex items-center justify-between mb-1.5 text-sm">
                    <span className="font-medium text-slate-700 truncate max-w-[200px]">{r.route}</span>
                    <div className="flex items-center gap-3 text-slate-500">
                      <span className="text-xs">{r.order_count} orders</span>
                      <span className="font-semibold text-[#0A1628]">{formatINR(r.revenue)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: "linear-gradient(90deg, #1976D2, #42A5F5)" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Outstanding */}
      {(data?.outstanding_parties?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-amber-100 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-[#0A1628]">Credit Exposure</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {data!.outstanding_parties.slice(0, 5).map((p) => (
              <div key={p.party_name} className="flex items-center justify-between py-3">
                <span className="text-sm text-slate-700">{p.party_name}</span>
                <span className="text-sm font-semibold text-amber-700">{formatINR(p.outstanding_amount)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-600 font-medium mt-4 pt-3 border-t border-amber-50">
            Total: ₹{data!.outstanding_parties.reduce((s, p) => s + toNum(p.outstanding_amount), 0).toLocaleString()} across {data!.outstanding_parties.length} parties
          </p>
        </div>
      )}
    </div>
  );
}

// ── KPI Card component (clean, light) ───────────────────────────────────────

function KPICard({
  title,
  value,
  change,
  icon,
}: {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
}) {
  const isPositive = (change ?? 0) >= 0;
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</span>
        <div className="w-7 h-7 rounded-lg bg-[#EBF5FF] flex items-center justify-center text-[#1976D2]">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-[#0A1628] mb-1">{value}</p>
      {change != null && (
        <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
          {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          <span>{Math.abs(change).toFixed(1)}%</span>
          <span className="text-slate-400 font-normal ml-1">vs last period</span>
        </div>
      )}
    </div>
  );
}
