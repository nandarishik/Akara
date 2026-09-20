import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { ReconciliationStep } from "../ReconciliationStep";

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

vi.mock("@/shared/ui/GradientButton", () => ({
  SecondaryButton: ({
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
  getReconciliation: vi.fn(),
  confirmReconciliation: vi.fn(),
  undoImport: vi.fn(),
}));

import {
  confirmReconciliation,
  getReconciliation,
  undoImport,
} from "@/features/data-import/api/cafeImportApi";

const recon = {
  import_id: "imp-1",
  order_count: 10,
  total_amount: 1000,
  currency: "INR",
  date_range_start: "2026-09-01T00:00:00Z",
  date_range_end: "2026-09-02T00:00:00Z",
  span_days: 2,
  span_alert: false,
  channels: [{ channel: "dine-in", order_count: 10, total_amount: 1000, pct: 100 }],
  quarantine_row_count: 0,
  top_failure_types: [],
  totals_delta_pct: 0,
  totals_flag: false,
  reconciliation_confirmed: false,
  reconciliation_notes: null,
};

describe("ReconciliationStep", () => {
  beforeEach(() => {
    vi.mocked(getReconciliation).mockResolvedValue(recon);
    vi.mocked(confirmReconciliation).mockResolvedValue(recon);
    vi.mocked(undoImport).mockResolvedValue(undefined);
  });

  it("Yes calls confirm accepted", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReconciliationStep importId="imp-1" onDone={() => undefined} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId("recon-yes")).toBeTruthy());
    await user.click(screen.getByTestId("recon-yes"));
    await waitFor(() =>
      expect(confirmReconciliation).toHaveBeenCalledWith("imp-1", {
        accepted: true,
        notes: null,
      }),
    );
  });

  it("No+undo calls undo path", async () => {
    const user = userEvent.setup();
    vi.mocked(confirmReconciliation).mockRejectedValueOnce(new Error("fallback"));
    render(
      <MemoryRouter>
        <ReconciliationStep importId="imp-1" onDone={() => undefined} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId("recon-no")).toBeTruthy());
    await user.click(screen.getByTestId("recon-no"));
    await user.click(screen.getByTestId("recon-undo"));
    await waitFor(() => expect(undoImport).toHaveBeenCalledWith("imp-1"));
  });
});
