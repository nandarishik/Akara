import React, { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useConnectorsEnabled } from "../../hooks/useConnectorsEnabled";

vi.mock("../../api/connectorsApi", () => ({
  getSystemSettings: vi.fn().mockResolvedValue({
    maintenance_mode: false,
    signup_open: true,
    connectors_enabled: false,
  }),
}));

function wrap(children: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useConnectorsEnabled", () => {
  it("hides nav when connectors_enabled is false", async () => {
    const { result } = renderHook(() => useConnectorsEnabled(), {
      wrapper: ({ children }) => wrap(children),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.enabled).toBe(false);
  });
});
