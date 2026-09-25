import { test, expect, type Locator, type Page } from '@playwright/test'
import { loginAsAdmin } from './fixtures/login'
import { rgb } from './fixtures/colors'
import {
  COLEGIO_DEMO_BRANDING,
  DON_BOSCO_BRANDING,
  JELENIUS_DEFAULT_BRANDING,
  UNIVERSIDAD_ROJA_BRANDING,
  withOrgBranding,
  type Branding,
} from './fixtures/org-branding'
import { sampleLanding, seedDynamicPage, withOrgLanding } from './fixtures/public-content'
import { resolveOrganizationTheme } from '../lib/theme/resolveOrganizationTheme'

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || 'admin@jelenius.dev'
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD as string

const isMobile = () => test.info().project.name === 'chromium-mobile'
const style = (l: Locator, prop: string) => l.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)
const bg = (l: Locator) => style(l, 'background-color')
const fg = (l: Locator) => style(l, 'color')
/** Background of a nav item: on the link itself or on its first inner row (the sidebar paints the row). */
const itemBgs = (l: Locator) =>
  l.evaluate((el) => [
    getComputedStyle(el).backgroundColor,
    el.firstElementChild ? getComputedStyle(el.firstElementChild).backgroundColor : '',
  ])
const noHorizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)

/** What the theme engine must produce for a school config — expected values come from the
 *  school's own configured hex (primary/secondary/accent), foregrounds from the resolver. */
function expectedTheme(b: Branding) {
  const t = resolveOrganizationTheme({
    config: { config: { customization: { general: { color: b.color, secondary_color: b.secondary_color, accent_color: b.accent_color, font: b.font } } } },
  })
  return t
}

const IDENTITIES: Array<{ key: string; branding: Branding }> = [
  { key: 'jelenius', branding: JELENIUS_DEFAULT_BRANDING },
  { key: 'colegio-demo', branding: COLEGIO_DEMO_BRANDING },
  { key: 'don-bosco', branding: DON_BOSCO_BRANDING },
]

/**
 * ONE codebase, three OrganizationConfigs → three LMS identities. Nothing in product code knows
 * these schools; the expected colors are the configured ones, read back from computed styles, so
 * a regression to the static default (the old `bg-brand` bug) fails here for any non-Jelenius org.
 */
test.describe.configure({ mode: 'serial' })

for (const { key, branding } of IDENTITIES) {
  test.describe(`Authenticated navigation — ${key}`, () => {
    test('sidebar, active state and hover follow the organization (desktop) / mobile nav (mobile)', async ({ page, request }) => {
      const t = expectedTheme(branding)
      await withOrgBranding(request, branding, async () => {
        await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD)
        await page.goto('/dash')

        if (!isMobile()) {
          const sidebar = page.getByTestId('dash-sidebar')
          await expect(sidebar).toBeVisible()
          expect(await bg(sidebar)).toBe(rgb(branding.secondary_color))
          expect(await fg(sidebar)).toBe(rgb(t.navigation.sidebarForeground))

          const active = sidebar.locator('a[aria-current="page"]').first()
          await expect(active).toBeVisible()
          // the active item is filled with the accent (on the link or on its inner row)
          expect(await itemBgs(active)).toContain(rgb(branding.accent_color))

          // hover: a non-active item takes the derived hover background
          const other = sidebar.getByRole('link', { name: /^library|^biblioteca|^courses|^cursos/i }).first()
          await other.hover()
          // (the row animates its background — poll until the transition settles)
          await expect
            .poll(async () => (await itemBgs(other)).includes(rgb(t.navigation.navHoverBackground)), { timeout: 5_000 })
            .toBe(true)
          await expect(sidebar).toHaveScreenshot(`nav-sidebar-${key}.png`, { maxDiffPixelRatio: 0.03 })
        } else {
          const pill = page.getByTestId('dash-mobile-nav')
          await expect(pill).toBeVisible()
          expect(await bg(pill)).toBe(rgb(branding.secondary_color))
          // on /dash/courses the "Courses" pill is the active one: filled with the accent
          await page.goto('/dash/courses')
          const active = page.getByTestId('dash-mobile-nav').locator('a[aria-current="page"]').first()
          await expect(active).toBeVisible()
          expect(await bg(active)).toBe(rgb(branding.accent_color))
          expect(await fg(active)).toBe(rgb(t.navigation.navActiveForeground))
          await expect(page.getByTestId('dash-mobile-nav')).toHaveScreenshot(`nav-mobile-${key}.png`, { maxDiffPixelRatio: 0.03 })
        }
        expect(await noHorizontalOverflow(page)).toBe(true)
      })
    })

    test('authenticated header follows the organization and the font is the school font', async ({ page, request }) => {
      const t = expectedTheme(branding)
      await withOrgBranding(request, branding, async () => {
        await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD)
        await page.goto('/')
        const header = page.getByTestId('org-header')
        await expect(header).toBeVisible()
        expect(await bg(header)).toBe(rgb(branding.color))
        expect(await fg(header)).toBe(rgb(t.navigation.headerForeground))
        const font = await page.locator('.lh-org-font-root').first().evaluate((el) => getComputedStyle(el).fontFamily)
        expect(font).toContain(branding.font)
        expect(await noHorizontalOverflow(page)).toBe(true)
        await expect(header).toHaveScreenshot(`nav-header-${key}.png`, { maxDiffPixelRatio: 0.03 })
      })
    })
  })
}

