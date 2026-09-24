import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

import {
  createAlert,
  fetchAlertHistory,
  fetchAlerts,
  fetchForecasts,
  fetchForecastSummary,
  fetchMorningBriefPreview,
  fetchNotificationPreferences,
  putNotificationPreferences,
  setIntelligenceMocks,
  updateAlert,
} from "../api/intelligenceApi";

describe("intelligenceApi", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    setIntelligenceMocks(false);
  });

  it("uses unversioned paths", async () => {
    apiFetch.mockResolvedValue([]);
    await fetchAlerts();
    expect(apiFetch).toHaveBeenCalledWith("/alerts");

    apiFetch.mockResolvedValue({ items: [] });
    await fetchAlertHistory();
    expect(apiFetch).toHaveBeenCalledWith("/alerts/history");

    apiFetch.mockResolvedValue({});
    await fetchNotificationPreferences();
    expect(apiFetch).toHaveBeenCalledWith("/notifications/preferences");

    await putNotificationPreferences({
      revenue_drop: { email: true, whatsapp: false, in_app: true },
      food_cost_high: { email: true, whatsapp: false, in_app: true },
      orders_low: { email: false, whatsapp: false, in_app: true },
      item_not_selling: { email: false, whatsapp: false, in_app: true },
      anomaly: { email: true, whatsapp: false, in_app: true },
    });
    expect(apiFetch).toHaveBeenCalledWith("/notifications/preferences", {
      method: "PUT",
      body: expect.any(String),
    });

    apiFetch.mockResolvedValue([]);
    await fetchForecasts();
    expect(apiFetch).toHaveBeenCalledWith("/forecasts");

    apiFetch.mockResolvedValue({ predicted_revenue_7d: 0, item_count: 0 });
    await fetchForecastSummary();
    expect(apiFetch).toHaveBeenCalledWith("/forecasts/summary");

    apiFetch.mockResolvedValue({});
    await fetchMorningBriefPreview();
    expect(apiFetch).toHaveBeenCalledWith("/morning-brief/preview");
  });

  it("updates alerts with PUT not PATCH", async () => {
    apiFetch.mockResolvedValue({ id: "1" });
    await updateAlert("1", { threshold: 5 });
    expect(apiFetch).toHaveBeenCalledWith("/alerts/1", {
      method: "PUT",
      body: JSON.stringify({ threshold: 5 }),
    });
  });

  it("creates alerts via POST /alerts", async () => {
    apiFetch.mockResolvedValue({ id: "1" });
    await createAlert({
      name: "Revenue floor",
      metric: "revenue_below_threshold",
      condition: "below",
      threshold: 10000,
      escalation_level: "daily_digest",
      channel_email: true,
      channel_whatsapp: false,
      channel_in_app: true,
    });
    expect(apiFetch).toHaveBeenCalledWith("/alerts", expect.objectContaining({ method: "POST" }));
  });
});
