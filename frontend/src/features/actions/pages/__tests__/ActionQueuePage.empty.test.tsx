import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_QUEUE_COPY } from "../../types";
import { ActionQueuePage } from "../ActionQueuePage";

vi.mock("../../hooks/useActions", () => ({
  useActions: () => ({
    data: { items: [], open_count: 0 },
    isLoading: false,
    error: null,
  }),
  useActionHistory: () => ({ data: { items: [] }, isLoading: false, error: null }),
  useActionOutcomes: () => ({ data: { items: [] }, isLoading: false, error: null }),
}));

vi.mock("../../hooks/useActionMutations", () => ({
  useActionMutations: () => ({
    accept: { mutate: vi.fn() },
    snooze: { mutate: vi.fn() },
    reject: { mutate: vi.fn() },
  }),
}));

describe("ActionQueuePage empty", () => {
  it("shows frozen empty copy", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ActionQueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText(EMPTY_QUEUE_COPY)).toBeInTheDocument();
  });
});