test.describe('Fundación Don Bosco (config-only fixture) — continuity from public site to dashboard', () => {
  test('public home → course → dashboard keep one identity; no generic black shell anywhere', async ({ page, request }) => {
    const b = DON_BOSCO_BRANDING
    const seeded = await seedDynamicPage(request, { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bienvenidos' }] }] })
    try {
      await withOrgBranding(request, b, async () => {
        await withOrgLanding(request, sampleLanding(), async () => {
          // 1. public home, signed out
          await page.goto('/')
          const publicHeader = page.getByTestId('public-header')
          await expect(publicHeader).toBeVisible()
          expect(await bg(publicHeader)).toBe(rgb(b.color))
          await expect(page.getByTestId('public-hero-cta')).toBeVisible()
          expect(await bg(page.getByTestId('public-hero-cta'))).toBe(rgb(b.color))
          expect(await noHorizontalOverflow(page)).toBe(true)
          await page.evaluate(() => document.fonts.ready)
          await expect(page).toHaveScreenshot('donbosco-public-home.png', { fullPage: true, maxDiffPixelRatio: 0.03 })

          // 2. login page carries the same brand variables
          await page.goto('/login')
          await expect
            .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim().toLowerCase()))
            .toBe(b.color.toLowerCase())

          // 3. signed in: course page (authenticated header) and dashboard (sidebar / mobile nav)
          await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD)
          await page.goto(`/course/${seeded.courseUuid.replace('course_', '')}`)
          const header = page.getByTestId('org-header')
          await expect(header).toBeVisible({ timeout: 20_000 })
          expect(await bg(header)).toBe(rgb(b.color))

          await page.goto('/dash/courses')
          if (isMobile()) {
            expect(await bg(page.getByTestId('dash-mobile-nav'))).toBe(rgb(b.secondary_color))
          } else {
            expect(await bg(page.getByTestId('dash-sidebar'))).toBe(rgb(b.secondary_color))
          }
          expect(await noHorizontalOverflow(page)).toBe(true)
        })
      })
    } finally {
      await seeded.cleanup()
    }
  })
})

test.describe('SSR — the school theme is in the very first HTML (no default-then-hydrate flash)', () => {
  test('brand and navigation tokens are present, correct, in the raw server HTML of public and login pages', async ({ request }) => {
    const b = DON_BOSCO_BRANDING
    await withOrgBranding(request, b, async () => {
      for (const route of ['/', '/login']) {
        const html = (await (await request.get(route)).text()).toLowerCase()
        for (const decl of [
          `--brand-primary:${b.color}`, `--brand-secondary:${b.secondary_color}`, `--brand-accent:${b.accent_color}`,
          `--app-header-bg:${b.color}`, `--app-sidebar-bg:${b.secondary_color}`, `--app-nav-active-bg:${b.accent_color}`,
          '--app-header-fg:', '--app-sidebar-fg:', '--app-nav-active-fg:', '--app-mobile-nav-bg:',
        ]) {
          expect(html, `${route} should contain ${decl}`).toContain(decl.toLowerCase())
        }
        // …and not the Jelenius default in the org wrapper's inline style
        expect(html).not.toContain('--app-header-bg:#0b1930')
      }
    })
  })
})

test.describe('A hypothetical new school needs no code change (Universidad Roja)', () => {
  test('red header, dark-red sidebar, gold active state, matching CTA and mobile nav — from config alone', async ({ page, request }) => {
    const b = UNIVERSIDAD_ROJA_BRANDING
    const t = expectedTheme(b)
    await withOrgBranding(request, b, async () => {
      await withOrgLanding(request, sampleLanding(), async () => {
        await page.goto('/')
        expect(await bg(page.getByTestId('public-header'))).toBe(rgb('#A32035'))
        expect(await bg(page.getByTestId('public-hero-cta'))).toBe(rgb('#A32035'))
        expect(await fg(page.getByTestId('public-hero-cta'))).toBe(rgb(t.brandPrimaryForeground))

        await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD)
        await page.goto('/dash')
        if (isMobile()) {
          const pill = page.getByTestId('dash-mobile-nav')
          expect(await bg(pill)).toBe(rgb('#541622'))
        } else {
          const sidebar = page.getByTestId('dash-sidebar')
          expect(await bg(sidebar)).toBe(rgb('#541622'))
          const active = sidebar.locator('a[aria-current="page"]').first()
          expect(await itemBgs(active)).toContain(rgb('#E7B84B'))
        }
      })
    })
  })
})
