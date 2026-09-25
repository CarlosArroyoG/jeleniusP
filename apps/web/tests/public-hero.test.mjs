import { describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  HERO_TOKENS,
  heroImageShare,
  resolveHeroButton,
  resolveHeroColors,
} from '../lib/publicHero.ts'

const webRoot = path.resolve(import.meta.dirname, '..')
const read = (rel) => fs.readFileSync(path.join(webRoot, rel), 'utf8')

// What the landing editor persisted for every school before this change.
const legacyHero = {
  background: { type: 'solid', color: '#ffffff' },
  heading: { color: '#000000' },
  subheading: { color: '#666666' },
}

describe('resolveHeroColors — hero uses brand tokens unless the admin customised it', () => {
  test('legacy editor defaults resolve to theme tokens (not hardcoded black / gray / white)', () => {
    const c = resolveHeroColors(legacyHero)
    expect(c.heading).toBe(HERO_TOKENS.heading)
    expect(c.subheading).toBe(HERO_TOKENS.subheading)
    expect(c.background).toBe(HERO_TOKENS.tintBackground)
    expect(c.hasCustomBackground).toBe(false)
    expect(c.heading).toContain('var(--foreground)')
    expect(c.background).toContain('var(--brand-primary)')
    expect(c.background).toContain('var(--surface)')
  })

  test('empty / missing colors are treated as not customised', () => {
    const c = resolveHeroColors({ background: { type: 'solid' }, heading: {}, subheading: {} })
    expect(c.heading).toBe(HERO_TOKENS.heading)
    expect(c.background).toBe(HERO_TOKENS.tintBackground)
    expect(() => resolveHeroColors({})).not.toThrow()
  })

  test('comparison is case / whitespace insensitive for legacy defaults', () => {
    const c = resolveHeroColors({ background: { type: 'solid', color: ' #FFFFFF ' }, heading: { color: '#000000' } })
    expect(c.hasCustomBackground).toBe(false)
  })

  test('a color the admin actually chose is respected untouched', () => {
    const c = resolveHeroColors({
      background: { type: 'solid', color: '#7A1F35' },
      heading: { color: '#ffffff' },
      subheading: { color: '#f5e6ea' },
    })
    expect(c.background).toBe('#7A1F35')
    expect(c.heading).toBe('#ffffff')
    expect(c.subheading).toBe('#f5e6ea')
    expect(c.hasCustomBackground).toBe(true)
  })

  test('gradient and image backgrounds are honoured', () => {
    const g = resolveHeroColors({ background: { type: 'gradient', colors: ['#111111', '#222222'], direction: '90deg' } })
    expect(g.background).toBe('linear-gradient(90deg, #111111, #222222)')
    const i = resolveHeroColors({ background: { type: 'image', image: '/bg.jpg' } })
    expect(i.background).toBe('url(/bg.jpg) center/cover')
  })
})

describe('resolveHeroButton — CTA is brand-colored, not the legacy black', () => {
  test('legacy black button with white text → brand primary', () => {
    expect(resolveHeroButton({ background: '#000000', color: '#ffffff' }, 0)).toEqual({ variant: 'brand' })
  })

  test('a button with no colors → brand primary', () => {
    expect(resolveHeroButton({}, 0)).toEqual({ variant: 'brand' })
  })

  test('secondary buttons with legacy colors become brand outline', () => {
    expect(resolveHeroButton({ background: '#000000', color: '#ffffff' }, 1)).toEqual({ variant: 'brand-outline' })
  })

  test('custom colors chosen by the admin are kept', () => {
    expect(resolveHeroButton({ background: '#D6AA52', color: '#32121A' }, 0)).toEqual({
      variant: 'custom',
      background: '#D6AA52',
      color: '#32121A',
    })
  })

  test('changing only one of the two legacy colors counts as customised', () => {
    expect(resolveHeroButton({ background: '#000000', color: '#ff0000' }, 0).variant).toBe('custom')
  })
})

describe('heroImageShare — the image gets the larger half', () => {
  test('sizes map to 40 / 50 / 55 and default to 50', () => {
    expect(heroImageShare('small')).toBe(40)
    expect(heroImageShare('medium')).toBe(50)
    expect(heroImageShare('large')).toBe(55)
    expect(heroImageShare(undefined)).toBe(50)
  })
})

describe('renderer source guards', () => {
  const landing = read('components/Landings/LandingCustom.tsx')

  test('hero image fills its column (cover) instead of floating small', () => {
    expect(landing).toContain('data-testid="public-hero-image"')
    expect(landing).toMatch(/absolute inset-0 h-full w-full object-cover/)
    expect(landing).not.toMatch(/h-full w-full object-contain/)
  })

  test('hero height is compact on desktop', () => {
    expect(landing).toContain('md:min-h-[340px]')
    expect(landing).toContain('lg:min-h-[400px]')
    expect(landing).not.toContain('sm:min-h-[500px]')
  })

  test('no hardcoded black / gray in the landing renderer', () => {
    expect(landing).not.toMatch(/bg-black|bg-gray-|text-gray-|bg-white\b/)
  })

  test('sections no longer stack huge vertical padding / double horizontal margins', () => {
    expect(landing).not.toContain('py-16')
    expect(landing).not.toContain('lg:mx-16')
  })

  test('people sections render as cards (one per person) and carry the header anchor', () => {
    expect(landing).toContain('data-testid="public-person-card"')
    expect(landing).toContain('LANDING_PEOPLE_ANCHOR')
  })

  test('course cards use the brand CTA, not a black button', () => {
    const thumb = read('components/Objects/Thumbnails/CourseThumbnailLanding.tsx')
    expect(thumb).toContain('bg-brand text-brand-foreground')
    expect(thumb).not.toMatch(/bg-black/)
  })
})

describe('footer — a single Jelenius platform element', () => {
  const layout = read('app/orgs/[orgslug]/(withmenu)/layout.tsx')
  const watermark = read('components/Objects/Watermark.tsx')

  test('layout no longer renders a separate icon AND a floating watermark', () => {
    expect(layout).not.toContain('JELENIUS_BRAND.icon')
    // <Watermark /> is rendered exactly once, inside the footer
    expect(layout.match(/^\s*<Watermark \/>/gm)?.length).toBe(1)
  })

  test('the watermark is inline (not a fixed floating overlay)', () => {
    expect(watermark).not.toContain('fixed')
    expect(watermark).toContain('data-testid="platform-credit"')
  })

  test('EE deployments still hide the credit (visibility rules unchanged)', () => {
    expect(watermark).toContain("if (mode === 'ee') return null")
  })
})
