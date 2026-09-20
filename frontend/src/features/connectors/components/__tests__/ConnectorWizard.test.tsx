import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ConnectorWizard } from "../../components/ConnectorWizard";
import { ReconnectPanel } from "../../components/ReconnectPanel";

vi.mock("@/shared/ui/GlowCTAButton", () => ({
  default: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/shared/ui/GradientButton", () => ({
  SecondaryButton: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/shared/ui/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../../api/connectorsApi", () => ({
  createConnector: vi.fn(),
  testConnector: vi.fn(),
}));

describe("ConnectorWizard", () => {
  it("shows four-step chrome and type picker", () => {
    render(
      <MemoryRouter>
        <ConnectorWizard open onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("connector-wizard")).toBeTruthy();
    expect(screen.getByText(/Step 1 of 4/)).toBeTruthy();
    expect(screen.getByText("Petpooja")).toBeTruthy();
  });

  it("advances to credentials step with blank masked fields", () => {
    render(
      <MemoryRouter>
        <ConnectorWizard open onClose={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByTestId("wizard-step-2")).toBeTruthy();
    expect(screen.getByTestId("credential-fields")).toBeTruthy();
    const inputs = screen.getByTestId("credential-fields").querySelectorAll("input");
    inputs.forEach((el) => expect((el as HTMLInputElement).value).toBe(""));
  });
});

describe("ReconnectPanel", () => {
  it("opens wizard with blank credentials", () => {
    render(
      <MemoryRouter>
        <ReconnectPanel
          open
          connectorType="petpooja"
          sourceName="Brewlab POS"
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Reconnect source")).toBeTruthy();
    fireEvent.click(screen.getByText("Next"));
    const inputs = screen.getByTestId("credential-fields").querySelectorAll("input");
    inputs.forEach((el) => expect((el as HTMLInputElement).value).toBe(""));
  });
});
