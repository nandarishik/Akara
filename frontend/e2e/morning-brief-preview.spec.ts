import { test, expect } from "@playwright/test";

test.describe("morning brief preview (smoke)", () => {
  test("preview route loads", async ({ page }) => {
    await page.goto("/settings/morning-brief");
    await expect(page.locator("body")).toBeVisible();
  });
});
