/**
 * Color contrast utilities for accessible text on dynamic backgrounds.
 * Uses WCAG 2.1 relative luminance to decide light vs dark foreground.
 */

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return null
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null
  return { r, g, b }
}

/** WCAG 2.1 relative luminance */
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/** Returns true when the background is light enough to need dark text */
export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  return relativeLuminance(rgb.r, rgb.g, rgb.b) > 0.4
}

/**
 * Tailwind class sets for header controls (links, icon buttons, search, profile).
 *
 * All colors come from the application navigation tokens
 * (`--app-header-*`, see lib/theme/navigationTokens.ts), so they follow the
 * organization's brand AND its computed foreground — nothing here assumes a
 * dark or a light header.
 *
 * `onHeader` — pass a truthy value (callers historically pass the org's primary
 * color) when the control sits on the header surface. With no value the controls
 * sit on a neutral light surface (e.g. a page body) and get neutral classes.
 */
export function getMenuColorClasses(onHeader: string | boolean = '') {
  if (!onHeader) {
    return {
      text: 'text-gray-700',
      textMuted: 'text-gray-500',
      hoverBg: 'hover:bg-gray-100',
      iconBtn: 'hover:bg-gray-100 text-gray-600',
      searchBg:
        'bg-white text-black placeholder:text-black/40 focus:ring-black/5 focus:border-black/20 nice-shadow',
      searchIcon: 'text-black/40 group-focus-within:text-black/60',
      signUpBtn: 'bg-brand text-brand-foreground hover:opacity-90',
      profileHover: 'hover:bg-gray-50',
      profileName: 'text-gray-900',
      profileMuted: 'text-gray-500',
    }
  }

  return {
    text: 'text-app-header-foreground',
    textMuted: 'text-app-header-muted',
    hoverBg: 'hover:bg-app-header-hover',
    iconBtn: 'hover:bg-app-header-hover text-app-header-foreground',
    searchBg:
      'bg-app-header-foreground/15 text-app-header-foreground placeholder:text-app-header-muted focus:ring-app-header-foreground/25 focus:border-app-header-foreground/40',
    searchIcon: 'text-app-header-muted group-focus-within:text-app-header-foreground',
    // The header's CTA is the accent (a brand-primary button would vanish on a brand-primary header).
    signUpBtn: 'bg-app-nav-active text-app-nav-active-foreground hover:opacity-90',
    profileHover: 'hover:bg-app-header-hover',
    profileName: 'text-app-header-foreground',
    profileMuted: 'text-app-header-muted',
  }
}
