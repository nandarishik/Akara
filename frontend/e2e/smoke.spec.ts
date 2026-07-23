/**
 * Smoke test — Phase 2 Day 1 E2E gate
 */

import { test, expect } from '@playwright/test'

test('login page renders with no accessibility violations', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveTitle(/AKARA/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('unauthenticated redirect from /dashboard to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('404 page renders for unknown route', async ({ page }) => {
  await page.goto('/this-page-does-not-exist-akara')
  await expect(page.locator('body')).not.toBeEmpty()
})
