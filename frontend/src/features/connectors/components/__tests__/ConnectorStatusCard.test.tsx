import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ConnectorStatusCard } from "../../components/ConnectorStatusCard";
import type { ConnectorSummary } from "../../api/types";

vi.mock("@/shared/ui/GradientButton", () => ({
  SecondaryButton: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

const base: ConnectorSummary = {
  id: "c1",
  connector_type: "petpooja",
  source_name: "Brewlab POS",
  status: "active",
  last_sync_at: "2026-09-05T08:00:00Z",
  last_sync_status: "success",
  rows_synced_last_run: 247,
  last_error: null,
  next_scheduled_sync: null,
};

describe("ConnectorStatusCard", () => {
  it("renders Active badge", () => {
    render(
      <MemoryRouter>
        <ConnectorStatusCard
          connector={base}
          onReconnect={vi.fn()}
          onDisconnect={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("connector-status-badge").textContent).toBe("Active");
  });

  it("shows Reconnect for error status", () => {
    render(
      <MemoryRouter>
        <ConnectorStatusCard
          connector={{ ...base, status: "error", last_error: "We couldn't connect to Brewlab POS." }}
          onReconnect={vi.fn()}
          onDisconnect={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Reconnect")).toBeTruthy();
    expect(screen.getByTestId("connector-status-badge").textContent).toBe("Error");
  });
});
