import type { APIRequestContext } from '@playwright/test'
import { getAdminToken } from './org-branding'

/**
 * Seed helpers for the public-home and Dynamic-Page image specs. Like
 * `org-branding.ts`, everything goes through the real admin API (the same
 * endpoints the dashboard uses) and every helper restores/removes what it
 * created — even when the test body throws.
 */

const API_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:1338/api/v1'
const ORG_ID = process.env.PLAYWRIGHT_ORG_ID || '1'
const ORG_SLUG = process.env.PLAYWRIGHT_ORG_SLUG || 'default'

/** Deterministic 16:9 SVG (as a data URI, so no storage / network is needed). */
export function svgImage(label: string, color = '#3b82f6', width = 1600, height = 900): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="100%" height="100%" fill="${color}"/>` +
    `<circle cx="${width / 2}" cy="${height / 2}" r="${height / 4}" fill="rgba(255,255,255,0.35)"/>` +
    `<text x="50%" y="52%" font-family="Arial" font-size="${height / 8}" fill="#fff" text-anchor="middle">${label}</text>` +
    `</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

async function authHeaders(request: APIRequestContext) {
  return { Authorization: `Bearer ${await getAdminToken(request)}` }
}

async function readLanding(request: APIRequestContext): Promise<any> {
  const res = await request.get(`${API_URL}/orgs/slug/${ORG_SLUG}`)
  if (!res.ok()) throw new Error(`Could not read the org for the e2e fixture (${res.status()})`)
  const org = await res.json()
  return org?.config?.config?.customization?.landing || org?.config?.config?.landing || null
}

async function writeLanding(request: APIRequestContext, landing: any): Promise<void> {
  const res = await request.put(`${API_URL}/orgs/${ORG_ID}/landing`, {
    headers: await authHeaders(request),
    data: landing,
  })
  if (!res.ok()) throw new Error(`Failed to set the org landing (${res.status()}): ${await res.text()}`)
  // The API caches org config; poll the read-back instead of sleeping.
  const wanted = JSON.stringify(landing)
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    const current = await readLanding(request)
    if (JSON.stringify(current) === wanted) return
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error('Org landing did not propagate within 5s of writeLanding()')
}

/** Runs `fn` with the org's public landing set to `landing`, always restoring the previous one. */
export async function withOrgLanding<T>(request: APIRequestContext, landing: any, fn: () => Promise<T>): Promise<T> {
  const previous = await readLanding(request)
  await writeLanding(request, landing)
  try {
    return await fn()
  } finally {
    // "no landing" is equivalent to an empty, disabled one.
    await writeLanding(request, previous ?? { enabled: false, sections: [] })
  }
}

/** A hero (legacy editor defaults: black CTA etc.), a text+image section and a people section. */
export function sampleLanding() {
  return {
    enabled: true,
    sections: [
      {
        type: 'hero',
        title: 'Hero',
        background: { type: 'solid', color: '#ffffff' },
        heading: { text: 'Encuentra aquí todo el contenido de tus sesiones', color: '#000000', size: 'large' },
        subheading: {
          text: 'Consulta materiales, recursos y actividades del programa.',
          color: '#666666',
          size: 'medium',
        },
        buttons: [{ text: 'Explorar cursos', link: '/courses', color: '#ffffff', background: '#000000' }],
        illustration: {
          image: { url: svgImage('Hero', '#0ea5a4'), alt: 'Ilustración del programa' },
          position: 'right',
          verticalAlign: 'center',
          size: 'large',
        },
        contentAlign: 'left',
      },
      {
        type: 'text-and-image',
        title: 'Sobre el programa',
        text: 'Un programa pensado para acompañarte sesión a sesión.',
        flow: 'left',
        image: { url: svgImage('Programa', '#8b5cf6'), alt: 'Programa' },
        buttons: [],
      },
      {
        type: 'people',
        title: 'Conoce a tus docentes',
        people: [
          {
            user_uuid: 'a',
            name: 'Docente Uno',
            description: 'Especialista en didáctica. '.repeat(6),
            image_url: svgImage('Uno', '#ef4444', 800, 600),
          },
          {
            user_uuid: 'b',
            name: 'Docente Dos',
            description: 'Investigadora en educación.',
            image_url: svgImage('Dos', '#f59e0b', 800, 600),
          },
        ],
      },
    ],
  }
}

