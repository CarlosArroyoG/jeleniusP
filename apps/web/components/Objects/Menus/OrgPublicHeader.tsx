'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { List, X } from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import LanguageSwitcher from '@components/Utils/LanguageSwitcher'
import OrgHeaderLogo from '@components/Objects/Menus/OrgHeaderLogo'
import { buildPublicNav, PublicNavItem } from '@/lib/publicNav'
import { getMenuColorClasses } from '@services/utils/ts/colorUtils'
import { cn } from '@/lib/utils'

export const PUBLIC_HEADER_HEIGHT = 60

/**
 * Simplified header for visitors who are NOT signed in. The full LMS shell
 * (`OrgMenu`) keeps rendering for authenticated users.
 *
 * It paints from the SAME application navigation tokens as the authenticated
 * header (`bg-app-header`, `text-app-header-foreground`, …), so a school's
 * public site and its LMS share one identity and one mapping — nothing here
 * decides "header = primary": that lives in lib/theme/navigationTokens.ts.
 */
export function OrgPublicHeader({ orgslug, topOffset = 0 }: { orgslug: string; topOffset?: number }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const pathname = usePathname() || ''
  const [open, setOpen] = useState(false)
  // Controls sit on the header surface → header-token classes (see getMenuColorClasses).
  const colors = getMenuColorClasses(true)

  const config = org?.config?.config
  const rf = config?.resolved_features
  const items = buildPublicNav({
    toHref: (path) => getUriWithOrg(orgslug, path),
    isFeatureEnabled: (feature) => rf?.[feature]?.enabled === true,
    menuItems: config?.customization?.menu?.items ?? config?.general?.menu?.items,
    landing: config?.customization?.landing || config?.landing,
  })

  const isActive = (item: PublicNavItem) => {
    if (item.external || item.href.includes('#')) return false
    let path = item.href
    try {
      path = new URL(item.href, 'http://x').pathname
    } catch {
      /* relative href — use as is */
    }
    const current = pathname.replace(/\/+$/, '') || '/'
    const target = path.replace(/\/+$/, '') || '/'
    // In single-tenant mode the home href is "/"; in multi-org it is "/orgs/<slug>"-like.
    return target === current || (item.key !== 'home' && current.startsWith(target + '/'))
  }

  // Active = filled state + underline marker + heavier weight (not colour alone).
  const linkClass = (active: boolean) =>
    cn(
      'relative rounded-lg px-3 py-2 text-sm transition-colors',
      colors.hoverBg,
      active
        ? 'bg-app-header-hover font-bold text-app-header-foreground after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-app-nav-active'
        : 'font-semibold text-app-header-muted hover:text-app-header-foreground'
    )

  const renderLink = (item: PublicNavItem, onClick?: () => void) => {
    const label = item.label || t(item.labelKey || '')
    const active = isActive(item)
    return item.external ? (
      <a
        key={item.key}
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass(false)}
        onClick={onClick}
      >
        {label}
      </a>
    ) : (
      <Link
        key={item.key}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={linkClass(active)}
        onClick={onClick}
      >
        {label}
      </Link>
    )
  }

  const loginButton = (className?: string, onClick?: () => void) => (
    <Link
      href={getUriWithOrg(orgslug, '/login')}
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
        colors.text,
        colors.hoverBg,
        className
      )}
    >
      {t('auth.login')}
    </Link>
  )

  const signupButton = (className?: string, onClick?: () => void) => (
    <Link
      href={getUriWithOrg(orgslug, '/signup')}
      onClick={onClick}
      className={cn(
        'rounded-lg px-4 py-2 text-sm font-bold shadow-sm transition-opacity',
        colors.signUpBtn,
        className
      )}
    >
      {t('auth.sign_up')}
    </Link>
  )

  return (
    <>
      <div aria-hidden="true" style={{ height: PUBLIC_HEADER_HEIGHT, marginTop: topOffset }} />
      <header
        data-testid="public-header"
        className="fixed start-0 end-0 border-b border-app-header-border bg-app-header text-app-header-foreground"
        style={{ zIndex: 'var(--z-nav)', top: topOffset, height: PUBLIC_HEADER_HEIGHT }}
      >
        <nav
          aria-label={t('public_home.nav_label', { defaultValue: 'Main navigation' })}
          className="mx-auto flex h-full w-full max-w-(--breakpoint-2xl) items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
        >
          <div className="flex min-w-0 items-center gap-6">
            <OrgHeaderLogo orgslug={orgslug} testId="public-header-logo" />
            <div className="hidden items-center gap-1 md:flex">{items.map((item) => renderLink(item))}</div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden sm:block">
              <LanguageSwitcher primaryColor="header" />
            </div>
            {loginButton('hidden md:inline-flex')}
            {signupButton()}
            <button
              type="button"
              className={cn('rounded-lg p-2 transition-colors md:hidden', colors.iconBtn)}
              aria-expanded={open}
              aria-controls="public-header-menu"
              aria-label={
                open
                  ? t('public_home.close_menu', { defaultValue: 'Close menu' })
                  : t('public_home.open_menu', { defaultValue: 'Open menu' })
              }
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={22} weight="bold" /> : <List size={22} weight="bold" />}
            </button>
          </div>
        </nav>

        {open && (
          <div
            id="public-header-menu"
            className="absolute start-0 end-0 top-full border-b border-app-header-border bg-app-header text-app-header-foreground shadow-lg md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {items.map((item) => renderLink(item, () => setOpen(false)))}
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-app-header-border pt-3">
                {loginButton('', () => setOpen(false))}
                <LanguageSwitcher primaryColor="header" />
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  )
}

export default OrgPublicHeader
