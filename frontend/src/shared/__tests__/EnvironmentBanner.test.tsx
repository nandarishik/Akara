/**
 * EnvironmentBanner — production hide / staging show (Phase 3)
 */

import React from "react"
import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { EnvironmentBanner } from "../EnvironmentBanner"

describe("EnvironmentBanner", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("test_environment_banner_hidden_in_production", () => {
    vi.stubEnv("VITE_ENVIRONMENT", "production")
    const { container } = render(<EnvironmentBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it("test_environment_banner_shows_staging", () => {
    vi.stubEnv("VITE_ENVIRONMENT", "staging")
    render(<EnvironmentBanner />)
    expect(
      screen.getByText("STAGING — Not production. Data is synthetic."),
    ).toBeInTheDocument()
  })
})
