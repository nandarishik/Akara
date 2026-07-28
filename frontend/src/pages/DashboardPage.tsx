import { useState, useEffect } from "react";
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
import { supabase } from "@/lib/supabase";
import GlowSurfaceCard from "@/components/ui/GlowSurfaceCard";
import { GlassIcon } from "@/components/effects/GlassIcon";
import type { GlassIconColor } from "@/components/effects/GlassIcons";
import { DASHBOARD_KPI_GLASS } from "@/lib/glassIconMap";
import { DashboardEmptyState } from "@/components/ui/EmptyState";
import { salesDataAgeDays } from "@/lib/dataFreshness";

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

const SLOT_E_VIEWS_KEY = "akara_slot_E_views";
const SLOT_E_DISMISSED_KEY = "akara_slot_E_dismissed";

export function DashboardPage() {
  const [period, setPeriod] = useState("30d");
  const [showWhatsAppNudge, setShowWhatsAppNudge] = useState(false);
  const [start, end] = getDateRange(period);
  const { data, isLoading, error } = useKPIs(start, end);

  useEffect(() => {
    if (localStorage.getItem(SLOT_E_DISMISSED_KEY)) return;
    if (!data?.last_import) return;

    const views = Number(localStorage.getItem(SLOT_E_VIEWS_KEY) || "0") + 1;
    localStorage.setItem(SLOT_E_VIEWS_KEY, String(views));
    if (views > 3) {
      localStorage.setItem(SLOT_E_DISMISSED_KEY, "1");
      return;
    }

    supabase
      .from("profiles")
      .select("phone_number")
      .maybeSingle()
      .then(({ data: profile }) => {
        if (!profile?.phone_number) setShowWhatsAppNudge(true);
      });
  }, [data?.last_import]);

  function dismissSlotE() {
    localStorage.setItem(SLOT_E_DISMISSED_KEY, "1");
    setShowWhatsAppNudge(false);
  }

  const dataAge = data ? salesDataAgeDays(data.last_import, data.date_range_end) : null;
  const isStale = dataAge !== null && dataAge > 7;

  if (!isLoading && !data) {
    return (
      <div className="p-6 lg:p-8 bg-surface-canvas min-h-full">
        <DashboardEmptyState />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto bg-surface-canvas">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-display text-2xl">Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <Calendar className="h-3.5 w-3.5 text-text-muted" />
            <p className="text-caption">{start} → {end}</p>
          </div>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40 bg-surface-card border-surface-border text-text-primary text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-surface-card border-surface-border">
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="ytd">Year to date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <GlowSurfaceCard className="border-red-200 bg-red-50/50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-red-800 font-medium text-sm">Failed to load dashboard</p>
              <p className="text-red-600 text-xs mt-0.5">{error.message}</p>
            </div>
          </div>
        </GlowSurfaceCard>
      )}

      {isStale && !isLoading && (
        <GlowSurfaceCard className="border-amber-200 bg-amber-50/50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-amber-800 font-medium text-sm">Data is {dataAge} days old</p>
                <p className="text-amber-700 text-xs">Import fresh data for current metrics</p>
              </div>
            </div>
            <Link to="/data" className="text-sm font-semibold text-accent hover:underline shrink-0">
              Import →
            </Link>
          </div>
        </GlowSurfaceCard>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <GlowSurfaceCard key={i}>
              <div className="skeleton h-3 w-20 mb-3" />
              <div className="skeleton h-8 w-24 mb-2" />
              <div className="skeleton h-3 w-16" />
            </GlowSurfaceCard>
          ))
        ) : (
          <>
            <KPICard
              title="Total Revenue"
              value={formatINR(data?.summary.total_revenue || 0)}
              change={data?.summary.revenue_change_pct}
              icon={IndianRupee}
              glassColor={DASHBOARD_KPI_GLASS.revenue}
            />
            <KPICard
              title="Total Orders"
              value={(data?.summary.total_orders || 0).toLocaleString("en-IN")}
              change={data?.summary.orders_change_pct}
              icon={ShoppingCart}
              glassColor={DASHBOARD_KPI_GLASS.orders}
            />
            <KPICard
              title="Unique Parties"
              value={(data?.summary.unique_parties || 0).toLocaleString("en-IN")}
              change={data?.summary.parties_change_pct}
              icon={Users}
              glassColor={DASHBOARD_KPI_GLASS.parties}
            />
            <KPICard
              title="Avg Order Value"
              value={formatINR(data?.summary.avg_order_value || 0)}
              change={data?.summary.aov_change_pct}
              icon={TrendingUp}
              glassColor={DASHBOARD_KPI_GLASS.growth}
            />
          </>
        )}
      </div>

      {showWhatsAppNudge && !isLoading && (
        <GlowSurfaceCard className="border-amber-200 bg-amber-50/50 animate-fadeInUp">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-amber-900 font-medium text-sm">
                Get this dashboard delivered to your WhatsApp every Monday
              </p>
              <p className="text-amber-700 text-xs mt-0.5">
                Add your WhatsApp number to receive weekly briefs automatically.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link
                to="/settings?focus=whatsapp"
                className="text-sm font-semibold text-accent hover:underline"
              >
                Add WhatsApp number →
              </Link>
              <button
                type="button"
                onClick={dismissSlotE}
                className="text-xs text-amber-700 hover:underline"
                aria-label="Dismiss WhatsApp nudge"
              >
                Dismiss
              </button>
            </div>
          </div>
        </GlowSurfaceCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlowSurfaceCard className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-5">
            <GlassIcon
              decorative
              size="sm"
              color="green"
              icon={<BarChart3 className="h-3.5 w-3.5" />}
              label="Revenue Trend"
            />
            <h2 className="text-h2">Revenue Trend</h2>
          </div>
          {isLoading ? (
            <div className="h-64 skeleton rounded-lg" />
          ) : (data?.revenue_trend?.length || 0) > 0 ? (
            <RevenueTrendChart data={data?.revenue_trend || []} />
          ) : (
            <div className="flex items-center justify-center h-64 text-text-muted text-sm">No data</div>
          )}
        </GlowSurfaceCard>

        <GlowSurfaceCard>
          <div className="flex items-center gap-2 mb-5">
            <Package className="h-4 w-4 text-accent" />
            <h2 className="text-h2">Revenue by Zone</h2>
          </div>
          {isLoading ? (
            <div className="h-48 skeleton rounded-lg" />
          ) : (data?.zone_breakdown?.length || 0) > 0 ? (
            <ZoneChart data={data?.zone_breakdown || []} />
          ) : (
            <div className="flex items-center justify-center h-48 text-text-muted text-sm">No data</div>
          )}
        </GlowSurfaceCard>
      </div>

      <GlowSurfaceCard>
        <div className="flex items-center gap-2 mb-5">
          <Package className="h-4 w-4 text-accent" />
          <h2 className="text-h2">Top Products</h2>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-10 rounded" />
            ))}
          </div>
        ) : (data?.top_products?.length || 0) > 0 ? (
          <div className="divide-y divide-surface-border">
            {data!.top_products.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded bg-surface-raised flex items-center justify-center text-xs font-bold text-text-secondary">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-text-primary">{p.product_name}</span>
                </div>
                <span className="text-sm font-semibold text-text-primary">{formatINR(p.total_revenue)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-text-muted text-sm">No product data</div>
        )}
      </GlowSurfaceCard>

      {(data?.route_performance?.length ?? 0) > 0 && (
        <GlowSurfaceCard>
          <div className="flex items-center gap-2 mb-5">
            <ExternalLink className="h-4 w-4 text-accent" />
            <h2 className="text-h2">Route Performance</h2>
          </div>
          <div className="space-y-4">
            {data!.route_performance.slice(0, 5).map((r) => {
              const maxRev = Math.max(...data!.route_performance.map(p => toNum(p.revenue)));
              const pct = (toNum(r.revenue) / maxRev) * 100;
              return (
                <div key={r.route}>
                  <div className="flex items-center justify-between mb-1.5 text-sm">
                    <span className="font-medium text-text-primary truncate max-w-[200px]">{r.route}</span>
                    <div className="flex items-center gap-3 text-text-secondary">
                      <span className="text-xs">{r.order_count} orders</span>
                      <span className="font-semibold text-text-primary">{formatINR(r.revenue)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-surface-raised rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-accent transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlowSurfaceCard>
      )}

      {(data?.outstanding_parties?.length ?? 0) > 0 && (
        <GlowSurfaceCard className="border-amber-200">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-h2">Credit Exposure</h2>
          </div>
          <div className="divide-y divide-surface-border">
            {data!.outstanding_parties.slice(0, 5).map((p) => (
              <div key={p.party_name} className="flex items-center justify-between py-3">
                <span className="text-sm text-text-primary">{p.party_name}</span>
                <span className="text-sm font-semibold text-amber-700">{formatINR(p.outstanding_amount)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-700 font-medium mt-4 pt-3 border-t border-amber-100">
            Total: ₹{data!.outstanding_parties.reduce((s, p) => s + toNum(p.outstanding_amount), 0).toLocaleString()} across {data!.outstanding_parties.length} parties
          </p>
        </GlowSurfaceCard>
      )}
    </div>
  );
}

function KPICard({
  title,
  value,
  change,
  icon: Icon,
  glassColor,
}: {
  title: string;
  value: string;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  glassColor: GlassIconColor;
}) {
  const isPositive = (change ?? 0) >= 0;
  return (
    <GlowSurfaceCard accent="blue" hover>
      <div className="flex items-center justify-between mb-3">
        <span className="text-caption uppercase tracking-wide">{title}</span>
        <GlassIcon
          decorative
          size="md"
          color={glassColor}
          icon={<Icon className="h-4 w-4" />}
          label={title}
        />
      </div>
      <p className="kpi-value text-2xl mb-1">{value}</p>
      {change != null && (
        <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
          {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          <span>{Math.abs(change).toFixed(1)}%</span>
          <span className="text-white/50 font-normal ml-1">vs last period</span>
        </div>
      )}
    </GlowSurfaceCard>
  );
}
