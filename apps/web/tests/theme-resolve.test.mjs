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
})
