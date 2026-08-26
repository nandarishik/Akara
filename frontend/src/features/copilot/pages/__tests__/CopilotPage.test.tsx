/**
 * CopilotPage smoke tests — render with mocked chat hooks.
 */

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { CopilotPage } from "../CopilotPage";

vi.mock("@/features/copilot/hooks/useCopilot", () => ({
  useCopilot: vi.fn(() => ({
    messages: [],
    isStreaming: false,
    conversationId: null,
    sendMessage: vi.fn(),
    loadConversation: vi.fn(),
    startNewConversation: vi.fn(),
    error: null,
  })),
}));

vi.mock("@/features/copilot/hooks/useConversations", () => ({
  useConversations: vi.fn(() => ({
    conversations: [],
    loading: false,
    refetch: vi.fn(),
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    renameConversation: vi.fn(),
  })),
}));

vi.mock("@/features/billing/hooks/useBilling", () => ({
  useBilling: vi.fn(() => ({
    usage: {
      copilot_calls_used: 0,
      copilot_calls_limit: 10,
      plan: "free",
    },
    isLoading: false,
  })),
}));

vi.mock("@/features/copilot/components/CopilotStrandsLoader", () => ({
  default: () => <div data-testid="strands-loader" />,
}));

vi.mock("@/shared/ui/GlowCTAButton", () => ({
  default: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock("@/shared/layout/MobileNavContext", () => ({
  useMobileNav: vi.fn(() => ({ setHidden: vi.fn() })),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CopilotPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CopilotPage", () => {
  it("renders copilot heading and suggested prompts", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /akara copilot/i })).toBeInTheDocument();
    expect(screen.getByText(/show me top routes by revenue/i)).toBeInTheDocument();
  });
});
