import React from "react"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { OnboardingPage } from "../OnboardingPage"

vi.mock("@/features/auth/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    session: { access_token: "token", user: { email: "owner@cafe.test" } },
    refreshProfile: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock("@/features/onboarding/hooks/useImportJobPoller", () => ({
  useImportJobPoller: vi.fn(() => ({ result: null, error: null })),
}))

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({}),
}) as unknown as typeof fetch

describe("OnboardingPage", () => {
  it("renders workspace setup step with skip link", () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole("heading", { name: /set up your workspace/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /skip for now/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/workspace name/i)).toBeInTheDocument()
  })
})
