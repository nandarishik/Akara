import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { QuarantinePage } from "../../pages/QuarantinePage";

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
  getCafeFlags: vi.fn(),
  listImportJobs: vi.fn(),
  listQuarantine: vi.fn(),
  ignoreQuarantine: vi.fn(),
  resubmitQuarantine: vi.fn(),
  downloadQuarantineExport: vi.fn(),
}));

import {
  getCafeFlags,
  ignoreQuarantine,
  listImportJobs,
  listQuarantine,
  resubmitQuarantine,
} from "@/features/data-import/api/cafeImportApi";

describe("QuarantinePage", () => {
  beforeEach(() => {
    vi.mocked(getCafeFlags).mockResolvedValue({
      cafe_import: true,
      ai_mapping: false,
      quarantine_ui: true,
      max_upload_bytes: 50_000_000,
    });
    vi.mocked(listImportJobs).mockResolvedValue({
      jobs: [{ id: "imp-1", filename: "orders.csv", import_type: "cafe_orders" }],
    });
    vi.mocked(listQuarantine).mockResolvedValue({
      rows: [
        {
          id: "row-1",
          row_number: 12,
          failure_type: "missing_required",
          failure_reason: "order_time is missing",
          canonical_field: "order_time",
          raw_row: { Bill: "120" },
          resolved: false,
        },
      ],
      unresolved_count: 1,
    });
    vi.mocked(ignoreQuarantine).mockResolvedValue({ resolved: true });
    vi.mocked(resubmitQuarantine).mockResolvedValue({ resolved: true, canonical_id: "c1" });
  });

  it("ignore handler fires", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/data/quarantine?import_id=imp-1"]}>
        <QuarantinePage />
      </MemoryRouter>,
    );
    // Select import via state — set by query param on mount only if we sync; select manually
    await waitFor(() => expect(screen.getByRole("combobox")).toBeTruthy());
    await user.selectOptions(screen.getByRole("combobox"), "imp-1");
    await waitFor(() => expect(screen.getByTestId("quarantine-ignore")).toBeTruthy());
    await user.click(screen.getByTestId("quarantine-ignore"));
    await waitFor(() => expect(ignoreQuarantine).toHaveBeenCalledWith("imp-1", "row-1"));
  });

  it("resubmit handler fires from edit modal", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <QuarantinePage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole("combobox")).toBeTruthy());
    await user.selectOptions(screen.getByRole("combobox"), "imp-1");
    await waitFor(() => expect(screen.getByTestId("quarantine-edit")).toBeTruthy());
    await user.click(screen.getByTestId("quarantine-edit"));
    await user.click(screen.getByTestId("quarantine-resubmit"));
    await waitFor(() => expect(resubmitQuarantine).toHaveBeenCalled());
  });
});
