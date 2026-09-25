import { expect, test } from 'bun:test'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { config } from '../proxy.ts'

test.each([
  '/jelenius/jelenius-icon.svg',
  '/jelenius/jelenius-wordmark.svg',
  '/jelenius/jelenius-icon.svg?v=2',
  '/lrn.svg',
  '/learnhouse_logo.png',
  '/_next/static/chunks/app.js',
])('public asset %s bypasses tenant rewriting', (url) => {
  expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false)
})

test.each(['/login', '/dash', '/course/course_test', '/jelenius-course'])(
  'application route %s still uses the tenant proxy', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true)
  },
)
