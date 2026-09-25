import { describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import { JELENIUS_BRAND } from '../lib/brand.ts'
import { MIN_TEXT_CONTRAST, contrastRatio, mixColors, pickForeground } from '../lib/theme/color.ts'
import {
  NAVIGATION_CSS_VARS,
  deriveNavigationTokens,
} from '../lib/theme/navigationTokens.ts'
import {
  resolveOrganizationTheme,
  themeTokensToCssVars,
  themeVarsToRootCss,
} from '../lib/theme/resolveOrganizationTheme.ts'

const webRoot = path.resolve(import.meta.dirname, '..')
const css = fs.readFileSync(path.join(webRoot, 'styles/globals.css'), 'utf8')

const org = (general) => ({ config: { config: { customization: { general } } } })
const school = (color, secondary, accent, font = 'Inter') =>
  resolveOrganizationTheme(org({ color, secondary_color: secondary, accent_color: accent, font }))

const DON_BOSCO_LIKE = ['#162562', '#00001e', '#ff9d2f'] // same codebase, different config
const UNIVERSIDAD_ROJA = ['#A32035', '#541622', '#E7B84B']

describe('foreground — real contrast, not a fixed white/black', () => {
  test('pickForeground chooses by WCAG contrast', () => {
    expect(pickForeground('#000000', '#ffffff', '#0B1930')).toBe('#ffffff')
    expect(pickForeground('#ffffff', '#ffffff', '#0B1930')).toBe('#0B1930')
  })

  test('light secondary (#F4D000) gets a dark foreground; dark secondary (#172033) a light one', () => {
    expect(school('#0B1930', '#F4D000', '#19B7A5').brandSecondaryForeground).toBe(JELENIUS_BRAND.primaryColor)
    expect(school('#0B1930', '#172033', '#19B7A5').brandSecondaryForeground).toBe('#ffffff')
  })

  test('light primary (bright yellow) → dark; dark primary → light', () => {
    expect(school('#FFD700', '#172033', '#19B7A5').brandPrimaryForeground).toBe(JELENIUS_BRAND.primaryColor)
    expect(school('#000000', '#172033', '#19B7A5').brandPrimaryForeground).toBe('#ffffff')
  })

  test('a mid-tone accent (Jelenius teal) gets dark text — white on it would be ~2.6:1', () => {
    const t = school('#0B1930', '#172033', '#19B7A5')
    expect(t.brandAccentForeground).toBe(JELENIUS_BRAND.primaryColor)
    expect(contrastRatio('#19B7A5', '#ffffff')).toBeLessThan(3)
  })

  test('every resolved foreground is AA (≥ 4.5:1) over a sweep of hues and lightness', () => {
    const samples = []
    for (let r = 0; r <= 255; r += 51) for (let g = 0; g <= 255; g += 51) for (let b = 0; b <= 255; b += 51)
      samples.push('#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join(''))
    for (const c of samples) {
      const t = school(c, c, c)
      for (const [bg, fg] of [
        [t.brandPrimary, t.brandPrimaryForeground],
        [t.brandSecondary, t.brandSecondaryForeground],
        [t.brandAccent, t.brandAccentForeground],
      ]) {
        expect(contrastRatio(bg, fg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
      }
    }
  })
})

describe('semantic navigation tokens — one mapping, derived', () => {
  test('default branded mapping: header = primary, sidebar = secondary, active = accent', () => {
    const t = school(...DON_BOSCO_LIKE)
    expect(t.navigation.headerBackground).toBe('#162562')
    expect(t.navigation.headerForeground).toBe(t.brandPrimaryForeground)
    expect(t.navigation.sidebarBackground).toBe('#00001e')
    expect(t.navigation.sidebarForeground).toBe(t.brandSecondaryForeground)
    expect(t.navigation.navActiveBackground).toBe('#ff9d2f')
    expect(t.navigation.navActiveForeground).toBe(t.brandAccentForeground)
  })

  test('mobile navigation shares the sidebar source (no separate palette)', () => {
    const n = school(...UNIVERSIDAD_ROJA).navigation
    expect(n.mobileNavBackground).toBe(n.sidebarBackground)
    expect(n.mobileNavForeground).toBe(n.sidebarForeground)
  })

  test('the Universidad Roja case: red header, dark-red sidebar, gold active, right foregrounds', () => {
    const t = school(...UNIVERSIDAD_ROJA, 'Merriweather')
    expect(t.navigation.headerBackground).toBe('#a32035')
    expect(t.navigation.sidebarBackground).toBe('#541622')
    expect(t.navigation.navActiveBackground).toBe('#e7b84b')
    expect(t.navigation.headerForeground).toBe('#ffffff')
    expect(t.navigation.sidebarForeground).toBe('#ffffff')
    expect(t.navigation.navActiveForeground).toBe(JELENIUS_BRAND.primaryColor)
    expect(t.fontSans).toBe('Merriweather')
  })

  test('every text/surface pair in the navigation is AA over a sweep of school colors', () => {
    const palette = ['#000000', '#ffffff', '#F4D000', '#172033', '#19B7A5', '#7A1F35', '#808080', '#162562', '#ff9d2f', '#e6e6fa']
    for (const p of palette) for (const s of palette) for (const a of palette) {
      const n = school(p, s, a).navigation
      const pairs = [
        [n.headerBackground, n.headerForeground],
        [n.headerBackground, n.headerForegroundMuted],
        [n.sidebarBackground, n.sidebarForeground],
        [n.sidebarBackground, n.sidebarForegroundMuted],
        [n.navHoverBackground, n.navHoverForeground],
        [n.navActiveBackground, n.navActiveForeground],
        [n.mobileNavBackground, n.mobileNavForeground],
      ]
      for (const [bg, fg] of pairs) expect(contrastRatio(bg, fg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
    }
  })

  test('hover is derived from the surface and its own foreground — lighter on dark, darker on light', () => {
    const dark = school('#0B1930', '#172033', '#19B7A5').navigation
    expect(contrastRatio(dark.navHoverBackground, '#ffffff')).toBeLessThan(contrastRatio(dark.sidebarBackground, '#ffffff'))
    const light = school('#0B1930', '#F4D000', '#19B7A5').navigation
    // dark foreground on a light sidebar: hover moves TOWARD the foreground (darker), not toward white
    expect(light.navHoverBackground).not.toBe(light.sidebarBackground)
    expect(contrastRatio(light.navHoverBackground, '#000000')).toBeLessThan(contrastRatio(light.sidebarBackground, '#000000'))
    expect(contrastRatio(light.navHoverBackground, light.sidebarForeground)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
  })

  test('an accent that is invisible against the sidebar falls back to a visible tint', () => {
    const sameAsSidebar = school('#0B1930', '#172033', '#172033').navigation
    expect(sameAsSidebar.navActiveBackground).not.toBe(sameAsSidebar.sidebarBackground)
    expect(contrastRatio(sameAsSidebar.navActiveBackground, sameAsSidebar.sidebarBackground)).toBeGreaterThan(1.1)
    expect(sameAsSidebar.navActiveForeground).toBe(sameAsSidebar.sidebarForeground)
  })

  test('deriveNavigationTokens is a pure function of the six brand values', () => {
    const b = {
      primary: '#162562', primaryForeground: '#ffffff', secondary: '#00001e',
      secondaryForeground: '#ffffff', accent: '#ff9d2f', accentForeground: '#0B1930',
    }
    expect(deriveNavigationTokens(b)).toEqual(deriveNavigationTokens({ ...b }))
  })
})

describe('fallbacks', () => {
  test('no organization → the Jelenius identity', () => {
    for (const nothing of [null, undefined, {}, org({})]) {
      const t = resolveOrganizationTheme(nothing)
      expect(t.brandPrimary).toBe(JELENIUS_BRAND.primaryColor)
      expect(t.brandSecondary).toBe(JELENIUS_BRAND.secondaryColor)
      expect(t.brandAccent).toBe(JELENIUS_BRAND.accentColor)
      expect(t.navigation.headerBackground).toBe(JELENIUS_BRAND.primaryColor)
      expect(t.navigation.sidebarBackground).toBe(JELENIUS_BRAND.secondaryColor)
      expect(t.navigation.navActiveBackground).toBe(JELENIUS_BRAND.accentColor)
    }
  })

  test('an invalid field falls back on its own without dropping the rest of the school theme', () => {
    const t = resolveOrganizationTheme(org({ color: '#162562', secondary_color: 'not-a-color', accent_color: '#ff9d2f' }))
    expect(t.brandPrimary).toBe('#162562')
    expect(t.brandSecondary).toBe(JELENIUS_BRAND.secondaryColor)
    expect(t.brandAccent).toBe('#ff9d2f')
  })
})

describe('CSS variables (SSR)', () => {
  test('every brand and navigation variable is produced', () => {
    const vars = themeVarsToRootCss(themeTokensToCssVars(school(...DON_BOSCO_LIKE)))
    for (const name of [
      '--brand-primary', '--brand-primary-foreground', '--brand-secondary', '--brand-secondary-foreground',
      '--brand-accent', '--brand-accent-foreground', '--font-org-sans',
      ...Object.values(NAVIGATION_CSS_VARS),
    ]) {
      expect(vars).toContain(`${name}:`)
    }
    expect(vars.startsWith(':root{')).toBe(true)
  })

  test('the :root rule can never close its <style> element', () => {
    expect(themeVarsToRootCss({ '--x': '</style><script>' })).not.toContain('</style>')
  })

  test('the :root defaults in globals.css are exactly the Jelenius derivation (no drift)', () => {
    const jelenius = themeTokensToCssVars(resolveOrganizationTheme(null))
    const rootBlock = css.slice(css.indexOf('--brand-primary: #0B1930'))
    for (const [name, value] of Object.entries(jelenius)) {
      if (name === '--font-org-sans') continue
      const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(rootBlock)
      expect(m, `${name} missing from :root defaults`).not.toBeNull()
      expect(m[1].toLowerCase(), name).toBe(value.toLowerCase())
    }
  })
})

describe('Tailwind ↔ runtime tokens (compiled output, not source)', () => {
  test('brand and app utilities read the runtime variable directly', async () => {
    const { default: tailwind } = await import('@tailwindcss/postcss')
    const { default: postcss } = await import('postcss')
    const input =
      css +
      '\n@source inline("bg-brand text-brand-foreground bg-brand-secondary text-brand-secondary-foreground bg-brand-accent text-brand-accent-foreground bg-brand/20 bg-app-header text-app-header-foreground bg-app-sidebar text-app-sidebar-foreground bg-app-nav-active text-app-nav-active-foreground bg-app-mobile-nav hover:bg-app-nav-hover border-app-nav-border");'
    const result = await postcss([tailwind({ base: webRoot, optimize: { minify: false } })]).process(input, {
      from: path.join(webRoot, 'styles/globals.css'),
    })
    const out = result.css
    const rule = (selector) => new RegExp(`\\.${selector.replace(/[/:]/g, '\\\\$&')}\\s*\\{([^}]*)\\}`).exec(out)?.[1] ?? ''

    expect(rule('bg-brand')).toMatch(/background-color:\s*var\(--brand-primary\)/)
    expect(rule('text-brand-foreground')).toMatch(/color:\s*var\(--brand-primary-foreground\)/)
    expect(rule('bg-brand-secondary')).toMatch(/background-color:\s*var\(--brand-secondary\)/)
    expect(rule('text-brand-secondary-foreground')).toMatch(/color:\s*var\(--brand-secondary-foreground\)/)
    expect(rule('bg-brand-accent')).toMatch(/background-color:\s*var\(--brand-accent\)/)
    expect(rule('text-brand-accent-foreground')).toMatch(/color:\s*var\(--brand-accent-foreground\)/)
    expect(rule('bg-app-header')).toMatch(/background-color:\s*var\(--app-header-bg\)/)
    expect(rule('text-app-header-foreground')).toMatch(/color:\s*var\(--app-header-fg\)/)
    expect(rule('bg-app-sidebar')).toMatch(/background-color:\s*var\(--app-sidebar-bg\)/)
    expect(rule('bg-app-nav-active')).toMatch(/background-color:\s*var\(--app-nav-active-bg\)/)
    expect(rule('text-app-nav-active-foreground')).toMatch(/color:\s*var\(--app-nav-active-fg\)/)
    expect(rule('bg-app-mobile-nav')).toMatch(/background-color:\s*var\(--app-mobile-nav-bg\)/)
    // opacity modifiers keep working with a runtime variable
    expect(out).toMatch(/\.bg-brand\\\/20[^{]*\{[^}]*var\(--brand-primary\)/)

    // The bug: these must NOT be routed through a :root-resolved --color-* alias.
    expect(out).not.toMatch(/var\(--color-brand/)
  }, 60_000)

  test('brand tokens are not declared in the static @theme block', () => {
    const staticTheme = css.slice(css.indexOf('@theme {'), css.indexOf('@theme inline'))
    expect(staticTheme).not.toContain('--color-brand')
    expect(staticTheme).not.toContain('--color-app-')
    const inline = css.slice(css.indexOf('@theme inline'))
    expect(inline).toContain('--color-brand: var(--brand-primary)')
  })
})
