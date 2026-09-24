import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MorningBriefPreview } from "@/features/settings/components/MorningBriefPreview";
import type { MorningBriefPreview as Preview } from "../api/types";

const base: Preview = {
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

describe("MorningBriefPreview", () => {
  it("renders rain copy", () => {
    render(
      <MorningBriefPreview
        data={{
          ...base,
          weather: { ...base.weather!, precipitation_mm: 20, is_rainy: true },
        }}
      />,
    );
    expect(screen.getByText(/rain/i)).toBeTruthy();
  });

  it("omits weather when null", () => {
    render(<MorningBriefPreview data={{ ...base, weather: null }} />);
    expect(screen.queryByText(/Open-Meteo/i)).toBeNull();
  });

  it("shows forecast unavailable reason", () => {
    render(
      <MorningBriefPreview
        data={{
          ...base,
          forecast_tomorrow: null,
          forecast_unavailable_reason: "Forecast not yet available — need 14+ days of data",
        }}
      />,
    );
    expect(screen.getByText(/need 14\+ days/i)).toBeTruthy();
  });
});
