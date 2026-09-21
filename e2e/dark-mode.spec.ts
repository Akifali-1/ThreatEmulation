import { expect, test, type Page } from '@playwright/test'

/**
 * Dark-mode capture.
 *
 * The theme is a persisted preference, so it is seeded into localStorage before the app boots
 * rather than toggled afterwards — that also exercises the read-on-load path, which is the one
 * a returning visitor hits.
 */
const DARK_PAGES = [
  { path: '/overview', name: 'overview', heading: 'Overview' },
  { path: '/compare', name: 'compare', heading: 'Compare' },
  { path: '/health', name: 'pipeline-health', heading: 'Pipeline Health' },
  { path: '/techniques', name: 'techniques', heading: 'Techniques' },
  { path: '/blue', name: 'blue-agent', heading: 'Blue Agent' },
]

async function seedDark(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('te-theme', 'dark')
  })
}

for (const entry of DARK_PAGES) {
  test(`dark: ${entry.heading}`, async ({ page }) => {
    await seedDark(page)
    await page.goto(entry.path)
    await expect(page.locator('main h1')).toHaveText(entry.heading, { timeout: 20_000 })

    // The attribute is what actually drives the tokens; assert it rather than trusting the seed.
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", { timeout: 20_000 })

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(600)

    await page.screenshot({
      path: `screenshots/dark/${entry.name}.png`,
    })
  })
}
