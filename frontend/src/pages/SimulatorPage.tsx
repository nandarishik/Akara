import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Info, 
  Zap,
  BarChart3,
  Target,
  Calculator,
  Crown,
  Sparkles,
  Play
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useBilling } from "@/hooks/useBilling";
import SurfaceCard from "@/components/ui/SurfaceCard";
import { AkaraButton, SecondaryButton } from "@/components/ui/GradientButton";
import { SimulatorPlanGate } from "@/components/billing/PlanGate";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { KPISkeleton } from "@/components/ui/ShimmerSkeleton";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

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

function formatINR(v: number) {
  const abs = Math.abs(v);
  const prefix = v < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${prefix}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${prefix}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${prefix}₹${(abs / 1_000).toFixed(1)}K`;
  return `${prefix}₹${abs.toFixed(0)}`;
}

function ScenarioSlider({
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
    <SurfaceCard 
      hover={false}
      padding="sm"
      className="animate-fadeInUp"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex justify-between items-center mb-3">
        <Label className="text-text-primary font-medium">{label}</Label>
        <span
          className={`text-sm font-bold tabular-nums transition-all duration-300 ${
            value > 0
              ? "text-emerald-600"
              : value < 0
              ? "text-red-600"
              : "text-text-secondary"
          } ${isAnimating ? "scale-110" : ""}`}
        >
          {formatLabel(value)}
        </span>
      </div>
      
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
      
      <div className="flex justify-between text-xs text-caption mt-2">
        <span>{formatLabel(min)}</span>
        <span>{formatLabel(max)}</span>
      </div>
    </SurfaceCard>
  );
}

export function SimulatorPage() {
  const { data: billing } = useBilling();
  const userPlan = billing?.plan ?? "free";

  const [growthRate, setGrowthRate] = useState(0);
  const [discountChange, setDiscountChange] = useState(0);
  const [marketExpansion, setMarketExpansion] = useState(0);
  const [customerRetention, setCustomerRetention] = useState(0);

  const {
    data: baseline,
    isLoading: baselineLoading,
    isError: baselineError,
  } = useQuery<BaselineResponse>({
    queryKey: ["simulator", "baseline"],
    queryFn: () => apiFetch<BaselineResponse>("/simulator/baseline"),
  });

  const {
    mutate: runSimulation,
    data: result,
    isPending,
    error: runError,
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

  const handleRunSimulation = () => {
    runSimulation(undefined, {
      onError: (err) => {
        console.error("Simulation failed:", err);
      },
    });
  };

  return (
    <SimulatorPlanGate>
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto bg-surface-canvas">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent text-white">
                <Calculator className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-display">Revenue Simulator</h1>
                <p className="text-body">
                  Advanced scenario modeling with real-time projections
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Crown className="h-4 w-4 text-amber-500" />
              <span className="text-amber-700 font-medium">
                {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)} Plan
              </span>
            </div>
            <SecondaryButton size="sm">
              <BarChart3 className="h-4 w-4 mr-2" />
              Export
            </SecondaryButton>
          </div>
        </div>

        {!baselineLoading && baseline && !hasEnoughData && (
          <SurfaceCard padding="sm" className="border-amber-200 bg-amber-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-800 font-medium">Insufficient data for reliable projections</p>
                <p className="text-amber-700 text-sm mt-1">
                  Found {baseline.data_days} day{baseline.data_days !== 1 ? "s" : ""} of sales data. 
                  Import at least 7 days for accurate modeling.
                </p>
              </div>
            </div>
          </SurfaceCard>
        )}

        {baselineError && (
          <SurfaceCard padding="sm" className="border-red-200 bg-red-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-red-700 font-medium">Failed to load baseline data</p>
                <p className="text-red-600 text-sm mt-1">Please refresh and try again.</p>
              </div>
            </div>
          </SurfaceCard>
        )}

        {baseline ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "30-Day Revenue",
                value: baseline.total_revenue_30d,
                sub: "actual baseline",
                icon: <TrendingUp className="h-4 w-4" />,
              },
              {
                label: "Total Orders",
                value: baseline.total_orders_30d,
                sub: "last 30 days",
                icon: <Target className="h-4 w-4" />,
              },
              {
                label: "Daily Average",
                value: baseline.daily_avg_revenue,
                sub: "revenue/day",
                icon: <BarChart3 className="h-4 w-4" />,
              },
              {
                label: "Volatility",
                value: baseline.daily_stddev_revenue,
                sub: "std deviation",
                icon: <Sparkles className="h-4 w-4" />,
              },
            ].map(({ label, value, sub, icon }, i) => (
              <SurfaceCard 
                key={label}
                hover={false}
                padding="sm"
                className="text-center animate-fadeInUp"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="text-accent">{icon}</div>
                  <span className="text-caption text-xs font-medium">{label}</span>
                </div>
                <div className="text-xl font-bold text-text-primary mb-1">
                  <AnimatedNumber value={value} />
                </div>
                <p className="text-xs text-caption">{sub}</p>
              </SurfaceCard>
            ))}
          </div>
        ) : baselineLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <KPISkeleton key={i} />
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <SurfaceCard padding="md">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="h-5 w-5 text-accent" />
              <h2 className="text-h2">Scenario Builder</h2>
            </div>

            <div className="space-y-4">
              <ScenarioSlider
                label="Volume Growth Rate"
                value={growthRate}
                min={-20}
                max={50}
                step={1}
                onChange={setGrowthRate}
                formatLabel={(v) => `${v > 0 ? "+" : ""}${v}%`}
                animationDelay={0}
              />

              <ScenarioSlider
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
                  <ScenarioSlider
                    label="Market Expansion"
                    value={marketExpansion}
                    min={0}
                    max={30}
                    step={1}
                    onChange={setMarketExpansion}
                    formatLabel={(v) => `+${v}%`}
                    animationDelay={200}
                  />

                  <ScenarioSlider
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

              {discountChange !== 0 && (
                <SurfaceCard hover={false} padding="sm" className="border-accent/20 bg-accent-soft">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                    <p className="text-xs text-body">
                      Price elasticity: -0.3 (FMCG avg). 
                      {Math.abs(discountChange)}% discount {discountChange > 0 ? "increase" : "reduction"} 
                      = ~{(discountChange * -0.3).toFixed(1)}% revenue impact.
                    </p>
                  </div>
                </SurfaceCard>
              )}

              <AkaraButton
                onClick={handleRunSimulation}
                disabled={isPending || !hasEnoughData}
                className="w-full"
              >
                {isPending ? (
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
              </AkaraButton>

              {runError && (
                <SurfaceCard padding="sm" className="border-red-200 bg-red-50">
                  <p className="text-xs text-red-600 text-center">
                    {runError.message.includes("403")
                      ? "Simulation blocked — check billing status or plan."
                      : "Projection failed. Please try again."}
                  </p>
                </SurfaceCard>
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard padding="md">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="h-5 w-5 text-accent" />
              <h2 className="text-h2">Live Projection</h2>
            </div>

            <div className="h-64 flex flex-col items-center justify-center">
              {!result && !isPending ? (
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-accent-soft text-accent opacity-70">
                    <TrendingUp className="h-8 w-8" />
                  </div>
                  <p className="text-body text-sm">Adjust parameters and run simulation</p>
                </div>
              ) : isPending ? (
                <div className="text-center animate-pulse">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-accent text-white">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                  </div>
                  <p className="text-accent font-medium animate-pulse">Running projection...</p>
                  <p className="text-body text-sm mt-1">Processing {baseline?.data_days || 30} days of data</p>
                </div>
              ) : (
                <div className="text-center w-full">
                  <div className="mb-4">
                    <p className="text-caption text-xs uppercase tracking-wide mb-2">
                      Projected 30-Day Revenue
                    </p>
                    <div className="text-3xl font-bold text-text-primary mb-2">
                      <AnimatedNumber
                        value={result?.projected_revenue || 0}
                        format={{ style: "currency", currency: "INR", maximumFractionDigits: 0 }}
                      />
                    </div>
                    <div className={`flex items-center justify-center gap-1 text-sm font-medium ${
                      isPositive ? "text-emerald-600" : "text-red-600"
                    }`}>
                      {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      <span>{isPositive ? "+" : ""}{result?.revenue_delta_pct.toFixed(1)}% vs baseline</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-text-secondary">
                      <span>Baseline</span>
                      <span>Projection</span>
                    </div>
                    <div className="w-full bg-surface-raised rounded-full h-3">
                      <div className="h-3 rounded-full bg-accent transition-all duration-2000 ease-out" style={{ width: '60%' }} />
                    </div>
                    <div className="w-full bg-surface-raised rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all duration-2000 ease-out ${
                          isPositive ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, 60 + (result?.revenue_delta_pct || 0))}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard padding="md">
            <div className="flex items-center gap-3 mb-6">
              <Target className="h-5 w-5 text-accent" />
              <h2 className="text-h2">Impact Analysis</h2>
            </div>

            {!result ? (
              <div className="space-y-3 opacity-50">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-8 bg-surface-raised rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  {[
                    { label: "Baseline Revenue", value: formatINR(result.baseline_revenue), type: "neutral" },
                    { label: "Revenue Delta", value: `${isPositive ? "+" : ""}${formatINR(result.revenue_delta)}`, type: isPositive ? "positive" : "negative" },
                    { label: "Projected Orders", value: result.projected_orders.toLocaleString("en-IN"), type: "neutral" },
                  ].map(({ label, value, type }, i) => (
                    <div 
                      key={label}
                      className="flex justify-between items-center py-2 border-b border-surface-border animate-fadeInUp"
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      <span className="text-body text-sm">{label}</span>
                      <span className={`font-semibold text-sm ${
                        type === "positive" ? "text-emerald-600" : 
                        type === "negative" ? "text-red-600" : "text-text-primary"
                      }`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                <SurfaceCard hover={false} padding="sm" className="border-accent/20 bg-accent-soft">
                  <div className="text-center">
                    <p className="text-caption text-xs mb-1">95% Confidence Range</p>
                    <div className="text-text-primary font-medium text-sm">
                      {formatINR(result.confidence_interval_lower)} – {formatINR(result.confidence_interval_upper)}
                    </div>
                  </div>
                </SurfaceCard>

                <div>
                  <p className="text-caption text-xs mb-2 uppercase tracking-wide">Risk Assessment</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-caption">Low Risk</span>
                      <span className="text-caption">High Risk</span>
                    </div>
                    <div className="w-full bg-surface-raised rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-1000 ${
                          Math.abs(result.revenue_delta_pct) > 15 
                            ? 'bg-red-500'
                            : Math.abs(result.revenue_delta_pct) > 8
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.abs(result.revenue_delta_pct) * 2)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <p className="text-xs text-caption text-center pt-2 border-t border-surface-border">
                  Based on {result.data_days} days of actual sales data. Not financial advice.
                </p>
              </div>
            )}
          </SurfaceCard>
        </div>
      </div>
    </SimulatorPlanGate>
  );
}
