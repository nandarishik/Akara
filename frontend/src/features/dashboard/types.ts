/** Café dashboard v2 wire types (snake_case). Do not break @/types/kpi. */

export type CafeKpiFilters = {
  from?: string;
  to?: string;
  location_id?: string;
  channel?: string;
  category?: string;
};

export type MetricEvidencePayload = {
  order_count: number;
  data_range?: string;
  last_import_at: string | null;
  last_updated_minutes_ago: number | null;
  metric_versions: Record<string, number>;
  partial?: boolean;
  partial_message?: string | null;
};

export type VsCompare = {
  value: number | null;
  change_pct: number | null;
};

export type MetricValue = {
  value: number | null;
  currency?: string;
  unit?: string;
  alert?: boolean;
  alert_message?: string | null;
  threshold?: number | null;
  data_quality?: string | null;
  setup_cta?: string | null;
  vs_yesterday?: VsCompare;
  vs_same_day_last_week?: VsCompare;
};

export type CafeSummaryResponse = {
  period: { from: string; to: string; timezone: string };
  evidence: MetricEvidencePayload;
  metrics: {
    revenue: MetricValue;
    food_cost_pct: MetricValue;
    orders: MetricValue;
    aov: MetricValue;
  };
};

export type TrendPoint = {
  date: string;
  revenue: number | null;
  orders?: number | null;
  prior_week_revenue?: number | null;
  labour_cost_pct?: number | null;
};

export type CafeTrendsResponse = {
  period: { from: string; to: string; timezone: string };
  evidence: MetricEvidencePayload;
  trend_7d: TrendPoint[];
  trend_30d: TrendPoint[];
};

export type ChannelSlice = {
  channel: string;
  revenue: number | null;
  orders: number | null;
  pct: number | null;
};

export type CafeChannelResponse = {
  evidence: MetricEvidencePayload;
  channels: ChannelSlice[];
};

export type DaypartCell = {
  daypart: string;
  day_of_week: number;
  orders: number | null;
  revenue: number | null;
};

export type CafeDaypartResponse = {
  evidence: MetricEvidencePayload;
  cells: DaypartCell[];
};

export type ItemRow = {
  item_name: string;
  revenue: number | null;
  orders: number | null;
  contribution_margin: number | null;
  rank: "top" | "bottom";
};

export type CafeItemsResponse = {
  evidence: MetricEvidencePayload;
  items: ItemRow[];
};

export type FoodCostAlertResponse = {
  food_cost_pct: number | null;
  threshold: number | null;
  alert: boolean;
  alert_message: string | null;
  setup_cta?: string | null;
  evidence: MetricEvidencePayload;
};

export type MetricDef = {
  metric_id: string;
  name: string;
  description: string;
  unit?: string | null;
  version?: number;
};

export type MetricsListResponse = {
  metrics: MetricDef[];
};

export type DashboardFlags = {
  cafe_metrics_v2: boolean;
  new_dashboard: boolean;
};
