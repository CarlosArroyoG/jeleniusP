import { describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import { buildPublicNav, usesPublicHeader, LANDING_PEOPLE_ANCHOR } from '../lib/publicNav.ts'

const webRoot = path.resolve(import.meta.dirname, '..')
const read = (rel) => fs.readFileSync(path.join(webRoot, rel), 'utf8')

const toHref = (p) => `https://school.test${p}`
const allEnabled = () => true

describe('usesPublicHeader — which shell a visitor gets', () => {
  test('only an unauthenticated visitor gets the public header', () => {
    expect(usesPublicHeader('unauthenticated')).toBe(true)
  })

  test('authenticated users keep the full LMS shell', () => {
    expect(usesPublicHeader('authenticated')).toBe(false)
  })

  test("'loading' / unknown never flashes the public header at a signed-in user", () => {
    expect(usesPublicHeader('loading')).toBe(false)
    expect(usesPublicHeader(undefined)).toBe(false)
    expect(usesPublicHeader(null)).toBe(false)
  })
})

describe('buildPublicNav — public navigation contents', () => {
  test('default: Home + Courses only — no Library / Communities / Podcasts / Store', () => {
    const items = buildPublicNav({ toHref, isFeatureEnabled: allEnabled })
    expect(items.map((i) => i.key)).toEqual(['home', 'courses'])
    expect(items[0].href).toBe('https://school.test/')
    expect(items[1].href).toBe('https://school.test/courses')
  })

  test('LMS-only built-in menu items configured by the org are still not advertised publicly', () => {
    const items = buildPublicNav({
      toHref,
      isFeatureEnabled: allEnabled,
      menuItems: [
        { type: 'library', enabled: true, order: 0 },
        { type: 'communities', enabled: true, order: 1 },
        { type: 'store', enabled: true, order: 2 },
      ],
    })
    expect(items.map((i) => i.key)).toEqual(['home', 'courses'])
  })

  test('Courses is hidden when the courses feature is not enabled for the org', () => {
    const items = buildPublicNav({ toHref, isFeatureEnabled: () => false })
    expect(items.map((i) => i.key)).toEqual(['home'])
  })

  test('custom menu items the school added are included, in configured order', () => {
    const items = buildPublicNav({
      toHref,
      isFeatureEnabled: allEnabled,
      menuItems: [
        { type: 'custom', enabled: true, order: 2, label: 'Contacto', url: '/contacto' },
        { type: 'custom', enabled: true, order: 1, label: 'Acerca de', url: 'https://example.org/about' },
        { type: 'custom', enabled: false, order: 3, label: 'Oculto', url: '/oculto' },
        { type: 'custom', enabled: true, order: 4, label: 'Sin url', url: '' },
      ],
    })
    const custom = items.filter((i) => i.key.startsWith('custom-'))
    expect(custom.map((i) => i.label)).toEqual(['Acerca de', 'Contacto'])
    expect(custom[0]).toMatchObject({ href: 'https://example.org/about', external: true })
    expect(custom[1]).toMatchObject({ href: 'https://school.test/contacto', external: false })
  })

  test('a people landing section adds an anchor link using the section title — only if it exists', () => {
    const without = buildPublicNav({
      toHref,
      isFeatureEnabled: allEnabled,
      landing: { enabled: true, sections: [{ type: 'hero' }] },
    })
    expect(without.find((i) => i.key === 'people')).toBeUndefined()

    const disabled = buildPublicNav({
      toHref,
      isFeatureEnabled: allEnabled,
      landing: { enabled: false, sections: [{ type: 'people', title: 'Docentes' }] },
    })
    expect(disabled.find((i) => i.key === 'people')).toBeUndefined()

    const withPeople = buildPublicNav({
      toHref,
      isFeatureEnabled: allEnabled,
      landing: { enabled: true, sections: [{ type: 'hero' }, { type: 'people', title: 'Conoce a tus docentes' }] },
    })
    const people = withPeople.find((i) => i.key === 'people')
    expect(people.label).toBe('Conoce a tus docentes')
    expect(people.href).toBe(`https://school.test/#${LANDING_PEOPLE_ANCHOR}`)
  })

  test('people section without a title falls back to the i18n default label', () => {
    const items = buildPublicNav({
      toHref,
      isFeatureEnabled: allEnabled,
      landing: { enabled: true, sections: [{ type: 'people', title: '' }] },
    })
    const people = items.find((i) => i.key === 'people')
    expect(people.label).toBeUndefined()
    expect(people.labelKey).toBe('public_home.people_default_title')
  })

  test('missing config never throws', () => {
    expect(() => buildPublicNav({ toHref, isFeatureEnabled: allEnabled, menuItems: undefined, landing: undefined })).not.toThrow()
  })
})

describe('shell separation (source-level guards)', () => {
  const orgMenu = read('components/Objects/Menus/OrgMenu.tsx')
  const publicHeader = read('components/Objects/Menus/OrgPublicHeader.tsx')

  test('OrgMenu hands unauthenticated visitors to OrgPublicHeader before rendering the LMS shell', () => {
    const gate = orgMenu.indexOf('usesPublicHeader(session?.status)')
    const shell = orgMenu.indexOf('aria-label="Top navigation"')
    expect(gate).toBeGreaterThan(-1)
    expect(shell).toBeGreaterThan(gate)
    expect(orgMenu).toContain('<OrgPublicHeader')
  })

  test('the authenticated shell still renders the full LMS navigation', () => {
    expect(orgMenu).toContain('<MenuLinks')
    expect(orgMenu).toContain('<SearchBar')
    expect(orgMenu).toContain('<HeaderProfileBox')
    expect(orgMenu).toContain('<CopilotMenuButton')
  })

  test('the public header does not render the LMS-only surfaces', () => {
    expect(publicHeader).not.toContain('SearchBar')
    expect(publicHeader).not.toContain('MenuLinks')
    expect(publicHeader).not.toContain('CopilotMenuButton')
  })

  test('the public header is themed by tokens — no hardcoded black / gray', () => {
    expect(publicHeader).toContain('bg-app-header')
    expect(publicHeader).toContain('text-app-header-foreground')
    expect(publicHeader).not.toMatch(/bg-black|bg-gray-9|text-black|#000\b|#111|#0f0f10/)
  })
})
