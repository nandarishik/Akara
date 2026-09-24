import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AlertSettingsPage } from "@/features/alerts/pages/AlertSettingsPage";
import { METRIC_LABELS } from "../api/types";

vi.mock("@/features/billing/hooks/useBilling", () => ({
  useBilling: () => ({
    data: {
      plan: "pro",
      features: { alerts: true, morning_brief: true },
    },
    isLoading: false,
  }),
}));

vi.mock("@/features/billing/components/PlanGate", () => ({
  PlanGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/shared/ui/GlowCTAButton", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/features/intelligence/api/intelligenceApi", () => ({
  fetchAlerts: vi.fn().mockResolvedValue([]),
  createAlert: vi.fn(),
  updateAlert: vi.fn(),
  deleteAlert: vi.fn(),
}));

describe("AlertSettingsPage", () => {
  it("exposes all five café metric labels (AC-P10-010)", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <AlertSettingsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const text = document.body.textContent ?? "";
    for (const label of Object.values(METRIC_LABELS)) {
      expect(text).toContain(label);
    }
  });
});
