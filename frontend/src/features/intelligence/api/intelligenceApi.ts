import { apiFetch } from "@/lib/api";

import {
  API_PREFIX,
  type AlertCreatePayload,
  type AlertHistoryItem,
  type AlertUpdatePayload,
  type CafeAlert,
  type ForecastItem,
  type ForecastSummary,
  type MorningBriefPreview,
  type NotificationPreferences,
  type NotificationPreferencesPut,
} from "./types";

let useMocks = false;

export function setIntelligenceMocks(on: boolean): void {
  useMocks = on;
}

function path(suffix: string): string {
  return `${API_PREFIX}${suffix}`;
}

const MOCK_PREFS: NotificationPreferences = {
  revenue_drop: { email: true, whatsapp: true, in_app: true },
  food_cost_high: { email: true, whatsapp: false, in_app: true },
  orders_low: { email: false, whatsapp: false, in_app: true },
  item_not_selling: { email: false, whatsapp: false, in_app: true },
  anomaly: { email: true, whatsapp: true, in_app: true },
  whatsapp_alerts_enabled: true,
};

const MOCK_PREVIEW: MorningBriefPreview = {
  date: "2026-09-09",
  revenue_yesterday: 18000,
  revenue_same_day_lw: 15000,
  revenue_wow_pct: 20,
  food_cost_ratio: 0.28,
  food_cost_alert: false,
  top_items: [{ item_name: "Filter Coffee", total_revenue: 2400, total_qty: 80 }],
  forecast_tomorrow: {
    predicted_revenue_tomorrow: 21000,
    busy_day_pct: 16.67,
    available: true,
  },
  weather: {
    temp_max_c: 29,
    precipitation_mm: 0,
    weather_code: 1,
    is_rainy: false,
    attribution: "Weather data from Open-Meteo (CC BY 4.0)",
  },
  forecast_unavailable_reason: null,
};

export async function fetchAlerts(): Promise<CafeAlert[]> {
  if (useMocks) return [];
  return apiFetch<CafeAlert[]>(path("/alerts"));
}

export async function createAlert(payload: AlertCreatePayload): Promise<CafeAlert> {
  if (useMocks) {
    return {
      id: "mock-alert",
      name: payload.name,
      metric: payload.metric,
      condition: payload.condition,
      threshold: payload.threshold,
      dimension: null,
      delivery: ["email"],
      cooldown_hours: 24,
      is_active: true,
      last_triggered: null,
      escalation_level: payload.escalation_level,
      channel_email: payload.channel_email,
      channel_whatsapp: payload.channel_whatsapp,
      channel_in_app: payload.channel_in_app,
    };
  }
  return apiFetch<CafeAlert>(path("/alerts"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAlert(id: string, payload: AlertUpdatePayload): Promise<CafeAlert> {
  if (useMocks) {
    return {
      id,
      name: payload.name ?? "Alert",
      metric: "revenue_below_threshold",
      condition: "below",
      threshold: payload.threshold ?? 0,
      dimension: null,
      delivery: ["email"],
      cooldown_hours: 24,
      is_active: payload.is_active ?? true,
      last_triggered: null,
      escalation_level: payload.escalation_level,
    };
  }
  // Frozen contract is PUT. PATCH remains a server alias; do not call it from this client.
  return apiFetch<CafeAlert>(path(`/alerts/${id}`), {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAlert(id: string): Promise<void> {
  if (useMocks) return;
  await apiFetch<void>(path(`/alerts/${id}`), { method: "DELETE" });
}

export async function fetchAlertHistory(): Promise<AlertHistoryItem[]> {
  if (useMocks) return [];
  const data = await apiFetch<{ items: AlertHistoryItem[] }>(path("/alerts/history"));
  return data.items ?? [];
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  if (useMocks) return MOCK_PREFS;
  return apiFetch<NotificationPreferences>(path("/notifications/preferences"));
}

export async function putNotificationPreferences(
  body: NotificationPreferencesPut,
): Promise<NotificationPreferences> {
  if (useMocks) return { ...MOCK_PREFS, ...body };
  return apiFetch<NotificationPreferences>(path("/notifications/preferences"), {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function fetchForecasts(): Promise<ForecastItem[]> {
  if (useMocks) return [];
  return apiFetch<ForecastItem[]>(path("/forecasts"));
}

export async function fetchForecastSummary(): Promise<ForecastSummary> {
  if (useMocks) return { predicted_revenue_7d: 0, item_count: 0 };
  return apiFetch<ForecastSummary>(path("/forecasts/summary"));
}

export async function fetchMorningBriefPreview(): Promise<MorningBriefPreview> {
  if (useMocks) return MOCK_PREVIEW;
  return apiFetch<MorningBriefPreview>(path("/morning-brief/preview"));
}
