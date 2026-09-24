import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { MOCK_OPEN_REC } from "../../types";
import { ActionQueuePage } from "../ActionQueuePage";

vi.mock("../../hooks/useActions", () => ({
  useActions: () => ({
    data: { items: [MOCK_OPEN_REC], open_count: 1 },
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

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/actions"]}>
        <ActionQueuePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ActionQueuePage", () => {
  it("renders the open recommendation and filter chrome", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Actions" })).toBeInTheDocument();
    expect(screen.getByText("Raise Cold Brew price by ₹10")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by type")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort recommendations")).toBeInTheDocument();
  });
});
