import { test, expect } from "@playwright/test";

test.describe("copilot outage (smoke)", () => {
  test("dashboard still reachable during outage path", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("body")).toBeVisible();
  });
});
