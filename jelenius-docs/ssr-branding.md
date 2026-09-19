# SSR Branding

## The problem this phase closed

Phase 2 built the theme engine (`resolveOrganizationTheme()` → CSS
variables → Tailwind tokens) but only wired it into **client** components.
`OrgContext`'s `useQuery` fetches the organization client-side, so during
the actual server-rendered HTML (what `curl` sees, no JS executed) the org
was never populated — the theme engine correctly fell back to the Jelenius
default at that point, then the real org's color/font applied a moment
later once the client query resolved. Phase 2's own `theme-engine.md`
flagged this explicitly as a known limitation, not a bug to silently live
with.

This phase closes it: the organization is now resolved **on the server**,
for both the pages that already needed org data (`generateMetadata()`) and
the theme, and that same server-fetched data is handed to the client via
React Query's hydration mechanism — so there is no gap for a flash to occur
in, and no second network request once the client mounts.

## Architecture

```
Request
  │
  ▼
getServerOrg(orgslug)                 lib/theme/getServerOrg.ts
  React.cache()-memoized — the same call from generateMetadata() and
  the layout body resolves to ONE network round-trip, not two
  │
  ▼
getServerOrgTheme(orgslug)            lib/theme/getServerOrgTheme.ts
  │                    │
  ▼                    ▼
resolveOrganizationTheme()      QueryClient.setQueryData(
  (same function,                 queryKeys.org.detail(orgslug), org)
   client + server + tests)       + dehydrate(queryClient)
  │                                │
  ▼                                ▼
style={...} on the                <HydrationBoundary state={...}>
layout's root element              wrapping <OrgProvider>
  │                                │
  ▼                                ▼
Initial HTML already has     Client's useQuery(same key) finds the
--brand-primary etc. set     data already cached — no fetch on mount,
to the ORG'S actual values,  same value the server used, no flash
not the Jelenius default     between "SSR default" and "hydrated org value"
(unless the org really
has no branding, in which
case they're the same value
anyway)
```

## Where it's wired in

- `app/orgs/[orgslug]/layout.tsx` — the student/instructor/admin org shell.
  `generateMetadata()` and the layout's default export both call
  `getServerOrg(orgslug)`; the layout additionally calls
  `getServerOrgTheme(orgslug)` for the CSS vars + hydration state.
- `app/auth/layout.tsx` — login/signup/reset/forgot/verify-email. Calls
  `getServerOrgTheme(orgslug)` directly (no pre-existing `generateMetadata`
  fetch to share memoization with here, so there's only one call site).

Both wrap their children in `<HydrationBoundary state={dehydratedState}>`
around `<OrgProvider>` — `OrgContext.tsx` itself is **unchanged**; it has no
idea whether its `useQuery` was served from a warm hydrated cache or a
fresh fetch, which is exactly the point (see "One resolution function"
below).

## One resolution function, three call sites

`resolveOrganizationTheme()` (from phase 2, `lib/theme/resolveOrganizationTheme.ts`)
was **not** duplicated into a server variant. It's a plain function with no
React hooks and no browser-only APIs — the only thing that differs between
"client" and "server" usage is *how the org object it's given was obtained*:

| Caller | How `org` is obtained |
|---|---|
| `useOrganizationTheme()` (client hook, phase 2) | `useOrg()` → React Query, hydrated or freshly fetched |
| `getServerOrgTheme()` (server, this phase) | `getServerOrg()` → direct `fetch()`, memoized per request |
| `tests/theme-resolve.test.mjs` (phase 2) | A plain object literal |

Same function, same tests, same guarantees, in all three places.

## FOUC verification

`e2e/ssr-branding.spec.ts` (Playwright) checks two things a curl-only test
can't fully cover:

1. The raw HTTP response body (via Playwright's `request` fixture — no
   browser, no JS) already contains `--brand-primary:<the org's real color>`.
2. A real browser's computed style on a branded element shows the same
   value immediately after `page.goto()` resolves, and again after
   `networkidle` (post-hydration) — proving the value never changes, i.e.
   no flash.

`e2e/network.spec.ts` separately confirms the browser makes **zero**
requests to `/orgs/slug/*` after the hydrated page loads — the thing the
whole hydration exercise was for.

## What this doesn't change

- `OrgContext.tsx`, `useOrg()`, `useOrgMembership()` — untouched. React
  Query is not replaced; it's given a warm start.
- The *data model* (`OrganizationConfig.customization.general`) — untouched,
  same as phase 2.
- Course editor, course player, analytics, assignments — none of these read
  org theme today and none were touched; they still fetch org data (if at
  all) exactly as before this phase.

## Known remaining gap

Course/activity/community pages elsewhere in `apps/web/app/orgs/[orgslug]/`
that need org data in their own `generateMetadata()` (there are dozens —
see phase 1's frontend-audit.md's §11 list) still call
`getOrganizationContextInfo` directly rather than the memoized
`getServerOrg()`. They were not migrated in this phase — doing so is
low-risk (swap one import) but wasn't necessary for the theme-flash problem
this phase set out to fix, and touching dozens of files for a `next` fetch
memoization win that doesn't affect branding was judged out of scope. Worth
a follow-up pass focused purely on request-count reduction, separate from
branding work.
