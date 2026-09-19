import { expect, test, type Page } from '@playwright/test'

/**
 * Waits until every Recharts surface has actually laid out.
 *
 * ResponsiveContainer measures its parent before drawing, so a capture taken in that window
 * records empty axes. Asserting on a non-zero SVG width, plus a frame to let the draw settle,
 * makes the screenshots trustworthy rather than intermittently chart-less.
 */
async function waitForCharts(page: Page) {
  // A screenshot of a loading placeholder is worse than no screenshot — it looks like a
  // layout result. Wait for the page to finish hydrating before measuring anything.
  await expect
    .poll(async () => page.locator('main').getByText(/^Loading |^Checking /).count(), {
      timeout: 20_000,
    })
    .toBe(0)

  const surfaces = page.locator('.recharts-responsive-container')
  const count = await surfaces.count()

  if (count > 0) {
    await expect
      .poll(
        async () =>
          surfaces.evaluateAll((nodes) =>
            nodes.every((node) => node.getBoundingClientRect().width > 0),
          ),
        { timeout: 15_000 },
      )
      .toBe(true)
  }

  // Two animation frames: one for the layout, one for the SVG paint.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
  await page.waitForTimeout(250)
}

const PAGES = [
  { path: '/', name: 'overview', heading: 'Overview', nav: 'Overview' },
  { path: '/live', name: 'live', heading: 'Live Operations', nav: 'Live' },
  { path: '/trials', name: 'trials', heading: 'Trials', nav: 'Trials' },
  { path: '/techniques', name: 'techniques', heading: 'Techniques', nav: 'Techniques' },
  { path: '/compare', name: 'compare', heading: 'Compare', nav: 'Compare' },
  { path: '/gaps', name: 'detection-gaps', heading: 'Detection Gaps', nav: 'Detection Gaps' },
  { path: '/blue', name: 'blue-agent', heading: 'Blue Agent', nav: 'Blue Agent' },
  { path: '/health', name: 'pipeline-health', heading: 'Pipeline Health', nav: 'Pipeline Health' },
  { path: '/reports', name: 'reports', heading: 'Reports', nav: 'Reports' },
  { path: '/methodology', name: 'methodology', heading: 'Methodology', nav: 'Methodology' },
]

for (const page of PAGES) {
  test(`${page.heading} renders`, async ({ page: pw }, testInfo) => {
    await pw.goto(page.path)
    // First hit on a lazy chunk can exceed the 5s default while Vite transforms it,
    // especially with the whole suite running in parallel against one dev server.
    await expect(pw.locator('main h1')).toHaveText(page.heading, { timeout: 20_000 })
    // Every panel fetches independently; capturing before those settle yields screenshots of
    // loading skeletons, which is worse than useless for spotting visual regressions.
    await pw.waitForLoadState('networkidle')
    await waitForCharts(pw)
    await pw.screenshot({
      path: `screenshots/${testInfo.project.name}/${page.name}.png`,
    })
  })
}

test('Technique detail renders via click-through', async ({ page }, testInfo) => {
  await page.goto('/techniques')
  await page.waitForLoadState('networkidle')

  const firstCard = page.locator('a[href^="/techniques/"]').first()
  await expect(firstCard).toBeVisible({ timeout: 20_000 })
  await firstCard.click()

  // Wait for the ROUTE to change, not merely for an h1 to exist — the list page's own heading
  // satisfies a bare visibility check, so the capture would race the navigation.
  await expect(page).toHaveURL(/\/techniques\/.+/, { timeout: 20_000 })
  await expect(page.locator('main h1')).not.toHaveText('Techniques', { timeout: 20_000 })
  await page.waitForLoadState('networkidle')
  await waitForCharts(page)

  await page.screenshot({
    path: `screenshots/${testInfo.project.name}/technique-detail.png`,
  })
})

test('navigation covers every section', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Sections' })
  for (const item of PAGES) {
    await expect(nav.getByRole('link', { name: item.nav, exact: true })).toBeVisible()
  }
})
