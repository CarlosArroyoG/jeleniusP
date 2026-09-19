import { describe, expect, test } from 'bun:test'
import { normalizeHexColor, resolveOrganizationTheme } from '../lib/theme/resolveOrganizationTheme.ts'
import { JELENIUS_BRAND } from '../lib/brand.ts'

function orgWithGeneral(general, { v1 = false } = {}) {
  const config = v1 ? { general } : { customization: { general } }
  return { config: { config } }
}

describe('normalizeHexColor', () => {
  test('accepts a 6-digit hex with #', () => {
    expect(normalizeHexColor('#0B1930')).toBe('#0b1930')
  })

  test('accepts a 6-digit hex without #', () => {
    expect(normalizeHexColor('0B1930')).toBe('#0b1930')
  })

  test('expands a 3-digit shorthand', () => {
    expect(normalizeHexColor('#abc')).toBe('#aabbcc')
  })

  test.each([
    [null],
    [undefined],
    [''],
    ['   '],
    ['not-a-color'],
    ['#12345'],
    ['#1234567'],
    [123456],
    [{}],
  ])('rejects invalid input: %p', (input) => {
    expect(normalizeHexColor(input)).toBeNull()
  })
})

describe('resolveOrganizationTheme — Jelenius fallback', () => {
  test('org is null → full Jelenius default', () => {
    const theme = resolveOrganizationTheme(null)
    expect(theme.brandPrimary).toBe(JELENIUS_BRAND.primaryColor)
    expect(theme.brandAccent).toBe(JELENIUS_BRAND.accentColor)
    expect(theme.brandSecondary).toBe(JELENIUS_BRAND.secondaryColor)
    expect(theme.fontSans).toBe(JELENIUS_BRAND.font)
    expect(theme.brandPrimaryForeground).toBeTruthy()
    expect(theme.brandSecondaryForeground).toBeTruthy()
    expect(theme.brandAccentForeground).toBeTruthy()
  })

  test('org is undefined → full Jelenius default', () => {
    const theme = resolveOrganizationTheme(undefined)
    expect(theme.brandPrimary).toBe(JELENIUS_BRAND.primaryColor)
  })

  test('org has a config object but no customization at all → Jelenius default', () => {
    const theme = resolveOrganizationTheme({ config: { config: {} } })
    expect(theme.brandPrimary).toBe(JELENIUS_BRAND.primaryColor)
    expect(theme.fontSans).toBe(JELENIUS_BRAND.font)
  })
})

describe('resolveOrganizationTheme — organization override', () => {
  test('valid color and curated font both apply (v2 shape)', () => {
    const org = orgWithGeneral({ color: '#7A1F2B', font: 'Poppins' })
    const theme = resolveOrganizationTheme(org)
    expect(theme.brandPrimary).toBe('#7a1f2b')
    expect(theme.fontSans).toBe('Poppins')
  })

  test('v1 shape (config.general, no customization wrapper) still resolves', () => {
    const org = orgWithGeneral({ color: '#123456', font: 'Roboto' }, { v1: true })
    const theme = resolveOrganizationTheme(org)
    expect(theme.brandPrimary).toBe('#123456')
    expect(theme.fontSans).toBe('Roboto')
  })

  test('color set, font missing → org color + Jelenius font (per-field fallback, not all-or-nothing)', () => {
    const org = orgWithGeneral({ color: '#7A1F2B' })
    const theme = resolveOrganizationTheme(org)
    expect(theme.brandPrimary).toBe('#7a1f2b')
    expect(theme.fontSans).toBe(JELENIUS_BRAND.font)
  })

  test('font set, color missing → Jelenius color + org font', () => {
    const org = orgWithGeneral({ font: 'Lato' })
    const theme = resolveOrganizationTheme(org)
    expect(theme.brandPrimary).toBe(JELENIUS_BRAND.primaryColor)
    expect(theme.fontSans).toBe('Lato')
  })

  test('organization secondary color applies independently of primary/accent', () => {
    const org = orgWithGeneral({ color: '#7A1F2B', secondary_color: '#32121A' })
    const theme = resolveOrganizationTheme(org)
    expect(theme.brandPrimary).toBe('#7a1f2b')
    expect(theme.brandSecondary).toBe('#32121a')
    expect(theme.brandAccent).toBe(JELENIUS_BRAND.accentColor)
  })

  test('organization accent color applies independently of primary/secondary', () => {
    const org = orgWithGeneral({ accent_color: '#D6AA52' })
    const theme = resolveOrganizationTheme(org)
    expect(theme.brandAccent).toBe('#d6aa52')
    expect(theme.brandPrimary).toBe(JELENIUS_BRAND.primaryColor)
    expect(theme.brandSecondary).toBe(JELENIUS_BRAND.secondaryColor)
  })

  test('secondary/accent resolve independently in the v1 shape too', () => {
    const org = orgWithGeneral({ secondary_color: '#32121A', accent_color: '#D6AA52' }, { v1: true })
    const theme = resolveOrganizationTheme(org)
    expect(theme.brandSecondary).toBe('#32121a')
    expect(theme.brandAccent).toBe('#d6aa52')
  })

  test('all four fields (primary, secondary, accent, font) can be set independently at once', () => {
    const org = orgWithGeneral({
      color: '#7A1F35',
      secondary_color: '#32121A',
      accent_color: '#D6AA52',
      font: 'Merriweather',
    })
    const theme = resolveOrganizationTheme(org)
    expect(theme.brandPrimary).toBe('#7a1f35')
    expect(theme.brandSecondary).toBe('#32121a')
    expect(theme.brandAccent).toBe('#d6aa52')
    expect(theme.fontSans).toBe('Merriweather')
  })
})

