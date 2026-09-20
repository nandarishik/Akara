import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { MappingConfirmStep } from "../MappingConfirmStep";

vi.mock("@/shared/ui/GlowCTAButton", () => ({
  default: ({
    children,
    disabled,
    onClick,
    ...rest
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock("@/features/data-import/api/cafeImportApi", () => ({
  getMappingProposal: vi.fn(),
  confirmMapping: vi.fn(),
}));

import { confirmMapping, getMappingProposal } from "@/features/data-import/api/cafeImportApi";

const proposal = {
  import_id: "imp-1",
  import_type: "cafe_orders" as const,
  status: "mapping_proposed",
  ai_mapping_used: false,
  ai_mapping_confidence: null,
  columns: [
    {
      raw_column: "Order Time",
      canonical_field: "order_time",
      confidence: 0.98,
      band: "accepted" as const,
      sample_values: ["2026-09-01"],
    },
    {
      raw_column: "Bill Amt",
      canonical_field: "total_amount",
      confidence: 0.8,
      band: "suggested" as const,
      sample_values: ["120"],
    },
    {
      raw_column: "Notes",
      canonical_field: null,
      confidence: 0.68,
      band: "uncertain" as const,
      sample_values: ["x"],
    },
  ],
  required_fields: ["order_time", "total_amount"],
  unmapped_required: [],
};

describe("MappingConfirmStep", () => {
  beforeEach(() => {
    vi.mocked(getMappingProposal).mockResolvedValue(proposal);
    vi.mocked(confirmMapping).mockResolvedValue({
      import_id: "imp-1",
      status: "mapping_confirmed",
    });
  });

  it("disables confirm while a required field is unmapped", async () => {
    vi.mocked(getMappingProposal).mockResolvedValue({
      ...proposal,
      columns: proposal.columns.map((c) =>
        c.canonical_field === "total_amount"
          ? { ...c, canonical_field: null, band: "unmapped", confidence: null }
          : c,
      ),
      unmapped_required: ["total_amount"],
    });

    render(
      <MemoryRouter>
        <MappingConfirmStep importId="imp-1" onConfirmed={() => undefined} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("mapping-confirm")).toBeDisabled());
    expect(screen.getByText(/uncertain/i)).toBeTruthy();
  });

  it("labels 0.68 band as uncertain", async () => {
    render(
      <MemoryRouter>
        <MappingConfirmStep importId="imp-1" onConfirmed={() => undefined} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/\(uncertain\)/)).toBeTruthy());
  });

  it("calls confirmMapping when enabled", async () => {
    const onConfirmed = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MappingConfirmStep importId="imp-1" onConfirmed={onConfirmed} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId("mapping-confirm")).not.toBeDisabled());
    await user.click(screen.getByTestId("mapping-confirm"));
    await waitFor(() => expect(confirmMapping).toHaveBeenCalled());
    expect(onConfirmed).toHaveBeenCalled();
  });
});
