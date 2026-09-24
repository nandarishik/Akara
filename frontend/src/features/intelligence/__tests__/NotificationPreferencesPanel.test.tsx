import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/ui/GlowCTAButton", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

const putNotificationPreferences = vi.fn();

vi.mock("@/features/intelligence/api/intelligenceApi", () => ({
  fetchNotificationPreferences: vi.fn().mockResolvedValue({
    revenue_drop: { email: true, whatsapp: true, in_app: true },
    food_cost_high: { email: true, whatsapp: false, in_app: true },
    orders_low: { email: false, whatsapp: false, in_app: true },
    item_not_selling: { email: false, whatsapp: false, in_app: true },
    anomaly: { email: true, whatsapp: true, in_app: true },
    whatsapp_alerts_enabled: false,
  }),
  putNotificationPreferences: (...args: unknown[]) => putNotificationPreferences(...args),
}));

import { NotificationPreferencesPanel } from "@/features/settings/components/NotificationPreferencesPanel";

describe("NotificationPreferencesPanel", () => {
  it("PUTs frozen keys and disables WhatsApp when workspace flag is off", async () => {
    putNotificationPreferences.mockResolvedValue({
      revenue_drop: { email: false, whatsapp: false, in_app: true },
      food_cost_high: { email: true, whatsapp: false, in_app: true },
      orders_low: { email: false, whatsapp: false, in_app: true },
      item_not_selling: { email: false, whatsapp: false, in_app: true },
      anomaly: { email: true, whatsapp: false, in_app: true },
      whatsapp_alerts_enabled: false,
    });

    render(<NotificationPreferencesPanel />);
    expect(await screen.findByText("Revenue drop")).toBeTruthy();

    const boxes = screen.getAllByRole("checkbox");
    const whatsappBoxes = boxes.filter((el) => (el as HTMLInputElement).disabled);
    expect(whatsappBoxes.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Save matrix"));
    await waitFor(() => expect(putNotificationPreferences).toHaveBeenCalled());
    const body = putNotificationPreferences.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      ["anomaly", "food_cost_high", "item_not_selling", "orders_low", "revenue_drop"].sort(),
    );
  });
});