export interface SeededDynamicPage {
  courseUuid: string
  activityUuid: string
  cleanup: () => Promise<void>
}

/** Tiptap doc with one image block per preset, an aligned image, a legacy image and an alt-text image. */
export function imageSizingDoc() {
  const img = (attrs: Record<string, unknown>, label: string) => ({
    type: 'blockImage',
    attrs: { unsplash_url: svgImage(label), ...attrs },
  })
  return {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Image block sizing' }] },
      img({ widthPreset: '25', alignment: 'center', alt: 'Preset 25' }, '25'),
      img({ widthPreset: '50', alignment: 'center', alt: 'Preset 50' }, '50'),
      img({ widthPreset: '75', alignment: 'center', alt: 'Preset 75' }, '75'),
      img({ widthPreset: '100', alignment: 'center', alt: 'Preset 100' }, '100'),
      img({ widthPreset: '50', alignment: 'left', alt: 'Left aligned' }, 'left'),
      img({ widthPreset: '50', alignment: 'right', alt: 'Right aligned' }, 'right'),
      // Saved before presets existed: only `size` + `alignment`, no widthPreset / alt.
      img({ size: { width: 300 }, alignment: 'center' }, 'legacy'),
    ],
  }
}

/** Creates a course > chapter > Dynamic Page (TYPE_DYNAMIC) with `content`, and returns a cleanup. */
export async function seedDynamicPage(request: APIRequestContext, content: any): Promise<SeededDynamicPage> {
  const headers = await authHeaders(request)

  const courseRes = await request.post(`${API_URL}/courses/?org_id=${ORG_ID}`, {
    headers,
    multipart: {
      name: `e2e image sizing ${Date.now()}`,
      description: 'Created by the Playwright image-sizing spec; removed afterwards.',
      public: 'true',
      learnings: 'e2e',
      tags: 'e2e',
      about: 'e2e',
    },
  })
  if (!courseRes.ok()) throw new Error(`Failed to create the e2e course (${courseRes.status()}): ${await courseRes.text()}`)
  const course = await courseRes.json()

  const cleanup = async () => {
    await request.delete(`${API_URL}/courses/${course.course_uuid}`, { headers }).catch(() => {})
  }

  try {
    const chapterRes = await request.post(`${API_URL}/chapters/`, {
      headers,
      data: { name: 'Chapter 1', description: '', course_id: course.id, org_id: Number(ORG_ID) },
    })
    if (!chapterRes.ok()) throw new Error(`Failed to create the e2e chapter (${chapterRes.status()}): ${await chapterRes.text()}`)
    const chapter = await chapterRes.json()

    const activityRes = await request.post(
      `${API_URL}/activities/?coursechapter_id=${chapter.id}&org_id=${ORG_ID}`,
      {
        headers,
        data: {
          name: 'Dynamic page',
          activity_type: 'TYPE_DYNAMIC',
          activity_sub_type: 'SUBTYPE_DYNAMIC_PAGE',
          chapter_id: chapter.id,
          content,
          published: true,
        },
      }
    )
    if (!activityRes.ok()) throw new Error(`Failed to create the e2e activity (${activityRes.status()}): ${await activityRes.text()}`)
    const activity = await activityRes.json()

    // Creation may ignore `content`; write it explicitly through the update endpoint too.
    const updateRes = await request.put(`${API_URL}/activities/${activity.activity_uuid}`, {
      headers,
      data: { content, published: true },
    })
    if (!updateRes.ok()) throw new Error(`Failed to set the e2e activity content (${updateRes.status()}): ${await updateRes.text()}`)

    return { courseUuid: course.course_uuid, activityUuid: activity.activity_uuid, cleanup }
  } catch (err) {
    await cleanup()
    throw err
  }
}
