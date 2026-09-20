import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { TenantImpersonationBanner } from "@/shared/layout/TenantImpersonationBanner";

const fetchImpersonationSession = vi.fn();

vi.mock("@/lib/api", () => ({
  fetchImpersonationSession: (...args: unknown[]) => fetchImpersonationSession(...args),
}));

vi.mock("@/lib/api/superadmin", () => ({
  endImpersonationSession: vi.fn(),
}));

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("TenantImpersonationBanner", () => {
  beforeEach(() => {
    fetchImpersonationSession.mockReset();
  });

  it("renders null when inactive", async () => {
    fetchImpersonationSession.mockResolvedValue({
      active: false,
      reason: null,
      expires_at: null,
      session_id: null,
    });
    const { container } = wrap(<TenantImpersonationBanner />);
    await waitFor(() => expect(fetchImpersonationSession).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows reason when active", async () => {
    fetchImpersonationSession.mockResolvedValue({
      active: true,
      reason: "Support investigation",
      expires_at: new Date(Date.now() + 600_000).toISOString(),
      session_id: "sess-1",
    });
    wrap(<TenantImpersonationBanner />);
    await waitFor(() => {
      expect(screen.getByText(/Support investigation/i)).toBeInTheDocument();
    });
  });
});
