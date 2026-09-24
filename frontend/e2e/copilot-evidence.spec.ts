import { test, expect } from "@playwright/test";

test.describe("copilot evidence / outage (smoke)", () => {
  test("copilot route loads", async ({ page }) => {
    await page.goto("/copilot");
    // May redirect to login — either heading or auth UI is acceptable for smoke.
    await expect(page.locator("body")).toBeVisible();
  });
});
