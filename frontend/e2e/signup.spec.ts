import { test, expect } from "@playwright/test";

test.describe("Public signup flow", () => {
  test("signup page renders and links to login", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /sign up|create/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /log in|sign in/i })).toBeVisible();
  });
});

test.describe("UI non-regression smoke", () => {
  test("landing page loads with AKARA branding", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toContainText(/AKARA/i);
  });

  test("404 page renders", async ({ page }) => {
    await page.goto("/does-not-exist-route-xyz");
    await expect(page.locator("body")).toContainText(/not found|404/i);
  });

  test("500 page renders", async ({ page }) => {
    await page.goto("/500");
    await expect(page.locator("body")).toContainText(/server error/i);
  });
});
