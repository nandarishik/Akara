import React from "react"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi, beforeEach } from "vitest"

import { TeamPage } from "../TeamPage"
import { useAuth } from "@/features/auth/contexts/AuthContext"

vi.mock("@/features/auth/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}))

vi.mock("@/features/billing/hooks/useBilling", () => ({
  useBilling: vi.fn(() => ({
    data: {
      users_limit: 5,
      features: { team_invites: true },
    },
    isLoading: false,
  })),
}))

vi.mock("@/features/billing/components/PlanGate", () => ({
  PlanGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/features/team/components/TeamSeatVisualizer", () => ({
  default: () => <div data-testid="seat-visualizer" />,
  buildSeatSlots: vi.fn(() => []),
}))

describe("TeamPage", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { apiFetch } = await import("@/lib/api")
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path === "/auth/me") return { max_seats: 5 }
      if (path === "/team/members") {
        return [
          {
            id: "1",
            email: "owner@cafe.test",
            display_name: "Owner",
            role: "owner",
            membership_status: "active",
          },
          {
            id: "2",
            email: "viewer@cafe.test",
            display_name: "Viewer",
            role: "user",
            membership_status: "active",
          },
        ]
      }
      if (path === "/team/invites") return []
      return []
    })
  })

  it("hides invite controls for viewers", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "2", role: "user", email: "viewer@cafe.test", tenantId: "t1" },
      session: { user: { user_metadata: { role: "user" } } } as never,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    })

    render(
      <MemoryRouter>
        <TeamPage embedded />
      </MemoryRouter>,
    )

    expect(await screen.findByRole("heading", { name: /members/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /invite teammate/i })).not.toBeInTheDocument()
  })

  it("shows invite for admins and no role select on owner row", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "1", role: "admin", email: "admin@cafe.test", tenantId: "t1" },
      session: { user: { user_metadata: { role: "admin" } } } as never,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    })

    render(
      <MemoryRouter>
        <TeamPage embedded />
      </MemoryRouter>,
    )

    expect(await screen.findByRole("button", { name: /invite teammate/i })).toBeInTheDocument()
    const ownerBadges = await screen.findAllByText("Owner")
    expect(ownerBadges.length).toBeGreaterThan(0)
    expect(screen.queryByDisplayValue("owner")).not.toBeInTheDocument()
  })
})
