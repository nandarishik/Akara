import { apiFetch } from "@/lib/api";

import {
  API_PREFIX,
  MOCK_OPEN_REC,
  MOCK_OUTCOME_REC,
  MOCK_SUMMARY,
  type ActionsItemsResponse,
  type ActionsListResponse,
  type ActionsSummary,
  type RecommendationResponse,
  type SortKey,
  type TypeFilter,
} from "../types";

let useMocks = false;

export function setActionsMocks(on: boolean): void {
  useMocks = on;
}

function path(suffix: string): string {
  return `${API_PREFIX}${suffix}`;
}

export async function fetchActions(opts?: {
  sort?: SortKey;
  type?: TypeFilter;
}): Promise<ActionsListResponse> {
  if (useMocks) {
    return { items: [MOCK_OPEN_REC], open_count: 1 };
  }
  const params = new URLSearchParams();
  if (opts?.sort) params.set("sort", opts.sort);
  if (opts?.type && opts.type !== "all") params.set("type", opts.type);
  const qs = params.toString();
  return apiFetch<ActionsListResponse>(path(qs ? `/actions?${qs}` : "/actions"));
}

export async function fetchAction(id: string): Promise<RecommendationResponse> {
  if (useMocks) {
    return id === MOCK_OPEN_REC.id ? MOCK_OPEN_REC : MOCK_OPEN_REC;
  }
  return apiFetch<RecommendationResponse>(path(`/actions/${id}`));
}

export async function fetchActionHistory(): Promise<ActionsItemsResponse> {
  if (useMocks) {
    return { items: [{ ...MOCK_OPEN_REC, status: "rejected", reject_reason: "Already done this" }] };
  }
  return apiFetch<ActionsItemsResponse>(path("/actions/history"));
}

export async function fetchActionOutcomes(): Promise<ActionsItemsResponse> {
  if (useMocks) {
    return { items: [MOCK_OUTCOME_REC] };
  }
  return apiFetch<ActionsItemsResponse>(path("/actions/outcomes"));
}

export async function fetchActionSummary(): Promise<ActionsSummary> {
  if (useMocks) return MOCK_SUMMARY;
  return apiFetch<ActionsSummary>(path("/actions/summary"));
}

export async function acceptAction(
  id: string,
  notes: string | null,
): Promise<RecommendationResponse> {
  if (useMocks) {
    return { ...MOCK_OPEN_REC, id, status: "watching" };
  }
  return apiFetch<RecommendationResponse>(path(`/actions/${id}/accept`), {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export async function snoozeAction(
  id: string,
  days: number,
  reason: string | null,
): Promise<RecommendationResponse> {
  if (useMocks) {
    return { ...MOCK_OPEN_REC, id, status: "snoozed" };
  }
  return apiFetch<RecommendationResponse>(path(`/actions/${id}/snooze`), {
    method: "POST",
    body: JSON.stringify({ reason, days }),
  });
}

export async function rejectAction(id: string, reason: string): Promise<RecommendationResponse> {
  if (useMocks) {
    return { ...MOCK_OPEN_REC, id, status: "rejected", reject_reason: reason };
  }
  return apiFetch<RecommendationResponse>(path(`/actions/${id}/reject`), {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function mutationErrorMessage(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const match = raw.match(/API (\d+)/);
  const status = match ? Number(match[1]) : 0;
  if (status === 403) {
    return {
      status,
      message: "You need to be a workspace admin to accept or reject recommendations.",
    };
  }
  if (status === 404) {
    return { status, message: "This recommendation is no longer available." };
  }
  if (status === 422) {
    return { status, message: "A reject reason is required (at least 3 characters)." };
  }
  return { status, message: raw || "Something went wrong." };
}
