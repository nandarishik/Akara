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
import { supabase } from "@/lib/supabase";
import LiquidGlassCard from "@/components/ui/LiquidGlassCard";
import GradientButton, { SecondaryButton } from "@/components/ui/GradientButton";
import { TableSkeleton, ChartSkeleton } from "@/components/ui/ShimmerSkeleton";
import { NoDataEmptyState } from "@/components/ui/EmptyState";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { PlanGate } from "@/components/billing/PlanGate";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

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

// Mock route performance data for blue gradient charts
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

  const { data: leakageRows, isLoading: leakageLoading } = useSchemeLeakage();

  const totalLeakage = (leakageRows || []).reduce(
    (sum, r) => sum + r.leakage_amount,
    0
  );

  const maxRevenue = Math.max(...mockRoutePerformance.map(r => r.revenue));
  const hasLeakage = leakageRows && leakageRows.length > 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 
            className="text-3xl font-bold bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #90CAF9 100%)'
            }}
          >
            Intelligence Center
          </h1>
          <p className="text-[#90CAF9] mt-2">
            Route performance analytics, generated reports, and scheme leakage detection
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <SecondaryButton size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </SecondaryButton>
          <GradientButton size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </GradientButton>
        </div>
      </div>

      {/* Route Performance with Blue Gradient Charts */}
      <LiquidGlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-[#42A5F5]" />
            <h2 
              className="text-lg font-semibold bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #90CAF9 100%)'
              }}
            >
              Route Performance Analytics
            </h2>
          </div>
          <SecondaryButton size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            View All Routes
          </SecondaryButton>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* Performance Chart */}
          <div>
            <h3 className="text-[#90CAF9] font-medium mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Revenue Performance
            </h3>
            <div className="space-y-4">
              {mockRoutePerformance.slice(0, 6).map((route, i) => {
                const percentage = (route.revenue / maxRevenue) * 100;
                return (
                  <div 
                    key={route.route} 
                    className={`animate-fadeInUp`}
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-[#E3F2FD] text-sm">{route.route}</span>
                      <div className="text-right">
                        <span className="text-[#42A5F5] font-semibold text-sm">
                          {formatINR(route.revenue)}
                        </span>
                        <div className="text-xs text-[#90CAF9]">{route.orders} orders</div>
                      </div>
                    </div>
                    <div className="w-full bg-[rgba(15,52,96,0.6)] rounded-full h-3">
                      <div 
                        className="h-3 rounded-full transition-all duration-1000 ease-out"
                        style={{
                          width: `${percentage}%`,
                          background: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 50%, #80D8FF 100%)',
                          boxShadow: '0 0 12px rgba(66, 165, 245, 0.4)'
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-[#5C8FBF]">Efficiency: {route.efficiency}%</span>
                      <span className={`flex items-center gap-1 ${
                        route.growth >= 0 ? 'text-emerald-400' : 'text-red-400'
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

          {/* Performance Metrics */}
          <div>
            <h3 className="text-[#90CAF9] font-medium mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Key Metrics
            </h3>
            <div className="space-y-4">
              <LiquidGlassCard hover={false} className="p-4 border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-emerald-400 font-medium">Top Performer</p>
                    <p className="text-emerald-300 text-sm">Hyderabad IT</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-400">21.3%</div>
                    <div className="text-xs text-emerald-300">growth</div>
                  </div>
                </div>
              </LiquidGlassCard>

              <LiquidGlassCard hover={false} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#E3F2FD] font-medium">Total Routes</p>
                    <p className="text-[#90CAF9] text-sm">Active this month</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-[#42A5F5]">
                      <AnimatedNumber value={mockRoutePerformance.length} />
                    </div>
                    <div className="text-xs text-[#90CAF9]">routes</div>
                  </div>
                </div>
              </LiquidGlassCard>

              <LiquidGlassCard hover={false} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#E3F2FD] font-medium">Avg Efficiency</p>
                    <p className="text-[#90CAF9] text-sm">Across all routes</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-[#42A5F5]">
                      <AnimatedNumber 
                        value={mockRoutePerformance.reduce((sum, r) => sum + r.efficiency, 0) / mockRoutePerformance.length} 
                        format={{ maximumFractionDigits: 1, minimumFractionDigits: 1 }}
                      />%
                    </div>
                    <div className="text-xs text-[#90CAF9]">efficiency</div>
                  </div>
                </div>
              </LiquidGlassCard>

              <LiquidGlassCard hover={false} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#E3F2FD] font-medium">Total Revenue</p>
                    <p className="text-[#90CAF9] text-sm">All routes combined</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-[#42A5F5]">
                      {formatINR(mockRoutePerformance.reduce((sum, r) => sum + r.revenue, 0))}
                    </div>
                    <div className="text-xs text-[#90CAF9]">this month</div>
                  </div>
                </div>
              </LiquidGlassCard>
            </div>
          </div>
        </div>
      </LiquidGlassCard>

      <PlanGate
        feature="scheme_leakage"
        requiredPlan="business"
        title="Scheme Leakage Detection"
        description="See exactly how much scheme money was claimed vs actual offtake."
        priceHint="From ₹13,999/month"
      >
      {hasLeakage && (
        <LiquidGlassCard className="p-6 border-red-500/20 bg-red-500/5 relative overflow-hidden">
          {/* Animated background warning pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              background: 'repeating-linear-gradient(45deg, transparent, transparent 20px, #EF4444 20px, #EF4444 40px)'
            }} />
          </div>
          
          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
                    boxShadow: '0 8px 32px rgba(239, 68, 68, 0.3)'
                  }}
                >
                  <Lock className="h-5 w-5 text-white animate-pulse" />
                </div>
                <div>
                  <h2 
                    className="text-lg font-semibold bg-clip-text text-transparent"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, #FECACA 0%, #FEE2E2 100%)'
                    }}
                  >
                    Scheme Leakage Detection
                  </h2>
                  <p className="text-red-300 text-sm">
                    {leakageLoading ? 'Scanning for anomalies...' : `${leakageRows?.length || 0} distributors flagged`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                  Critical Alert
                </Badge>
                <div 
                  className="w-3 h-3 rounded-full bg-red-400 animate-pulse"
                  style={{
                    boxShadow: '0 0 20px rgba(239, 68, 68, 0.6)'
                  }}
                />
              </div>
            </div>

            {leakageLoading ? (
              <ChartSkeleton height="h-[200px]" />
            ) : (
              <div className="space-y-4">
                {/* Total Leakage Summary */}
                <LiquidGlassCard hover={false} className="p-4 border-red-500/30 bg-red-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-red-400" />
                      <div>
                        <p className="text-red-300 font-medium">Total Potential Savings</p>
                        <p className="text-red-400 text-sm">Deniable claims this cycle</p>
                      </div>
                    </div>
                    <div 
                      className="text-2xl font-bold bg-clip-text text-transparent"
                      style={{
                        backgroundImage: 'linear-gradient(135deg, #FCA5A5 0%, #FECACA 100%)'
                      }}
                    >
                      {formatINR(totalLeakage)}
                    </div>
                  </div>
                </LiquidGlassCard>

                {/* Leakage Details */}
                <div className="space-y-3">
                  {leakageRows?.slice(0, 5).map((row, i) => (
                    <div
                      key={i}
                      className={`flex items-start justify-between p-4 rounded-lg border border-red-500/20 bg-red-500/5 animate-fadeInUp hover:bg-red-500/10 transition-colors`}
                      style={{
                        animationDelay: `${i * 100}ms`
                      }}
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-red-200">{row.party_name}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-red-300">{row.scheme_name}</span>
                          <span className="text-red-400">•</span>
                          <span className="text-red-300">{row.product_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-red-400">
                          <Calendar className="h-3 w-3" />
                          <span>{row.scheme_start} → {row.scheme_end}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="h-4 w-4 text-red-400" />
                          <span 
                            className="font-semibold bg-clip-text text-transparent"
                            style={{
                              backgroundImage: 'linear-gradient(135deg, #FCA5A5 0%, #FECACA 100%)'
                            }}
                          >
                            {formatINR(row.leakage_amount)}
                          </span>
                        </div>
                        <div className="text-xs text-red-400">
                          Claimed {formatINR(row.claimed_amount)}
                        </div>
                        <div className="text-xs text-red-500">
                          Actual {formatINR(row.actual_offtake)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-red-500/20">
                  <div className="text-sm text-red-300">
                    {leakageRows && leakageRows.length > 5 && (
                      <span>+{leakageRows.length - 5} more distributors flagged</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <SecondaryButton size="sm" className="border-red-500/30 text-red-300 hover:bg-red-500/10">
                      <Eye className="h-4 w-4 mr-2" />
                      View All
                    </SecondaryButton>
                    <GradientButton size="sm" className="bg-gradient-to-r from-red-600 to-red-500">
                      <Shield className="h-4 w-4 mr-2" />
                      Take Action
                    </GradientButton>
                  </div>
                </div>
              </div>
            )}
          </div>
        </LiquidGlassCard>
      )}
      </PlanGate>

      {/* Generated Reports with Navy Glass */}
      <LiquidGlassCard className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <FileSpreadsheet className="h-5 w-5 text-[#42A5F5]" />
          <h2 
            className="text-lg font-semibold bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #90CAF9 100%)'
            }}
          >
            Generated Reports
          </h2>
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
              <LiquidGlassCard
                key={r.id}
                hover={true}
                className={`p-4 animate-fadeInUp`}
                style={{
                  animationDelay: `${i * 100}ms`
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
                        boxShadow: '0 4px 16px rgba(66, 165, 245, 0.3)'
                      }}
                    >
                      <FileSpreadsheet className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-[#E3F2FD] mb-1">
                        {r.title}
                      </p>
                      <div className="flex items-center gap-3 text-xs">
                        <Badge 
                          className="bg-[rgba(66,165,245,0.1)] text-[#42A5F5] border-[rgba(33,150,243,0.12)]"
                        >
                          {r.report_type}
                        </Badge>
                        <span className="text-[#90CAF9] flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(r.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        {r.file_size_bytes && (
                          <span className="text-[#5C8FBF]">
                            {(r.file_size_bytes / 1024).toFixed(0)} KB
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <GradientButton
                    size="sm"
                    onClick={() => downloadReport(r.id, r.title)}
                    disabled={!r.storage_path}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </GradientButton>
                </div>
              </LiquidGlassCard>
            ))}
          </div>
        )}
      </LiquidGlassCard>

      {/* Ad Slot J - Analytics Upgrade */}
      <LiquidGlassCard className="p-6 border-[#42A5F5]/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
                boxShadow: '0 4px 16px rgba(66, 165, 245, 0.3)'
              }}
            >
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 
                className="font-semibold bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #90CAF9 100%)'
                }}
              >
                Advanced Analytics Package
              </h3>
              <p className="text-[#90CAF9] text-sm">
                Get predictive analytics, custom reports, and real-time alerts
              </p>
            </div>
          </div>
          <GradientButton size="sm">
            Upgrade Analytics
          </GradientButton>
        </div>
      </LiquidGlassCard>
    </div>
  );
}
