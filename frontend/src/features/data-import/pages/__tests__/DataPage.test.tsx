/**
 * DataPage smoke tests — render with mocked auth and billing hooks.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { DataPage } from "../DataPage";

vi.mock("@/shared/ui/GlowCTAButton", () => ({
  default: ({
    children,
    to,
  }: {
    children: React.ReactNode;
    to?: string;
  }) => (to ? <a href={to}>{children}</a> : <button type="button">{children}</button>),
}));

vi.mock("@/features/data-import/api/cafeImportApi", () => ({
  getDataQuality: vi.fn().mockRejectedValue(new Error("404")),
  getCafeFlags: vi.fn().mockResolvedValue({
    cafe_import: true,
    ai_mapping: false,
    quarantine_ui: true,
    max_upload_bytes: 50_000_000,
  }),
}));

vi.mock("@/features/auth/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "user-1", email: "test@akara.test" },
    session: {},
  })),
}));

vi.mock("@/lib/auth-utils", () => ({
  isAdmin: vi.fn(() => true),
}));

vi.mock("@/features/billing/hooks/useBilling", () => ({
  useBilling: vi.fn(() => ({
    usage: {
      plan: "pro",
      features: { secondary_sales: true },
      uploads_today: 0,
      uploads_per_day: 10,
    },
    isLoading: false,
  })),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}));

vi.mock("@/features/data-import/components/DataUploadPanel", () => ({
  DataUploadPanel: () => <div data-testid="upload-panel" />,
}));

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ jobs: [], daily_usage: [] }),
}) as unknown as typeof fetch;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DataPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("DataPage", () => {
  it("renders data management heading", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: /import center/i })).toBeInTheDocument();
  });
});
