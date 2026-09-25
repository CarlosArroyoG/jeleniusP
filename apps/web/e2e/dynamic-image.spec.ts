import { test, expect, type Locator, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test'
import { loginAsAdmin } from './fixtures/login'
import { imageSizingDoc, seedDynamicPage, type SeededDynamicPage } from './fixtures/public-content'

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || 'admin@jelenius.dev'
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD as string

const strip = (uuid: string, prefix: string) => uuid.replace(new RegExp(`^${prefix}_`), '')

/**
 * Image block sizing inside a real Dynamic Page (learner view + editor).
 * The images are inline SVG data URIs (16:9) so no upload/storage is needed and
 * the aspect ratio is exactly known.
 */
test.describe('Dynamic Page — image block sizing', () => {
  // One signed-in browser session shared by the whole describe: the API rate-limits
  // logins (30 / 5 min / IP), and a login per test would trip it across two projects.
  test.describe.configure({ mode: 'serial' })

  let ctx: APIRequestContext
  let seeded: SeededDynamicPage
  let browserContext: BrowserContext
  let page: Page

  test.beforeAll(async ({ playwright, browser }, testInfo) => {
    ctx = await playwright.request.newContext()
    seeded = await seedDynamicPage(ctx, imageSizingDoc())
    browserContext = await browser.newContext(testInfo.project.use)
    page = await browserContext.newPage()
    await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD)
  })

  test.afterAll(async () => {
    await browserContext?.close()
    await seeded?.cleanup()
    await ctx?.dispose()
  })

  const viewUrl = () =>
    `/course/${strip(seeded.courseUuid, 'course')}/activity/${strip(seeded.activityUuid, 'activity')}`

  const isMobile = () => test.info().project.name === 'chromium-mobile'

  async function box(locator: Locator) {
    const b = await locator.boundingBox()
    if (!b) throw new Error('element has no bounding box')
    return b
  }

  /** The block-image wrapper (the full usable content width) around a frame. */
  const wrapperOf = (frame: Locator) => frame.locator('xpath=ancestor::*[contains(@class,"block-image")][1]')

  test.beforeEach(async () => {
    await page.goto(viewUrl())
    await expect(page.locator('.lh-image-frame').first()).toBeVisible({ timeout: 20_000 })
  })

  for (const preset of ['25', '50', '75', '100'] as const) {
    test(`learner view: ${preset}% image`, async () => {
      const frame = page.locator(`.lh-image-frame[data-image-preset="${preset}"]`).first()
      await expect(frame).toBeVisible()
      const img = frame.locator('img')
      await expect(img).toHaveAttribute('alt', `Preset ${preset}`)

      const frameBox = await box(frame)
      const wrapperBox = await box(wrapperOf(frame))
      // Presets collapse to the full content width on narrow screens (see globals.css)
      const expected = isMobile() ? 1 : Number(preset) / 100
      expect(frameBox.width / wrapperBox.width).toBeCloseTo(expected, 1)
      // never wider than the content column
      expect(frameBox.width).toBeLessThanOrEqual(wrapperBox.width + 1)

      // aspect ratio preserved (source is 16:9)
      const imgBox = await box(img)
      expect(imgBox.width / imgBox.height).toBeCloseTo(16 / 9, 1)

      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false)
    })
  }

  test('learner view: alignment left / right', async () => {
    test.skip(isMobile(), 'On phones presets fill the column, so alignment has no visible effect')
    const left = page.locator('.lh-image-frame').filter({ has: page.locator('img[alt="Left aligned"]') })
    const right = page.locator('.lh-image-frame').filter({ has: page.locator('img[alt="Right aligned"]') })
    const l = await box(left)
    const lw = await box(wrapperOf(left))
    expect(Math.abs(l.x - lw.x)).toBeLessThan(2)
    const r = await box(right)
    const rw = await box(wrapperOf(right))
    expect(Math.abs(r.x + r.width - (rw.x + rw.width))).toBeLessThan(2)
  })

  test('learner view: an old image (no preset, no alt) still renders at its legacy width', async () => {
    const legacy = page.locator('.lh-image-frame:not([data-image-preset])').first()
    await expect(legacy).toBeVisible()
    const legacyBox = await box(legacy)
    const wrapperBox = await box(wrapperOf(legacy))
    expect(legacyBox.width).toBeCloseTo(Math.min(300, wrapperBox.width), 0)
    expect(await legacy.locator('img').getAttribute('alt')).toBe('')
    const imgBox = await box(legacy.locator('img'))
    expect(imgBox.width / imgBox.height).toBeCloseTo(16 / 9, 1)
  })

  test('learner view: full-width image screenshot', async () => {
    const full = wrapperOf(page.locator('.lh-image-frame[data-image-preset="100"]').first())
    await full.scrollIntoViewIfNeeded()
    await expect(full).toHaveScreenshot('dynamic-image-full-width.png')
  })

  test('editor: size presets change the image and stay within the content width', async () => {
    test.skip(isMobile(), 'The editor toolbar is exercised on the desktop viewport')
    await page.goto(`${viewUrl()}/edit`) // the proxy rewrites this to the standalone /editor route
    const controls = page.getByTestId('image-block-controls').first()
    await expect(controls).toBeVisible({ timeout: 30_000 })

    // first image starts at 25%
    const firstFrame = page.locator('.lh-image-frame').first()
    await expect(firstFrame).toHaveAttribute('data-image-preset', '25')

    for (const preset of ['50', '75', '100']) {
      await controls.getByTestId(`image-size-${preset}`).click()
      await expect(firstFrame).toHaveAttribute('data-image-preset', preset)
      await expect(controls.getByTestId(`image-size-${preset}`)).toHaveAttribute('aria-pressed', 'true')
      const frameBox = await box(firstFrame)
      const wrapperBox = await box(wrapperOf(firstFrame))
      expect(frameBox.width).toBeLessThanOrEqual(wrapperBox.width + 1)
    }

    // alt text is editable
    const alt = page.getByTestId('image-alt-input').first()
    await alt.fill('Descripción editada')
    await expect(alt).toHaveValue('Descripción editada')
  })
})
