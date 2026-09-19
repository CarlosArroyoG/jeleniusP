# White-Label Architecture

## Principle: reuse, don't rebuild

LearnHouse already ships a mature, per-organization branding system — data
model, upload endpoints, and a full admin editing UI. Jelenius's white-label
layer is a **thin adapter over that system plus a platform-level default**,
not a parallel `BrandConfig` model. This document records what already
existed, what was added, and where the real gaps are.

## What LearnHouse already supports (verified live against a running org)

`GET /api/v1/orgs/slug/{slug}` returns, among other things:

```json
"customization": {
  "general": {
    "color": "",
    "footer_text": "",
    "favicon_image": "",
    "square_logo_image": "",
    "watermark": true,
    "font": "",
    "default_language": "en",
    "email_sender_name": ""
  },
  "auth_branding": {
    "welcome_message": "",
    "background_type": "gradient",
    "background_image": "",
    "text_color": "light",
    "unsplash_photographer_name": "",
    "unsplash_photographer_url": "",
    "unsplash_photo_url": ""
  },
  "seo": {
    "default_meta_title_suffix": "",
    "default_meta_description": "",
    "default_og_image": "",
    "google_site_verification": "",
    "twitter_handle": "",
    "noindex_communities": false
  },
  "landing": {},
  "menu": { "items": [] },
  "signup_fields": { "fields": [] }
}
```

Plus, on the `Organization` row itself: `logo_image` (wide logo),
`thumbnail_image`, `previews`, `socials`, `links`.

Backing admin UI (already built, reused as-is):
`apps/web/components/Dashboard/Pages/Org/OrgEditBranding/` — Logos, Theme
(color + font), Auth branding (login background/message), Social, Previews
tabs, at **Dashboard → Organization → Appearance → Branding**.

**Gaps in what already exists** (worth a future phase, not attempted here):
no dark-mode logo variant, no secondary/accent color field beyond the single
`color`, no custom-CSS escape hatch, font limited to a curated Google Fonts
list (`apps/web/lib/fonts.ts`).

## What Jelenius adds

### `JELENIUS_BRAND` — the platform default (`apps/web/lib/brand.ts`)

```ts
export const JELENIUS_BRAND = {
  name: 'Jelenius',
  primaryColor: '#0B1F3A', // navy
  accentColor: '#14B8A6',  // teal
  font: 'Inter',
  wordmark: '/jelenius/jelenius-wordmark.svg',
  icon: '/jelenius/jelenius-icon.svg',
  favicon: '/jelenius/jelenius-icon.svg',
} as const
```

This is the **one place** the platform default lives. It is deliberately not
duplicated as inline literals anywhere else — every fallback point imports
from here.

### `BrandIcon` / `BrandWordmark` / `BrandName` (`apps/web/components/Brand/BrandMark.tsx`)

Thin components that render the Jelenius default asset. They are used
exclusively as the **fallback** argument wherever the existing
`OrgSquareLogo`/`getOrgWideLogoUrl` lookup finds no org-uploaded logo — they
never compete with or duplicate the org's own branding, they complete it.

Call sites: `AuthBrandingPanel`, `AuthMobileHeader`, `OrgMenu` (public
header), `DashLeftMenu`/`DashMobileMenu` (instructor sidebar),
`AdminLeftMenu` (superadmin topbar), `Watermark`, the org footer mark, the
platform 404 page, the shared transactional-email template.

### Root metadata default (`apps/web/app/layout.tsx`)

```ts
export const metadata: Metadata = {
  title: JELENIUS_BRAND.name,
  description: 'Jelenius — the learning platform for your school.',
  icons: { icon: JELENIUS_BRAND.favicon },
}
```

The root layout previously had no `metadata` export at all — every page
either inherited nothing or set its own. This is purely a **platform-level
fallback**; `app/orgs/[orgslug]/layout.tsx`'s existing `generateMetadata()`
(which reads the org's own favicon) still wins whenever an org context
exists, since Next.js merges metadata down the layout tree.

## Theme tokens — current state and what's deferred

Tailwind v4 in this codebase is configured via `@theme` in
`apps/web/styles/globals.css`, with a static shadcn/ui token set
(`--primary`, `--background`, etc.) that does **not** vary per org today.
Org color/font are applied via inline React styles, computed ad hoc in each
consuming component (`(withmenu)/layout.tsx`, `OrgMenu.tsx`).

This phase did **not** rewire that into a CSS-custom-property bridge (e.g.
setting `--brand-primary` at a root element and having Tailwind utilities
consume it) — that is real, valuable follow-up work, but it touches the
rendering of every branded surface at once and deserves its own review
rather than being folded into this pass. What this phase did instead:
introduced `JELENIUS_BRAND` as the single source of truth for the *default*
values, so that future token work has one place to read the default from
instead of scattered hex literals.

## Proof: same code, two identities

Verified live against the running dev instance (org id 1, slug `default`),
by rewriting only `organization.name` and
`organizationconfig.config.customization.general.{color,font}` — the exact
fields the existing Branding admin tab writes to — with **no code or
component changes**:

| | Jelenius (default) | Colegio Demo |
|---|---|---|
| Org name | Jelenius | Colegio Demo |
| Primary color | `#0B1F3A` (navy) | `#7A1F2B` (maroon) |
| Font | Inter | Merriweather |
| Logo | Jelenius default icon (fallback) | Jelenius default icon (fallback — no logo uploaded, which is expected and allowed) |

`curl http://localhost:3000/` before/after:

```
<title>Home — Jelenius</title>        →  <title>Home — Colegio Demo</title>
```

The org config write path is cached in Redis (`org_cache:config:{id}`,
`org_cache:slug:{slug}`) for performance — a write through the real
admin API invalidates its own cache; a direct SQL write (as used for this
test, since no browser/session was available in this environment) does not,
and needs an explicit `DEL` (or `FLUSHALL`, as already noted in
`DEMO_STACK.md`) to be reflected immediately. Not a Jelenius-specific issue —
this is existing LearnHouse cache behavior, just worth knowing when testing
branding changes by hand.

The instance was returned to Jelenius-default branding afterward, per the
requirement that Jelenius, not a demo school, is the resting default.

## Deployment model this white-label design assumes

See `deployment-model.md`: one organization = one instance = one school.
This is **not** LearnHouse's Enterprise Multi-Org feature (many orgs in one
instance) — Jelenius does not unlock or reimplement that. A future,
separate Control Plane would manage many single-tenant instances, which is
a different architecture from either.
