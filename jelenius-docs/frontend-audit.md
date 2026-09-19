# Frontend Audit — apps/web (LearnHouse → Jelenius)

Snapshot taken on `jelenius-dev` at the point it branched from `upstream/dev`
(commit `0ec01f2`). Paths are relative to the repo root.

## 1. Top-level structure

| Directory | Contents |
|---|---|
| `apps/web/app/` | Next.js App Router routes: `(hub)/` (account/billing/org-picker), `admin/` (superadmin panel), `api/` (route handlers — auth proxy, sitemap, robots, SCORM proxy), `auth/` (login/signup/reset/verify), `board/`, `editor/` (course & playground editors), `embed/`, `home/` (marketing apex page), `orgs/[orgslug]/` (all per-org student/instructor/settings routes), `payments/`. |
| `apps/web/components/` | React components by domain: `Admin/`, `Auth/`, `Dashboard/`, `Objects/` (Editor, Activities, Menus, Org, Media, Modals…), `Contexts/`, `Emails/`, `Footer*/`, `Brand/` (new, this phase). |
| `apps/web/lib/` | Framework-agnostic helpers: `fonts.ts`, `seo/`, `auth/`, `query/`, `i18n.ts`, `direction.ts`, `constants.ts`, `eeGate.ts`, `brand.ts` (new). |
| `apps/web/services/` | API-calling functions by domain (`org/`, `settings/`, `media/`, `auth/`, `courses/`, `billing/`, `emails/`, `config/`). |
| `apps/web/public/` | Static assets, including the LearnHouse logo/icon files and the new `jelenius/` brand assets. |
| `apps/web/styles/globals.css` | Tailwind v4 entry point (configured via `@theme`, no `tailwind.config.js`), the shadcn/ui token set, RTL rules. |
| `apps/web/ee/` | Enterprise-Edition-gated code, mirrored under `lib/eeGate.ts`. |
| `apps/web/locales/` | 22 react-i18next translation files. |

## 2. Layouts & navigation

- Root layout: `app/layout.tsx` — global fonts, `Providers`. Now carries a
  platform-level `metadata` export (title/description/favicon default to
  Jelenius) — it had none before this phase.
- Org-scoped layout: `app/orgs/[orgslug]/layout.tsx` — `generateMetadata()`
  sets the org favicon; wraps children in `OrgProvider`.
- Public shell (header + footer): `app/orgs/[orgslug]/(withmenu)/layout.tsx` —
  reads `primaryColor`/`customFont` from org config and applies them via
  inline styles; renders `OrgMenu` and `OrgFooter`.
- Header: `components/Objects/Menus/OrgMenu.tsx`.
- Instructor/admin sidebar: `components/Dashboard/Menus/DashLeftMenu.tsx`
  (desktop), `DashMobileMenu.tsx` (mobile).
- Superadmin topbar: `components/Admin/AdminLeftMenu.tsx`.
- Auth screen shell: `app/auth/layout.tsx` + `components/Auth/AuthLayout.tsx`,
  `AuthBrandingPanel.tsx` (desktop illustration pane), `AuthMobileHeader.tsx`.

## 3. Auth screens

Login (`app/auth/login/`), signup (`app/auth/signup/`, with
`OpenSignup.tsx`/`InviteOnlySignUp.tsx` variants), forgot/reset password,
email verification, magic link, SSO/Google callback, and a separate
superadmin login at `app/admin/login/`.

## 4. Student-facing

Org home (`(withmenu)/page.tsx`), course catalog, course landing page, course
player/activity viewer, plus library, podcasts, communities, boards,
playgrounds, store, progress trail, certificates, search, account.

## 5. Instructor-facing

Instructor dashboard home, course management list, course structure editor
(`dash/courses/course/[courseuuid]/[subpage]`), the Tiptap-based activity
content editor (`app/editor/course/[courseid]/activity/[activityuuid]/edit`),
playground editor, plus analytics, assignments, boards, communities, library,
users, payments, podcasts, developers (API keys/webhooks/SSO/domains/SEO),
onboarding.

## 6. Admin

- Superadmin panel (platform operator, cross-org): `app/admin/(dashboard)/`.
  Read-only org inspector; no branding-editing UI here (by design — that
  lives at the org level, see below).
- **Per-organization Appearance/Branding admin UI already exists and is
  fully built**, at `app/orgs/[orgslug]/dash/org/settings/[subpage]/page.tsx`
  (tabs: `general`, `branding`, `menu`, `landing`, `ai`, `usage`, `other`,
  `danger`). The branding tab
  (`components/Dashboard/Pages/Org/OrgEditBranding/`) has five sub-tabs:
  `LogosTab`, `ThemeTab` (primary color + font), `AuthBrandingTab` (login
  background/welcome message), `SocialTab`, `PreviewsTab`. **This phase did
  not build a new branding UI — it already existed and is reused as-is.**

## 7. Theme / branding mechanism already in LearnHouse

### Data model (`apps/api`)

- `apps/api/src/db/organizations.py` — `Organization`: `logo_image`,
  `thumbnail_image`, `previews`, `socials`, `links`, `label`, `slug`, `email`.
- `apps/api/src/db/organization_config.py` — the JSON `OrganizationConfig.config`
  field, current (v2) shape under `customization`:
  - `general`: `color`, `footer_text`, `favicon_image`, `square_logo_image`
    (falls back to `logo_image`), `watermark` (bool), `font` (Google Font
    name), `default_language`, `email_sender_name`.
  - `auth_branding`: `welcome_message`, `background_type`
    (`gradient|custom|unsplash`), `background_image`, `text_color`.
  - `seo`: `default_meta_title_suffix`, `default_meta_description`,
    `default_og_image`, `google_site_verification`, `twitter_handle`,
    `noindex_communities`.
  - `menu`, `signup_fields`, `landing`.

  No dedicated dark-mode logo variant or secondary/accent color field exists
  beyond the single `color` — a real gap if a fuller token system is wanted
  later (see `white-label.md`).

