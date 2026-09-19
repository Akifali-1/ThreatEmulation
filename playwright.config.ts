import { defineConfig, devices } from '@playwright/test'

/**
 * Screenshot harness. Not a functional test suite — it renders every route at desktop and
 * tablet width and writes PNGs to screenshots/, so visual regressions are visible across
 * pages as they get built.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list']],
  timeout: 45_000,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    // Charts and fonts need to settle before capture.
    screenshot: 'off',
  },
  projects: [
    {
      name: 'desktop',
      // Deliberately tall. The app shell is `overflow-hidden` with an internal scroll region,
      // so the document is only ever viewport-height and `fullPage` captures nothing extra.
      // A tall viewport lets the internal region lay out the whole page, and avoids the
      // resize-during-capture that Recharts' ResizeObserver reacts to by blanking the charts.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 2800 } },
    },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 834, height: 2600 } },
    },
  ],
})
