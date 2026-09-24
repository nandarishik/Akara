import { test, expect } from "@playwright/test";

test.describe("alerts settings (smoke)", () => {
  test("settings alerts route loads", async ({ page }) => {
    await page.goto("/settings/alerts");
    await expect(page.locator("body")).toBeVisible();
  });
});
