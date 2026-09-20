import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { TotpSetupPage } from "../pages/TotpSetupPage";

const getTotpStatus = vi.fn();
const setupTotp = vi.fn();

vi.mock("@/lib/api/superadmin", () => ({
  getTotpStatus: (...a: unknown[]) => getTotpStatus(...a),
  setupTotp: (...a: unknown[]) => setupTotp(...a),
  startSudo: vi.fn().mockResolvedValue({ expires_at: new Date().toISOString(), csrf_token: "x" }),
}));

describe("TotpSetupPage", () => {
  beforeEach(() => {
    getTotpStatus.mockReset();
    setupTotp.mockReset();
  });

  it("shows configured state", async () => {
    getTotpStatus.mockResolvedValue({ configured: true });
    render(<TotpSetupPage />);
    await waitFor(() => expect(screen.getByText(/TOTP configured/i)).toBeInTheDocument());
  });

  it("renders svg from setup mock", async () => {
    getTotpStatus.mockResolvedValue({ configured: false });
    setupTotp.mockResolvedValue({
      provisioning_uri: "otpauth://totp/Akara:admin",
      qr_code_svg: "<svg xmlns='http://www.w3.org/2000/svg'><rect/></svg>",
    });
    render(<TotpSetupPage />);
    await waitFor(() => screen.getByRole("button", { name: /set up authenticator/i }));
    fireEvent.click(screen.getByRole("button", { name: /set up authenticator/i }));
    await waitFor(() => {
      expect(screen.getByText(/otpauth:\/\//i)).toBeInTheDocument();
    });
  });
});
