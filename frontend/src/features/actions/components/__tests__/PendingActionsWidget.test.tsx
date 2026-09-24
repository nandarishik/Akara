import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { MOCK_SUMMARY } from "../../types";
import { PendingActionsWidget } from "../PendingActionsWidget";

describe("PendingActionsWidget", () => {
  it("shows open count and CTA", () => {
    render(
      <MemoryRouter>
        <PendingActionsWidget summary={MOCK_SUMMARY} loading={false} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Pending actions")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review all recommendations/i })).toHaveAttribute(
      "href",
      "/actions",
    );
  });
});
