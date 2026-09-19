import { test, expect } from '@playwright/test'
import { JELENIUS_DEFAULT_BRANDING } from './fixtures/org-branding'

/**
 * The core "no theme flash" guarantee: the organization's brand color must
 * be present in the raw server-rendered HTML — before any client JS runs —
 * not applied a moment later once React Query hydrates. See
 * jelenius-docs/ssr-branding.md.
 */
test.describe('SSR branding', () => {
  test('the raw HTML response for / already contains the org brand color (no JS executed)', async ({ request, baseURL }) => {
    const res = await request.get(baseURL!)
    const html = await res.text()
    expect(html).toContain(`--brand-primary:${JELENIUS_DEFAULT_BRANDING.color.toLowerCase()}`)
  })

  test('the raw HTML response for /login already contains the org brand color', async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/login`)
    const html = await res.text()
    expect(html).toContain(`--brand-primary:${JELENIUS_DEFAULT_BRANDING.color.toLowerCase()}`)
  })

  test('a real browser sees the correct brand color on first paint, before and after hydration', async ({ page }) => {
    await page.goto('/login')
    // --brand-primary is set inline on AuthLayout's wrapper div, a
    // descendant of <body> — custom properties inherit downward, so reading
    // it from document.body itself would only ever show :root's static
    // default, masking whether the actual per-org SSR value made it into
    // the tree. The welcome heading is inside that wrapper and inherits
    // from it, so it sees the real resolved value.
    const heading = page.getByRole('heading', { level: 1 }).first()
    await expect(heading).toBeVisible()
    const readBrandPrimary = () =>
      heading.evaluate((el) => getComputedStyle(el).getPropertyValue('--brand-primary').trim())

    // Immediately after first paint — this is the window a flash would be visible in.
    expect((await readBrandPrimary()).toLowerCase()).toBe(JELENIUS_DEFAULT_BRANDING.color.toLowerCase())

    // And again once hydration/React Query have fully settled — same value, confirming no flash swapped it.
    await page.waitForLoadState('networkidle')
    expect((await readBrandPrimary()).toLowerCase()).toBe(JELENIUS_DEFAULT_BRANDING.color.toLowerCase())
  })

  test('favicon/title metadata resolve server-side (Jelenius default, no LearnHouse leakage)', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/Jelenius/)
    const title = await page.title()
    expect(title).not.toMatch(/LearnHouse/i)
  })
})
