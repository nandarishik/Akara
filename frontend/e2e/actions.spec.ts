import { test, expect } from "@playwright/test";

test.describe("actions queue (smoke)", () => {
  test("actions route loads", async ({ page }) => {
    await page.goto("/actions");
    await expect(page.locator("body")).toBeVisible();
  });

  test("history and outcomes tabs are reachable", async ({ page }) => {
    await page.goto("/actions?tab=history");
    await expect(page.locator("body")).toBeVisible();
    await page.goto("/actions?tab=outcomes");
    await expect(page.locator("body")).toBeVisible();
  });
});
