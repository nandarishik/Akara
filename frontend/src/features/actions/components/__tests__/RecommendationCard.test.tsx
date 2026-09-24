import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MOCK_LIMITED_REC, MOCK_OPEN_REC } from "../../types";
import { RecommendationCard } from "../RecommendationCard";

describe("RecommendationCard", () => {
  it("renders frozen fields and no auto-apply chrome", () => {
    render(
      <RecommendationCard
        rec={MOCK_OPEN_REC}
        onAccept={vi.fn()}
        onSnooze={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText("Raise Cold Brew price by ₹10")).toBeInTheDocument();
    expect(screen.getByText("Pricing")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
    expect(screen.getByText("45 days of data")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Snooze" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.queryByText(/auto-apply/i)).toBeNull();
    expect(screen.queryByText(/execute/i)).toBeNull();
  });

  it("shows uncertainty badge on limited data", () => {
    render(
      <RecommendationCard
        rec={MOCK_LIMITED_REC}
        onAccept={vi.fn()}
        onSnooze={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText("Limited data")).toBeInTheDocument();
  });
});
