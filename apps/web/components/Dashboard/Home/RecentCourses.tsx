'use client'
import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { useTranslation } from 'react-i18next'
import { formatDate } from '@/lib/format'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { getOrgCourses } from '@services/courses/courses'
import { SafeImage } from '@components/Objects/SafeImage'
import { BookOpen, PlusCircle, Clock } from '@phosphor-icons/react'
import { Card } from '@components/ui/card'
import { Badge } from '@components/ui/badge'
import { EmptyState } from '@components/ui/empty-state'

export default function RecentCourses() {
  const { t, i18n } = useTranslation()
  const org = useOrg() as any
  const session = useLHSession() as any
  const token = session?.data?.tokens?.access_token
  const orgslug = org?.slug

  const { data: coursesData, isLoading } = useQuery({
    queryKey: [...queryKeys.courses.list(orgslug), 'recent', 8],
    queryFn: () => getOrgCourses(orgslug, null, token, true),
    enabled: !!token && !!orgslug,
    staleTime: 60_000,
  })

  const courses: any[] = coursesData ?? []
  const publishedCount = courses.filter((c: any) => c.published).length
  const draftCount = courses.filter((c: any) => !c.published).length

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-text-secondary">
            {t('dashboard.home.recent_courses')}
          </h3>
          {courses.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="success" className="text-[10px] px-2 py-0.5">
                {publishedCount} {t('dashboard.home.published')}
              </Badge>
              {draftCount > 0 && (
                <Badge variant="neutral" className="text-[10px] px-2 py-0.5">
                  {draftCount} {t('dashboard.home.draft')}
                </Badge>
              )}
            </div>
          )}
        </div>
        <Link
          href="/dash/courses"
          className="text-[11px] font-medium text-text-secondary/70 hover:text-text-secondary transition-colors"
        >
          {t('dashboard.home.view_all')} &rarr;
        </Link>
      </div>

      {isLoading ? (
        <div className="px-5 pb-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 bg-gray-100 rounded-lg shrink-0" />
              <div className="flex-1">
                <div className="h-3 bg-gray-100 rounded w-40 mb-1.5" />
                <div className="h-2 bg-gray-50 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={20} weight="duotone" />}
          title={t('dashboard.home.no_courses_yet')}
          action={
            <Link
              href="/dash/courses?new=true"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:opacity-80"
            >
              <PlusCircle size={14} weight="bold" />
              {t('dashboard.home.create_your_first_course')}
            </Link>
          }
        />
      ) : (
        <div className="divide-y divide-gray-50">
          {courses.slice(0, 8).map((course: any) => {
            const courseId = course.course_uuid?.replace('course_', '')
            const thumbnail = course.thumbnail_image
              ? getCourseThumbnailMediaDirectory(
                  org.org_uuid,
                  course.course_uuid,
                  course.thumbnail_image
                )
              : null
            const updatedAt = course.update_date
              ? formatDate(course.update_date, i18n.language, {
                  dateStyle: undefined,
                  month: 'short',
                  day: 'numeric',
                })
              : null

            return (
              <Link
                key={course.course_uuid}
                prefetch={false}
                href={`/dash/courses/course/${courseId}/general`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {thumbnail ? (
                    <SafeImage
                      src={thumbnail}
                      alt={course.name}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <BookOpen
                      size={16}
                      weight="duotone"
                      className="text-gray-300"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate group-hover:text-gray-900">
                    {course.name}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {updatedAt && (
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Clock size={10} />
                        {updatedAt}
                      </span>
                    )}
                    {course.chapters_count !== undefined && (
                      <span className="text-[10px] text-gray-400">
                        {course.chapters_count} {course.chapters_count !== 1 ? t('dashboard.home.chapters') : t('dashboard.home.chapter')}
                      </span>
                    )}
                  </div>
                </div>
                <Badge
                  variant={course.published ? 'success' : 'neutral'}
                  className="text-[10px] px-2 py-0.5 shrink-0"
                >
                  {course.published ? t('dashboard.home.published') : t('dashboard.home.draft')}
                </Badge>
              </Link>
            )
          })}
        </div>
      )}
    </Card>
  )
}
