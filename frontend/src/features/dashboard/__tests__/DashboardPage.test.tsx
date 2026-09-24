import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { DashboardPage } from "../pages/DashboardPage";

vi.mock("@/features/dashboard/hooks/useDashboardFlags", () => ({
  useDashboardFlags: () => ({ newDashboard: false, cafeMetricsV2: false, isLoading: false }),
}));

vi.mock("@/features/dashboard/hooks/useKPIs", () => ({
  useKPIs: () => ({ data: null, isLoading: false, error: null }),
}));

vi.mock("@/features/dashboard/hooks/useSalesHeatmap", () => ({
  useSalesHeatmap: () => ({ data: null, isLoading: false }),
}));

vi.mock("@/features/data-import/components/DataQualityWidget", () => ({
  DataQualityWidget: () => <div data-testid="dq" />,
}));

vi.mock("@/features/alerts/components/AlertHistoryWidget", () => ({
  AlertHistoryWidget: () => <div data-testid="alert-history" />,
}));

vi.mock("@/features/actions/components/PendingActionsMount", () => ({
  PendingActionsMount: () => <div data-testid="pending-actions" />,
}));

vi.mock("@/features/dashboard/components/DashboardEmptyState", () => ({
  DashboardEmptyState: () => <div data-testid="empty">Empty</div>,
}));

describe("DashboardPage flag-off", () => {
  it("keeps FMCG empty state when NEW_DASHBOARD false", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("empty")).toBeTruthy();
  });
});
