import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MOCK_OPEN_REC } from "../../types";
import { EvidenceDrillDown } from "../EvidenceDrillDown";

describe("EvidenceDrillDown", () => {
  it("renders four evidence types when open", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <EvidenceDrillDown evidence={MOCK_OPEN_REC.evidence} open={false} onOpenChange={onOpenChange} />,
    );
    expect(screen.getByText("4 evidence items")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show evidence" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);

    rerender(
      <EvidenceDrillDown evidence={MOCK_OPEN_REC.evidence} open onOpenChange={onOpenChange} />,
    );
    expect(screen.getByText("metric")).toBeInTheDocument();
    expect(screen.getByText("trend")).toBeInTheDocument();
    expect(screen.getByText("benchmark")).toBeInTheDocument();
    expect(screen.getByText("observation")).toBeInTheDocument();
  });
});
