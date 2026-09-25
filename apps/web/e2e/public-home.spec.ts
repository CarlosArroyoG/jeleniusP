import { test, expect, type Page } from '@playwright/test'
import { loginAsAdmin } from './fixtures/login'
import { JELENIUS_DEFAULT_BRANDING, COLEGIO_DEMO_BRANDING, withOrgBranding } from './fixtures/org-branding'
import { sampleLanding, withOrgLanding } from './fixtures/public-content'

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || 'admin@jelenius.dev'
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD as string

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '')
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`
}
const BLACKS = ['rgb(0, 0, 0)', 'rgb(17, 24, 39)', 'rgb(15, 15, 16)']

const hasHorizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)

const bg = (locator: ReturnType<Page['locator']>) =>
  locator.evaluate((el) => getComputedStyle(el).backgroundColor)

test.describe('Public home (signed out) — Jelenius branding', () => {
  test('header is the simplified public header, not the LMS shell', async ({ page, request }) => {
    await withOrgLanding(request, sampleLanding(), async () => {
      await page.goto('/')
      const header = page.getByTestId('public-header')
      await expect(header).toBeVisible()

      // Logo + the two always-present public destinations
      await expect(page.getByTestId('public-header-logo')).toBeVisible()
      const nav = header.getByRole('navigation')
      const isMobile = test.info().project.name === 'chromium-mobile'
      if (!isMobile) {
        await expect(nav.getByRole('link', { name: /home|inicio/i }).first()).toBeVisible()
        await expect(nav.getByRole('link', { name: /courses|cursos/i }).first()).toBeVisible()
        // The school's own "people" section is reachable from the header
        await expect(nav.getByRole('link', { name: 'Conoce a tus docentes' })).toBeVisible()
        await expect(nav.getByRole('link', { name: /log ?in|iniciar sesi/i })).toBeVisible()
      } else {
        await header.getByRole('button', { name: /open menu|abrir menú/i }).click()
        await expect(page.locator('#public-header-menu').getByRole('link', { name: /log ?in|iniciar sesi/i })).toBeVisible()
      }
      const signup = header.getByRole('link', { name: /sign ?up|registr/i })
      await expect(signup).toBeVisible()

      // LMS-only surfaces must not be in the public header
      await expect(page.locator('nav[aria-label="Top navigation"]')).toHaveCount(0)
      await expect(header.getByRole('link', { name: /library|biblioteca|communit|comunidad|playground|store|tienda/i })).toHaveCount(0)
      await expect(header.locator('input')).toHaveCount(0) // no global LMS search

      // The header itself is the primary (app-header token); its Sign up CTA is the accent
      // (a primary button would vanish on a primary header) — neither is a hardcoded black.
      expect(await bg(header)).toBe(hexToRgb(JELENIUS_DEFAULT_BRANDING.color))
      const signupBg = await bg(signup)
      expect(signupBg).toBe(hexToRgb(JELENIUS_DEFAULT_BRANDING.accent_color))
      expect(BLACKS).not.toContain(signupBg)
    })
  })

  test('hero is compact, its image fills its column and the CTA uses the brand color', async ({ page, request }) => {
    await withOrgLanding(request, sampleLanding(), async () => {
      await page.goto('/')
      const hero = page.getByTestId('public-hero')
      await expect(hero).toBeVisible()
      const image = page.getByTestId('public-hero-image')
      await expect(image).toBeVisible()
      const cta = page.getByTestId('public-hero-cta')
      await expect(cta).toBeVisible()
      await expect(cta).toHaveAttribute('data-variant', 'brand')

      const isMobile = test.info().project.name === 'chromium-mobile'
      const heroBox = (await hero.boundingBox())!
      const imageBox = (await image.boundingBox())!
      const ctaBox = (await cta.boundingBox())!

      // CTA is brand-colored, never the legacy black
      expect(await bg(cta)).toBe(hexToRgb(JELENIUS_DEFAULT_BRANDING.color))
      expect(await bg(cta)).not.toBe('rgb(0, 0, 0)')

      // Image covers its box with object-fit: cover and has real pixels
      expect(await image.evaluate((el) => getComputedStyle(el).objectFit)).toBe('cover')
      expect(await image.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)

      if (!isMobile) {
        // compact: 340–420px min, must not balloon
        expect(heroBox.height).toBeGreaterThanOrEqual(330)
        expect(heroBox.height).toBeLessThanOrEqual(520)
        // the image column takes ~half the hero and the full hero height
        expect(imageBox.width / heroBox.width).toBeGreaterThan(0.4)
        expect(imageBox.height).toBeGreaterThanOrEqual(heroBox.height - 4)
      } else {
        // mobile: text, CTA, then the image; image spans the full width
        expect(imageBox.y).toBeGreaterThanOrEqual(ctaBox.y + ctaBox.height - 1)
        expect(imageBox.width).toBeGreaterThan(heroBox.width - 4)
      }
      expect(await hasHorizontalOverflow(page)).toBe(false)
    })
  })

  test('teacher cards, single platform credit, no overflow', async ({ page, request }) => {
    await withOrgLanding(request, sampleLanding(), async () => {
      await page.goto('/')
      const cards = page.getByTestId('public-person-card')
      await expect(cards).toHaveCount(2)
      const first = (await cards.nth(0).boundingBox())!
      const second = (await cards.nth(1).boundingBox())!
      if (test.info().project.name === 'chromium-mobile') {
        expect(Math.abs(first.x - second.x)).toBeLessThan(2) // one card per row
        expect(second.y).toBeGreaterThan(first.y + first.height - 2)
      } else {
        expect(Math.abs(first.y - second.y)).toBeLessThan(2) // side by side
        expect(second.x).toBeGreaterThan(first.x + first.width - 2)
      }
      // Card text is not clipped horizontally
      for (const i of [0, 1]) {
        const clipped = await cards.nth(i).evaluate((el) => el.scrollWidth > el.clientWidth + 1)
        expect(clipped).toBe(false)
      }

      // Exactly one Jelenius platform element (no icon + floating watermark pair), and it's inline
      await expect(page.getByTestId('platform-credit')).toHaveCount(1)
      const position = await page.getByTestId('platform-credit').evaluate((el) => getComputedStyle(el).position)
      expect(position).not.toBe('fixed')
      expect(await hasHorizontalOverflow(page)).toBe(false)
    })
  })

  test('public-home screenshot', async ({ page, request }, testInfo) => {
    await withOrgLanding(request, sampleLanding(), async () => {
      await page.goto('/')
      await expect(page.getByTestId('public-hero-image')).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      const name = testInfo.project.name === 'chromium-mobile' ? 'public-home-mobile.png' : 'public-home-desktop.png'
      await expect(page).toHaveScreenshot(name, { fullPage: true })
    })
  })
})

test.describe('Public home — school-branded (Colegio Demo)', () => {
  test('header, CTA and font follow the organization branding without code changes', async ({ page, request }) => {
    await withOrgBranding(request, COLEGIO_DEMO_BRANDING, async () => {
      await withOrgLanding(request, sampleLanding(), async () => {
        await page.goto('/')
        const header = page.getByTestId('public-header')
        await expect(header).toBeVisible()
        const school = hexToRgb(COLEGIO_DEMO_BRANDING.color)

        const signup = header.getByRole('link', { name: /sign ?up|registr/i })
        expect(await bg(header)).toBe(school)
        expect(await bg(signup)).toBe(hexToRgb(COLEGIO_DEMO_BRANDING.accent_color))
        expect(await bg(page.getByTestId('public-hero-cta'))).toBe(school)

        // The org name is the logo text when there is no uploaded logo
        await expect(header.getByText(COLEGIO_DEMO_BRANDING.name)).toBeVisible()
        // The Jelenius default color must not leak into the school's page
        expect(await bg(signup)).not.toBe(hexToRgb(JELENIUS_DEFAULT_BRANDING.accent_color))

        const font = await page.locator('.lh-org-font-root').first().evaluate((el) => getComputedStyle(el).fontFamily)
        expect(font).toContain(COLEGIO_DEMO_BRANDING.font)

        expect(await hasHorizontalOverflow(page)).toBe(false)
        await expect(page).toHaveScreenshot(
          test.info().project.name === 'chromium-mobile' ? 'colegio-demo-public-home-mobile.png' : 'colegio-demo-public-home-desktop.png',
          { fullPage: true }
        )
      })
    })
  })
})

test.describe('Authenticated shell is unaffected', () => {
  test('a signed-in admin still gets the full LMS header, not the public one', async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.goto('/')
    await expect(page.getByTestId('public-header')).toHaveCount(0)
    await expect(page.locator('nav[aria-label="Top navigation"]')).toBeVisible()
    if (test.info().project.name !== 'chromium-mobile') {
      // LMS navigation and the global search are still there
      await expect(page.locator('nav[aria-label="Top navigation"]').getByRole('link', { name: /courses|cursos/i }).first()).toBeVisible()
      await expect(page.locator('nav[aria-label="Top navigation"] input').first()).toBeVisible()
    }
  })
})
