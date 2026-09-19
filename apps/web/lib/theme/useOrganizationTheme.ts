'use client'
import { useMemo } from 'react'
import { useOrg } from '@components/Contexts/OrgContext'
import { resolveOrganizationTheme, themeTokensToCssVars } from './resolveOrganizationTheme'
import type { ThemeTokens } from './tokens'

/**
 * The org-aware theme, ready to use in a client component.
 *
 * `style` is a plain object of CSS custom properties (`--brand-primary`,
 * etc.) meant to be spread onto whatever element currently owns the
 * org-branding wrapper style (e.g. the `(withmenu)` layout's root `div`) —
 * it does not render anything itself, so it composes with that element's
 * other inline styles instead of requiring a new DOM node.
 *
 * Descendants can then use the `bg-brand` / `text-brand-foreground` /
 * `bg-brand-accent` Tailwind utilities (see `styles/globals.css`'s
 * `@theme`) instead of reading `tokens.brandPrimary` and writing inline
 * styles by hand — reach for `tokens` directly only where an actual dynamic
 * value is needed (contrast-aware icon filters, non-Tailwind consumers).
 */
export function useOrganizationTheme(): { tokens: ThemeTokens; style: Record<string, string> } {
  const org = useOrg()

  return useMemo(() => {
    const tokens = resolveOrganizationTheme(org)
    return { tokens, style: themeTokensToCssVars(tokens) }
  }, [org])
}
