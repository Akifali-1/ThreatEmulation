import { expect, test } from '@playwright/test'
test('curve shape probe', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.locator('h1')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(2500)
  const span = await page.evaluate(() => window.innerHeight * 3.2)
  // Land squarely in the escalation band.
  await page.evaluate((y) => window.scrollTo(0, y), span * 0.44)
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `screenshots/${testInfo.project.name}/probe-esc.png` })
  await page.evaluate((y) => window.scrollTo(0, y), span * 0.75)
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `screenshots/${testInfo.project.name}/probe-pay.png` })
})
