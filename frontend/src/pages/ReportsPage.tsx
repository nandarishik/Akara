import { useState } from "react";
import { 
  Download, 
  FileSpreadsheet, 
  RefreshCw, 
  Lock, 
  Shield, 
  AlertTriangle, 
  ExternalLink, 
  BarChart3,
  TrendingUp,
  Eye,
  Calendar,
  Filter,
  ArrowUpRight
} from "lucide-react";
import { useReports, useSchemeLeakage } from "@/hooks/useReports";
import { useBilling } from "@/hooks/useBilling";
import { useKPIs } from "@/hooks/useKPIs";
import { supabase } from "@/lib/supabase";
import SurfaceCard from "@/components/ui/SurfaceCard";
import { AkaraButton, SecondaryButton } from "@/components/ui/GradientButton";
import { TableSkeleton, ChartSkeleton } from "@/components/ui/ShimmerSkeleton";
import { NoDataEmptyState } from "@/components/ui/EmptyState";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { PlanGate } from "@/components/billing/PlanGate";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { Link } from "react-router-dom";

const BASE = import.meta.env.VITE_API_BASE_URL as string;

function formatINR(v: number) {
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(2)}Cr`;
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
}

async function downloadReport(reportId: string, title: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;

  try {
    const res = await fetch(`${BASE}/reports/${reportId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!res.ok) {
      toast.error('Failed to download report');
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report downloaded successfully');
  } catch (err) {
    console.error('Download error:', err);
    toast.error('Failed to download report');
  }
}

const mockRoutePerformance = [
  { route: 'Mumbai Central', orders: 1247, revenue: 12450000, growth: 12.5, efficiency: 89 },
  { route: 'Delhi NCR', orders: 998, revenue: 9876000, growth: 8.2, efficiency: 85 },
  { route: 'Bangalore Tech', orders: 856, revenue: 8560000, growth: 15.7, efficiency: 92 },
  { route: 'Chennai Metro', orders: 742, revenue: 7420000, growth: -3.1, efficiency: 78 },
  { route: 'Pune Industrial', orders: 689, revenue: 6890000, growth: 6.8, efficiency: 81 },
  { route: 'Hyderabad IT', orders: 634, revenue: 6340000, growth: 21.3, efficiency: 95 },
  { route: 'Kolkata East', orders: 578, revenue: 5780000, growth: 4.2, efficiency: 76 },
  { route: 'Ahmedabad', orders: 523, revenue: 5230000, growth: 9.1, efficiency: 83 }
];

