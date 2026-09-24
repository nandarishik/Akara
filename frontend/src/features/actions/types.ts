export const API_PREFIX = "";

export const RECOMMENDATION_TYPES = [
  "menu_engineering",
  "pricing",
  "waste",
  "promotion",
  "operational",
  "gst",
  "delivery_margin",
] as const;

export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export const REC_STATUSES = [
  "open",
  "watching",
  "snoozed",
  "resolved",
  "rejected",
  "superseded",
  "expired",
] as const;

export type RecStatus = (typeof REC_STATUSES)[number];

export const EVIDENCE_TYPES = ["metric", "trend", "benchmark", "observation"] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export type ActionsTab = "queue" | "history" | "outcomes";
export type SortKey = "confidence" | "impact" | "date";
export type TypeFilter =
  | "all"
  | "menu_engineering"
  | "pricing"
  | "waste"
  | "operational"
  | "gst"
  | "delivery_margin"
  | "promotion";

export type EvidenceItem = {
  type: EvidenceType | string;
  label: string;
  value: number | string;
  unit: string | null;
};

export type OutcomeMeasured = {
  actual_impact_inr: number;
  expected_impact_inr: number;
  delta_pct: number;
  measurement_window_days: number;
  measurement_method: string;
  statistical_note: string;
};

export type RecommendationResponse = {
  id: string;
  recommendation_type: RecommendationType | string;
  title: string;
  description: string;
  evidence: EvidenceItem[];
  confidence_score: number;
  confidence_methodology: string;
  data_days: number | null;
  expected_impact_min: number | null;
  expected_impact_max: number | null;
  expected_impact_currency: string;
  assumptions: string[];
  risks: string[];
  cost_or_effort: string | null;
  status: RecStatus | string;
  outcome_measured: OutcomeMeasured | null;
  created_at: string;
  expires_at: string;
  snooze_until: string | null;
  reject_reason: string | null;
  uncertainty_label: string | null;
};

export type ActionsSummary = {
  open_count: number;
  accepted_this_month: number;
  total_impact_measured_inr: number;
  highest_confidence: {
    id: string;
    title: string;
    confidence_score: number;
    expected_impact_min: number | null;
    expected_impact_max: number | null;
    recommendation_type: string;
  } | null;
};

export type ActionsListResponse = {
  items: RecommendationResponse[];
  open_count: number;
};

export type ActionsItemsResponse = {
  items: RecommendationResponse[];
};

export const REJECT_REASONS = [
  "Not relevant to my café",
  "Already done this",
  "Disagree with the analysis",
  "Too risky right now",
  "Other",
] as const;

export const TYPE_FILTER_LABELS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "menu_engineering", label: "Menu" },
  { id: "pricing", label: "Pricing" },
  { id: "waste", label: "Waste" },
  { id: "operational", label: "Operational" },
  { id: "gst", label: "GST" },
  { id: "delivery_margin", label: "Delivery" },
];

export const TYPE_BADGE_LABELS: Record<string, string> = {
  menu_engineering: "Menu",
  pricing: "Pricing",
  waste: "Waste",
  operational: "Operational",
  promotion: "Promotion",
  gst: "GST",
  delivery_margin: "Delivery",
};

export const EMPTY_QUEUE_COPY =
  "No recommendations yet. Akara drafts actions after enough café data lands — nothing is applied without you.";

export const ACCEPT_MODAL_COPY =
  "By accepting this recommendation, Akara will track the affected items for the next 14 days and measure actual impact versus the estimate. Akara will not change prices or menus for you.";

export const MOCK_OPEN_REC: RecommendationResponse = {
  id: "11111111-1111-1111-1111-111111111111",
  recommendation_type: "pricing",
  title: "Raise Cold Brew price by ₹10",
  description: "Cost rose 18% while the menu price sat still for 45 days.",
  evidence: [
    { type: "metric", label: "Cold Brew revenue last 30d", value: 45000, unit: "INR" },
    { type: "trend", label: "Revenue trend WoW", value: -12, unit: "pct" },
    { type: "benchmark", label: "Food cost vs target", value: 0.47, unit: "ratio" },
    { type: "observation", label: "Price last changed", value: "45 days ago", unit: null },
  ],
  confidence_score: 0.72,
  confidence_methodology: "volume 0.5 + consistency 0.5 − freshness penalty",
  data_days: 45,
  expected_impact_min: 8000,
  expected_impact_max: 12000,
  expected_impact_currency: "INR",
  assumptions: ["Demand holds within 10%", "Time horizon: This month"],
  risks: ["Volume drop if price-sensitive"],
  cost_or_effort: "5 minutes to update menu price",
  status: "open",
  outcome_measured: null,
  created_at: "2026-09-09T04:00:00+00:00",
  expires_at: "2026-10-09T04:00:00+00:00",
  snooze_until: null,
  reject_reason: null,
  uncertainty_label:
    "Based on 45 days of data. Results should strengthen as more data accumulates.",
};

export const MOCK_LIMITED_REC: RecommendationResponse = {
  ...MOCK_OPEN_REC,
  id: "22222222-2222-2222-2222-222222222222",
  data_days: 20,
  confidence_score: 0.32,
  uncertainty_label: "⚠ Based on limited data (20 days). Treat with caution.",
};

export const MOCK_SUMMARY: ActionsSummary = {
  open_count: 1,
  accepted_this_month: 0,
  total_impact_measured_inr: 0,
  highest_confidence: {
    id: MOCK_OPEN_REC.id,
    title: MOCK_OPEN_REC.title,
    confidence_score: 0.72,
    expected_impact_min: 8000,
    expected_impact_max: 12000,
    recommendation_type: "pricing",
  },
};

export const MOCK_OUTCOME_REC: RecommendationResponse = {
  ...MOCK_OPEN_REC,
  id: "33333333-3333-3333-3333-333333333333",
  status: "resolved",
  outcome_measured: {
    actual_impact_inr: 8200,
    expected_impact_inr: 10000,
    delta_pct: -18.0,
    measurement_window_days: 14,
    measurement_method: "revenue_comparison",
    statistical_note:
      "Based on 14-day post-action vs 14-day pre-action revenue for affected items. No control group; confounders (seasonality, weather) not adjusted for. Minimum 90 days of data required for statistically reliable causal estimates.",
  },
};
