# White-Label Architecture

> **Phase 2 update (2026-09-19):** the ad hoc inline-style branding
> described below now goes through a proper resolver — see
> `theme-engine.md` for `resolveOrganizationTheme()`, the CSS-variable
> bridge into Tailwind's `@theme`, and where it's wired in (login, app
> shell, sidebar). This document's description of the *data model* (what
> LearnHouse already supports) is unchanged and still accurate; only the
> *consumption* side changed. Jelenius's default brand values were also
> corrected from an approximation to the exact hex values published at
> https://jelenius.com.mx/ — see `brand-reference.md`.

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

> **Phase 3:** the Theme sub-tab now also has **secondary color** and
> **accent color** pickers, right beside the existing primary color picker
> — same hex-input + swatch pattern, same `Input`/`Button` primitives, no
> new UI pattern introduced. A small live preview (a sample button using
> the accent color, a sample badge using the secondary color, both with
> auto-computed legible text) sits under the existing header vignette so an
> admin can see the effect of these two fields specifically, which the
> existing vignette doesn't cover. Backed by two new endpoints,
> `PUT /orgs/{id}/config/secondary_color` and `.../accent_color`, mirroring
> the existing `color`/`font` endpoints exactly (see `theme-engine.md`).

**Gaps in what already exists** (worth a future phase, not attempted here):
no dark-mode logo variant, no custom-CSS escape hatch (deliberately — see
"White-label without arbitrary CSS" below), font limited to a curated
Google Fonts list (`apps/web/lib/fonts.ts`, though phase 3 added
Merriweather as the list's first serif option).

> **Phase 3.1:** the branding *data model* and admin UI above are
> unchanged — this phase's work was entirely on the *consuming* side
> (dashboard cards, course catalog cards, buttons, badges now render through
> a shared token-based Card/Button/Badge system instead of hardcoded
> `bg-white`/`bg-gray-900`/one-off pill `<span>`s). See `theme-engine.md`'s
> "Card system" and "Brand vs. semantic color" sections. Re-verified with a
> real Colegio Demo pass on the dashboard and course catalog, not just
> login — same components, no branching, per the white-label proof pattern
> already established below.

## What Jelenius adds

### `JELENIUS_BRAND` — the platform default (`apps/web/lib/brand.ts`)

```ts
export const JELENIUS_BRAND = {
  name: 'Jelenius',
  primaryColor: '#0B1930',   // navy — exact value from jelenius.com.mx (see brand-reference.md)
  secondaryColor: '#172033', // ink
  accentColor: '#19B7A5',    // teal
  tertiaryColor: '#2F80ED',  // blue
  font: 'Inter',
  wordmark: '/jelenius/jelenius-wordmark.svg',
  icon: '/jelenius/jelenius-icon.svg',
  favicon: '/jelenius/jelenius-icon.svg',
} as const
```

Phase 1 shipped this with hand-picked approximate values
(`#0B1F3A`/`#14B8A6`); phase 2 replaced them with the exact hex codes and
the real logo mark extracted from https://jelenius.com.mx/'s own CSS and
SVG assets — see `brand-reference.md` for the extraction. Same asset paths,
corrected values and added the mark's actual paths (previously an
independently-drawn placeholder icon).

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

## Theme tokens (built in phase 2 — see `theme-engine.md`)

Phase 1 left this as deferred work: Tailwind v4's `@theme` carried only a
static shadcn/ui token set, and org color/font were applied via inline
styles computed ad hoc in each consuming component. Phase 2 built the
missing piece — `resolveOrganizationTheme()` turns org config into
`ThemeTokens`, exposed as CSS custom properties
(`--brand-primary`/`--brand-accent`/`--brand-secondary`/`--font-org-sans`)
that Tailwind's `@theme` maps into ordinary utility classes (`bg-brand`,
`text-brand-foreground`, `bg-brand-accent`). Full detail, including which
components were migrated to it (login, app shell, sidebar — per this
phase's explicit scope) and which weren't yet (course editor, player,
analytics), lives in `theme-engine.md`; this file's job is the branding
*data model*, not the token pipeline.

## Proof: same code, two identities

Verified live against the running dev instance (org id 1, slug `default`),
by rewriting only `organization.name` and
`organizationconfig.config.customization.general.{color,font}` — the exact
fields the existing Branding admin tab writes to — with **no code or
component changes**:

| | Jelenius (default) | Colegio Demo |
|---|---|---|
| Org name | Jelenius | Colegio Demo |
| Primary color | `#0B1930` (navy, exact brand-reference value) | `#7A1F2B` (maroon) |
| Font | Inter | Merriweather |
| Logo | Jelenius default icon (fallback) | Jelenius default icon (fallback — no logo uploaded, which is expected and allowed) |

Re-verified after the phase 2 theme engine changes: the same DB-level swap
still flips the `<title>` (`Home — Jelenius` ↔ `Home — Colegio Demo`) and
the API's `/orgs/slug/default` response, end to end, confirming the
org-config → resolver pipeline the new theme engine sits on top of is
intact. See `theme-engine.md`'s "Known limitation: SSR vs. hydration"
section for what could and couldn't be confirmed via `curl` alone (no
browser was available in this environment) regarding the *rendered* color
itself, as opposed to the name/title, which Next's server-side
`generateMetadata()` always reflects immediately.

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

## White-label without arbitrary CSS

Every color field (`color`, `secondary_color`, `accent_color`) is validated
server-side against a plain `#rrggbb`/`#rgb` hex pattern
(`normalize_brand_color` in `apps/api/src/services/email/branding.py`,
reused rather than reimplemented for the org endpoints — see
`theme-engine.md`) and client-side by the same rule
(`normalizeHexColor` in `resolveOrganizationTheme.ts`). Neither accepts
`url()`, `var()`, `calc()`, `javascript:`, or anything else that isn't a
bare hex triplet — an invalid value is rejected with `422` (write path) or
silently replaced with the Jelenius default (read/render path), never
passed through. There is no free-text CSS field anywhere in org branding,
by design: a school gets tokens (color/secondary/accent/font), not a
`<style>` tag. Custom CSS is real future-phase territory (per this phase's
own instructions), not something to sneak in via an unvalidated string
field.

## Deployment model this white-label design assumes

See `deployment-model.md`: one organization = one instance = one school.
This is **not** LearnHouse's Enterprise Multi-Org feature (many orgs in one
instance) — Jelenius does not unlock or reimplement that. A future,
separate Control Plane would manage many single-tenant instances, which is
a different architecture from either.
