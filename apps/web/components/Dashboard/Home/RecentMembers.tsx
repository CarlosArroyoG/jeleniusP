'use client'
import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useTranslation } from 'react-i18next'
import { formatDate } from '@/lib/format'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getAPIUrl } from '@services/config/config'
import { apiFetch } from '@services/utils/ts/requests'
import { Users, ShieldCheck, Clock, EnvelopeSimple } from '@phosphor-icons/react'
import { Card } from '@components/ui/card'
import { Badge } from '@components/ui/badge'
import { EmptyState } from '@components/ui/empty-state'

export default function RecentMembers() {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const orgId = org?.id

  const { data: membersData, isLoading } = useQuery({
    queryKey: [...queryKeys.org.users(orgId), 1, 'recent', 8],
    queryFn: () => apiFetch(`${getAPIUrl()}orgs/${orgId}/users?page=1&limit=8&sort_order=desc`, token),
    enabled: !!token && !!orgId,
    staleTime: 60_000,
  })

  const members: any[] = membersData?.items ?? []
  const totalMembers = membersData?.total ?? 0

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-text-secondary">
            {t('dashboard.home.recent_members')}
          </h3>
          {totalMembers > 0 && (
            <Badge variant="neutral" className="text-[10px] px-2 py-0.5">
              {totalMembers} {t('dashboard.home.total')}
            </Badge>
          )}
        </div>
        <Link
          href="/dash/users/settings/users"
          className="text-[11px] font-medium text-text-secondary/70 hover:text-text-secondary transition-colors"
        >
          {t('dashboard.home.view_all')} &rarr;
        </Link>
      </div>

      {isLoading ? (
        <div className="px-5 pb-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 bg-gray-100 rounded-full shrink-0" />
              <div className="flex-1">
                <div className="h-3 bg-gray-100 rounded w-32 mb-1.5" />
                <div className="h-2 bg-gray-50 rounded w-44" />
              </div>
            </div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={<Users size={20} weight="duotone" />}
          title={t('dashboard.home.no_members_yet')}
        />
      ) : (
        <div className="divide-y divide-gray-50">
          {members.map((member: any) => {
            const user = member.user
            const role = member.role
            const joinedAt = member.joined_at
              ? formatDate(member.joined_at, i18n.language, {
                  dateStyle: undefined,
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : null
            const displayName =
              user.first_name || user.last_name
                ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                : user.username
            const initials = `${(user.first_name?.[0] || user.username?.[0] || '').toUpperCase()}${(user.last_name?.[0] || '').toUpperCase()}`

            return (
              <div
                key={user.user_uuid}
                className="flex items-center gap-3 px-5 py-3"
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-indigo-100 shrink-0 flex items-center justify-center">
                  <span className="text-[11px] font-semibold text-indigo-600">
                    {initials}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {displayName}
                    </p>
                    {!user.email_verified && (
                      <Badge variant="warning" className="text-[9px] px-1.5 py-0.5">
                        {t('dashboard.home.unverified')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-[10px] text-gray-400 truncate">
                      <EnvelopeSimple size={10} />
                      {user.email}
                    </span>
                    {joinedAt && (
                      <span className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
                        <Clock size={10} />
                        {joinedAt}
                      </span>
                    )}
                  </div>
                </div>

                {/* Role badge */}
                {role && (
                  <Badge variant="neutral" className="flex items-center gap-1 text-[10px] px-2 py-0.5 shrink-0">
                    <ShieldCheck size={10} />
                    {role.name}
                  </Badge>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