export function ReportsPage() {
  const {
    data: reports,
    isLoading: reportsLoading,
    refetch,
  } = useReports();

  const { data: usage } = useBilling();
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const { data: kpiData } = useKPIs(start, end);
  const { data: leakageRows, isLoading: leakageLoading } = useSchemeLeakage();
  const [slotJDismissed, setSlotJDismissed] = useState(
    () => localStorage.getItem("akara_slot_J_dismissed") === "1",
  );
  const showSlotJ =
    usage?.plan === "pro" &&
    !usage.features.scheme_leakage &&
    !slotJDismissed;

  const totalLeakage = (leakageRows || []).reduce(
    (sum, r) => sum + r.leakage_amount,
    0
  );

  const hasLeakage = leakageRows && leakageRows.length > 0;
  const zoneRows = (kpiData?.zone_breakdown ?? []).filter((z) => Number(z.revenue) > 0);
  const hasRealZones = zoneRows.length > 0;
  const routeRows = hasRealZones
    ? zoneRows
        .slice()
        .sort((a, b) => Number(b.revenue) - Number(a.revenue))
        .slice(0, 6)
        .map((z) => ({
          route: z.zone,
          orders: z.order_count,
          revenue: Number(z.revenue),
          growth: 0,
          efficiency: Math.round(Number(z.revenue_pct)),
        }))
    : mockRoutePerformance.slice(0, 6);
  const routeMaxRevenue = Math.max(...routeRows.map((r) => r.revenue), 1);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto bg-surface-canvas">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-display">Intelligence Center</h1>
          <p className="text-body mt-2">
            Route performance analytics, generated reports, and scheme leakage detection
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <SecondaryButton size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </SecondaryButton>
          <AkaraButton size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </AkaraButton>
        </div>
      </div>

      <SurfaceCard padding="md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-accent" />
            <h2 className="text-h2">Route Performance Analytics</h2>
            <Badge variant="outline" className="text-caption">
              {hasRealZones ? "Your data" : "Sample data"}
            </Badge>
          </div>
          <SecondaryButton size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            View All Routes
          </SecondaryButton>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-text-secondary font-medium mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Revenue Performance
              <span className="text-caption text-xs font-normal">
                ({hasRealZones ? "Your data" : "Sample data"})
              </span>
            </h3>
            <div className="space-y-4">
              {routeRows.map((route, i) => {
                const percentage = (route.revenue / routeMaxRevenue) * 100;
                return (
                  <div 
                    key={route.route} 
                    className="animate-fadeInUp"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-text-primary text-sm">{route.route}</span>
                      <div className="text-right">
                        <span className="text-accent font-semibold text-sm">
                          {formatINR(route.revenue)}
                        </span>
                        <div className="text-xs text-text-secondary">{route.orders} orders</div>
                      </div>
                    </div>
                    <div className="w-full bg-surface-raised rounded-full h-3">
                      <div 
                        className="h-3 rounded-full bg-accent transition-all duration-1000 ease-out"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-caption">Efficiency: {route.efficiency}%</span>
                      <span className={`flex items-center gap-1 ${
                        route.growth >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        <ArrowUpRight className={`h-3 w-3 ${route.growth < 0 ? 'rotate-90' : ''}`} />
                        {Math.abs(route.growth).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-text-secondary font-medium mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Key Metrics
              <span className="text-caption text-xs font-normal">
                ({hasRealZones ? "Your data" : "Sample data"})
              </span>
            </h3>
            <div className="space-y-4">
              <SurfaceCard hover={false} padding="sm" className="border-emerald-200 bg-emerald-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-emerald-700 font-medium">Top Performer</p>
                    <p className="text-emerald-600 text-sm">Hyderabad IT</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-700">21.3%</div>
                    <div className="text-xs text-emerald-600">growth</div>
                  </div>
                </div>
              </SurfaceCard>

              <SurfaceCard hover={false} padding="sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-text-primary font-medium">Total Routes</p>
                    <p className="text-body text-sm">Active this month</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-accent">
                      <AnimatedNumber value={mockRoutePerformance.length} />
                    </div>
                    <div className="text-xs text-text-secondary">routes</div>
                  </div>
                </div>
              </SurfaceCard>

              <SurfaceCard hover={false} padding="sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-text-primary font-medium">Avg Efficiency</p>
                    <p className="text-body text-sm">Across all routes</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-accent">
                      <AnimatedNumber 
                        value={mockRoutePerformance.reduce((sum, r) => sum + r.efficiency, 0) / mockRoutePerformance.length} 
                        format={{ maximumFractionDigits: 1, minimumFractionDigits: 1 }}
                      />%
                    </div>
                    <div className="text-xs text-text-secondary">efficiency</div>
                  </div>
                </div>
              </SurfaceCard>

              <SurfaceCard hover={false} padding="sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-text-primary font-medium">Total Revenue</p>
                    <p className="text-body text-sm">All routes combined</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-accent">
                      {formatINR(mockRoutePerformance.reduce((sum, r) => sum + r.revenue, 0))}
                    </div>
                    <div className="text-xs text-text-secondary">this month</div>
                  </div>
                </div>
              </SurfaceCard>
            </div>
          </div>
        </div>
      </SurfaceCard>

      {showSlotJ && (
        <SurfaceCard
          padding="md"
          className="border-violet-200 bg-gradient-to-r from-violet-50/80 to-amber-50/60 animate-fadeInUp"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-text-primary">
                Detect scheme leakage before payout day
              </p>
              <p className="text-sm text-text-secondary mt-1">
                See exactly how much scheme money was claimed without matching secondary sales.
                Business plan unlocks full leakage analytics.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link to="/billing">
                <AkaraButton size="sm">Upgrade to Business →</AkaraButton>
              </Link>
              <button
                type="button"
                className="text-xs text-text-muted hover:underline"
                onClick={() => {
                  localStorage.setItem("akara_slot_J_dismissed", "1");
                  setSlotJDismissed(true);
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </SurfaceCard>
      )}

      <PlanGate
        feature="scheme_leakage"
        requiredPlan="business"
        title="Scheme Leakage Detection"
        description="See exactly how much scheme money was claimed vs actual offtake."
        priceHint="From ₹13,999/month"
      >
      {hasLeakage && (
        <SurfaceCard padding="md" className="border-red-200 bg-red-50 relative overflow-hidden">
          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-600 text-white">
                  <Lock className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-h2 text-red-900">Scheme Leakage Detection</h2>
                  <p className="text-red-700 text-sm">
                    {leakageLoading ? 'Scanning for anomalies...' : `${leakageRows?.length || 0} distributors flagged`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Badge className="bg-red-100 text-red-700 border-red-200">
                  Critical Alert
                </Badge>
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              </div>
            </div>

            {leakageLoading ? (
              <ChartSkeleton height="h-[200px]" />
            ) : (
              <div className="space-y-4">
                <SurfaceCard hover={false} padding="sm" className="border-red-300 bg-red-100/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-red-600" />
                      <div>
                        <p className="text-red-800 font-medium">Total Potential Savings</p>
                        <p className="text-red-700 text-sm">Deniable claims this cycle</p>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-red-700">
                      {formatINR(totalLeakage)}
                    </div>
                  </div>
                </SurfaceCard>

                <div className="space-y-3">
                  {leakageRows?.slice(0, 5).map((row, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between p-4 rounded-lg border border-red-200 bg-white animate-fadeInUp hover:bg-red-50 transition-colors"
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-red-900">{row.party_name}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-red-700">{row.scheme_name}</span>
                          <span className="text-red-500">•</span>
                          <span className="text-red-700">{row.product_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-red-600">
                          <Calendar className="h-3 w-3" />
                          <span>{row.scheme_start} → {row.scheme_end}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="font-semibold text-red-700">
                            {formatINR(row.leakage_amount)}
                          </span>
                        </div>
                        <div className="text-xs text-red-600">
                          Claimed {formatINR(row.claimed_amount)}
                        </div>
                        <div className="text-xs text-red-700">
                          Actual {formatINR(row.actual_offtake)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-red-200">
                  <div className="text-sm text-red-700">
                    {leakageRows && leakageRows.length > 5 && (
                      <span>+{leakageRows.length - 5} more distributors flagged</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <SecondaryButton size="sm" className="border-red-300 text-red-700 hover:bg-red-50">
                      <Eye className="h-4 w-4 mr-2" />
                      View All
                    </SecondaryButton>
                    <AkaraButton size="sm">
                      <Shield className="h-4 w-4 mr-2" />
                      Take Action
                    </AkaraButton>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SurfaceCard>
      )}
      </PlanGate>

      <SurfaceCard padding="md">
        <div className="flex items-center gap-3 mb-6">
          <FileSpreadsheet className="h-5 w-5 text-accent" />
          <h2 className="text-h2">Generated Reports</h2>
        </div>

        {reportsLoading ? (
          <TableSkeleton rows={4} />
        ) : (!reports || reports.length === 0) ? (
          <NoDataEmptyState
            title="No reports generated yet"
            description="Reports will appear here once created by the system or administrators"
            actionLabel="Request Report"
          />
        ) : (
          <div className="space-y-3">
            {reports.map((r, i) => (
              <SurfaceCard
                key={r.id}
                hover
                padding="sm"
                className="animate-fadeInUp"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent text-white">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-text-primary mb-1">
                        {r.title}
                      </p>
                      <div className="flex items-center gap-3 text-xs">
                        <Badge className="bg-accent-soft text-accent border-surface-border">
                          {r.report_type}
                        </Badge>
                        <span className="text-text-secondary flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(r.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        {r.file_size_bytes && (
                          <span className="text-caption">
                            {(r.file_size_bytes / 1024).toFixed(0)} KB
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <AkaraButton
                    size="sm"
                    onClick={() => downloadReport(r.id, r.title)}
                    disabled={!r.storage_path}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </AkaraButton>
                </div>
              </SurfaceCard>
            ))}
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard padding="md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent text-white">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-h2">Advanced Analytics Package</h3>
              <p className="text-body text-sm">
                Get predictive analytics, custom reports, and real-time alerts
              </p>
            </div>
          </div>
          <AkaraButton size="sm">
            Upgrade Analytics
          </AkaraButton>
        </div>
      </SurfaceCard>
    </div>
  );
}
