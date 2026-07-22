import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, AlertCircle, Info } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  formatLabel: (v: number) => string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-medium text-slate-700">{label}</Label>
        <span
          className={`text-sm font-semibold tabular-nums ${
            value > 0
              ? "text-green-600"
              : value < 0
              ? "text-red-600"
              : "text-slate-500"
          }`}
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
      />
      <div className="flex justify-between text-xs text-slate-400">
        <span>{formatLabel(min)}</span>
        <span>{formatLabel(max)}</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────

export function SimulatorPage() {
  const [growthRate, setGrowthRate] = useState(0);
  const [discountChange, setDiscountChange] = useState(0);

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
        }),
      }),
  });

  const hasEnoughData = baseline && baseline.data_days >= 7;
  const isPositive = result && result.revenue_delta >= 0;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Revenue Simulator</h1>
        <p className="text-sm text-slate-500 mt-1">
          Model what-if scenarios using your actual sales data
        </p>
      </div>

      {/* Insufficient data warning */}
      {!baselineLoading && baseline && !hasEnoughData && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Not enough data for a reliable projection
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              We found {baseline.data_days} day
              {baseline.data_days !== 1 ? "s" : ""} of sales data. Import at
              least 7 days of sales from the Data page to get meaningful
              projections.
            </p>
          </div>
        </div>
      )}

      {/* Baseline error */}
      {baselineError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">
            Failed to load your baseline data. Please refresh and try again.
          </p>
        </div>
      )}

      {/* Baseline summary strip */}
      {baseline && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "30-Day Revenue",
              value: formatINR(baseline.total_revenue_30d),
              sub: "actual",
            },
            {
              label: "30-Day Orders",
              value: baseline.total_orders_30d.toLocaleString("en-IN"),
              sub: "actual",
            },
            {
              label: "Daily Avg",
              value: formatINR(baseline.daily_avg_revenue),
              sub: "revenue/day",
            },
            {
              label: "Daily Std Dev",
              value: formatINR(baseline.daily_stddev_revenue),
              sub: "variance",
            },
          ].map(({ label, value, sub }) => (
            <div
              key={label}
              className="bg-white border border-slate-200 rounded-lg p-3 text-center"
            >
              <p className="text-base font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              <p className="text-xs text-slate-400">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {baselineLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 bg-slate-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Scenario Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scenario Parameters</CardTitle>
            <CardDescription>
              Adjust sliders to model a what-if scenario
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <SliderRow
              label="Volume Growth Rate"
              value={growthRate}
              min={-20}
              max={50}
              step={1}
              onChange={setGrowthRate}
              formatLabel={(v) => `${v > 0 ? "+" : ""}${v}%`}
            />

            <SliderRow
              label="Discount Change"
              value={discountChange}
              min={-20}
              max={20}
              step={0.5}
              onChange={setDiscountChange}
              formatLabel={(v) => `${v > 0 ? "+" : ""}${v}%`}
            />

            {/* Elasticity notice */}
            {discountChange !== 0 && (
              <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <Info className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-500">
                  Discount elasticity modelled at −0.3 (FMCG industry average).
                  A {Math.abs(discountChange)}%{" "}
                  {discountChange > 0 ? "increase" : "reduction"} in discount
                  adjusts revenue by approximately{" "}
                  {(discountChange * -0.3).toFixed(1)}%.
                </p>
              </div>
            )}

            <Button
              onClick={() => runSimulation()}
              disabled={isPending || !hasEnoughData}
              className="w-full"
            >
              {isPending ? "Calculating..." : "Run Projection"}
            </Button>

            {runError && (
              <p className="text-xs text-red-600 text-center">
                Projection failed. Please try again.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Projected Outcome */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projected Outcome</CardTitle>
            <CardDescription>
              Based on your last{" "}
              {baseline ? `${baseline.data_days} days` : "30 days"} of sales
              data
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!result && (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
                <TrendingUp className="h-8 w-8 text-slate-200" />
                <span>Run a simulation to see results</span>
              </div>
            )}

            {result && (
              <div className="space-y-6">
                {/* Headline number */}
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">
                    Projected 30-Day Revenue
                  </p>
                  <div className="text-4xl font-bold text-slate-900">
                    {formatINR(result.projected_revenue)}
                  </div>
                  <div
                    className={`flex items-center justify-center gap-1 mt-1 text-sm font-medium ${
                      isPositive ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {isPositive ? "+" : ""}
                    {result.revenue_delta_pct.toFixed(1)}% vs baseline
                  </div>
                </div>

                {/* Stats grid */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-sm py-2 border-b border-slate-100">
                    <span className="text-slate-500">Baseline (last 30d)</span>
                    <span className="font-medium tabular-nums">
                      {formatINR(result.baseline_revenue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm py-2 border-b border-slate-100">
                    <span className="text-slate-500">Revenue Delta</span>
                    <span
                      className={`font-medium tabular-nums ${
                        isPositive ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {formatINR(result.revenue_delta)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm py-2 border-b border-slate-100">
                    <span className="text-slate-500">Projected Orders</span>
                    <span className="font-medium tabular-nums">
                      {result.projected_orders.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm py-2">
                    <span className="text-slate-500">
                      95% Confidence Range
                      <span className="ml-1 text-xs text-slate-400">
                        (based on your variance)
                      </span>
                    </span>
                    <span className="font-medium tabular-nums text-xs text-slate-700">
                      {formatINR(result.confidence_interval_lower)} –{" "}
                      {formatINR(result.confidence_interval_upper)}
                    </span>
                  </div>
                </div>

                {/* Disclaimer */}
                <p className="text-xs text-slate-400 pt-1">
                  Projection based on your last {result.data_days} days of
                  actual sales data. Not financial advice.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
