import { describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import { JELENIUS_BRAND } from '../lib/brand.ts'
import { getOrgSquareLogoFile, getOrgWideLogoUrl, hasOrgLogo } from '../components/Objects/Org/OrgSquareLogo.tsx'

const webRoot = path.resolve(import.meta.dirname, '..')
const HEX_RE = /^#[0-9a-fA-F]{6}$/

// BrandIcon/BrandWordmark (components/Brand/BrandMark.tsx) are thin JSX
// wrappers with no branching logic of their own — they always render
// JELENIUS_BRAND.icon/wordmark. There is nothing to unit test there beyond
// what's covered here: the constant itself is well-formed, and the actual
// per-org fallback DECISION (does this org have a logo, or does the caller's
// fallback — a BrandIcon/BrandWordmark — render instead?) lives in
// OrgSquareLogo.tsx, which is plain, DOM-free logic and is what these tests
// exercise directly instead of rendering JSX (this test suite has no DOM).
describe('JELENIUS_BRAND — the platform default BrandLogo/BrandName fall back to', () => {
  test('name is a non-empty string', () => {
    expect(typeof JELENIUS_BRAND.name).toBe('string')
    expect(JELENIUS_BRAND.name.length).toBeGreaterThan(0)
  })

  test.each(['primaryColor', 'secondaryColor', 'accentColor', 'tertiaryColor'])(
    '%s is a valid #rrggbb hex color',
    (key) => {
      expect(JELENIUS_BRAND[key]).toMatch(HEX_RE)
    }
  )

  test.each(['wordmark', 'icon', 'favicon'])('%s points at a file that actually exists under public/', (key) => {
    const publicPath = path.join(webRoot, 'public', JELENIUS_BRAND[key].replace(/^\//, ''))
    expect(fs.existsSync(publicPath)).toBe(true)
  })
})

describe('OrgSquareLogo fallback chain (square → wide → caller fallback)', () => {
  test('no logo of any kind → hasOrgLogo is false, both lookups are empty', () => {
    const org = { org_uuid: 'org_x', logo_image: null, config: { config: { customization: { general: {} } } } }
    expect(hasOrgLogo(org)).toBe(false)
    expect(getOrgSquareLogoFile(org)).toBe('')
    expect(getOrgWideLogoUrl(org)).toBeNull()
  })

  test('org has only a wide logo_image → hasOrgLogo true, square lookup still empty', () => {
    const org = { org_uuid: 'org_x', logo_image: 'wide.png', config: { config: { customization: { general: {} } } } }
    expect(hasOrgLogo(org)).toBe(true)
    expect(getOrgSquareLogoFile(org)).toBe('')
    expect(getOrgWideLogoUrl(org)).toContain('wide.png')
  })

  test('org has a square_logo_image (v2 shape) → hasOrgLogo true, square file resolved', () => {
    const org = {
      org_uuid: 'org_x',
      logo_image: null,
      config: { config: { customization: { general: { square_logo_image: 'square.png' } } } },
    }
    expect(hasOrgLogo(org)).toBe(true)
    expect(getOrgSquareLogoFile(org)).toBe('square.png')
  })

  test('org has a square_logo_image (v1 shape, no customization wrapper) → still resolved', () => {
    const org = {
      org_uuid: 'org_x',
      config: { config: { general: { square_logo_image: 'square-v1.png' } } },
    }
    expect(getOrgSquareLogoFile(org)).toBe('square-v1.png')
  })

  test('missing org / missing config never throws — treated as no logo', () => {
    expect(() => hasOrgLogo(null)).not.toThrow()
    expect(hasOrgLogo(null)).toBe(false)
    expect(hasOrgLogo(undefined)).toBe(false)
    expect(getOrgWideLogoUrl(null)).toBeNull()
  })
})
