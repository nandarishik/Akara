import { apiFetch } from "@/lib/api";
import {
  METRIC_LABELS,
  type CafeMetric,
} from "@/features/intelligence/api/types";
import {
  createAlert as createCafeAlert,
  deleteAlert as deleteCafeAlert,
  fetchAlerts as fetchCafeAlerts,
  updateAlert as updateCafeAlert,
} from "@/features/intelligence/api/intelligenceApi";

export type AlertSummary = {
  id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  dimension: string | null;
  delivery: string[];
  cooldown_hours: number;
  is_active: boolean;
  last_triggered: string | null;
};

export type AlertCreatePayload = {
  name: string;
  metric: string;
  condition: "below" | "above" | "equals";
  threshold: number;
  dimension?: string | null;
};

export function metricLabel(metric: string): string {
  return METRIC_LABELS[metric as CafeMetric] ?? metric;
}

export async function fetchAlerts(): Promise<AlertSummary[]> {
  return fetchCafeAlerts();
}

export async function createAlert(payload: AlertCreatePayload): Promise<AlertSummary> {
  return createCafeAlert({
    name: payload.name,
    metric: payload.metric as CafeMetric,
    condition: payload.condition,
    threshold: payload.threshold,
    escalation_level: "daily_digest",
    channel_email: true,
    channel_whatsapp: false,
    channel_in_app: true,
  });
}

export async function updateAlert(
  id: string,
  patch: Partial<Pick<AlertSummary, "name" | "threshold" | "is_active">>,
): Promise<AlertSummary> {
  return updateCafeAlert(id, patch);
}

export async function deleteAlert(id: string): Promise<void> {
  await deleteCafeAlert(id);
}

/** @deprecated Prefer intelligenceApi.updateAlert (PUT). Kept for type imports. */
export async function patchAlertLegacy(
  id: string,
  patch: Partial<Pick<AlertSummary, "name" | "threshold" | "is_active">>,
): Promise<AlertSummary> {
  return apiFetch<AlertSummary>(`/alerts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
