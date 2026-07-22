import { useState } from "react";
import {
  IndianRupee,
  ShoppingCart,
  Users,
  TrendingUp,
  Package,
} from "lucide-react";
import { useKPIs } from "@/hooks/useKPIs";
import { KPICard } from "@/components/dashboard/KPICard";
import { RevenueTrendChart } from "@/components/dashboard/RevenueTrendChart";
import { ZoneChart } from "@/components/dashboard/ZoneChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function formatINR(value: number): string {
  if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2)}Cr`;
  if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${value.toFixed(0)}`;
}

export function DashboardPage() {
  const [period, setPeriod] = useState("30d");
  const [start, end] = getDateRange(period);
  const { data, isLoading, error } = useKPIs(start, end);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            {start} → {end}
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="ytd">Year to date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="text-red-600 bg-red-50 p-4 rounded-lg text-sm">
          Failed to load KPIs: {error.message}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          title="Total Revenue"
          value={data ? formatINR(data.summary.total_revenue) : "—"}
          icon={IndianRupee}
          loading={isLoading}
        />
        <KPICard
          title="Total Orders"
          value={data ? data.summary.total_orders.toLocaleString() : "—"}
          icon={ShoppingCart}
          loading={isLoading}
        />
        <KPICard
          title="Unique Parties"
          value={data ? data.summary.unique_parties.toLocaleString() : "—"}
          icon={Users}
          loading={isLoading}
        />
        <KPICard
          title="Avg Order Value"
          value={data ? formatINR(data.summary.avg_order_value) : "—"}
          icon={TrendingUp}
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 bg-slate-50 rounded animate-pulse" />
            ) : (
              <RevenueTrendChart data={data?.revenue_trend || []} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by Zone</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 bg-slate-50 rounded animate-pulse" />
            ) : (
              <ZoneChart data={data?.zone_breakdown || []} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Products</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 bg-slate-50 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(data?.top_products || []).map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-4">{i + 1}</span>
                    <div className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-sm font-medium">{p.product_name}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatINR(p.total_revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Route Performance Card — shown if route_performance has entries */}
      {(data?.route_performance?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Route Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data!.route_performance.slice(0, 5).map((r) => (
                <div key={r.route} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700 truncate max-w-[180px]">{r.route}</span>
                  <div className="flex items-center gap-4 text-slate-500">
                    <span>{r.order_count} orders</span>
                    <span className="font-semibold text-slate-800">
                      ₹{(Number(r.revenue) / 100000).toFixed(1)}L
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outstanding Parties Card — shown if outstanding_parties has entries */}
      {(data?.outstanding_parties?.length ?? 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base text-amber-800">Credit Exposure</CardTitle>
            <p className="text-sm text-amber-600">Parties with outstanding receivables</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data!.outstanding_parties.slice(0, 5).map((p) => (
                <div key={p.party_name} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-amber-900 truncate max-w-[200px]">
                    {p.party_name}
                  </span>
                  <span className="font-semibold text-amber-800">
                    ₹{(Number(p.outstanding_amount) / 100000).toFixed(1)}L
                  </span>
                </div>
              ))}
              <p className="text-xs text-amber-600 pt-1">
                Total: ₹
                {(
                  data!.outstanding_parties.reduce(
                    (s, p) => s + Number(p.outstanding_amount),
                    0
                  ) / 100000
                ).toFixed(1)}
                L outstanding across {data!.outstanding_parties.length} parties
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
