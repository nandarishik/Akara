import { useQuery } from "@tanstack/react-query";

import {
  fetchActionHistory,
  fetchActionOutcomes,
  fetchActionSummary,
  fetchActions,
} from "../api/actionsApi";
import type { SortKey, TypeFilter } from "../types";

export function useActions(sort: SortKey, type: TypeFilter) {
  return useQuery({
    queryKey: ["actions", "queue", sort, type],
    queryFn: () => fetchActions({ sort, type }),
  });
}

export function useActionHistory() {
  return useQuery({
    queryKey: ["actions", "history"],
    queryFn: fetchActionHistory,
  });
}

export function useActionOutcomes() {
  return useQuery({
    queryKey: ["actions", "outcomes"],
    queryFn: fetchActionOutcomes,
  });
}

export function useActionSummary() {
  return useQuery({
    queryKey: ["actions", "summary"],
    queryFn: fetchActionSummary,
    refetchInterval: 60_000,
  });
}
