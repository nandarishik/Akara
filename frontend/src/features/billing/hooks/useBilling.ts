/**
 * useBilling — React Query hook for GET /billing/usage.
 */

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import type { UsageResponse } from "@/lib/api/billing";

export function useBilling() {
  const { session } = useAuth();

  return useQuery<UsageResponse>({
    queryKey: ["billing", "usage"],
    queryFn: () => apiFetch<UsageResponse>("/billing/usage"),
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: !!session?.access_token,
  });
}
