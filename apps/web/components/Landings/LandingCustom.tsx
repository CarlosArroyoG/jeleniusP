'use client'

import React from 'react'
import { LandingSection } from '@components/Dashboard/Pages/Org/OrgEditLanding/landing_types'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getOrgCourses } from '@services/courses/courses'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import CourseThumbnailLanding from '@components/Objects/Thumbnails/CourseThumbnailLanding'
import UserAvatar from '@components/Objects/UserAvatar'
import { useTranslation } from 'react-i18next'
import { cardVariants } from '@components/ui/card'
import { cn } from '@/lib/utils'
import { LANDING_PEOPLE_ANCHOR } from '@/lib/publicNav'
import { heroImageShare, resolveHeroButton, resolveHeroColors } from '@/lib/publicHero'

interface LandingCustomProps {
  landing: {
    sections: LandingSection[]
    enabled: boolean
  }
  orgslug: string
}

function LandingCustom({ landing, orgslug }: LandingCustomProps) {
  const { t } = useTranslation()
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token

  // Fetch all courses for the organization
  const { data: allCourses } = useQuery({
    queryKey: queryKeys.courses.list(orgslug),
    queryFn: () => getOrgCourses(orgslug, null, access_token),
    enabled: !!orgslug,
    staleTime: 60_000,
  })

  const renderSection = (section: LandingSection) => {
    switch (section.type) {
      case 'hero': {
        const colors = resolveHeroColors(section)
        const illustration = section.illustration?.image?.url ? section.illustration : undefined
        const imageShare = heroImageShare(illustration?.size)
        const align = section.contentAlign || (illustration ? 'left' : 'center')
        const alignClasses =
          align === 'left'
            ? 'items-start text-start'
            : align === 'right'
            ? 'items-end text-end'
            : 'items-center text-center'
        const buttonRowClasses =
          align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center'

        return (
          <section
            key={`hero-${section.title}`}
            data-testid="public-hero"
            className="mt-6 md:mt-8 w-full overflow-hidden rounded-xl border border-border shadow-card"
            style={{ background: colors.background }}
          >
            <div
              className={cn(
                'grid items-stretch md:min-h-[340px] lg:min-h-[400px]',
                illustration && 'md:grid-cols-[var(--hero-cols)]'
              )}
              style={
                illustration
                  ? ({ '--hero-cols': `minmax(0,${100 - imageShare}fr) minmax(0,${imageShare}fr)` } as React.CSSProperties)
                  : undefined
              }
            >
              {/* Content */}
              <div
                className={cn(
                  'flex flex-col justify-center gap-4 px-6 py-8 md:px-10 md:py-10 lg:px-14',
                  alignClasses,
                  illustration?.position === 'left' && 'md:order-2'
                )}
              >
                <div className="max-w-xl">
                  <h1
                    className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-balance"
                    style={{ color: colors.heading }}
                  >
                    {section.heading.text}
                  </h1>
                  {section.subheading.text && (
                    <p
                      className="mt-3 text-base md:text-lg leading-relaxed"
                      style={{ color: colors.subheading }}
                    >
                      {section.subheading.text}
                    </p>
                  )}
                </div>
                {section.buttons.length > 0 && (
                  <div className={cn('flex flex-wrap items-center gap-3', buttonRowClasses)}>
                    {section.buttons.map((button, index) => {
                      const style = resolveHeroButton(button, index)
                      return (
                        <a
                          key={index}
                          href={button.link}
                          data-testid={index === 0 ? 'public-hero-cta' : 'public-hero-cta-secondary'}
                          data-variant={style.variant}
                          className={cn(
                            'inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-bold shadow-sm transition-all hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                            style.variant === 'brand' && 'bg-brand text-brand-foreground',
                            style.variant === 'brand-outline' &&
                              'border border-brand text-brand bg-transparent shadow-none hover:bg-brand/10'
                          )}
                          style={
                            style.variant === 'custom'
                              ? { backgroundColor: style.background, color: style.color }
                              : undefined
                          }
                        >
                          {button.text}
                        </a>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Image: fills its whole column (never a small picture floating in a big box) */}
              {illustration && (
                <div
                  className={cn(
                    'relative min-h-[220px] sm:min-h-[280px] md:min-h-0',
                    illustration.position === 'left' && 'md:order-1'
                  )}
                >
                  <img
                    src={illustration.image.url}
                    alt={illustration.image.alt || ''}
                    data-testid="public-hero-image"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              )}
            </div>
          </section>
        )
      }
      case 'text-and-image': {
        const hasImage = !!section.image?.url
        return (
          <section key={`text-image-${section.title}`} className="my-8 md:my-10 w-full">
            <div
              className={cn(
                cardVariants({ variant: 'default', padding: 'none' }),
                'grid items-center gap-6 md:gap-10 p-5 md:p-8',
                hasImage && 'md:grid-cols-2'
              )}
            >
              <div className={cn('w-full', hasImage && section.flow === 'right' && 'md:order-2')}>
                <h2 className="text-2xl md:text-3xl font-bold mb-3 text-foreground tracking-tight">{section.title}</h2>
                <p className="text-base leading-relaxed text-text-secondary whitespace-pre-line">
                  {section.text}
                </p>
                {section.buttons.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-6">
                    {section.buttons.map((button, index) => {
                      const style = resolveHeroButton(button, index)
                      return (
                        <a
                          key={index}
                          href={button.link}
                          className={cn(
                            'inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-bold shadow-xs transition-opacity hover:opacity-90',
                            style.variant === 'brand' && 'bg-brand text-brand-foreground',
                            style.variant === 'brand-outline' &&
                              'border border-brand text-brand bg-transparent shadow-none hover:bg-brand/10'
                          )}
                          style={
                            style.variant === 'custom'
                              ? { backgroundColor: style.background, color: style.color }
                              : undefined
                          }
                        >
                          {button.text}
                        </a>
                      )
                    })}
                  </div>
                )}
              </div>
              {hasImage && (
                <div className={cn('w-full', section.flow === 'right' && 'md:order-1')}>
                  <div className="relative w-full aspect-[4/3] max-h-[340px] overflow-hidden rounded-xl bg-surface-muted">
                    <img
                      src={section.image.url}
                      alt={section.image.alt || ''}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        )
      }
      case 'logos':
        return (
          <section key={`logos-${section.type}`} className="my-8 md:my-10 w-full">
            {section.title && (
              <h2 className="text-2xl md:text-3xl font-bold text-start mb-6 text-foreground">{section.title}</h2>
            )}
            <div className="flex justify-center w-full">
              <div className="flex flex-wrap justify-center items-center gap-x-10 gap-y-6 max-w-7xl">
                {section.logos.map((logo, index) => (
                  <div key={index} className="flex items-center justify-center h-20 w-40 sm:w-48">
                    <img
                      src={logo.url}
                      alt={logo.alt}
                      className="max-h-16 max-w-full object-contain hover:opacity-80 transition-opacity"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      case 'people': {
        // Only the first people section carries the anchor the public header links to.
        const isFirstPeople = landing.sections.find((x) => x.type === 'people') === section
        return (
          <section
            key={`people-${section.title}`}
            id={isFirstPeople ? LANDING_PEOPLE_ANCHOR : undefined}
            className="my-8 md:my-10 w-full scroll-mt-20"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-start mb-6 text-foreground tracking-tight">{section.title}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {section.people.map((person, index) => (
                <article
                  key={index}
                  data-testid="public-person-card"
                  className={cn(cardVariants({ variant: 'default', padding: 'none' }), 'flex flex-col overflow-hidden')}
                >
                  {person.image_url ? (
                    <div className="relative aspect-[4/3] w-full bg-surface-muted">
                      <img
                        src={person.image_url}
                        alt={person.name}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                  ) : person.username ? (
                    <div className="flex items-center justify-center bg-surface-muted py-6">
                      <UserAvatar
                        username={person.username}
                        width={96}
                        rounded="rounded-full"
                        border="border-4"
                        showProfilePopup
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-1 flex-col gap-1.5 p-4">
                    <h3 className="text-lg font-bold leading-snug text-foreground" dir="auto">{person.name}</h3>
                    {person.description && (
                      <p className="text-sm leading-relaxed text-text-secondary line-clamp-4" dir="auto">
                        {person.description}
                      </p>
                    )}
                    {person.link && (
                      <a
                        href={person.link}
                        className="mt-auto pt-2 text-sm font-semibold text-brand hover:underline"
                      >
                        {t('public_home.view_more', { defaultValue: 'View more' })} →
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )
      }
      case 'featured-courses': {
        if (!allCourses) {
          return (
            <section
              key={`featured-courses-${section.title}`}
              className="my-8 md:my-10 w-full"
            >
              <h2 className="text-2xl md:text-3xl font-bold text-start mb-6 text-foreground">{section.title}</h2>
              <div className="text-center py-6 text-text-secondary">{t('courses.loading_courses')}</div>
            </section>
          )
        }

        const featuredCourses = allCourses.filter((course: any) => 
          section.courses.includes(course.course_uuid)
        )

        return (
          <section
            key={`featured-courses-${section.title}`}
            className="my-8 md:my-10 w-full"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-start mb-6 text-foreground">{section.title}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
              {featuredCourses.map((course: any) => (
                <div key={course.course_uuid} className="w-full flex justify-center">
                  <CourseThumbnailLanding
                    course={course}
                    orgslug={orgslug}
                  />
                </div>
              ))}
              {featuredCourses.length === 0 && (
                <div className="col-span-full text-center py-6 text-text-secondary">
                  {t('courses.no_featured_courses')}
                </div>
              )}
            </div>
          </section>
        )
        }
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col items-center w-full max-w-(--breakpoint-2xl) mx-auto px-4 sm:px-6 lg:px-8 pb-6">
      {landing.sections.map((section) => renderSection(section))}
    </div>
  )
}

export default LandingCustom