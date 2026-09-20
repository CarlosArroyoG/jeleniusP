'use client'
import React from 'react'
import Link from 'next/link'
import {
  PlusCircle,
  ChartBar,
  GearSix,
  Users,
  BookOpen,
} from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useTranslation } from 'react-i18next'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getAPIUrl } from '@services/config/config'
import { OrgUsageResponse, orgUsageFetcher } from '@services/orgs/usage'
import AdminAuthorization from '@components/Security/AdminAuthorization'
import { usePlan } from '@components/Hooks/usePlan'
import QuickStats from './QuickStats'
import RecentCourses from './RecentCourses'
import RecentMembers from './RecentMembers'
import ContentOverview from './ContentOverview'
import UsageOverview from './UsageOverview'
import { Button } from '@components/ui/button'
import { Badge } from '@components/ui/badge'

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  free: { bg: 'bg-gray-100', text: 'text-gray-600' },
  oss: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  standard: { bg: 'bg-blue-100', text: 'text-blue-700' },
  pro: { bg: 'bg-purple-100', text: 'text-purple-700' },
  enterprise: { bg: 'bg-amber-100', text: 'text-amber-700' },
}

export default function DashboardHome() {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const org = useOrg() as any

  const token = session?.data?.tokens?.access_token
  const orgId = org?.id
  const username = session?.data?.user?.username || ''

  // TanStack Query will dedupe with UsageOverview's identical call via shared queryKey
  const { data: usageData } = useQuery<OrgUsageResponse>({
    queryKey: queryKeys.org.usage(orgId),
    queryFn: () => orgUsageFetcher(`${getAPIUrl()}orgs/${orgId}/usage`, token),
    enabled: !!token && !!orgId,
    staleTime: 60_000,
  })

  const plan = usePlan()
  const planStyle = PLAN_COLORS[plan] || PLAN_COLORS.free

  return (
    <div className="h-full w-full bg-surface-muted">
      <div className="px-4 sm:px-10 pt-8 pb-10">
        <div className="space-y-6 max-w-[1600px] mx-auto w-full">
          {/* Welcome Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {t('dashboard.home.welcome_back')}{username ? `, ${username}` : ''}
              </h1>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge
                  variant="outline"
                  className={`capitalize ${planStyle.bg} ${planStyle.text} border-transparent`}
                >
                  {plan === 'oss' ? 'OSS' : `${plan} ${t('dashboard.home.plan')}`}
                </Badge>
                {org?.name && (
                  <span className="text-xs text-gray-400">{org.name}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button asChild variant="brand" size="sm" className="gap-1.5">
                <Link href="/dash/courses?new=true">
                  <PlusCircle size={14} weight="bold" />
                  {t('dashboard.home.create_course')}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-1.5 nice-shadow">
                <Link href="/dash/analytics">
                  <ChartBar size={14} weight="bold" />
                  {t('dashboard.home.analytics')}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-1.5 nice-shadow">
                <Link href="/dash/users/settings/users">
                  <Users size={14} weight="bold" />
                  {t('dashboard.home.members')}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-1.5 nice-shadow">
                <Link href="/dash/org/settings/general">
                  <GearSix size={14} weight="bold" />
                  {t('dashboard.home.settings')}
                </Link>
              </Button>
            </div>
          </div>

          <AdminAuthorization authorizationMode="component">
            <div className="space-y-6">
              {/* Content counts row */}
              <ContentOverview />

              {/* Main grid: courses + members + usage */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <RecentCourses />
                  <RecentMembers />
                </div>
                <div className="space-y-6">
                  <UsageOverview />
                  <QuickStats />
                </div>
              </div>
            </div>
          </AdminAuthorization>
        </div>
      </div>
    </div>
  )
}
