import { apiFetch } from "@/lib/api";

import type {
  CafeChannelResponse,
  CafeDaypartResponse,
  CafeItemsResponse,
  CafeKpiFilters,
  CafeSummaryResponse,
  CafeTrendsResponse,
  DashboardFlags,
  FoodCostAlertResponse,
  MetricsListResponse,
} from "../types";

/** Kickoff: live useKPIs uses unprefixed `/kpi/...`. */
export const API_PREFIX = (import.meta.env.VITE_API_PREFIX as string | undefined) ?? "";

export function cafeKpiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_PREFIX}${normalized}`;
}

export function buildFilterQuery(filters: CafeKpiFilters = {}): string {
  const q = new URLSearchParams();
  if (filters.from) q.set("from", filters.from);
  if (filters.to) q.set("to", filters.to);
  if (filters.location_id) q.set("location_id", filters.location_id);
  if (filters.channel) q.set("channel", filters.channel);
  if (filters.category) q.set("category", filters.category);
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

export const _paths = {
  summary: (f?: CafeKpiFilters) => cafeKpiPath(`/kpi/summary${buildFilterQuery(f)}`),
  trends: (f?: CafeKpiFilters) => cafeKpiPath(`/kpi/trends${buildFilterQuery(f)}`),
  channel: (f?: CafeKpiFilters) => cafeKpiPath(`/kpi/channel${buildFilterQuery(f)}`),
  daypart: (f?: CafeKpiFilters) => cafeKpiPath(`/kpi/daypart${buildFilterQuery(f)}`),
  items: (f?: CafeKpiFilters) => cafeKpiPath(`/kpi/items${buildFilterQuery(f)}`),
  foodCostAlert: (f?: CafeKpiFilters) => cafeKpiPath(`/kpi/food-cost-alert${buildFilterQuery(f)}`),
  flags: () => cafeKpiPath("/kpi/flags"),
  metrics: () => cafeKpiPath("/metrics"),
  metric: (id: string) => cafeKpiPath(`/metrics/${id}`),
};

export async function getSummary(filters: CafeKpiFilters = {}): Promise<CafeSummaryResponse> {
  return apiFetch(_paths.summary(filters));
}

export async function getTrends(filters: CafeKpiFilters = {}): Promise<CafeTrendsResponse> {
  return apiFetch(_paths.trends(filters));
}

export async function getChannel(filters: CafeKpiFilters = {}): Promise<CafeChannelResponse> {
  return apiFetch(_paths.channel(filters));
}

export async function getDaypart(filters: CafeKpiFilters = {}): Promise<CafeDaypartResponse> {
  return apiFetch(_paths.daypart(filters));
}

export async function getItems(filters: CafeKpiFilters = {}): Promise<CafeItemsResponse> {
  return apiFetch(_paths.items(filters));
}

export async function getFoodCostAlert(
  filters: CafeKpiFilters = {},
): Promise<FoodCostAlertResponse> {
  return apiFetch(_paths.foodCostAlert(filters));
}

export async function listMetrics(): Promise<MetricsListResponse> {
  return apiFetch(_paths.metrics());
}

export async function getFlags(): Promise<DashboardFlags> {
  return apiFetch(_paths.flags());
}
