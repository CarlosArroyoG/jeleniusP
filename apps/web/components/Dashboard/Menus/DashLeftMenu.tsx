'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import { signOut } from '@components/Contexts/AuthContext'
import {
  House,
  BookOpen,
  Files,
  Users,
  CurrencyCircleDollar,
  Buildings,
  Globe,
  Question,
  Gear,
  SignOut,
  SidebarSimple,
  Check,
  CaretDown,
  PencilSimple,
  ChatsCircle,
  ChatCircleDots,
  Headphones,
  ChartBar,
  DotsThree,
  UsersThree,
  Shield,
  UserPlus,
  ClipboardText,
  Palette,
  Rocket,
  Robot,
  LinkSimple,
  Key,
  Lock,
  Wrench,
  ChartLine,
  MagnifyingGlass,
  ChalkboardSimple,
  Cube,
  ShoppingBag,
  FolderSimple,
  Plus,
  Code,
  Lightning,
} from '@phosphor-icons/react'
import { motion } from 'motion/react'
import CommandPaletteTrigger from '@components/Dashboard/CommandPalette/CommandPaletteTrigger'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import UserAvatar from '../../Objects/UserAvatar'
import { BrandIcon } from '@components/Brand/BrandMark'
import AdminAuthorization from '@components/Security/AdminAuthorization'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg, getAPIUrl, getMainDomainUri, isMultiOrgModeEnabled } from '@services/config/config'
import { useTranslation } from 'react-i18next'
import { changeLanguage } from '@/lib/i18n'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@components/ui/tooltip"
import {
  HoverMenu,
  HoverMenuContent,
  HoverMenuItem,
  HoverMenuLabel,
  HoverMenuSeparator,
} from "@components/ui/hover-menu"
import { FeedbackModal } from '@components/Objects/Modals/FeedbackModal'
import { AVAILABLE_LANGUAGES } from '@/lib/languages'
import OrgSquareLogo, { hasOrgLogo } from '@components/Objects/Org/OrgSquareLogo'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'
import { getAssignmentsFromACourse } from '@services/courses/assignments'
import { getDeploymentMode } from '@services/config/config'
import PlanBadge from '@components/Dashboard/Shared/PlanRestricted/PlanBadge'
import { usePlan } from '@components/Hooks/usePlan'
import { planMeetsRequirement } from '@services/plans/plans'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'
import OnboardingSidebarBox from '@components/Dashboard/Onboarding/OnboardingSidebarBox'
import { useOnboarding } from '@components/Hooks/useOnboarding'

// Scattered night-sky starfield for the free-plan upgrade box. Fixed positions
// (top/left %) so the constellation is stable across renders; `north` is the
// brighter amber guide star. dim/bright drive the idle twinkle amplitude.
const UPGRADE_STARS: {
  top: string; left: string; size: number; delay: number; dim: number; bright: number; north?: boolean
}[] = [
  { top: '8%', left: '50%', size: 2.5, delay: 0.0, dim: 0.5, bright: 1, north: true },
  { top: '14%', left: '12%', size: 1, delay: 0.6, dim: 0.15, bright: 0.6 },
  { top: '10%', left: '30%', size: 1.5, delay: 1.1, dim: 0.2, bright: 0.7 },
  { top: '22%', left: '20%', size: 1, delay: 0.3, dim: 0.15, bright: 0.55 },
  { top: '30%', left: '38%', size: 1, delay: 1.5, dim: 0.1, bright: 0.5 },
  { top: '18%', left: '66%', size: 1.5, delay: 0.9, dim: 0.2, bright: 0.75 },
  { top: '26%', left: '78%', size: 1, delay: 0.2, dim: 0.15, bright: 0.6 },
  { top: '12%', left: '88%', size: 1, delay: 1.8, dim: 0.1, bright: 0.5 },
  { top: '34%', left: '60%', size: 1, delay: 1.3, dim: 0.15, bright: 0.55 },
  { top: '6%', left: '72%', size: 1, delay: 0.5, dim: 0.1, bright: 0.5 },
  { top: '32%', left: '90%', size: 1.5, delay: 1.0, dim: 0.2, bright: 0.65 },
  { top: '20%', left: '44%', size: 1, delay: 2.0, dim: 0.1, bright: 0.45 },
]

const NAV_TIP_CLASS =
  "z-tooltip max-w-[220px] bg-app-sidebar border-app-nav-border text-app-sidebar-foreground text-xs leading-snug px-2.5 py-1.5 shadow-lg shadow-black/20"

// Hover tooltip with a short description of what a menu entry does. The text
// lives under `dashboard.nav_tips.<id>` in the locale files.
const NavTip = ({ id, children }: { id: string; children: React.ReactElement }) => {
  const { t } = useTranslation()
  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className={NAV_TIP_CLASS}>
        {t(`dashboard.nav_tips.${id}`)}
      </TooltipContent>
    </Tooltip>
  )
}

// Same description, shown as a subtitle inside a flyout menu. Used for parent
// entries whose hover already opens a flyout, so a tooltip would collide with it.
const NavDesc = ({ id }: { id: string }) => {
  const { t } = useTranslation()
  return (
    <p className="px-3 pb-2 -mt-1 text-xs leading-snug text-app-sidebar-foreground/50">
      {t(`dashboard.nav_tips.${id}`)}
    </p>
  )
}

