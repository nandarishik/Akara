export const API_PREFIX = "";

export const CAFE_METRICS = [
  "revenue_below_threshold",
  "food_cost_above_threshold",
  "orders_below_expected",
  "item_not_selling",
  "anomaly",
] as const;

export type CafeMetric = (typeof CAFE_METRICS)[number];

export const METRIC_LABELS: Record<CafeMetric, string> = {
  revenue_below_threshold: "Daily revenue falls below ₹X",
  food_cost_above_threshold: "Food cost ratio exceeds X%",
  orders_below_expected: "Order count falls below X",
  item_not_selling: "Item not sold for 3+ days",
  anomaly: "Unusual pattern detected (AI)",
};

export const PREF_KEYS = [
  "revenue_drop",
  "food_cost_high",
  "orders_low",
  "item_not_selling",
  "anomaly",
] as const;

export type PrefKey = (typeof PREF_KEYS)[number];

export const PREF_LABELS: Record<PrefKey, string> = {
  revenue_drop: "Revenue drop",
  food_cost_high: "Food cost high",
  orders_low: "Orders low",
  item_not_selling: "Item not selling",
  anomaly: "Anomaly",
};

export type EscalationLevel = "immediate" | "daily_digest" | "weekly_trend";

export type ChannelPreference = {
  email: boolean;
  whatsapp: boolean;
  in_app: boolean;
};

export type CafeAlert = {
  id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  dimension: string | null;
  delivery: string[];
  cooldown_hours: number;
  is_active: boolean;
  last_triggered: string | null;
  escalation_level?: EscalationLevel;
  channel_email?: boolean;
  channel_whatsapp?: boolean;
  channel_in_app?: boolean;
  anomaly_detection?: boolean;
};

export type AlertCreatePayload = {
  name: string;
  metric: CafeMetric;
  condition: "below" | "above" | "equals";
  threshold: number;
  escalation_level: EscalationLevel;
  channel_email: boolean;
  channel_whatsapp: boolean;
  channel_in_app: boolean;
  anomaly_detection?: boolean;
};

export type AlertUpdatePayload = Partial<
  Pick<
    CafeAlert,
    | "name"
    | "threshold"
    | "is_active"
    | "escalation_level"
    | "channel_email"
    | "channel_whatsapp"
    | "channel_in_app"
  >
>;

export type AlertHistoryItem = {
  id: string;
  metric: string;
  metric_label: string;
  value: number;
  threshold: number;
  channel: string;
  escalation_level: EscalationLevel;
  timestamp: string;
};

export type NotificationPreferences = Record<PrefKey, ChannelPreference> & {
  whatsapp_alerts_enabled: boolean;
};

export type NotificationPreferencesPut = Record<PrefKey, ChannelPreference>;

export type DayForecast = {
  forecast_date: string;
  predicted_revenue: number;
  confidence_interval_low: number;
  confidence_interval_high: number;
};

export type ForecastItem = {
  item_id: string;
  location_id: string | null;
  days: DayForecast[];
};

export type ForecastSummary = {
  predicted_revenue_7d: number;
  item_count: number;
};

export type MorningBriefPreview = {
  date: string;
  revenue_yesterday: number;
  revenue_same_day_lw: number;
  revenue_wow_pct: number;
  food_cost_ratio: number | null;
  food_cost_alert: boolean;
  top_items: { item_name: string; total_revenue: number; total_qty: number }[];
  forecast_tomorrow: {
    predicted_revenue_tomorrow: number;
    busy_day_pct: number;
    available: boolean;
  } | null;
  weather: {
    temp_max_c: number;
    precipitation_mm: number;
    weather_code: number;
    is_rainy: boolean;
    attribution: string;
  } | null;
  forecast_unavailable_reason: string | null;
};

export type TrendComparison = {
  revenue_wow_pct: number;
  food_cost_wow_pct?: number | null;
};

export type RecommendedAction = {
  title: string;
  detail: string;
};
