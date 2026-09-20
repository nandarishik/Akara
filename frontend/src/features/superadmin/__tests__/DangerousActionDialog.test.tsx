import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DangerousActionDialog } from "../components/DangerousActionDialog";

describe("DangerousActionDialog", () => {
  it("requires two steps and reason before confirm", async () => {
    const onConfirm = vi.fn();
    render(
      <DangerousActionDialog
        open
        onOpenChange={() => {}}
        title="Delete tenant"
        summary="This removes the workspace."
        minReasonLength={20}
        irreversible
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    const confirm = screen.getByRole("button", { name: /confirm/i });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "Enough characters for delete ops" },
    });
    fireEvent.click(screen.getByLabelText(/cannot be undone/i));
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalled();
  });
});