describe('resolveOrganizationTheme — backward compatibility', () => {
  test('an org config saved before secondary/accent existed (only color+font keys present) still resolves cleanly', () => {
    // Exactly the shape a pre-phase-3 config has: no secondary_color/accent_color
    // keys at all, not even as empty strings.
    const org = orgWithGeneral({ color: '#0B1F3A', font: 'Inter' })
    const theme = resolveOrganizationTheme(org)
    expect(theme.brandPrimary).toBe('#0b1f3a')
    expect(theme.fontSans).toBe('Inter')
    expect(theme.brandSecondary).toBe(JELENIUS_BRAND.secondaryColor)
    expect(theme.brandAccent).toBe(JELENIUS_BRAND.accentColor)
  })

  test('an org config with only legacy v1 general.color (no v2 customization wrapper at all) still resolves', () => {
    const org = orgWithGeneral({ color: '#0B1F3A' }, { v1: true })
    const theme = resolveOrganizationTheme(org)
    expect(theme.brandPrimary).toBe('#0b1f3a')
    expect(theme.brandSecondary).toBe(JELENIUS_BRAND.secondaryColor)
    expect(theme.brandAccent).toBe(JELENIUS_BRAND.accentColor)
  })
})

describe('resolveOrganizationTheme — invalid/missing values never throw and never leak through', () => {
  test('malformed color string falls back to Jelenius, does not throw', () => {
    const org = orgWithGeneral({ color: 'not-a-hex-color' })
    expect(() => resolveOrganizationTheme(org)).not.toThrow()
    expect(resolveOrganizationTheme(org).brandPrimary).toBe(JELENIUS_BRAND.primaryColor)
  })

  test('a font not on the curated list falls back to Jelenius default, does not pass through arbitrary strings', () => {
    const org = orgWithGeneral({ font: '</style><script>alert(1)</script>' })
    const theme = resolveOrganizationTheme(org)
    expect(theme.fontSans).toBe(JELENIUS_BRAND.font)
  })

  test('non-object config does not throw', () => {
    expect(() => resolveOrganizationTheme({ config: { config: 'nonsense' } })).not.toThrow()
    expect(() => resolveOrganizationTheme('nonsense')).not.toThrow()
    expect(() => resolveOrganizationTheme(42)).not.toThrow()
  })

  test('brandPrimaryForeground is always black or white (WCAG contrast), never empty', () => {
    const dark = resolveOrganizationTheme(orgWithGeneral({ color: '#0B1930' }))
    const light = resolveOrganizationTheme(orgWithGeneral({ color: '#FFFFFF' }))
    expect(['#ffffff', '#0B1930']).toContain(dark.brandPrimaryForeground)
    expect(dark.brandPrimaryForeground).toBe('#ffffff')
    expect(light.brandPrimaryForeground).toBe('#0B1930')
  })

  test('malformed secondary color falls back to Jelenius secondary, does not throw', () => {
    const org = orgWithGeneral({ secondary_color: 'url(javascript:alert(1))' })
    expect(() => resolveOrganizationTheme(org)).not.toThrow()
    expect(resolveOrganizationTheme(org).brandSecondary).toBe(JELENIUS_BRAND.secondaryColor)
  })

  test('malformed accent color falls back to Jelenius accent, does not throw', () => {
    const org = orgWithGeneral({ accent_color: 'var(--evil)' })
    expect(() => resolveOrganizationTheme(org)).not.toThrow()
    expect(resolveOrganizationTheme(org).brandAccent).toBe(JELENIUS_BRAND.accentColor)
  })

  test.each([
    ['calc(1px + 1px)'],
    ['expression(alert(1))'],
    ['javascript:alert(1)'],
    ['#7A1F2B; background: url(evil.com)'],
  ])('CSS/script injection attempts in any color field are rejected, not sanitized-and-passed-through: %p', (payload) => {
    const theme = resolveOrganizationTheme(orgWithGeneral({ color: payload, secondary_color: payload, accent_color: payload }))
    expect(theme.brandPrimary).toBe(JELENIUS_BRAND.primaryColor)
    expect(theme.brandSecondary).toBe(JELENIUS_BRAND.secondaryColor)
    expect(theme.brandAccent).toBe(JELENIUS_BRAND.accentColor)
  })

  test('dynamic foreground resolves correctly for a very light, near-white configurable color', () => {
    const theme = resolveOrganizationTheme(orgWithGeneral({ color: '#FFD700', secondary_color: '#FFD700', accent_color: '#FFD700' }))
    // #FFD700 (gold) is light — legible text on it is dark, never white-on-yellow.
    expect(theme.brandPrimaryForeground).toBe(JELENIUS_BRAND.primaryColor)
    expect(theme.brandSecondaryForeground).toBe(JELENIUS_BRAND.primaryColor)
    expect(theme.brandAccentForeground).toBe(JELENIUS_BRAND.primaryColor)
  })

  test('dynamic foreground resolves correctly for a very dark configurable color', () => {
    const theme = resolveOrganizationTheme(orgWithGeneral({ color: '#000000', secondary_color: '#000000', accent_color: '#000000' }))
    expect(theme.brandPrimaryForeground).toBe('#ffffff')
    expect(theme.brandSecondaryForeground).toBe('#ffffff')
    expect(theme.brandAccentForeground).toBe('#ffffff')
  })
})
