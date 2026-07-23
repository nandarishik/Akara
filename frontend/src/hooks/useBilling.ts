/**
 * useBilling — React Query hook for GET /billing/usage.
 *
 * Provides the current tenant's plan, quota counters, and feature flags.
 * Cached for 60 seconds so every page load doesn't hit the API.
 *
 * Usage:
 *   const { data, isLoading } = useBilling();
 *   if (data?.plan_status === 'past_due') return <PastDueBanner />;
 */

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { UsageResponse } from "@/lib/api/billing";

export function useBilling() {
  return useQuery<UsageResponse>({
    queryKey: ["billing", "usage"],
    queryFn: () => apiFetch<UsageResponse>("/billing/usage"),
    staleTime: 1000 * 60,        // 60 s — limits don't change mid-session
    refetchOnWindowFocus: false,  // avoid refetch on every tab switch
    retry: 1,                    // one retry on transient failures
  });
}
