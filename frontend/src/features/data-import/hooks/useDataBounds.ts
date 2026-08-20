import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { DataBounds } from "@/lib/dateRange";

interface DataBoundsResponse {
  start: string | null;
  end: string | null;
}

export function useDataBounds() {
  return useQuery<DataBounds | null>({
    queryKey: ["kpi-data-bounds"],
    queryFn: async () => {
      const res = await apiFetch<DataBoundsResponse>("/kpi/data-bounds");
      if (res.start && res.end) {
        return { start: res.start, end: res.end };
      }
      return null;
    },
    staleTime: 1000 * 60 * 2,
  });
}
