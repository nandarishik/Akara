import { apiFetch } from "@/lib/api";

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

const METRIC_LABELS: Record<string, string> = {
  secondary_sales_total: "Secondary sales total",
  primary_sales_total: "Primary sales total",
  outstanding_amount: "Outstanding amount",
  beat_adherence_pct: "Beat adherence %",
};

export function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] ?? metric;
}

export async function fetchAlerts(): Promise<AlertSummary[]> {
  return apiFetch<AlertSummary[]>("/alerts");
}

export async function createAlert(payload: AlertCreatePayload): Promise<AlertSummary> {
  return apiFetch<AlertSummary>("/alerts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAlert(
  id: string,
  patch: Partial<Pick<AlertSummary, "name" | "threshold" | "is_active">>
): Promise<AlertSummary> {
  return apiFetch<AlertSummary>(`/alerts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteAlert(id: string): Promise<void> {
  await apiFetch<void>(`/alerts/${id}`, { method: "DELETE" });
}
