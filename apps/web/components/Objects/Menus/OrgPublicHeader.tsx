'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { List, X } from '@phosphor-icons/react'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithOrg } from '@services/config/config'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { BrandIcon } from '@components/Brand/BrandMark'
import LanguageSwitcher from '@components/Utils/LanguageSwitcher'
import { buildPublicNav, PublicNavItem } from '@/lib/publicNav'
import { cn } from '@/lib/utils'

export const PUBLIC_HEADER_HEIGHT = 60

/**
 * Simplified header for visitors who are NOT signed in. The full LMS shell
 * (`OrgMenu`) keeps rendering for authenticated users.
 *
 * Colors come from the organization theme tokens (`bg-brand`,
 * `text-brand-foreground`, `surface`, `border`) that the (withmenu) layout
 * already injects on its wrapper, so a school's branding applies without any
 * per-school code here.
 */
export function OrgPublicHeader({ orgslug, topOffset = 0 }: { orgslug: string; topOffset?: number }) {
  const { t } = useTranslation()
  const org = useOrg() as any
  const pathname = usePathname() || ''
  const [open, setOpen] = useState(false)

  const config = org?.config?.config
  const rf = config?.resolved_features
  const items = buildPublicNav({
    toHref: (path) => getUriWithOrg(orgslug, path),
    isFeatureEnabled: (feature) => rf?.[feature]?.enabled === true,
    menuItems: config?.customization?.menu?.items ?? config?.general?.menu?.items,
    landing: config?.customization?.landing || config?.landing,
  })

  const homeHref = getUriWithOrg(orgslug, '/')
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

  const linkClass = (active: boolean) =>
    cn(
      'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
      active
        ? 'text-brand bg-brand/10'
        : 'text-text-secondary hover:text-foreground hover:bg-surface-muted'
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
        'rounded-lg px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted',
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
        'rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground shadow-sm transition-opacity hover:opacity-90',
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
        className="fixed start-0 end-0 border-b border-border bg-surface/90 backdrop-blur-lg"
        style={{ zIndex: 'var(--z-nav)', top: topOffset, height: PUBLIC_HEADER_HEIGHT }}
      >
        <nav
          aria-label={t('public_home.nav_label', { defaultValue: 'Main navigation' })}
          className="mx-auto flex h-full w-full max-w-(--breakpoint-2xl) items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
        >
          <div className="flex min-w-0 items-center gap-6">
            <Link href={homeHref} className="flex h-9 min-w-0 items-center gap-2.5" data-testid="public-header-logo">
              {org?.logo_image ? (
                <img
                  src={getOrgLogoMediaDirectory(org.org_uuid, org.logo_image)}
                  alt={org?.name || 'Organization logo'}
                  style={{ width: 'auto', height: '100%' }}
                  className="rounded-md py-0.5"
                />
              ) : (
                <>
                  <BrandIcon className="h-8 w-8 shrink-0 rounded-lg" />
                  <span className="truncate text-base font-bold text-foreground">{org?.name}</span>
                </>
              )}
            </Link>
            <div className="hidden items-center gap-1 md:flex">{items.map((item) => renderLink(item))}</div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            {loginButton('hidden md:inline-flex')}
            {signupButton()}
            <button
              type="button"
              className="rounded-lg p-2 text-foreground transition-colors hover:bg-surface-muted md:hidden"
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
            className="absolute start-0 end-0 top-full border-b border-border bg-surface shadow-lg md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {items.map((item) => renderLink(item, () => setOpen(false)))}
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-3">
                {loginButton('', () => setOpen(false))}
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  )
}

export default OrgPublicHeader
