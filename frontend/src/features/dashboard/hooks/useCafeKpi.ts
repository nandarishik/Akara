import { useQuery } from "@tanstack/react-query";

import {
  getChannel,
  getDaypart,
  getFoodCostAlert,
  getItems,
  getSummary,
  getTrends,
  listMetrics,
} from "../api/cafeKpiApi";
import type { CafeKpiFilters } from "../types";

export function useCafeSummary(filters: CafeKpiFilters, enabled = true) {
  return useQuery({
    queryKey: ["cafe-kpi", "summary", filters],
    queryFn: () => getSummary(filters),
    enabled,
    staleTime: 60_000,
  });
}

export function useCafeTrends(filters: CafeKpiFilters, enabled = true) {
  return useQuery({
    queryKey: ["cafe-kpi", "trends", filters],
    queryFn: () => getTrends(filters),
    enabled,
    staleTime: 60_000,
  });
}

export function useCafeChannel(filters: CafeKpiFilters, enabled = true) {
  return useQuery({
    queryKey: ["cafe-kpi", "channel", filters],
    queryFn: () => getChannel(filters),
    enabled,
    staleTime: 60_000,
  });
}

export function useCafeDaypart(filters: CafeKpiFilters, enabled = true) {
  return useQuery({
    queryKey: ["cafe-kpi", "daypart", filters],
    queryFn: () => getDaypart(filters),
    enabled,
    staleTime: 60_000,
  });
}

export function useCafeItems(filters: CafeKpiFilters, enabled = true) {
  return useQuery({
    queryKey: ["cafe-kpi", "items", filters],
    queryFn: () => getItems(filters),
    enabled,
    staleTime: 60_000,
  });
}

export function useFoodCostAlert(filters: CafeKpiFilters, enabled = true) {
  return useQuery({
    queryKey: ["cafe-kpi", "food-cost-alert", filters],
    queryFn: () => getFoodCostAlert(filters),
    enabled,
    staleTime: 60_000,
  });
}

export function useMetricDefs(enabled = true) {
  return useQuery({
    queryKey: ["metrics", "list"],
    queryFn: listMetrics,
    enabled,
    staleTime: 10 * 60_000,
  });
}
