import { useQuery } from "@tanstack/react-query";

import { getFlags } from "../api/cafeKpiApi";

/**
 * NEW_DASHBOARD = VITE_NEW_DASHBOARD==="true" OR flags.new_dashboard.
 * Both default false — FMCG path stays until ops flips flags.
 */
export function useDashboardFlags() {
  const viteOn = import.meta.env.VITE_NEW_DASHBOARD === "true";
  const { data, isLoading } = useQuery({
    queryKey: ["kpi", "flags"],
    queryFn: getFlags,
    staleTime: 5 * 60 * 1000,
    enabled: !viteOn,
    retry: false,
  });

  if (viteOn) {
    return { newDashboard: true, cafeMetricsV2: true, isLoading: false };
  }

  return {
    newDashboard: Boolean(data?.new_dashboard),
    cafeMetricsV2: Boolean(data?.cafe_metrics_v2),
    isLoading,
  };
}
