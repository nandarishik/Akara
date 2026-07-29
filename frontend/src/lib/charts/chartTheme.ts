import type { Margin } from "@/charts/chart-context";

/** Shared chart chrome for AKARA matte-black surfaces */
export const CHART_LOADING_LABEL = "Loading analytics…";

export const chartMargins = {
  area: { top: 16, right: 16, bottom: 32, left: 48 } satisfies Partial<Margin>,
  bar: { top: 12, right: 16, bottom: 40, left: 48 } satisfies Partial<Margin>,
  barHorizontal: { top: 8, right: 24, bottom: 8, left: 72 } satisfies Partial<Margin>,
  line: { top: 16, right: 16, bottom: 32, left: 48 } satisfies Partial<Margin>,
} as const;

export const chartColors = {
  primary: "var(--chart-line-primary)",
  secondary: "var(--chart-line-secondary)",
  grid: "var(--chart-grid)",
  series: [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ],
} as const;

export const chartAspect = {
  wide: "2.4 / 1",
  standard: "2 / 1",
  square: "1 / 1",
} as const;
