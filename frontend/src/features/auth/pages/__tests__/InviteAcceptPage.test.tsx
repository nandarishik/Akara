import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it, vi, beforeEach } from "vitest"

import { InviteAcceptPage } from "../InviteAcceptPage"

const mockSignOut = vi.fn().mockResolvedValue(undefined)
const mockRefreshProfile = vi.fn().mockResolvedValue(undefined)

vi.mock("@/features/auth/contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    session: null,
    user: null,
    signOut: mockSignOut,
    refreshProfile: mockRefreshProfile,
  })),
}))

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}))

vi.mock("@/lib/teamInvite", () => ({
  persistInviteTokenFromSearch: vi.fn(() => "test-token"),
  clearInviteToken: vi.fn(),
  INVITE_TOKEN_KEY: "akara_team_invite_token",
}))

function renderPage(search = "?token=test-token") {
  return render(
    <MemoryRouter initialEntries={[`/invite/accept${search}`]}>
      <Routes>
        <Route path="/invite/accept" element={<InviteAcceptPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("InviteAcceptPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test")
  })

  it("renders expired state on 410", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 410,
      ok: false,
    }) as unknown as typeof fetch

    renderPage()
    expect(await screen.findByText(/invite link has expired/i)).toBeInTheDocument()
  })

  it("renders login CTAs when not logged in", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        email: "invitee@company.com",
        role: "user",
        workspace_name: "Acme Café",
        invited_by_name: "Admin User",
      }),
    }) as unknown as typeof fetch

    renderPage()
    expect(await screen.findByText(/Acme Café/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /sign in to accept/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /create account/i })).toBeInTheDocument()
  })

  it("renders join button when logged in with matching email", async () => {
    const { useAuth } = await import("@/features/auth/contexts/AuthContext")
    vi.mocked(useAuth).mockReturnValue({
      session: { user: { email: "invitee@company.com" } } as never,
      user: { email: "invitee@company.com" } as never,
      signOut: mockSignOut,
      refreshProfile: mockRefreshProfile,
    } as never)

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        email: "invitee@company.com",
        role: "user",
        workspace_name: "Acme Café",
        invited_by_name: "Admin User",
      }),
    }) as unknown as typeof fetch

    renderPage()
    expect(await screen.findByRole("button", { name: /join workspace/i })).toBeInTheDocument()
  })

  it("shows email mismatch when logged in with wrong email", async () => {
    const { useAuth } = await import("@/features/auth/contexts/AuthContext")
    vi.mocked(useAuth).mockReturnValue({
      session: { user: { email: "other@company.com" } } as never,
      user: { email: "other@company.com" } as never,
      signOut: mockSignOut,
      refreshProfile: mockRefreshProfile,
    } as never)

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        email: "invitee@company.com",
        role: "user",
        workspace_name: "Acme Café",
        invited_by_name: "Admin User",
      }),
    }) as unknown as typeof fetch

    renderPage()
    expect(await screen.findByText(/sent to invitee@company.com/i)).toBeInTheDocument()
  })

  it("shows success after successful join", async () => {
    const { useAuth } = await import("@/features/auth/contexts/AuthContext")
    vi.mocked(useAuth).mockReturnValue({
      session: { user: { email: "invitee@company.com" } } as never,
      user: { email: "invitee@company.com" } as never,
      signOut: mockSignOut,
      refreshProfile: mockRefreshProfile,
    } as never)

    const { apiFetch } = await import("@/lib/api")
    vi.mocked(apiFetch).mockResolvedValue({ joined: true, tenant_id: "t-1" })

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        email: "invitee@company.com",
        role: "user",
        workspace_name: "Acme Café",
        invited_by_name: "Admin User",
      }),
    }) as unknown as typeof fetch

    renderPage()

    const joinBtn = await screen.findByRole("button", { name: /join workspace/i })
    joinBtn.click()

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/team/invite/accept", {
        method: "POST",
        body: JSON.stringify({ token: "test-token" }),
      })
    })

    expect(await screen.findByText(/redirecting to your dashboard/i)).toBeInTheDocument()
  })
})
