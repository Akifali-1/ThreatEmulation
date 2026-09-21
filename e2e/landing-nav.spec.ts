import { expect, test } from '@playwright/test'

/**
 * Regression guard for the landing page's fixed type layer.
 *
 * The narrative plates are `absolute inset-0` and switch `pointer-events` on when visible, so
 * anything they overlap has to outrank them in stacking order or it silently stops responding.
 * The header link and the error fallback both sit under the plates — this asserts both are
 * actually hittable, which reading the CSS alone cannot confirm.
 */
test('landing header link is clickable through the type layer', async ({ page }) => {
  await page.goto('/')

  const dashboard = page.getByRole('link', { name: 'Dashboard →' })
  await expect(dashboard).toBeVisible()

  await dashboard.click()
  await expect(page).toHaveURL(/\/overview$/)
})

test('sidebar brand returns to the landing page', async ({ page }) => {
  await page.goto('/overview')

  await page.getByTitle('Back to the landing page').click()
  await expect(page).toHaveURL(/\/$/)
})
