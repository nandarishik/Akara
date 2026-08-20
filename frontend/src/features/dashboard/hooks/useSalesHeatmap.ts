import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface HeatmapCell {
  zone: string;
  product_name: string;
  revenue: number;
  order_count: number;
}

export interface HeatmapResponse {
  cells: HeatmapCell[];
  date_range_start: string;
  date_range_end: string;
}

export function useSalesHeatmap(startDate: string, endDate: string, enabled = true) {
  return useQuery<HeatmapResponse>({
    queryKey: ["kpi", "heatmap", startDate, endDate],
    queryFn: () =>
      apiFetch<HeatmapResponse>(
        `/kpi/heatmap?start_date=${startDate}&end_date=${endDate}`,
      ),
    staleTime: 1000 * 60 * 2,
    enabled,
  });
}