function DashLeftMenu() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const { t, i18n } = useTranslation()
  const { track } = useLHAnalytics('dashboard')
  const pathname = usePathname() || ''
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [upgradeHovered, setUpgradeHovered] = useState(false)
  // Onboarding takes over the search slot until setup is complete / dismissed.
  const onboarding = useOnboarding()
  const showOnboarding =
    !isCollapsed && onboarding.welcomeSeen && !onboarding.dismissed && !onboarding.allCompleted

  const isActivePath = (path: string) => {
    if (path === '/dash') {
      return pathname === '/dash' || pathname === '/dash/'
    }
    return pathname === path || pathname.startsWith(path + '/')
  }
  const [recentAssignments, setRecentAssignments] = useState<any[]>([])
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const access_token = session?.data?.tokens?.access_token

  // Fetch recent courses
  const { data: coursesData } = useQuery({
    queryKey: [...queryKeys.courses.list(org?.slug || ''), 'recent', 8],
    queryFn: async () => {
      const url = `${getAPIUrl()}courses/org_slug/${org.slug}/page/1/limit/8`
      const res = await fetch(url, RequestBodyWithAuthHeader('GET', null, null, access_token))
      if (!res.ok) throw new Error('Failed to fetch courses')
      return res.json()
    },
    enabled: !!org?.slug,
    staleTime: 60_000,
  })
  const recentCourses = coursesData?.slice(0, 8) || []

  // Lazy-load assignments only when the assignments hover menu is opened
  const [assignmentsFetched, setAssignmentsFetched] = useState(false)

  const fetchAssignments = () => {
    if (assignmentsFetched || !coursesData || !access_token) return
    setAssignmentsFetched(true)
    const coursesToFetch = coursesData.slice(0, 5)
    const promises = coursesToFetch.map((course: any) =>
      getAssignmentsFromACourse(course.course_uuid, access_token)
    )
    Promise.all(promises).then((results) => {
      const allAssignments: any[] = []
      results.forEach((res: any, index: number) => {
        if (res?.data) {
          res.data.forEach((assignment: any) => {
            allAssignments.push({
              ...assignment,
              courseName: coursesToFetch[index].name
            })
          })
        }
      })
      setRecentAssignments(allAssignments.slice(0, 8))
    }).catch(() => {})
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dash-menu-collapsed')
      if (saved !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsCollapsed(saved === 'true')
      }
    }
  }, [])

  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('dash-menu-collapsed', String(newState))
  }


  async function logOutUI() {
    await signOut({ redirect: true, callbackUrl: getUriWithOrg(org.slug, '/login') })
  }


  const plan = usePlan()
  const mode = getDeploymentMode()
  // Only org managers (admins/superadmins) see billing surfaces — non-admins
  // shouldn't manage the plan/subscription.
  const { canManageOrg } = useAdminStatus()

  if (!org || !session) return null
  const planLabel =
    mode === 'ee' ? 'Enterprise Edition' :
    mode === 'oss' ? 'OSS' :
    plan  // SaaS: show actual plan name

  // Multi-org (SaaS) hub: the apex /home, /new, /billing routes only exist in
  // multi tenancy. The user's organizations (deduped) come from the session.
  const multiOrg = isMultiOrgModeEnabled()
  const myOrgs: any[] = (() => {
    const roles = session?.data?.roles || []
    const seen = new Set<number>()
    const orgs: any[] = []
    for (const r of roles) {
      const o = r?.org
      if (o && o.id != null && !seen.has(o.id)) { seen.add(o.id); orgs.push(o) }
    }
    return orgs
  })()
  // Plan label: a neutral chip derived from the sidebar's own foreground — it is
  // an informational label, not a status colour, so it must stay legible on any school color.
  const planPillColor = 'bg-app-sidebar-foreground/10 text-app-sidebar-foreground/80'

  // Feature visibility from API resolved_features
  const rf = org?.config?.config?.resolved_features
  const isEnabled = (feature: string) => rf?.[feature]?.enabled === true

  const showLibrary = isEnabled('folders')
  const showCommunities = isEnabled('communities')
  const showPodcasts = isEnabled('podcasts')
  const showBoards = isEnabled('boards')
  const showPlaygrounds = isEnabled('playgrounds')
  const showPayments = isEnabled('payments')

  return (
    <TooltipProvider delayDuration={0}>
    <nav
      aria-label={t('dashboard.nav.sidebar_navigation')}
      data-testid="dash-sidebar"
      className={cn(
        "flex flex-col text-app-sidebar-foreground h-screen sticky top-0 z-overlay border-e border-app-nav-border bg-app-sidebar transition-all duration-300",
        isCollapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Header with Logo and Toggle */}
      <div className={cn(
        "relative flex items-center h-16 border-b border-app-nav-border px-4 shrink-0",
        isCollapsed ? "justify-center" : "justify-between"
      )}>
        <Link
          className={cn("flex items-center transition-opacity hover:opacity-70", isCollapsed ? "" : "space-x-3")}
          href={'/'}
        >
          {planMeetsRequirement(plan, 'standard') && hasOrgLogo(org) ? (
            <div className="h-9 w-9 rounded-lg overflow-hidden bg-white shrink-0">
              <OrgSquareLogo org={org} wideInsetClassName="p-1" fallback={null} />
            </div>
          ) : (
            <BrandIcon className="h-8 w-8 rounded-lg" />
          )}
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm text-app-sidebar-foreground truncate">
                {org?.name}
              </span>
              <span className={cn(
                "mt-0.5 inline-flex w-fit items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider",
                planPillColor
              )}>
                {planLabel}
              </span>
            </div>
          )}
        </Link>

        {!isCollapsed && (
          <button
            aria-label={t('dashboard.nav.collapse_sidebar')}
            onClick={toggleCollapse}
            className="p-2 rounded-lg text-app-sidebar-foreground/50 hover:text-app-nav-hover-foreground hover:bg-app-nav-hover transition-all"
          >
            <SidebarSimple size={18} weight="fill" />
          </button>
        )}

        {/* Onboarding progress reuses this header's bottom border as its track —
            a neon purple gradient that glows out from the border. */}
        {showOnboarding && (
          <>
            {/* faint full-width track so the border reads as purple even at 0% */}
            <div className="absolute -bottom-px start-0 end-0 h-[2px] bg-app-sidebar-foreground/10" />
            <motion.div
              className="absolute -bottom-px start-0 h-[2px] rounded-e-full"
              style={{
                        background: 'var(--app-nav-active-bg)',
                boxShadow:
                  '0 0 6px var(--app-nav-active-bg), 0 0 12px color-mix(in srgb, var(--app-nav-active-bg) 55%, transparent)',
              }}
              initial={false}
              animate={{ width: `${Math.max(onboarding.progress * 100, 6)}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </>
        )}
      </div>

      {/* Search trigger — replaced by the onboarding progress in this slot until
          setup is complete (then the search box returns). */}
      <div className={cn('px-3', showOnboarding ? 'pt-2' : 'pt-3')}>
        {showOnboarding ? (
          <OnboardingSidebarBox />
        ) : (
          <CommandPaletteTrigger isCollapsed={isCollapsed} />
        )}
      </div>

      {/* Main Navigation - Vertically Centered */}
      <div className="flex-1 flex flex-col justify-center py-4 px-3">
        <AdminAuthorization authorizationMode="component">
          <div className="space-y-1">
            <MenuLink
              href="/dash"
              tip="home"
              icon={<House size={20} weight="fill" />}
              label={t('common.home')}
              isCollapsed={isCollapsed}
              active={isActivePath('/dash')}
              onClick={() => track(AnalyticsEvent.DashboardNavClicked, { section: 'home' })}
            />

            {/* Courses with hover menu */}
            <HoverMenu
              content={
                <HoverMenuContent className="w-64">
                  <HoverMenuLabel className="text-app-sidebar-muted font-medium">{t('courses.courses')}</HoverMenuLabel>
                  <NavDesc id="courses" />
                  <HoverMenuSeparator />
                  <HoverMenuItem asChild>
                    <NavTip id="all_courses">
                      <Link href="/dash/courses" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <BookOpen size={16} weight="fill" />
                        <span>{t('common.all_courses')}</span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                  {recentCourses.length > 0 && (
                    <>
                      <HoverMenuSeparator />
                      <HoverMenuLabel className="text-app-sidebar-foreground/50">{t('common.recent')}</HoverMenuLabel>
                      {recentCourses.map((course: any) => (
                        <HoverMenuItem key={course.course_uuid} asChild>
                          <Link
                            href={`/dash/courses/course/${course.course_uuid.replace('course_', '')}/settings`}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors"
                          >
                            <PencilSimple size={14} className="text-app-sidebar-foreground/50" />
                            <span className="truncate">{course.name}</span>
                          </Link>
                        </HoverMenuItem>
                      ))}
                    </>
                  )}
                </HoverMenuContent>
              }
            >
              {(() => {
                const active = isActivePath('/dash/courses')
                return (
                  <Link
                    href="/dash/courses"
                    aria-label={t('dashboard.nav.open_courses_menu')}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      "relative flex items-center w-full rounded-lg transition-all",
                      active
                        ? "text-app-nav-active-foreground bg-app-nav-active"
                        : "text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover",
                      isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute start-0.5 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-app-nav-active-foreground rounded-full"
                      />
                    )}
                    <span className="relative flex items-center justify-center">
                      <BookOpen size={20} weight="fill" />
                      {isCollapsed && (
                        <CaretDown aria-hidden="true" size={8} weight="bold" className={cn("absolute -end-2.5", active ? "text-app-sidebar-muted" : "text-app-sidebar-foreground/50")} />
                      )}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 text-start">{t('courses.courses')}</span>
                        <CaretDown aria-hidden="true" size={14} weight="bold" className={active ? "text-app-sidebar-muted" : "text-app-sidebar-foreground/50"} />
                      </>
                    )}
                  </Link>
                )
              })()}
            </HoverMenu>

            {/* Assignments with hover menu */}
            <div onMouseEnter={fetchAssignments}>
            <HoverMenu
              content={
                <HoverMenuContent className="w-72">
                  <HoverMenuLabel className="text-app-sidebar-muted font-medium">{t('common.assignments')}</HoverMenuLabel>
                  <NavDesc id="assignments" />
                  <HoverMenuSeparator />
                  <HoverMenuItem asChild>
                    <NavTip id="all_assignments">
                      <Link href="/dash/assignments" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <Files size={16} weight="fill" />
                        <span>{t('common.all_assignments')}</span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                  {recentAssignments.length > 0 && (
                    <>
                      <HoverMenuSeparator />
                      <HoverMenuLabel className="text-app-sidebar-foreground/50">{t('common.recent')}</HoverMenuLabel>
                      {recentAssignments.map((assignment: any) => (
                        <HoverMenuItem key={assignment.assignment_uuid} asChild>
                          <Link
                            href={`/dash/assignments/${assignment.assignment_uuid.replace('assignment_', '')}?subpage=editor`}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors"
                          >
                            <PencilSimple size={14} className="text-app-sidebar-foreground/50" />
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{assignment.title}</span>
                              <span className="text-xs text-app-sidebar-foreground/50 truncate">{assignment.courseName}</span>
                            </div>
                          </Link>
                        </HoverMenuItem>
                      ))}
                    </>
                  )}
                </HoverMenuContent>
              }
            >
              {(() => {
                const active = isActivePath('/dash/assignments')
                return (
                  <Link
                    href="/dash/assignments"
                    aria-label={t('dashboard.nav.open_assignments_menu')}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      "relative flex items-center w-full rounded-lg transition-all",
                      active
                        ? "text-app-nav-active-foreground bg-app-nav-active"
                        : "text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover",
                      isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute start-0.5 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-app-nav-active-foreground rounded-full"
                      />
                    )}
                    <span className="relative flex items-center justify-center">
                      <Files size={20} weight="fill" />
                      {isCollapsed && (
                        <CaretDown aria-hidden="true" size={8} weight="bold" className={cn("absolute -end-2.5", active ? "text-app-sidebar-muted" : "text-app-sidebar-foreground/50")} />
                      )}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 text-start">{t('common.assignments')}</span>
                        <CaretDown aria-hidden="true" size={14} weight="bold" className={active ? "text-app-sidebar-muted" : "text-app-sidebar-foreground/50"} />
                      </>
                    )}
                  </Link>
                )
              })()}
            </HoverMenu>
            </div>
            {showLibrary && (
              <MenuLink
                href="/dash/library"
                tip="library"
                icon={<FolderSimple size={20} weight="fill" />}
                label={t('library.library')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/library')}
              />
            )}
            {showCommunities && (
              <MenuLink
                href="/dash/communities"
                tip="communities"
                icon={<ChatsCircle size={20} weight="fill" />}
                label={t('communities.title')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/communities')}
              />
            )}
            {showPodcasts && (
              <MenuLink
                href="/dash/podcasts"
                tip="podcasts"
                icon={<Headphones size={20} weight="fill" />}
                label={t('podcasts.podcasts')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/podcasts')}
              />
            )}
            {showBoards && (
              <MenuLink
                href="/dash/boards"
                tip="boards"
                icon={<ChalkboardSimple size={20} weight="fill" />}
                label={t('boards.boards')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/boards')}
              />
            )}
            {showPlaygrounds && (
              <MenuLink
                href="/dash/playgrounds"
                tip="playgrounds"
                icon={<Cube size={20} weight="fill" />}
                label={t('common.playgrounds')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/playgrounds')}
              />
            )}
            {/* Users with hover menu */}
            <HoverMenu
              content={
                <HoverMenuContent className="w-64">
                  <HoverMenuLabel className="text-app-sidebar-muted font-medium">{t('common.users')}</HoverMenuLabel>
                  <NavDesc id="users" />
                  <HoverMenuSeparator />
                  <HoverMenuItem asChild>
                    <NavTip id="users_list">
                      <Link href="/dash/users/settings/users" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <Users size={16} weight="fill" />
                        <span>{t('dashboard.users.settings.tabs.users')}</span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <NavTip id="usergroups">
                      <Link href="/dash/users/settings/usergroups" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <UsersThree size={16} weight="fill" />
                        <span className="flex items-center">{t('dashboard.users.settings.tabs.usergroups')}<PlanBadge currentPlan={plan} requiredPlan="standard" variant="dark" /></span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <NavTip id="roles">
                      <Link href="/dash/users/settings/roles" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <Shield size={16} weight="fill" />
                        <span className="flex items-center">{t('dashboard.users.settings.tabs.roles')}<PlanBadge currentPlan={plan} requiredPlan="pro" variant="dark" /></span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <NavTip id="signups">
                      <Link href="/dash/users/settings/signups" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <ClipboardText size={16} weight="fill" />
                        <span>{t('dashboard.users.settings.tabs.signups')}</span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <NavTip id="add_users">
                      <Link href="/dash/users/settings/add" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <UserPlus size={16} weight="fill" />
                        <span>{t('dashboard.users.settings.tabs.add')}</span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                </HoverMenuContent>
              }
            >
              {(() => {
                const active = isActivePath('/dash/users')
                return (
                  <Link
                    href="/dash/users/settings/users"
                    aria-label={t('dashboard.nav.open_users_menu')}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      "relative flex items-center w-full rounded-lg transition-all",
                      active
                        ? "text-app-nav-active-foreground bg-app-nav-active"
                        : "text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover",
                      isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute start-0.5 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-app-nav-active-foreground rounded-full"
                      />
                    )}
                    <span className="relative flex items-center justify-center">
                      <Users size={20} weight="fill" />
                      {isCollapsed && (
                        <CaretDown aria-hidden="true" size={8} weight="bold" className={cn("absolute -end-2.5", active ? "text-app-sidebar-muted" : "text-app-sidebar-foreground/50")} />
                      )}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 text-start">{t('common.users')}</span>
                        <CaretDown aria-hidden="true" size={14} weight="bold" className={active ? "text-app-sidebar-muted" : "text-app-sidebar-foreground/50"} />
                      </>
                    )}
                  </Link>
                )
              })()}
            </HoverMenu>

            {showPayments && (
              <MenuLink
                href="/dash/payments/overview"
                tip="payments"
                icon={<CurrencyCircleDollar size={20} weight="fill" />}
                label={t('common.payments')}
                isCollapsed={isCollapsed}
                active={isActivePath('/dash/payments')}
              />
            )}

            {/* Organization with hover menu */}
            <HoverMenu
              content={
                <HoverMenuContent className="w-64">
                  <HoverMenuLabel className="text-app-sidebar-muted font-medium">{t('common.organization')}</HoverMenuLabel>
                  <NavDesc id="organization" />
                  <HoverMenuSeparator />
                  <HoverMenuItem asChild>
                    <NavTip id="org_general">
                      <Link href="/dash/org/settings/general" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <Gear size={16} weight="fill" />
                        <span>{t('dashboard.organization.settings.tabs.general')}</span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <NavTip id="org_branding">
                      <Link href="/dash/org/settings/branding" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <Palette size={16} weight="fill" />
                        <span>{t('dashboard.organization.settings.tabs.branding')}</span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <NavTip id="org_landing">
                      <Link href="/dash/org/settings/landing" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <Rocket size={16} weight="fill" />
                        <span>{t('dashboard.organization.settings.tabs.landing')}</span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <NavTip id="org_ai">
                      <Link href="/dash/org/settings/ai" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <Robot size={16} weight="fill" />
                        <span className="flex items-center">{t('dashboard.organization.settings.tabs.ai')}<PlanBadge currentPlan={plan} requiredPlan="standard" variant="dark" /></span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                  {canManageOrg && (
                    <HoverMenuItem asChild>
                      <NavTip id="org_usage">
                        <Link href="/dash/org/settings/usage" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                          <ChartBar size={16} weight="fill" />
                          <span>{t('dashboard.organization.settings.tabs.usage') || 'Usage'}</span>
                        </Link>
                      </NavTip>
                    </HoverMenuItem>
                  )}
                  <HoverMenuItem asChild>
                    <NavTip id="org_other">
                      <Link href="/dash/org/settings/other" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <Wrench size={16} weight="fill" />
                        <span>{t('dashboard.organization.settings.tabs.other')}</span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                </HoverMenuContent>
              }
            >
              {(() => {
                const active = isActivePath('/dash/org')
                return (
                  <Link
                    href="/dash/org/settings/general"
                    aria-label={t('dashboard.nav.open_organization_menu')}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      "relative flex items-center w-full rounded-lg transition-all",
                      active
                        ? "text-app-nav-active-foreground bg-app-nav-active"
                        : "text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover",
                      isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute start-0.5 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-app-nav-active-foreground rounded-full"
                      />
                    )}
                    <span className="relative flex items-center justify-center">
                      <Buildings size={20} weight="fill" />
                      {isCollapsed && (
                        <CaretDown aria-hidden="true" size={8} weight="bold" className={cn("absolute -end-2.5", active ? "text-app-sidebar-muted" : "text-app-sidebar-foreground/50")} />
                      )}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 text-start">{t('common.organization')}</span>
                        <CaretDown aria-hidden="true" size={14} weight="bold" className={active ? "text-app-sidebar-muted" : "text-app-sidebar-foreground/50"} />
                      </>
                    )}
                  </Link>
                )
              })()}
            </HoverMenu>

            {/* Developers with hover menu */}
            <HoverMenu
              content={
                <HoverMenuContent className="w-64">
                  <HoverMenuLabel className="text-app-sidebar-muted font-medium">{t('dashboard.developers.breadcrumb', { defaultValue: 'Developers' })}</HoverMenuLabel>
                  <NavDesc id="developers" />
                  <HoverMenuSeparator />
                  <HoverMenuItem asChild>
                    <NavTip id="dev_api">
                      <Link href="/dash/developers/api" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <Key size={16} weight="fill" />
                        <span className="flex items-center">{t('dashboard.organization.settings.tabs.api', { defaultValue: 'API Access' })}<PlanBadge currentPlan={plan} requiredPlan="pro" variant="dark" /></span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <NavTip id="dev_automations">
                      <Link href="/dash/developers/automations" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <Lightning size={16} weight="fill" />
                        <span className="flex items-center">{t('dashboard.organization.settings.tabs.automations', { defaultValue: 'Automations' })}<PlanBadge currentPlan={plan} requiredPlan="pro" variant="dark" /></span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <NavTip id="dev_domains">
                      <Link href="/dash/developers/domains" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <LinkSimple size={16} weight="fill" />
                        <span className="flex items-center">{t('dashboard.organization.settings.tabs.domains', { defaultValue: 'Domains' })}<PlanBadge currentPlan={plan} requiredPlan="standard" variant="dark" /></span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <NavTip id="dev_seo">
                      <Link href="/dash/developers/seo" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <MagnifyingGlass size={16} weight="fill" />
                        <span>SEO</span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <NavTip id="dev_sso">
                      <Link href="/dash/developers/sso" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <Lock size={16} weight="fill" />
                        <span className="flex items-center">{t('dashboard.organization.settings.tabs.sso', { defaultValue: 'SSO' })}<PlanBadge currentPlan={plan} requiredPlan="enterprise" variant="dark" /></span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                </HoverMenuContent>
              }
            >
              {(() => {
                const active = isActivePath('/dash/developers')
                return (
                  <Link
                    href="/dash/developers/api"
                    aria-label={t('dashboard.nav.open_developers_menu')}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      "relative flex items-center w-full rounded-lg transition-all",
                      active
                        ? "text-app-nav-active-foreground bg-app-nav-active"
                        : "text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover",
                      isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute start-0.5 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-app-nav-active-foreground rounded-full"
                      />
                    )}
                    <span className="relative flex items-center justify-center">
                      <Code size={20} weight="fill" />
                      {isCollapsed && (
                        <CaretDown aria-hidden="true" size={8} weight="bold" className={cn("absolute -end-2.5", active ? "text-app-sidebar-muted" : "text-app-sidebar-foreground/50")} />
                      )}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 text-start">{t('dashboard.developers.breadcrumb', { defaultValue: 'Developers' })}</span>
                        <CaretDown aria-hidden="true" size={14} weight="bold" className={active ? "text-app-sidebar-muted" : "text-app-sidebar-foreground/50"} />
                      </>
                    )}
                  </Link>
                )
              })()}
            </HoverMenu>

            {/* Analytics with hover menu */}
            <HoverMenu
              content={
                <HoverMenuContent className="w-64">
                  <HoverMenuLabel className="text-app-sidebar-muted font-medium">Analytics</HoverMenuLabel>
                  <NavDesc id="analytics" />
                  <HoverMenuSeparator />
                  <HoverMenuItem asChild>
                    <NavTip id="analytics_overview">
                      <Link href="/dash/analytics" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <ChartBar size={16} weight="fill" />
                        <span>{t('analytics.tabs.overview')}</span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                  <HoverMenuItem asChild>
                    <NavTip id="analytics_advanced">
                      <Link href="/dash/analytics" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <ChartLine size={16} weight="fill" />
                        <span className="flex items-center">{t('analytics.tabs.advanced')}<PlanBadge currentPlan={plan} requiredPlan="enterprise" variant="dark" /></span>
                      </Link>
                    </NavTip>
                  </HoverMenuItem>
                </HoverMenuContent>
              }
            >
              {(() => {
                const active = isActivePath('/dash/analytics')
                return (
                  <Link
                    href="/dash/analytics"
                    aria-label={t('common.analytics')}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      "relative flex items-center w-full rounded-lg transition-all",
                      active
                        ? "text-app-nav-active-foreground bg-app-nav-active"
                        : "text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover",
                      isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute start-0.5 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-app-nav-active-foreground rounded-full"
                      />
                    )}
                    <span className="relative flex items-center justify-center">
                      <ChartBar size={20} weight="fill" />
                      {isCollapsed && (
                        <CaretDown aria-hidden="true" size={8} weight="bold" className={cn("absolute -end-2.5", active ? "text-app-sidebar-muted" : "text-app-sidebar-foreground/50")} />
                      )}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 text-start">{t('common.analytics')}</span>
                        <CaretDown aria-hidden="true" size={14} weight="bold" className={active ? "text-app-sidebar-muted" : "text-app-sidebar-foreground/50"} />
                      </>
                    )}
                  </Link>
                )
              })()}
            </HoverMenu>

            {/* Disabled features shown in an "Other" hover menu */}
            {(!showCommunities || !showPodcasts || !showBoards || !showPlaygrounds || !showPayments) && (
              <HoverMenu
                content={
                  <HoverMenuContent className="w-64">
                    <HoverMenuLabel className="flex items-center justify-between text-app-sidebar-muted font-medium">
                      <span>{t('common.other')}</span>
                      <span className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-app-sidebar-foreground/10 text-app-sidebar-foreground/50">
                        {t('common.disabled')}
                      </span>
                    </HoverMenuLabel>
                    <NavDesc id="other" />
                    <HoverMenuSeparator />
                    {!showCommunities && (
                      <HoverMenuItem asChild>
                        <NavTip id="communities">
                          <Link href="/dash/communities" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-foreground/50 hover:text-app-sidebar-foreground/70 hover:bg-app-nav-hover cursor-pointer transition-colors">
                            <ChatsCircle size={16} weight="fill" />
                            <span>{t('communities.title')}</span>
                          </Link>
                        </NavTip>
                      </HoverMenuItem>
                    )}
                    {!showPodcasts && (
                      <HoverMenuItem asChild>
                        <NavTip id="podcasts">
                          <Link href="/dash/podcasts" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-foreground/50 hover:text-app-sidebar-foreground/70 hover:bg-app-nav-hover cursor-pointer transition-colors">
                            <Headphones size={16} weight="fill" />
                            <span>{t('podcasts.podcasts')}</span>
                          </Link>
                        </NavTip>
                      </HoverMenuItem>
                    )}
                    {!showBoards && (
                      <HoverMenuItem asChild>
                        <NavTip id="boards">
                          <Link href="/dash/boards" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-foreground/50 hover:text-app-sidebar-foreground/70 hover:bg-app-nav-hover cursor-pointer transition-colors">
                            <ChalkboardSimple size={16} weight="fill" />
                            <span>{t('common.boards')}</span>
                          </Link>
                        </NavTip>
                      </HoverMenuItem>
                    )}
                    {!showPlaygrounds && (
                      <HoverMenuItem asChild>
                        <NavTip id="playgrounds">
                          <Link href="/dash/playgrounds" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-foreground/50 hover:text-app-sidebar-foreground/70 hover:bg-app-nav-hover cursor-pointer transition-colors">
                            <Cube size={16} weight="fill" />
                            <span>{t('common.playgrounds')}</span>
                          </Link>
                        </NavTip>
                      </HoverMenuItem>
                    )}
                    {!showPayments && (
                      <HoverMenuItem asChild>
                        <NavTip id="payments">
                          <Link href="/dash/payments/overview" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-foreground/50 hover:text-app-sidebar-foreground/70 hover:bg-app-nav-hover cursor-pointer transition-colors">
                            <CurrencyCircleDollar size={16} weight="fill" />
                            <span>{t('common.payments')}</span>
                          </Link>
                        </NavTip>
                      </HoverMenuItem>
                    )}
                  </HoverMenuContent>
                }
              >
                <button
                  aria-label={t('dashboard.nav.other')}
                  className={cn(
                    "flex items-center w-full rounded-lg text-app-sidebar-foreground/50 hover:text-app-sidebar-foreground/70 hover:bg-app-nav-hover transition-all",
                    isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
                  )}
                >
                  <span className="relative flex items-center justify-center">
                    <DotsThree size={20} weight="bold" />
                    {isCollapsed && (
                      <CaretDown aria-hidden="true" size={8} weight="bold" className="absolute -end-2.5 text-app-sidebar-foreground/50" />
                    )}
                  </span>
                  {!isCollapsed && (
                    <>
                      <span className="text-sm font-medium flex-1 text-start">{t('common.other')}</span>
                      <CaretDown aria-hidden="true" size={14} weight="bold" className="text-app-sidebar-foreground/50" />
                    </>
                  )}
                </button>
              </HoverMenu>
            )}
          </div>
        </AdminAuthorization>
      </div>

      {/* Free-plan upgrade box — replaces the old full-width top banner.
          Sits in the sidebar's empty space; multi-org / SaaS, free plan only.
          Twinkling stars on top; on hover it reveals the premium features the
          org is missing, the gold glow swells and the button sweeps a shimmer. */}
      {multiOrg && plan === 'free' && !isCollapsed && canManageOrg && (
        <motion.div
          className="relative overflow-hidden shrink-0 px-4 pt-6 pb-4"
          onHoverStart={() => setUpgradeHovered(true)}
          onHoverEnd={() => setUpgradeHovered(false)}
        >
          {/* Blueprint grid — same motif as the login/home pages, fading in
              from the bottom. No card/border; it blends into the sidebar. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(color-mix(in srgb, var(--app-sidebar-fg) 5%, transparent) 1px, transparent 1px),
                linear-gradient(90deg, color-mix(in srgb, var(--app-sidebar-fg) 5%, transparent) 1px, transparent 1px),
                linear-gradient(color-mix(in srgb, var(--app-sidebar-fg) 2.5%, transparent) 1px, transparent 1px),
                linear-gradient(90deg, color-mix(in srgb, var(--app-sidebar-fg) 2.5%, transparent) 1px, transparent 1px)`,
              backgroundSize: '56px 56px, 56px 56px, 14px 14px, 14px 14px',
              maskImage: 'linear-gradient(to top, black 0%, transparent 80%)',
              WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 80%)',
            }}
          />
          {/* Gold glow rising from the bottom — swells on hover. */}
          <motion.div
            className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none"
            initial={false}
            animate={{ opacity: upgradeHovered ? 1 : 0.5 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            style={{
              background:
                'radial-gradient(120% 90% at 50% 100%, color-mix(in srgb, var(--app-nav-active-bg) 14%, transparent), color-mix(in srgb, var(--app-sidebar-fg) 5%, transparent) 38%, transparent 72%)',
            }}
          />
          {/* Night-sky starfield — scattered points of light that twinkle and
              brighten on hover. The single amber "north star" is the plan you're
              reaching for; the white stars are the features it unlocks below. */}
          <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none">
            {UPGRADE_STARS.map((s, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full"
                style={{
                  top: s.top,
                  left: s.left,
                  width: s.size,
                  height: s.size,
                  background: s.north ? 'var(--app-nav-active-bg)' : 'var(--app-sidebar-fg)',
                  boxShadow: s.north
                    ? '0 0 6px 1px var(--app-nav-active-bg)'
                    : s.size >= 2
                      ? '0 0 4px 0.5px var(--app-sidebar-fg)'
                      : 'none',
                }}
                animate={{
                  opacity: upgradeHovered ? [s.dim + 0.2, 1, s.dim + 0.2] : [s.dim, s.bright, s.dim],
                  scale: upgradeHovered ? [1, s.north ? 1.5 : 1.7, 1] : [1, 1.2, 1],
                }}
                transition={{
                  duration: (upgradeHovered ? 1.3 : 2.4) + s.size * 0.3,
                  repeat: Infinity,
                  delay: s.delay,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>

          <motion.div layout className="relative">
            {/* Plan badge + CTA headline (replaces the plain "Free plan" title). */}
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-app-sidebar-foreground/10 text-app-sidebar-muted text-[8px] font-bold uppercase tracking-wider">
              {t('plan.free_plan_title', { defaultValue: 'Free plan' })}
            </span>
            <p className="mt-2 text-[13px] font-bold text-app-sidebar-foreground leading-tight">
              {t('plan.free_plan_cta', { defaultValue: 'Unlock the full platform' })}
            </p>

            {/* Stable one-line pitch — no layout shift on hover; hover only
                intensifies the gold glow / starfield / button halo. */}
            <p className="mt-1 text-[11px] leading-relaxed text-app-sidebar-foreground/50">
              {t('plan.free_plan_desc', {
                defaultValue: 'Everything you need to teach, sell & grow.',
              })}
            </p>

            <motion.a
              href={getMainDomainUri(`/billing?org=${org?.slug ?? ''}`)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              animate={{
                boxShadow: upgradeHovered
                  ? '0 0 0 1px var(--app-nav-active-bg), 0 8px 24px -6px var(--app-nav-active-bg)'
                  : '0 0 0 0 transparent',
              }}
              transition={{ duration: 0.35 }}
              className="mt-3 relative overflow-hidden flex items-center justify-center gap-1.5 w-full rounded-lg bg-app-nav-active text-app-nav-active-foreground text-[13px] font-semibold py-2"
            >
              <span className="relative z-10 flex items-center gap-1.5">
                <Rocket size={13} weight="duotone" />
                {t('plan.upgrade', { defaultValue: 'Upgrade' })}
              </span>
              {/* Diagonal shimmer sweep across the button. */}
              <motion.span
                aria-hidden
                className="absolute top-0 bottom-0 w-1/3 -skew-x-12 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(0,0,0,0.07), transparent)',
                }}
                animate={{ left: ['-40%', '140%'] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatDelay: upgradeHovered ? 0.4 : 2,
                  ease: 'easeInOut',
                }}
              />
            </motion.a>
          </motion.div>
        </motion.div>
      )}

      {/* Bottom Section */}
      <div className="border-t border-app-nav-border py-3 px-3 shrink-0">
        <div className="space-y-1">
          {/* Expand button when collapsed */}
          {isCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label={t('dashboard.nav.expand_sidebar')}
                  onClick={toggleCollapse}
                  className="flex items-center justify-center w-full h-10 rounded-lg text-app-sidebar-foreground/50 hover:text-app-nav-hover-foreground hover:bg-app-nav-hover transition-all"
                >
                  <SidebarSimple size={20} weight="fill" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="z-tooltip bg-app-sidebar border-app-nav-border text-app-sidebar-foreground text-xs px-2 py-1 shadow-lg shadow-black/20">
                {t('common.expand')}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Language Switcher with hover menu */}
          <HoverMenu
            align="end"
            content={
              <HoverMenuContent className="w-64 max-h-96 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <HoverMenuLabel className="flex items-center gap-2 text-app-sidebar-muted font-medium">
                  <Globe size={16} weight="fill" />
                  <span>{t('common.language')}</span>
                </HoverMenuLabel>
                <NavDesc id="language" />
                <HoverMenuSeparator />
                {AVAILABLE_LANGUAGES.map((language) => (
                  <HoverMenuItem
                    key={language.code}
                    onClick={() => changeLanguage(language.code)}
                    className="flex items-center justify-between px-3 py-2.5 cursor-pointer text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{language.nativeName}</span>
                      <span className="text-xs text-app-sidebar-foreground/50">{t(language.translationKey)}</span>
                    </div>
                    {i18n.language.split('-')[0] === language.code && (
                      <Check size={16} weight="bold" className="text-green-500" />
                    )}
                  </HoverMenuItem>
                ))}
              </HoverMenuContent>
            }
          >
            <button aria-label={t('dashboard.nav.open_language_menu')} className={cn(
              "flex items-center w-full rounded-lg text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover transition-all group",
              isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
            )}>
              <Globe size={20} weight="fill" />
              {!isCollapsed && (
                <span className="text-sm font-medium">{t('common.language')}</span>
              )}
            </button>
          </HoverMenu>

          {/* Help with hover menu */}
          <HoverMenu
            align="end"
            content={
              <HoverMenuContent className="w-56">
                <HoverMenuLabel className="flex items-center gap-2 text-app-sidebar-muted font-medium">
                  <Question size={16} weight="fill" />
                  <span>{t('common.help')}</span>
                </HoverMenuLabel>
                <NavDesc id="help" />
                <HoverMenuSeparator />
                <NavTip id="feedback">
                  <HoverMenuItem
                    onClick={() => setFeedbackModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors"
                  >
                    <ChatCircleDots size={16} weight="fill" />
                    <span>{t('common.help_menu.report_feedback')}</span>
                  </HoverMenuItem>
                </NavTip>
              </HoverMenuContent>
            }
          >
            <button aria-label={t('dashboard.nav.open_help_menu')} className={cn(
              "flex items-center w-full rounded-lg text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover transition-all group",
              isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
            )}>
              <Question size={20} weight="fill" />
              {!isCollapsed && (
                <span className="text-sm font-medium">{t('common.help')}</span>
              )}
            </button>
          </HoverMenu>

          {/* My Organizations with hover menu (multi-org / SaaS only) */}
          {multiOrg && (
            <HoverMenu
              align="end"
              content={
                <HoverMenuContent className="w-64 max-h-96 overflow-y-auto">
                  <HoverMenuLabel className="flex items-center gap-2 text-app-sidebar-muted font-medium">
                    <Buildings size={16} weight="fill" />
                    <span>{t('common.organizations', { defaultValue: 'Organizations' })}</span>
                  </HoverMenuLabel>
                  <NavDesc id="orgs" />
                  <HoverMenuSeparator />
                  <HoverMenuItem asChild>
                    <NavTip id="orgs_home">
                      <a href={getMainDomainUri('/home')} className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <House size={16} weight="fill" />
                        <span>{t('common.home', { defaultValue: 'Home' })}</span>
                      </a>
                    </NavTip>
                  </HoverMenuItem>
                  {canManageOrg && (
                    <HoverMenuItem asChild>
                      <NavTip id="orgs_billing">
                        <a href={getMainDomainUri(`/billing?org=${org?.slug ?? ''}`)} className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                          <CurrencyCircleDollar size={16} weight="fill" />
                          <span>{t('common.billing', { defaultValue: 'Billing' })}</span>
                        </a>
                      </NavTip>
                    </HoverMenuItem>
                  )}
                  {myOrgs.length > 0 && <HoverMenuSeparator />}
                  {myOrgs.map((o: any) => (
                    <HoverMenuItem key={o.id} asChild>
                      <a href={getUriWithOrg(o.slug, '/')} className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors",
                        o.id === org?.id ? "text-app-sidebar-foreground" : "text-app-sidebar-muted"
                      )}>
                        <Buildings size={16} weight="fill" />
                        <span className="truncate flex-1">{o.name}</span>
                        {o.id === org?.id && <Check size={14} weight="bold" className="text-green-500" />}
                      </a>
                    </HoverMenuItem>
                  ))}
                  <HoverMenuSeparator />
                  <HoverMenuItem asChild>
                    <NavTip id="orgs_create">
                      <a href={getMainDomainUri('/new')} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-app-sidebar-foreground hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                        <Plus size={16} weight="bold" />
                        <span>{t('common.create_organization', { defaultValue: 'Create organization' })}</span>
                      </a>
                    </NavTip>
                  </HoverMenuItem>
                </HoverMenuContent>
              }
            >
              <button aria-label={t('dashboard.nav.open_organizations_menu')} className={cn(
                "flex items-center w-full rounded-lg text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover transition-all group",
                isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
              )}>
                <Buildings size={20} weight="fill" />
                {!isCollapsed && (
                  <span className="text-sm font-medium">{t('common.organizations', { defaultValue: 'Organizations' })}</span>
                )}
              </button>
            </HoverMenu>
          )}

          {/* User Menu with hover menu */}
          <HoverMenu
            align="end"
            content={
              <HoverMenuContent className="w-56">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold text-app-sidebar-foreground">{session?.data?.user?.username}</p>
                  <p className="text-xs text-app-sidebar-foreground/50">{session?.data?.user?.email}</p>
                </div>
                <HoverMenuSeparator />
                <HoverMenuItem asChild>
                  <NavTip id="account_settings">
                    <Link href="/account/general" className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                      <Gear size={16} weight="fill" />
                      <span>{t('common.settings')}</span>
                    </Link>
                  </NavTip>
                </HoverMenuItem>
                <HoverMenuItem asChild>
                  <NavTip id="purchases">
                    <Link href={getUriWithOrg(org?.slug, '/account/purchases')} className="flex items-center gap-2 px-3 py-2 text-sm text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover cursor-pointer transition-colors">
                      <ShoppingBag size={16} weight="fill" />
                      <span>{t('account.purchases')}</span>
                    </Link>
                  </NavTip>
                </HoverMenuItem>
                <HoverMenuSeparator />
                <NavTip id="sign_out">
                  <HoverMenuItem
                    onClick={() => logOutUI()}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:text-red-400 hover:bg-app-nav-hover cursor-pointer transition-colors"
                  >
                    <SignOut size={16} weight="fill" data-dir-flip />
                    <span>{t('user.sign_out')}</span>
                  </HoverMenuItem>
                </NavTip>
              </HoverMenuContent>
            }
          >
            <button className={cn(
              "flex items-center w-full rounded-lg text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover transition-all group",
              isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
            )}>
              <UserAvatar width={24} rounded="rounded-full" shadow="shadow-none" />
              {!isCollapsed && (
                <div className="flex flex-col min-w-0 flex-1 text-start">
                  <span className="text-sm font-medium truncate text-app-sidebar-foreground">{session?.data?.user?.username}</span>
                  <span className="text-xs text-app-sidebar-foreground/50 truncate">{session?.data?.user?.email}</span>
                </div>
              )}
            </button>
          </HoverMenu>
        </div>
      </div>
    </nav>

      {/* Feedback Modal */}
      <FeedbackModal
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
        theme="dark"
        userName={session?.data?.user?.username}
        userEmail={session?.data?.user?.email}
      />
    </TooltipProvider>
  )
}

const MenuLink = ({ href, icon, label, tip, isCollapsed, isExternal, active, onClick }: {
  href: string
  icon: React.ReactNode
  label: string
  tip?: string
  isCollapsed: boolean
  isExternal?: boolean
  active?: boolean
  onClick?: () => void
}) => {
  const { t } = useTranslation()
  const content = (
    <div
      className={cn(
        "relative flex items-center w-full rounded-lg transition-all",
        active
          ? "text-app-nav-active-foreground bg-app-nav-active"
          : "text-app-sidebar-muted hover:text-app-nav-hover-foreground hover:bg-app-nav-hover",
        isCollapsed ? "justify-center h-10" : "px-3 py-2 gap-3"
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute start-0.5 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-app-nav-active-foreground rounded-full"
        />
      )}
      {icon}
      {!isCollapsed && (
        <span className="text-sm font-medium">{label}</span>
      )}
    </div>
  )

  const ariaCurrent = active ? 'page' : undefined
  const linkElement = isExternal ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} onClick={onClick}>
      {content}
    </a>
  ) : (
    <Link aria-label={label} aria-current={ariaCurrent} href={href} onClick={onClick}>
      {content}
    </Link>
  )

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {linkElement}
        </TooltipTrigger>
        <TooltipContent side="right" className="z-tooltip max-w-[220px] bg-app-sidebar border-app-nav-border text-app-sidebar-foreground text-xs px-2 py-1 shadow-lg shadow-black/20">
          {label}
          {tip && (
            <span className="block mt-0.5 leading-snug text-app-sidebar-muted">{t(`dashboard.nav_tips.${tip}`)}</span>
          )}
        </TooltipContent>
      </Tooltip>
    )
  }

  return tip ? <NavTip id={tip}>{linkElement}</NavTip> : linkElement
}

export default DashLeftMenu
