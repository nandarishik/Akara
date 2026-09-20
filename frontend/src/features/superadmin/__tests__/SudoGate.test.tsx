import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { SudoGate } from "../components/SudoGate";

const startSudo = vi.fn();
const getSudoStatus = vi.fn();

vi.mock("@/lib/api/superadmin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/superadmin")>(
    "@/lib/api/superadmin",
  );
  return {
    ...actual,
    getSudoStatus: (...args: unknown[]) => getSudoStatus(...args),
    startSudo: (...args: unknown[]) => startSudo(...args),
  };
});

describe("SudoGate", () => {
  beforeEach(() => {
    getSudoStatus.mockResolvedValue({ active: false, expires_at: null });
    startSudo.mockResolvedValue({
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      csrf_token: "x",
    });
  });

  it("submits password and 6-digit totp", async () => {
    render(
      <SudoGate>
        <div>child</div>
      </SudoGate>,
    );

    await waitFor(() => screen.getByLabelText(/password/i));
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret" } });
    for (let i = 1; i <= 6; i++) {
      fireEvent.change(screen.getByLabelText(`TOTP digit ${i}`), {
        target: { value: String(i) },
      });
    }
    fireEvent.click(screen.getByRole("button", { name: /continue to superadmin/i }));
    await waitFor(() => expect(startSudo).toHaveBeenCalledWith("secret", "123456"));
  });
});
