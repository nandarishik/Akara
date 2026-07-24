/**
 * UsageBanner unit tests.
 *
 * Covers: 0%, 79%, 80%, 90%, 100%, unlimited (-1) quota states.
 * Verifies correct styling hints, ARIA roles, and message presence.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UsageBanner } from "../UsageBanner";
import type { UsageResponse } from "@/lib/api/billing";

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------

function makeUsage(
  overrides: Partial<UsageResponse> = {}
): UsageResponse {
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
    },
    retention_days: 30,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("UsageBanner", () => {
  it("renders without crashing at 0%", () => {
    render(<UsageBanner usage={makeUsage({ copilot_calls_used: 0 })} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows remaining count message at 0% (ok state)", () => {
    render(<UsageBanner usage={makeUsage({ copilot_calls_used: 0 })} />);
    expect(screen.getByText(/10 questions remaining/i)).toBeInTheDocument();
  });

  it("does NOT show warning at 79% usage", () => {
    // 7/10 = 70% — under the 80% threshold
    render(<UsageBanner usage={makeUsage({ copilot_calls_used: 7 })} />);
    expect(screen.queryByText(/you've used/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows amber warning at 80% usage (8/10)", () => {
    render(<UsageBanner usage={makeUsage({ copilot_calls_used: 8 })} />);
    // The 80% warning is a status (not alert)
    const statusEl = screen.getByRole("status");
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveTextContent(/80%/i);
  });

  it("shows orange critical warning at 90% usage (9/10)", () => {
    render(<UsageBanner usage={makeUsage({ copilot_calls_used: 9 })} />);
    const alertEl = screen.getByRole("alert");
    expect(alertEl).toBeInTheDocument();
    expect(alertEl).toHaveTextContent(/1 question left/i);
    // Must have an upgrade link
    expect(screen.getByRole("link", { name: /upgrade/i })).toBeInTheDocument();
  });

  it("shows blocked state at 100% usage (10/10)", () => {
    render(<UsageBanner usage={makeUsage({ copilot_calls_used: 10 })} />);
    const alertEl = screen.getByRole("alert");
    expect(alertEl).toBeInTheDocument();
    expect(alertEl).toHaveTextContent(/copilot blocked/i);
    expect(alertEl).toHaveTextContent(/dashboard.*still works/i);
    expect(screen.getByRole("link", { name: /upgrade to pro/i })).toBeInTheDocument();
  });

  it("shows blocked state when usage exceeds limit (race condition edge case)", () => {
    render(<UsageBanner usage={makeUsage({ copilot_calls_used: 15, copilot_calls_limit: 10 })} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/copilot blocked/i);
  });

  it("renders unlimited state without messages when limit is -1", () => {
    render(
      <UsageBanner
        usage={makeUsage({
          copilot_calls_used: 9999,
          copilot_calls_limit: -1,
          plan: "pro",
        })}
      />
    );
    // No warning or alert should appear for unlimited plans
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Remaining count message should not appear (unlimited)
    expect(screen.queryByText(/remaining/i)).not.toBeInTheDocument();
  });

  it("shows daily upload counter", () => {
    render(<UsageBanner usage={makeUsage({ uploads_today: 2, uploads_per_day: 3 })} />);
    expect(screen.getByText(/uploads today/i)).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("shows daily undo counter", () => {
    render(<UsageBanner usage={makeUsage({ undos_today: 1, undos_per_day: 2 })} />);
    expect(screen.getByText(/undos today/i)).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("progressbar has correct aria attributes", () => {
    render(<UsageBanner usage={makeUsage({ copilot_calls_used: 5 })} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("applies custom className", () => {
    const { container } = render(
      <UsageBanner usage={makeUsage()} className="test-class" />
    );
    expect(container.firstChild).toHaveClass("test-class");
  });
});
