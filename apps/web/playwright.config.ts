import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'node:path'

// Same convention as Next.js's own .env.local — gitignored, one per
// developer machine. Holds PLAYWRIGHT_ADMIN_PASSWORD (see
// e2e/fixtures/org-branding.ts and jelenius-docs/visual-testing.md).
dotenv.config({ path: path.resolve(__dirname, '.env.test.local') })

/**
 * Browser QA for the white-label theme engine — see jelenius-docs/visual-testing.md.
 *
 * Runs against a production build + production server (not `next dev`),
 * per the phase instructions: dev-mode Turbopack cold-compile times are not
 * representative of anything a real user or a visual regression baseline
 * should be judged against. Playwright starts and owns this server itself
 * (see `webServer` below) — a developer never needs to have anything
 * running manually beyond the existing `npx learnhouse dev` backend stack
 * (API/Postgres/Redis), which this config does NOT start; it must already
 * be up (see jelenius-docs/visual-testing.md's prerequisites).
 */
export default defineConfig({
  testDir: './e2e',
  // Serial, not parallel: every spec shares the same single organization
  // (id 1) in this single-tenant dev backend — the white-label spec
  // temporarily rewrites its branding to "Colegio Demo" and back, which
  // would race with any other spec's assumption of Jelenius-default
  // branding if they ran concurrently. A real multi-org test backend would
  // remove this constraint; not worth building for this suite's size.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',

  use: {
    baseURL: 'http://localhost:3010',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  expect: {
    // Consumer/marketing-grade color differences (anti-aliasing, subpixel
    // font rendering) are expected across machines — this is "does it look
    // like the right brand," not a pixel-perfect design-tool diff.
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],

  webServer: {
    command: 'bun run build && bun run start -p 3010',
    url: 'http://localhost:3010',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
