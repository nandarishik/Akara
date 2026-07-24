import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Info, 
  Lock,
  Zap,
  BarChart3,
  Target,
  Calculator,
  Crown,
  Sparkles,
  Play
} from "lucide-react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { useBilling } from "@/hooks/useBilling";
import LiquidGlassCard from "@/components/ui/LiquidGlassCard";
import GradientButton, { SecondaryButton } from "@/components/ui/GradientButton";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { KPISkeleton } from "@/components/ui/ShimmerSkeleton";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface BaselineResponse {
  total_revenue_30d: number;
  total_orders_30d: number;
  daily_avg_revenue: number;
  daily_stddev_revenue: number;
  data_days: number;
}

interface SimResult {
  baseline_revenue: number;
  projected_revenue: number;
  projected_orders: number;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
  revenue_delta: number;
  revenue_delta_pct: number;
  growth_rate_pct: number;
  discount_change_pct: number;
  data_days: number;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function formatINR(v: number) {
  const abs = Math.abs(v);
  const prefix = v < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${prefix}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${prefix}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${prefix}₹${(abs / 1_000).toFixed(1)}K`;
  return `${prefix}₹${abs.toFixed(0)}`;
}

function BlueGradientSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatLabel,
  animationDelay = 0,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  formatLabel: (v: number) => string;
  animationDelay?: number;
}) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (value !== 0) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [value]);

  return (
    <LiquidGlassCard 
      hover={false} 
      className={`p-4 animate-fadeInUp`}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex justify-between items-center mb-3">
        <Label className="text-[#E3F2FD] font-medium">{label}</Label>
        <span
          className={`text-sm font-bold tabular-nums transition-all duration-300 ${
            value > 0
              ? "text-emerald-400"
              : value < 0
              ? "text-red-400"
              : "text-[#90CAF9]"
          } ${isAnimating ? "scale-110" : ""}`}
        >
          {formatLabel(value)}
        </span>
      </div>
      
      {/* Custom blue gradient slider */}
      <div className="relative">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={([v]) => onChange(v)}
          className="w-full"
        />
        {/* Blue glow effect when active */}
        {value !== 0 && (
          <div 
            className="absolute inset-0 pointer-events-none rounded-full opacity-30 animate-pulse"
            style={{
              background: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
              filter: 'blur(8px)',
            }}
          />
        )}
      </div>
      
      <div className="flex justify-between text-xs text-[#5C8FBF] mt-2">
        <span>{formatLabel(min)}</span>
        <span>{formatLabel(max)}</span>
      </div>
    </LiquidGlassCard>
  );
}

// ────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────

export function SimulatorPage() {
  const { data: billing } = useBilling();
  const userPlan = billing?.plan ?? "free";
  const isPremium = billing?.features?.simulator ?? false;

  const [growthRate, setGrowthRate] = useState(0);
  const [discountChange, setDiscountChange] = useState(0);
  const [marketExpansion, setMarketExpansion] = useState(0);
  const [customerRetention, setCustomerRetention] = useState(0);
  const [isRunningSimulation, setIsRunningSimulation] = useState(false);

  // ── Fetch real baseline on mount ──
  const {
    data: baseline,
    isLoading: baselineLoading,
    isError: baselineError,
  } = useQuery<BaselineResponse>({
    queryKey: ["simulator", "baseline"],
    queryFn: () => apiFetch<BaselineResponse>("/simulator/baseline"),
  });

  // ── Run projection mutation ──
  const {
    mutate: runSimulation,
    data: result,
    isPending,
    isError: runError,
  } = useMutation<SimResult, Error, void>({
    mutationFn: () =>
      apiFetch<SimResult>("/simulator/run", {
        method: "POST",
        body: JSON.stringify({
          growth_rate_pct: growthRate,
          discount_change_pct: discountChange,
          market_expansion_pct: marketExpansion,
          customer_retention_pct: customerRetention,
        }),
      }),
  });

  const hasEnoughData = baseline && baseline.data_days >= 7;
  const isPositive = result && result.revenue_delta >= 0;

  // Animation for simulation
  const handleRunSimulation = () => {
    setIsRunningSimulation(true);
    setTimeout(() => {
      runSimulation();
      setIsRunningSimulation(false);
    }, 2000);
  };

  // Navy Glass Gate for Free Users
  if (!isPremium) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <LiquidGlassCard className="p-8 text-center border-[#42A5F5]/20 relative overflow-hidden">
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(circle at 20% 50%, #1565C0 0%, transparent 50%), radial-gradient(circle at 80% 50%, #42A5F5 0%, transparent 50%)',
            }} />
          </div>
          
          <div className="relative z-10 max-w-md mx-auto">
            <div 
              className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center animate-pulse"
              style={{
                background: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
                boxShadow: '0 20px 60px rgba(66, 165, 245, 0.4)'
              }}
            >
              <Lock className="h-10 w-10 text-white" />
            </div>
            
            <h1 
              className="text-2xl font-bold mb-4 bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #90CAF9 100%)'
              }}
            >
              Revenue Simulator
            </h1>
            
            <p className="text-[#90CAF9] mb-6 leading-relaxed">
              Advanced what-if modeling and revenue projections are available with 
              Pro and Business plans. Unlock powerful forecasting capabilities.
            </p>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 text-left">
                <div className="w-2 h-2 rounded-full bg-[#42A5F5]" />
                <span className="text-[#E3F2FD] text-sm">Multi-variable scenario modeling</span>
              </div>
              <div className="flex items-center gap-3 text-left">
                <div className="w-2 h-2 rounded-full bg-[#42A5F5]" />
                <span className="text-[#E3F2FD] text-sm">Monte Carlo projections</span>
              </div>
              <div className="flex items-center gap-3 text-left">
                <div className="w-2 h-2 rounded-full bg-[#42A5F5]" />
                <span className="text-[#E3F2FD] text-sm">Confidence intervals & risk analysis</span>
              </div>
              <div className="flex items-center gap-3 text-left">
                <div className="w-2 h-2 rounded-full bg-[#42A5F5]" />
                <span className="text-[#E3F2FD] text-sm">Market expansion scenarios</span>
              </div>
            </div>

            <Link to="/upgrade">
              <GradientButton className="mb-4">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </GradientButton>
            </Link>
            
            <p className="text-[#5C8FBF] text-xs">
              Or contact sales for Business plan features
            </p>
          </div>
        </LiquidGlassCard>
      </div>
    );
  }

  // Premium 3-Panel Experience
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
                boxShadow: '0 8px 32px rgba(66, 165, 245, 0.3)'
              }}
            >
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 
                className="text-3xl font-bold bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #90CAF9 100%)'
                }}
              >
                Revenue Simulator
              </h1>
              <p className="text-[#90CAF9]">
                Advanced scenario modeling with real-time projections
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Crown className="h-4 w-4 text-amber-400" />
            <span className="text-amber-400 font-medium">
              {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)} Plan
            </span>
          </div>
          <SecondaryButton size="sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Export
          </SecondaryButton>
        </div>
      </div>

      {/* Warnings & Errors */}
      {!baselineLoading && baseline && !hasEnoughData && (
        <LiquidGlassCard className="p-4 border-amber-500/20 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-amber-400 font-medium">Insufficient data for reliable projections</p>
              <p className="text-amber-300 text-sm mt-1">
                Found {baseline.data_days} day{baseline.data_days !== 1 ? "s" : ""} of sales data. 
                Import at least 7 days for accurate modeling.
              </p>
            </div>
          </div>
        </LiquidGlassCard>
      )}

      {baselineError && (
        <LiquidGlassCard className="p-4 border-red-500/20 bg-red-500/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-red-400 font-medium">Failed to load baseline data</p>
              <p className="text-red-300 text-sm mt-1">Please refresh and try again.</p>
            </div>
          </div>
        </LiquidGlassCard>
      )}

      {/* Baseline Metrics */}
      {baseline ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "30-Day Revenue",
              value: baseline.total_revenue_30d,
              formatted: formatINR(baseline.total_revenue_30d),
              sub: "actual baseline",
              icon: <TrendingUp className="h-4 w-4" />,
            },
            {
              label: "Total Orders",
              value: baseline.total_orders_30d,
              formatted: baseline.total_orders_30d.toLocaleString("en-IN"),
              sub: "last 30 days",
              icon: <Target className="h-4 w-4" />,
            },
            {
              label: "Daily Average",
              value: baseline.daily_avg_revenue,
              formatted: formatINR(baseline.daily_avg_revenue),
              sub: "revenue/day",
              icon: <BarChart3 className="h-4 w-4" />,
            },
            {
              label: "Volatility",
              value: baseline.daily_stddev_revenue,
              formatted: formatINR(baseline.daily_stddev_revenue),
              sub: "std deviation",
              icon: <Sparkles className="h-4 w-4" />,
            },
          ].map(({ label, value, sub, icon }, i) => (
            <LiquidGlassCard 
              key={label}
              hover={false}
              className={`p-4 text-center animate-fadeInUp`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="text-[#42A5F5]">{icon}</div>
                <span className="text-[#90CAF9] text-xs font-medium">{label}</span>
              </div>
              <div className="text-xl font-bold text-[#E3F2FD] mb-1">
                <AnimatedNumber value={value} />
              </div>
              <p className="text-xs text-[#5C8FBF]">{sub}</p>
            </LiquidGlassCard>
          ))}
        </div>
      ) : baselineLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <KPISkeleton key={i} />
          ))}
        </div>
      ) : null}

      {/* 3-Panel Layout: Inputs | Simulation | Results */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Panel 1: Scenario Parameters */}
        <LiquidGlassCard className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="h-5 w-5 text-[#42A5F5]" />
            <h2 
              className="text-lg font-semibold bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #90CAF9 100%)'
              }}
            >
              Scenario Builder
            </h2>
          </div>

          <div className="space-y-4">
            <BlueGradientSlider
              label="Volume Growth Rate"
              value={growthRate}
              min={-20}
              max={50}
              step={1}
              onChange={setGrowthRate}
              formatLabel={(v) => `${v > 0 ? "+" : ""}${v}%`}
              animationDelay={0}
            />

            <BlueGradientSlider
              label="Discount Adjustment"
              value={discountChange}
              min={-20}
              max={20}
              step={0.5}
              onChange={setDiscountChange}
              formatLabel={(v) => `${v > 0 ? "+" : ""}${v}%`}
              animationDelay={100}
            />

            {userPlan === 'business' && (
              <>
                <BlueGradientSlider
                  label="Market Expansion"
                  value={marketExpansion}
                  min={0}
                  max={30}
                  step={1}
                  onChange={setMarketExpansion}
                  formatLabel={(v) => `+${v}%`}
                  animationDelay={200}
                />

                <BlueGradientSlider
                  label="Customer Retention"
                  value={customerRetention}
                  min={-10}
                  max={25}
                  step={0.5}
                  onChange={setCustomerRetention}
                  formatLabel={(v) => `${v > 0 ? "+" : ""}${v}%`}
                  animationDelay={300}
                />
              </>
            )}

            {/* Elasticity Info */}
            {discountChange !== 0 && (
              <LiquidGlassCard hover={false} className="p-3 border-[#42A5F5]/20 bg-[rgba(66,165,245,0.05)]">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-[#42A5F5] mt-0.5 shrink-0" />
                  <p className="text-xs text-[#90CAF9]">
                    Price elasticity: -0.3 (FMCG avg). 
                    {Math.abs(discountChange)}% discount {discountChange > 0 ? "increase" : "reduction"} 
                    = ~{(discountChange * -0.3).toFixed(1)}% revenue impact.
                  </p>
                </div>
              </LiquidGlassCard>
            )}

            <GradientButton
              onClick={handleRunSimulation}
              disabled={isPending || !hasEnoughData || isRunningSimulation}
              className="w-full"
            >
              {isRunningSimulation || isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Calculating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Simulation
                </>
              )}
            </GradientButton>

            {runError && (
              <LiquidGlassCard className="p-3 border-red-500/20 bg-red-500/5">
                <p className="text-xs text-red-400 text-center">
                  Projection failed. Please try again.
                </p>
              </LiquidGlassCard>
            )}
          </div>
        </LiquidGlassCard>

        {/* Panel 2: Live Simulation Visual */}
        <LiquidGlassCard className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="h-5 w-5 text-[#42A5F5]" />
            <h2 
              className="text-lg font-semibold bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #90CAF9 100%)'
              }}
            >
              Live Projection
            </h2>
          </div>

          <div className="h-64 flex flex-col items-center justify-center">
            {!result && !isRunningSimulation ? (
              <div className="text-center">
                <div 
                  className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
                  }}
                >
                  <TrendingUp className="h-8 w-8 text-white" />
                </div>
                <p className="text-[#90CAF9] text-sm">Adjust parameters and run simulation</p>
              </div>
            ) : isRunningSimulation ? (
              <div className="text-center animate-pulse">
                <div 
                  className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
                    boxShadow: '0 0 30px rgba(66, 165, 245, 0.6)'
                  }}
                >
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                </div>
                <p className="text-[#42A5F5] font-medium animate-pulse">Running Monte Carlo simulation...</p>
                <p className="text-[#90CAF9] text-sm mt-1">Processing {baseline?.data_days || 30} days of data</p>
              </div>
            ) : (
              <div className="text-center w-full">
                {/* Animated projection results */}
                <div className="mb-4">
                  <p className="text-[#90CAF9] text-xs uppercase tracking-wide mb-2">
                    Projected 30-Day Revenue
                  </p>
                  <div 
                    className="text-3xl font-bold bg-clip-text text-transparent mb-2"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, #42A5F5 0%, #80D8FF 100%)'
                    }}
                  >
                    <AnimatedNumber
                      value={result?.projected_revenue || 0}
                      format={{ style: "currency", currency: "INR", maximumFractionDigits: 0 }}
                    />
                  </div>
                  <div className={`flex items-center justify-center gap-1 text-sm font-medium ${
                    isPositive ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span>{isPositive ? "+" : ""}{result?.revenue_delta_pct.toFixed(1)}% vs baseline</span>
                  </div>
                </div>

                {/* Visual bar representation */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-[#90CAF9]">
                    <span>Baseline</span>
                    <span>Projection</span>
                  </div>
                  <div className="relative">
                    <div className="w-full bg-[rgba(15,52,96,0.6)] rounded-full h-3">
                      <div 
                        className="h-3 rounded-full transition-all duration-2000 ease-out"
                        style={{
                          width: '60%',
                          background: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
                        }}
                      />
                    </div>
                    <div className="w-full bg-[rgba(15,52,96,0.6)] rounded-full h-3 mt-1">
                      <div 
                        className="h-3 rounded-full transition-all duration-2000 ease-out"
                        style={{
                          width: `${Math.min(100, 60 + (result?.revenue_delta_pct || 0))}%`,
                          background: isPositive 
                            ? 'linear-gradient(135deg, #10B981 0%, #34D399 100%)'
                            : 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',
                          boxShadow: `0 0 10px ${isPositive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </LiquidGlassCard>

        {/* Panel 3: Detailed Results */}
        <LiquidGlassCard className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Target className="h-5 w-5 text-[#42A5F5]" />
            <h2 
              className="text-lg font-semibold bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #90CAF9 100%)'
              }}
            >
              Impact Analysis
            </h2>
          </div>

          {!result ? (
            <div className="space-y-3 opacity-50">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-8 bg-[rgba(15,52,96,0.3)] rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Key Metrics */}
              <div className="space-y-3">
                {[
                  { label: "Baseline Revenue", value: formatINR(result.baseline_revenue), type: "neutral" },
                  { label: "Revenue Delta", value: `${isPositive ? "+" : ""}${formatINR(result.revenue_delta)}`, type: isPositive ? "positive" : "negative" },
                  { label: "Projected Orders", value: result.projected_orders.toLocaleString("en-IN"), type: "neutral" },
                ].map(({ label, value, type }, i) => (
                  <div 
                    key={label}
                    className={`flex justify-between items-center py-2 border-b border-[rgba(33,150,243,0.08)] animate-fadeInUp`}
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <span className="text-[#90CAF9] text-sm">{label}</span>
                    <span className={`font-semibold text-sm ${
                      type === "positive" ? "text-emerald-400" : 
                      type === "negative" ? "text-red-400" : "text-[#E3F2FD]"
                    }`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Confidence Interval */}
              <LiquidGlassCard hover={false} className="p-3 border-[#42A5F5]/20 bg-[rgba(66,165,245,0.05)]">
                <div className="text-center">
                  <p className="text-[#90CAF9] text-xs mb-1">95% Confidence Range</p>
                  <div className="text-[#E3F2FD] font-medium text-sm">
                    {formatINR(result.confidence_interval_lower)} – {formatINR(result.confidence_interval_upper)}
                  </div>
                </div>
              </LiquidGlassCard>

              {/* Risk Assessment */}
              <div>
                <p className="text-[#90CAF9] text-xs mb-2 uppercase tracking-wide">Risk Assessment</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#5C8FBF]">Low Risk</span>
                    <span className="text-[#5C8FBF]">High Risk</span>
                  </div>
                  <div className="w-full bg-[rgba(15,52,96,0.6)] rounded-full h-2">
                    <div 
                      className="h-2 rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(100, Math.abs(result.revenue_delta_pct) * 2)}%`,
                        background: Math.abs(result.revenue_delta_pct) > 15 
                          ? 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)'
                          : Math.abs(result.revenue_delta_pct) > 8
                          ? 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)'
                          : 'linear-gradient(135deg, #10B981 0%, #34D399 100%)'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <p className="text-xs text-[#5C8FBF] text-center pt-2 border-t border-[rgba(33,150,243,0.08)]">
                Based on {result.data_days} days of actual sales data. Not financial advice.
              </p>
            </div>
          )}
        </LiquidGlassCard>
      </div>
    </div>
  );
}
