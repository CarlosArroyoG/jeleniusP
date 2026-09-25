'use client'
import { useEffect } from 'react'

/**
 * Mirrors the organization's theme variables onto <html>.
 *
 * The org layout paints them on its wrapper element (server-rendered, so the first
 * HTML already carries the school's identity). UI that React portals to <body> —
 * the mobile navigation, flyout menus, dialogs — sits OUTSIDE that wrapper and
 * would otherwise resolve the Jelenius defaults from :root. Those surfaces only
 * mount after hydration (they open on interaction / after `mounted`), so setting the
 * variables here, once the app is running, is early enough for them; nothing visible
 * in the initial paint depends on it.
 *
 * (A server-rendered `<style>:root{…}</style>` was tried first: React does not emit
 * a bare `<style>` element from a nested server layout, so there is no such tag.)
 */
export default function OrgThemeRootSync({ vars }: { vars: Record<string, string> }) {
  const serialized = JSON.stringify(vars)

  useEffect(() => {
    const entries = Object.entries(JSON.parse(serialized) as Record<string, string>)
    const root = document.documentElement
    const previous = entries.map(([name]) => [name, root.style.getPropertyValue(name)] as const)
    for (const [name, value] of entries) root.style.setProperty(name, value)
    return () => {
      for (const [name, value] of previous) {
        if (value) root.style.setProperty(name, value)
        else root.style.removeProperty(name)
      }
    }
  }, [serialized])

  return null
}
