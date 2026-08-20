/**
 * DashboardPage smoke tests â€” render with mocked data hooks.
 */

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { DashboardPage } from "../DashboardPage";

vi.mock("@/features/dashboard/hooks/useKPIs", () => ({
  useKPIs: vi.fn(() => ({
    data: null,
    isLoading: true,
    error: null,
    refetch: vi.fn(),
  })),
}));

vi.mock("@/features/dashboard/hooks/useSalesHeatmap", () => ({
  useSalesHeatmap: vi.fn(() => ({ data: null, isLoading: false })),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}));

vi.mock("@/features/dashboard/components/RevenueTrendChart", () => ({
  RevenueTrendChart: () => <div data-testid="revenue-chart" />,
}));

vi.mock("@/features/dashboard/components/ZoneChart", () => ({
  ZoneChart: () => <div data-testid="zone-chart" />,
}));

vi.mock("@/shared/charts/composed/akara/ProductZoneMatrix", () => ({
  ProductZoneMatrix: () => <div data-testid="product-zone-matrix" />,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("DashboardPage", () => {
  it("renders page heading while loading", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
  });
});
