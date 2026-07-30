/**
 * UsageBanner unit tests — copilot quota strip only.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { UsageBanner } from "../UsageBanner";
import type { UsageResponse } from "@/lib/api/billing";

function makeUsage(overrides: Partial<UsageResponse> = {}): UsageResponse {
  return {
    plan: "free",
    plan_status: "active",
    copilot_calls_used: 0,
    copilot_calls_limit: 10,
    rows_used: 0,
    rows_limit: 10_000,
    uploads_used: 0,
    uploads_limit: 5,
    uploads_today: 0,
    uploads_per_day: 3,
    undos_today: 0,
    undos_per_day: 2,
    users_used: 1,
    users_limit: 1,
    debrief_count_used: 0,
    debrief_lifetime_limit: 3,
    features: {
      morning_brief: false,
      scheme_leakage: false,
      simulator: false,
      reports: false,
      custom_language: false,
      secondary_sales: false,
      api_push: false,
      tally_connector: false,
      team_invites: false,
      api_keys: false,
      ask_copilot_debrief: false,
      alerts: false,
    },
    retention_days: 30,
    ...overrides,
  };
}

function renderBanner(usage: UsageResponse, className?: string) {
  return render(
    <MemoryRouter>
      <UsageBanner usage={usage} className={className} />
    </MemoryRouter>
  );
}

describe("UsageBanner", () => {
  it("renders progress bar at 0%", () => {
    renderBanner(makeUsage({ copilot_calls_used: 0 }));
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText(/10 left/i)).toBeInTheDocument();
  });

  it("does not show warning below 80%", () => {
    renderBanner(makeUsage({ copilot_calls_used: 7 }));
    expect(screen.queryByText(/80%/i)).not.toBeInTheDocument();
  });

  it("shows amber warning at 80% (8/10)", () => {
    renderBanner(makeUsage({ copilot_calls_used: 8 }));
    expect(screen.getByText(/80% used/i)).toBeInTheDocument();
  });

  it("shows critical state at 90% (9/10) with upgrade link", () => {
    renderBanner(makeUsage({ copilot_calls_used: 9 }));
    expect(screen.getByText(/1 left/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upgrade/i })).toBeInTheDocument();
  });

  it("shows blocked state at 100% (10/10)", () => {
    renderBanner(makeUsage({ copilot_calls_used: 10 }));
    expect(screen.getByText(/copilot blocked/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upgrade to pro/i })).toBeInTheDocument();
  });

  it("renders unlimited plan without remaining message", () => {
    renderBanner(
      makeUsage({ copilot_calls_used: 9999, copilot_calls_limit: -1, plan: "pro" })
    );
    expect(screen.getByText(/∞/)).toBeInTheDocument();
    expect(screen.queryByText(/left · resets/i)).not.toBeInTheDocument();
  });

  it("progressbar has correct aria attributes", () => {
    renderBanner(makeUsage({ copilot_calls_used: 5 }));
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("applies custom className", () => {
    const { container } = renderBanner(makeUsage(), "test-class");
    expect(container.firstChild).toHaveClass("test-class");
  });
});
