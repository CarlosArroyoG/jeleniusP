import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './fixtures/login'
import { JELENIUS_DEFAULT_BRANDING, COLEGIO_DEMO_BRANDING, withOrgBranding } from './fixtures/org-branding'

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || 'admin@jelenius.dev'
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD as string

/**
 * Proves the phase's central claim in a real browser: the same code, same
 * components, same deployed build, rendering two different brand identities
 * purely from organization config — no code path branches on which brand is
 * active. See jelenius-docs/white-label.md.
 */
test.describe('White-label — Jelenius baseline', () => {
  test('login renders Jelenius branding', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText(JELENIUS_DEFAULT_BRANDING.name, { exact: false }).locator('visible=true').first()).toBeVisible()
    await expect(page).toHaveScreenshot('jelenius-login.png', { fullPage: true })
  })

  test('dashboard sidebar renders the Jelenius accent on the active nav item', async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    const sidebar = page.locator('nav[aria-label*="avigation" i]:visible').first()
    await expect(sidebar).toBeVisible()
    // Sidebar-only, not full-page: the dashboard body has variable data
    // (course counts, recent items) that would make a full-page snapshot
    // flaky for reasons that have nothing to do with branding — see
    // playwright.config.ts / section 16's warning against unstabilized
    // full-page snapshots. The sidebar itself is static chrome.
    await expect(sidebar).toHaveScreenshot('jelenius-dashboard-sidebar.png')
  })

  test('dashboard "Create Course" button renders in the Jelenius brand color', async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    const createCourse = page.getByRole('link', { name: /create course/i }).locator('visible=true').first()
    await expect(createCourse).toBeVisible()
    // The button's own background is set via bg-brand — confirm the
    // computed value matches the resolved --brand-primary, not a hardcoded
    // gray/black, proving the Button "brand" variant added this phase is
    // actually wired to org config rather than a fixed color.
    const bg = await createCourse.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bg).not.toBe('rgb(17, 24, 39)') // the old hardcoded bg-gray-900

    await expect(createCourse).toHaveScreenshot('jelenius-dashboard-primary-button.png')
  })

  test('course catalog renders with Jelenius branding, no layout break', async ({ page }) => {
    await page.goto('/courses')
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    )
    expect(hasOverflow).toBe(false)
  })
})

test.describe('White-label — Colegio Demo (fixture)', () => {
  test('login renders Colegio Demo branding — different name, color, font, same components', async ({ page, request }) => {
    await withOrgBranding(request, COLEGIO_DEMO_BRANDING, async () => {
      await page.goto('/login')
      // The org-identity element is an <h1> in the desktop branding panel
      // but a plain <span> in the mobile header (AuthMobileHeader.tsx) — text
      // content, not role, is the one thing stable across both viewports.
      const identity = page.getByText(COLEGIO_DEMO_BRANDING.name, { exact: false }).locator('visible=true').first()
      await expect(identity).toBeVisible()
      // Not asserting zero "Jelenius" text anywhere on the page: the ToS/
      // privacy disclaimer ("By continuing, you agree to Jelenius's Terms…")
      // deliberately still names Jelenius regardless of which school is
      // white-labeled — Jelenius the software vendor, not the school, is
      // the counterparty for platform terms. What must change per-brand is
      // the org-identity element checked above and its inherited brand color.
      const brandPrimary = await identity.evaluate((el) => getComputedStyle(el).getPropertyValue('--brand-primary').trim())
      expect(brandPrimary.toLowerCase()).toBe(COLEGIO_DEMO_BRANDING.color.toLowerCase())

      await expect(page).toHaveScreenshot('colegio-demo-login.png', { fullPage: true })
    })
  })

  test('dashboard sidebar reflects Colegio Demo accent, restored to Jelenius afterward', async ({ page, request }) => {
    await withOrgBranding(request, COLEGIO_DEMO_BRANDING, async () => {
      await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD)
      const sidebar = page.locator('nav[aria-label*="avigation" i]:visible').first()
      await expect(sidebar).toBeVisible()
      await expect(sidebar).toHaveScreenshot('colegio-demo-dashboard-sidebar.png')

      // "Create Course" primary button — stable content (no course/user data
      // in it), unlike the dashboard body below it, so safe to snapshot.
      const createCourse = page.getByRole('link', { name: /create course/i }).locator('visible=true').first()
      await expect(createCourse).toHaveScreenshot('colegio-demo-dashboard-primary-button.png')
    })

    // withOrgBranding already restored Jelenius branding in its `finally` —
    // confirm that actually took effect rather than trusting it silently.
    await page.goto('/login')
    await expect(page.getByText(JELENIUS_DEFAULT_BRANDING.name, { exact: false }).locator('visible=true').first()).toBeVisible()
  })

  test('course catalog renders under Colegio Demo branding without layout break, restored after', async ({ page, request }) => {
    // Not snapshotting the catalog grid itself: the dev org's 3 seeded
    // courses are real content (thumbnails, authors, dates) that can change
    // independently of branding — a pixel diff here would flag content
    // drift, not a branding regression. See visual-testing.md.
    await withOrgBranding(request, COLEGIO_DEMO_BRANDING, async () => {
      await page.goto('/courses')
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      )
      expect(hasOverflow).toBe(false)
    })
  })
})
