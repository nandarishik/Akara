import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { MetricEvidence } from "../components/MetricEvidence";
import { FoodCostAlertCard } from "../components/Layer1Cards";
import { DaypartHeatmap } from "../components/CafeCharts";

describe("MetricEvidence", () => {
  it("renders order count and partial banner", () => {
    render(
      <MetricEvidence
        evidence={{
          order_count: 12,
          last_import_at: "2026-09-06T17:00:00Z",
          last_updated_minutes_ago: 3,
          metric_versions: { revenue: 1 },
          partial: true,
          partial_message: "Showing partial data (query timed out)",
        }}
      />,
    );
    expect(screen.getByTestId("metric-evidence").textContent).toContain("12");
    expect(screen.getByText(/partial data/i)).toBeTruthy();
  });
});

describe("FoodCostAlertCard", () => {
  it("shows dash and setup CTA when null", () => {
    render(
      <MemoryRouter>
        <FoodCostAlertCard
          metric={{
            value: null,
            unit: "percent",
            setup_cta: "expense_tracking",
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("food-cost-card").textContent).toBe("—");
    expect(screen.getByText(/Upload expenses/i)).toBeTruthy();
  });
});

describe("DaypartHeatmap", () => {
  it("renders grid", () => {
    render(
      <DaypartHeatmap
        cells={[{ daypart: "lunch", day_of_week: 1, orders: 5, revenue: 100 }]}
      />,
    );
    expect(screen.getByTestId("daypart-heatmap")).toBeTruthy();
  });
});
