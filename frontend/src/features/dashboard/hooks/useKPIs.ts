import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { KPIResponse } from "@/types/kpi";

export function useKPIs(
  startDate: string,
  endDate: string,
  options?: { enabled?: boolean }
) {
  return useQuery<KPIResponse>({
    queryKey: ["kpi", startDate, endDate],
    queryFn: () =>
      apiFetch<KPIResponse>(
        `/kpi/?start_date=${startDate}&end_date=${endDate}`
      ),
    staleTime: 1000 * 60 * 2,
    enabled: options?.enabled ?? true,
  });
}