### How apps/web reads it

There is no single `ThemeProvider`/`useOrgBranding()` hook — every consumer
reads `org?.config?.config?.customization?.general?.X` directly (with a
v1-shape fallback) via `useOrg()` (`components/Contexts/OrgContext.tsx`), then
applies it with **inline React styles**, component by component:
`(withmenu)/layout.tsx` (background tint, font), `OrgMenu.tsx` (nav
background + contrast-aware text via
`services/utils/ts/colorUtils.ts`), `OrgSquareLogo.tsx` (logo fallback
chain: square → wide → caller-supplied fallback).

Tailwind v4 is configured purely in `styles/globals.css` via `@theme`
(no `tailwind.config.js`). The shadcn/ui design tokens there (`--primary`,
`--background`, etc.) are **static** — not wired to per-org config. Org
color/font stay a parallel, inline-style-only system. Unifying the two is
flagged as follow-up work in `white-label.md`.

## 8. Hardcoded "LearnHouse" branding found and fixed this phase

- Fallback logo/icon assets: `public/lrn-text.svg`, `public/lrn-dash.svg`,
  `public/lrn.svg`, `public/learnhouse_bigicon_1.png`, `public/black_logo.png`
  — replaced with `public/jelenius/jelenius-{icon,wordmark}.svg` behind a new
  `components/Brand/BrandMark.tsx` (`BrandIcon`, `BrandWordmark`, `BrandName`)
  and `lib/brand.ts` (`JELENIUS_BRAND` constant).
- Hardcoded outbound links to `learnhouse.app`, `docs.learnhouse.app`,
  `discord.gg/learnhouse` in the public header help menu (`OrgMenu.tsx`) and
  the instructor sidebar help menu (`DashLeftMenu.tsx`, `DashMobileMenu.tsx`)
  — **removed** rather than repointed, since Jelenius has no equivalent
  community/docs site to send customers to yet (fabricating one would be
  worse than not linking).
- "Powered by LearnHouse" watermark (`components/Objects/Watermark.tsx`),
  org footer mark (`(withmenu)/layout.tsx`'s `OrgFooter`) — now Jelenius
  asset/copy; the outbound link to `learnhouse.app` was dropped (no real
  Jelenius marketing site to link to yet) rather than left pointing at
  LearnHouse's site.
- "Welcome back to LearnHouse.", org-name fallback `'LearnHouse'` in
  `AuthBrandingPanel.tsx` / `AuthMobileHeader.tsx` — now
  `JELENIUS_BRAND.name`.
- `© {{year}} LearnHouse, Inc.` / "By continuing, you agree to LearnHouse's…"
  in `components/Footers/LegalFooters.tsx` — now Jelenius, and the
  Terms/Privacy links (which previously fell back to `learnhouse.io/terms`)
  now render as **plain text, not a link,** when no platform URL is
  configured, instead of silently pointing at LearnHouse's legal pages.
- All 22 `apps/web/locales/*.json` files: every visible occurrence of
  "LearnHouse" replaced with "Jelenius" (title, watermark label, feedback
  copy, onboarding strings, org-explore-page copy). Left untouched:
  lowercase `learnhouse.io` references describing the actual SaaS
  central-session-sharing domain (a real, still-accurate technical
  behavior description, not branding copy).
- `apps/web/components/Emails/LearnHouseEmail.tsx` (shared platform
  transactional-email template) — the hardcoded `learnhouse.io` logo URL,
  alt text, and footer line updated to Jelenius; component/file name kept
  (technical identifier, not user-visible).
- `apps/web/app/not-found.tsx` — swapped the platform-level 404 page's logo.

## 9. Deliberately NOT changed / deferred

- `apps/web/components/Objects/Modals/Course/Import/LearnHouseCourseImport.tsx`
  and its `LearnHouse course export (.zip)` copy — the LearnHouse course
  interchange **format** name, not org branding. Left as-is; revisit if/when
  Jelenius defines its own export format.
- `apps/api/src/services/email/nudge_translations/*.py` (20 languages) and
  the org-less/SaaS-signup email path's `ACADEMY_URL`/inline `LOGO_SVG` in
  `apps/api/src/services/users/emails.py` — this path only fires for
  org-less signups, which don't occur under Jelenius's single-tenant
  deployment model (see `deployment-model.md`). The always-exercised
  "Powered by LearnHouse" line **was** fixed (see `white-label.md`); the
  org-less academy CTA was not. Flagged for a follow-up pass, not attempted
  here to avoid a large, low-value change under time pressure.
- Component/file/identifier names such as `LearnHouseLogo` (removed),
  `LearnHousePlayer.tsx`, `LearnHouseSpinner.tsx`, the `learnhouse` npm
  package name, `LEARNHOUSE_*` env vars, Docker service names
  (`learnhouse-db-dev`, etc.) — technical identifiers, per the instruction
  to distinguish visible branding from upstream technical identifiers and
  keep the upstream-sync delta small.

## 10. Relevant unmerged upstream branches (flagged, not diffed)

`upstream/feat/branding-redesign-square-logo` and
`upstream/feat/email-whitelabel` exist on the upstream remote. Diff these
before doing further branding work in that area, to avoid duplicating what
LearnHouse's own team may already be building.
