import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RejectModal } from "../RejectModal";

describe("RejectModal", () => {
  it("disables confirm until a reason is chosen", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<RejectModal open onClose={vi.fn()} onConfirm={onConfirm} />);
    const confirm = screen.getByRole("button", { name: "Reject" });
    expect(confirm).toBeDisabled();
    await user.click(screen.getByLabelText("Already done this"));
    expect(confirm).not.toBeDisabled();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("Already done this");
  });
});
