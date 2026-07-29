import type { HeatmapCellRow } from "@/lib/charts/chartAdapters";

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

export const fixtureAreaSeries = Array.from({ length: 14 }, (_, i) => ({
  date: daysAgo(13 - i),
  revenue: 120_000 + i * 8_500 + (i % 3) * 12_000,
}));

export const fixtureBarRows = [
  { name: "West", value: 34 },
  { name: "North", value: 28 },
  { name: "South", value: 22 },
  { name: "East", value: 16 },
];

export const fixtureFunnel = [
  { label: "Claimed", value: 4200000, displayValue: "₹42L" },
  { label: "Matched", value: 3100000, displayValue: "₹31L" },
  { label: "Leakage", value: 1100000, displayValue: "₹11L" },
];

export const fixtureHeatmapRows: HeatmapCellRow[] = [
  { zone: "Mumbai", product_name: "SKU-A", revenue: 420000, order_count: 120 },
  { zone: "Mumbai", product_name: "SKU-B", revenue: 280000, order_count: 95 },
  { zone: "Delhi", product_name: "SKU-A", revenue: 390000, order_count: 110 },
  { zone: "Delhi", product_name: "SKU-C", revenue: 210000, order_count: 70 },
  { zone: "Bangalore", product_name: "SKU-B", revenue: 350000, order_count: 88 },
];

export const fixtureUsage = {
  plan: "pro" as const,
  plan_status: "active" as const,
  copilot_calls_used: 42,
  copilot_calls_limit: 100,
  rows_used: 85000,
  rows_limit: 200000,
  uploads_used: 3,
  uploads_limit: 10,
  uploads_today: 1,
  uploads_per_day: 3,
  undos_today: 0,
  undos_per_day: 5,
  users_used: 2,
  users_limit: 5,
  debrief_count_used: 1,
  debrief_lifetime_limit: 3,
  features: {
    morning_brief: true,
    scheme_leakage: false,
    simulator: true,
    reports: true,
    custom_language: false,
    secondary_sales: false,
    api_push: false,
    tally_connector: false,
    team_invites: true,
    api_keys: false,
    ask_copilot_debrief: true,
    alerts: false,
  },
  retention_days: 90,
};

export const fixtureZones = [
  { zone: "West", revenue: 420000, order_count: 120, revenue_pct: 34 },
  { zone: "North", revenue: 310000, order_count: 95, revenue_pct: 28 },
  { zone: "South", revenue: 240000, order_count: 80, revenue_pct: 22 },
];

export const fixtureWeekdayPulse = [
  { day: "Mon", weekday: "Monday", revenue: 82000, trailing_avg: 76000 },
  { day: "Tue", weekday: "Tuesday", revenue: 91000, trailing_avg: 88000 },
  { day: "Wed", weekday: "Wednesday", revenue: 68000, trailing_avg: 79000 },
];

export const fixtureMovers = [
  { name: "Premium Oil 1L", change_inr: 42000, change_pct: 12, direction: "up" as const },
  { name: "Snack Pack", change_inr: -18000, change_pct: -8, direction: "down" as const },
];
