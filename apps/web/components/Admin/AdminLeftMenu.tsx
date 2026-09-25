'use client'
import {
  Buildings,
  ChartBar,
  Key,
  SignOut,
  User,
  Users,
} from '@phosphor-icons/react'
import { signOut } from '@components/Contexts/AuthContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import { BrandIcon } from '@components/Brand/BrandMark'
import { cn } from '@/lib/utils'
// Safe with no OrgProvider ancestor: useOrg()'s useContext() falls back to
// its default (null) rather than throwing, and resolveOrganizationTheme(null)
// is exactly the Jelenius default — this screen is cross-org (superadmin),
// so there is no "which school's color" to resolve, but routing it through
// the same theme engine (rather than hand-picked literals) is what "migrate
// to the Theme Engine" means for a screen with no org context.
import { useOrganizationTheme } from '@/lib/theme/useOrganizationTheme'

function AdminTopMenu() {
  const session = useLHSession() as any
  const pathname = usePathname() || ''
  const { style: themeVars } = useOrganizationTheme()

  async function logOutUI() {
    await signOut({ redirect: true, callbackUrl: '/admin/login' })
  }

  if (!session) return null

  const user = session?.data?.user
  const avatarUrl = user?.avatar_image
    ? user.avatar_image.startsWith('http')
      ? user.avatar_image
      : getUserAvatarMediaDirectory(user.user_uuid, user.avatar_image)
    : null

  return (
    <>
      {/* Spacer to push content below the fixed menu */}
      <div className="h-14" />
      {/* Fixed menu bar */}
      <div
        className="fixed top-0 start-0 end-0 h-14 bg-app-header border-b border-app-header-border flex items-center text-app-header-foreground px-4 gap-6"
        style={{ zIndex: 'var(--z-overlay)', ...themeVars }}
      >
        {/* Logo */}
        <Link className="flex items-center gap-2 transition-opacity hover:opacity-70 shrink-0" href="/admin">
          <BrandIcon className="h-7 w-7 rounded-md" />
          <span className="font-semibold text-sm text-app-header-foreground">Admin</span>
          <span className="text-[9px] font-medium uppercase tracking-wider text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
            Superadmin
          </span>
        </Link>

        {/* Navigation */}
        <nav aria-label="Admin navigation" className="flex items-center gap-1">
          <NavLink
            href="/admin/organizations"
            icon={<Buildings size={16} weight="fill" />}
            label="Organizations"
            active={pathname.startsWith('/admin/organizations')}
          />
          <NavLink
            href="/admin/users"
            icon={<Users size={16} weight="fill" />}
            label="Users"
            active={pathname.startsWith('/admin/users')}
          />
          <NavLink
            href="/admin/analytics"
            icon={<ChartBar size={16} weight="fill" />}
            label="Analytics"
            active={pathname.startsWith('/admin/analytics')}
          />
          <NavLink
            href="/admin/developers"
            icon={<Key size={16} weight="fill" />}
            label="Developers"
            active={pathname.startsWith('/admin/developers')}
          />
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User section */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-6 h-6 rounded-full object-cover bg-gray-700"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-app-header-foreground/10 flex items-center justify-center">
                <User size={14} weight="fill" className="text-app-header-muted" />
              </div>
            )}
            <span className="text-sm text-app-header-muted hidden sm:inline">
              {user?.username}
            </span>
          </div>
          <button
            onClick={logOutUI}
            className="flex items-center gap-1.5 rounded-lg text-red-500 hover:text-red-400 hover:bg-app-header-hover transition-all px-2 py-1.5"
            title="Sign Out"
          >
            <SignOut size={16} weight="fill" data-dir-flip />
            <span className="text-xs font-medium hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </>
  )
}

const NavLink = ({
  href,
  icon,
  label,
  active,
}: {
  href: string
  icon: React.ReactNode
  label: string
  active?: boolean
}) => {
  return (
    <Link aria-label={label} aria-current={active ? 'page' : undefined} href={href}>
      <div
        className={cn(
          'flex items-center rounded-lg transition-all px-3 py-1.5 gap-2',
          active ? 'text-app-nav-active-foreground bg-app-nav-active' : 'text-app-header-muted hover:text-app-header-foreground hover:bg-app-header-hover'
        )}
      >
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
    </Link>
  )
}

export default AdminTopMenu
