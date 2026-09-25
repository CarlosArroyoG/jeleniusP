/**
 * Small, dependency-free color math for the theme engine (WCAG 2.1 relative
 * luminance / contrast, sRGB mixing). Pure — no DOM, no React — so it runs
 * identically on the server (SSR theme) and the client and is unit-testable.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

/** `#rrggbb` (lowercase, 6 digits) → channels, or null when malformed. */
export function parseHex(hex: string): Rgb | null {
  const m = /^#([0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)))

export function toHex({ r, g, b }: Rgb): string {
  return '#' + [r, g, b].map((c) => clamp(c).toString(16).padStart(2, '0')).join('')
}

/** WCAG 2.1 relative luminance of a `#rrggbb` color (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex)
  if (!rgb) return 0
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two `#rrggbb` colors (1 … 21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Linear sRGB interpolation: weight 0 → `a`, weight 1 → `b`. */
export function mixColors(a: string, b: string, weight: number): string {
  const ca = parseHex(a)
  const cb = parseHex(b)
  if (!ca || !cb) return a
  const w = Math.min(1, Math.max(0, weight))
  return toHex({
    r: ca.r + (cb.r - ca.r) * w,
    g: ca.g + (cb.g - ca.g) * w,
    b: ca.b + (cb.b - ca.b) * w,
  })
}

/** WCAG AA for normal text. */
export const MIN_TEXT_CONTRAST = 4.5

/**
 * The legible foreground for `background`: whichever of `light` / `dark` has
 * the higher real contrast — not a luminance cut-off. If neither reaches AA
 * (mid-tone backgrounds where a brand ink is too soft) pure black is the last
 * resort, which always clears 4.5:1 against a color that white cannot.
 */
export function pickForeground(background: string, light = '#ffffff', dark = '#000000'): string {
  const cLight = contrastRatio(background, light)
  const cDark = contrastRatio(background, dark)
  const best = cDark > cLight ? dark : light
  const bestContrast = Math.max(cLight, cDark)
  if (bestContrast >= MIN_TEXT_CONTRAST) return best
  return contrastRatio(background, '#000000') > bestContrast ? '#000000' : best
}

/**
 * Moves `color` toward `target` in small steps until it reaches `min` contrast
 * against `background` (or reaches `target`). Used to keep de-emphasised text
 * legible on any brand background.
 */
export function ensureContrast(color: string, background: string, min: number, target: string): string {
  let current = color
  for (let step = 1; step <= 20 && contrastRatio(current, background) < min; step++) {
    current = mixColors(color, target, step / 20)
  }
  return current
}
