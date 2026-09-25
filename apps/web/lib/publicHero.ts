/**
 * Color resolution for the public landing hero.
 *
 * The landing editor historically created hero sections with hard-coded
 * defaults (black heading, gray subheading, white background, black CTA with
 * white text) and those literals were persisted into every school's config.
 * Rendering them verbatim is what made schools' public pages ignore their own
 * branding. Values that are still exactly those legacy defaults (or empty) are
 * therefore treated as "not customised" and resolve to organization theme
 * tokens; anything else the admin chose is respected untouched.
 *
 * Pure (no React / no DOM) so the rules are unit-testable.
 */

export const LEGACY_HERO_DEFAULTS = {
  headingColor: '#000000',
  subheadingColor: '#666666',
  backgroundColor: '#ffffff',
  buttonBackground: '#000000',
  buttonColor: '#ffffff',
} as const

const norm = (value?: string | null) => (value || '').trim().toLowerCase()
const isUnset = (value: string | undefined | null, legacy: string) => {
  const v = norm(value)
  return v === '' || v === legacy
}

/** Theme-token CSS values (resolved by the org wrapper's CSS variables). */
export const HERO_TOKENS = {
  heading: 'hsl(var(--foreground))',
  subheading: 'hsl(var(--text-secondary))',
  // A very soft brand-derived tint over the surface color — mixing (instead of
  // using the raw brand color) keeps text contrast independent of the palette.
  tintBackground:
    'linear-gradient(135deg, color-mix(in srgb, var(--brand-primary) 9%, hsl(var(--surface))), color-mix(in srgb, var(--brand-accent) 7%, hsl(var(--surface))))',
  brand: 'var(--brand-primary)',
  brandForeground: 'var(--brand-primary-foreground)',
} as const

export interface HeroLike {
  background?: {
    type?: 'solid' | 'gradient' | 'image'
    color?: string
    colors?: string[]
    direction?: string
    image?: string
  }
  heading?: { color?: string }
  subheading?: { color?: string }
  illustration?: { size?: 'small' | 'medium' | 'large' }
}

export function resolveHeroColors(section: HeroLike): {
  heading: string
  subheading: string
  background: string
  hasCustomBackground: boolean
} {
  const bg = section.background
  let background: string = HERO_TOKENS.tintBackground
  let hasCustomBackground = false

  if (bg?.type === 'gradient' && bg.colors && bg.colors.length > 0) {
    background = `linear-gradient(${bg.direction || '45deg'}, ${bg.colors.join(', ')})`
    hasCustomBackground = true
  } else if (bg?.type === 'image' && bg.image) {
    background = `url(${bg.image}) center/cover`
    hasCustomBackground = true
  } else if (bg?.type === 'solid' && !isUnset(bg.color, LEGACY_HERO_DEFAULTS.backgroundColor)) {
    background = bg.color as string
    hasCustomBackground = true
  }

  return {
    heading: isUnset(section.heading?.color, LEGACY_HERO_DEFAULTS.headingColor)
      ? HERO_TOKENS.heading
      : (section.heading?.color as string),
    subheading: isUnset(section.subheading?.color, LEGACY_HERO_DEFAULTS.subheadingColor)
      ? HERO_TOKENS.subheading
      : (section.subheading?.color as string),
    background,
    hasCustomBackground,
  }
}

export type HeroButtonVariant = 'brand' | 'brand-outline' | 'custom'

export interface HeroButtonStyle {
  variant: HeroButtonVariant
  /** Only set for 'custom' — the admin's own colors */
  background?: string
  color?: string
}

/**
 * The first button is the primary CTA (solid brand); later ones are secondary
 * (brand outline). A button keeps its own colors only if the admin actually
 * changed them from the legacy black/white default.
 */
export function resolveHeroButton(
  button: { background?: string; color?: string },
  index: number
): HeroButtonStyle {
  const untouched =
    isUnset(button.background, LEGACY_HERO_DEFAULTS.buttonBackground) &&
    isUnset(button.color, LEGACY_HERO_DEFAULTS.buttonColor)
  if (untouched) return { variant: index === 0 ? 'brand' : 'brand-outline' }
  return { variant: 'custom', background: button.background, color: button.color }
}

/** Share of the hero width given to the illustration on desktop (rest is text). */
export function heroImageShare(size?: 'small' | 'medium' | 'large'): number {
  switch (size) {
    case 'small':
      return 40
    case 'large':
      return 55
    default:
      return 50
  }
}
