# Theme Engine

> **Phase 3 updates (2026-09-19):**
> - **SSR** — the theme now resolves server-side too, closing the "known
>   limitation" this doc used to end on. See `ssr-branding.md`.
> - **Secondary/accent colors** — `ThemeTokens` gained `brandSecondary`/
>   `brandAccent` as genuinely organization-configurable fields (they were
>   previously always Jelenius's own — see "What's dynamic vs. static"
>   below, updated) via two new endpoints,
>   `PUT /orgs/{id}/config/secondary_color` and `.../accent_color`, mirroring
>   the existing `color`/`font` ones exactly. `OrganizationConfig`'s JSON
>   blob gained two optional keys (`secondary_color`, `accent_color`) —
>   **no PostgreSQL migration**, since `customization.general` is already a
>   JSON column and both keys default to `""` (absent = old behavior).
> - **AdminLeftMenu** (superadmin topbar) now runs through
>   `useOrganizationTheme()` too, for consistency — it has no org context
>   (superadmin is cross-org), so it always resolves to the Jelenius
>   default, which is exactly correct for that screen.
> - **Playwright** (`jelenius-docs/visual-testing.md`) now verifies all of
>   the above in a real browser, not just via curl/unit tests.

> **Phase 3.1 updates (2026-09-19) — demo readiness:**
> - **Card system** — new design tokens `--radius-card` (24px) and
>   `--shadow-card` (`0 24px 70px rgba(11,25,48,.12)`, brand-navy-tinted per
>   `brand-reference.md`, not neutral gray) feed a new `Card` primitive
>   (`components/ui/card.tsx`, `default`/`interactive`/`muted` variants,
>   `cva`-based like the existing `Button`/`Alert`). Migrated onto it: all
>   six dashboard-home widgets, `CourseThumbnail` (catalog + dashboard course
>   cards), `TrailCourseCard` (student "My Courses"), and the catalog's empty
>   states. See "Card system" below.
> - **Button** gained a `brand` variant (`bg-brand text-brand-foreground`) —
>   opt-in, not the default, to avoid repainting every existing Button call
>   site app-wide. Used for the dashboard's primary "Create Course" action
>   and the catalog's sign-in CTA, replacing hardcoded `bg-gray-900
>   text-white`.
> - **Badge** gained `brand`/`success`/`warning`/`neutral` variants, used to
>   replace ad hoc pill `<span>`s (published/draft, unverified, plan tier,
>   course status) — see "Brand vs. semantic color" below for which is which.
> - New `EmptyState` primitive (`components/ui/empty-state.tsx`) —
>   icon/title/description/action — replacing five independent ad hoc empty
>   states in the dashboard and catalog.
> - **Dark mode** was independently verified this phase (forced `.dark`
>   class via Playwright — see the important caveat in "Dark mode" below:
>   there is still no user-facing toggle).
> - **Testing infrastructure fix**: `playwright.config.ts` was running
>   against `next start`, which Next.js explicitly does not support with
>   this project's `output: 'standalone'` config — it caused intermittent
>   "destination stream closed early" request failures that had gone
>   unnoticed in phase 3 (most requests happened to still succeed). Phase 3.1
>   switched it to `bun run start:standalone` (`node .next/standalone/server.js`,
>   the exact entry point `docker-entrypoint.sh`/`server-wrapper.js` run in
>   production), so this suite now tests the real deployed code path.

## Card system

```
--radius-card: 1.5rem;                              /* 24px */
--shadow-card: 0 24px 70px rgba(11, 25, 48, 0.12);   /* brand-navy tint */
```

Both are structural Jelenius design-system constants (like `--color-surface`),
not organization-configurable — same reasoning as the rest of "What's dynamic
vs. static" below. Tailwind v4 auto-generates `rounded-card`/`shadow-card`
utilities from these theme keys (confirmed in the built CSS output — see
`visual-testing.md`).

`Card` (`components/ui/card.tsx`) variants:
- `default` — `bg-surface` + `shadow-card` + a subtle `border-strong`
  outline. The base card everywhere.
- `interactive` — adds a hover lift (`-translate-y-0.5` + a stronger
  shadow), for cards that are also links (course cards, the
  content-overview tiles).
- `muted` — `bg-surface-muted`, no shadow — used for the catalog's
  dashed-border empty-state box.

`bg-surface` (not `bg-white`) is the actual fix that makes dark mode work for
cards at all — see "Dark mode" below.

## Brand vs. semantic color

A recurring mistake this phase's audit found in the pre-existing code: using
a fixed decorative color (teal, green) for something that was actually
either (a) the org's own brand accent, which must stay dynamic, or (b) a
true semantic state (success/warning/danger), which must NOT shift with an
org's brand color choice. Both now route through tokens instead of literal
Tailwind color utilities:

| Use | Token | Example |
|---|---|---|
| Org's own accent, non-critical UI highlight | `text-brand-accent` / `bg-brand-accent` | "Start Learning" link hover, in-progress course progress bar |
| Task genuinely succeeded | `bg-success` / `text-success` | Published course badge, 100% course completion, usage under 70% |
| Needs attention, not yet broken | `bg-warning` / `text-warning` | Unverified member badge, pending certificate, usage 70-90% |
| Failed / destructive | `bg-destructive` / `text-destructive` | Usage over 90%, "limit reached", "no credits remaining" |
| Non-semantic tier/category label | `bg-surface-muted` (Badge `neutral`) | Draft course, role badge, member count |

The one deliberately-untouched case: `UsageOverview`'s per-plan tier colors
(free/oss/standard/pro/enterprise) stay their existing hand-picked palette —
that's a business/billing distinction, not a brand-vs-semantic one, and
billing is out of this phase's scope.

## Dark mode

**There is no user-facing dark-mode toggle anywhere in this app.** The
`.dark { ... }` CSS custom properties in `globals.css` have existed since
earlier phases, but nothing in the client ever adds a `.dark` class to the
document, and `globals.css`'s own `@media (prefers-color-scheme: dark)`
block actively pins `body` to light colors regardless of OS preference —
so OS-level dark mode doesn't organically activate anything either.

Phase 3.1 verified the token wiring is at least *correct*, by forcing the
`.dark` class via Playwright (`e2e/dark-mode.spec.ts`) and confirming
`bg-surface`-based cards (this phase's Card primitive) pick up the dark
`--surface` value instead of staying hardcoded white, on login, dashboard,
and catalog. This proves "if a toggle is added later, the card system
already works," not "users can switch to dark mode today." Adding an actual
toggle is out of this phase's scope (see `demo-readiness.md`'s "next phase"
recommendations).

## What problem this solves

Before this phase, an organization's color/font lived in
`OrganizationConfig.customization.general` and every consumer
(`OrgMenu.tsx`, `(withmenu)/layout.tsx`, `AuthBrandingPanel.tsx`, …) read
that JSON path directly and computed its own inline style. That's still
exactly how the data is *stored* — this phase didn't touch the data model —
but there was no single place that turned "org config" into "the concrete
values a component should render," and no fallback story beyond whatever
each call site happened to hardcode (mostly `''`, which usually meant "no
color at all," not "the Jelenius color").

## Architecture

```
OrganizationConfig.customization.general (unchanged — LearnHouse's own model)
                    │
                    ▼
   resolveOrganizationTheme(org)      lib/theme/resolveOrganizationTheme.ts
                    │                 pure function, fully unit-tested
                    ▼
              ThemeTokens             lib/theme/tokens.ts
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
useOrganizationTheme()      themeTokensToCssVars()
(React hook, memoized)      (tokens → CSS custom properties)
        │
        ▼
  style={...} spread onto an existing wrapper element
  (AuthLayout's root div, (withmenu)'s root div — no new DOM node)
        │
        ▼
  --brand-primary / --brand-accent / --brand-secondary / --font-org-sans
  cascade through the DOM to every descendant
        │
        ▼
  Tailwind utilities: bg-brand, text-brand-foreground, bg-brand-accent, …
  (apps/web/styles/globals.css's @theme maps --color-brand: var(--brand-primary), etc.)
```

`useOrg()` was **not** removed or replaced — `resolveOrganizationTheme`
takes whatever `useOrg()` already returns as its only input. The theme
engine is a translation layer on top of the existing data flow, not a
competing one.

## Files

| File | Role |
|---|---|
| `apps/web/lib/theme/tokens.ts` | `ThemeTokens` type + the CSS variable name mapping |
| `apps/web/lib/theme/resolveOrganizationTheme.ts` | `resolveOrganizationTheme(org)`, `normalizeHexColor()`, `themeTokensToCssVars()` — pure, no React, fully unit-tested (`tests/theme-resolve.test.mjs`) |
| `apps/web/lib/theme/useOrganizationTheme.ts` | The React hook: `useOrg()` + resolver + memoization, returns `{ tokens, style }` |
| `apps/web/lib/brand.ts` | `JELENIUS_BRAND` — the platform default every field falls back to |
| `apps/web/styles/globals.css` | Where the CSS variables are declared (`:root`/`.dark` defaults) and mapped into Tailwind's `@theme` |

## What's dynamic vs. static

**Dynamic** (resolved per-organization, `ThemeTokens`):
- `brandPrimary` — org's `customization.general.color`, validated as a hex
  color, or `JELENIUS_BRAND.primaryColor`.
- `brandPrimaryForeground` — auto-computed black/white via the existing
  WCAG 2.1 luminance check in `services/utils/ts/colorUtils.ts`
  (`isLightColor`) — reused, not reimplemented. This is the "resolución
  automática de foreground apropiado" the phase asked for: pick any
  `brandPrimary` and body text on it stays legible.
- `fontSans` — org's `customization.general.font`, validated against the
  curated Google Fonts list (`lib/fonts.ts`), or `JELENIUS_BRAND.font`.
- `brandSecondary` — org's `customization.general.secondary_color` (phase 3),
  same hex validation as primary, or `JELENIUS_BRAND.secondaryColor`.
- `brandAccent` — org's `customization.general.accent_color` (phase 3), or
  `JELENIUS_BRAND.accentColor`.
- `brandSecondaryForeground`, `brandAccentForeground` — same auto-contrast
  treatment as `brandPrimaryForeground`, computed independently per field
  (an org can have a light secondary color and a dark accent color at the
  same time and both get correct, independent contrast).

All four color fields are optional and independent — a config with only
`color` set (everything predating phase 3) resolves exactly as it did
before; `secondary_color`/`accent_color` being absent is indistinguishable
from being explicitly empty, both fall back to the Jelenius default. See
`tests/theme-resolve.test.mjs`'s "backward compatibility" describe block.

**Static** (Jelenius design-system constants, not organization-configurable,
live directly in `globals.css`, no resolver involved): `--surface`,
`--surface-muted`, `--text-secondary`, `--border-strong`, `--success`,
`--warning`, `--radius-xl`, plus the pre-existing shadcn/ui token set
(`--background`, `--foreground`, `--border`, `--radius-sm/md/lg`, full
`.dark` support — unchanged, still works). The organization does not, and
should not, control these — per the phase's own principle: "el Design
System Jelenius define estructura y calidad. La organización controla
logo/nombre/primary color/font."

## Tailwind v4 integration

No `tailwind.config.js` was introduced — this project configures Tailwind
v4 entirely through `@theme` in `globals.css`, and the new tokens follow
that exact existing convention:

```css
@theme {
  --color-brand: var(--brand-primary);
  --color-brand-foreground: var(--brand-primary-foreground);
  --color-brand-secondary: var(--brand-secondary);
  --color-brand-accent: var(--brand-accent);
  --color-surface: hsl(var(--surface));
  --color-surface-muted: hsl(var(--surface-muted));
  --color-text-secondary: hsl(var(--text-secondary));
  --color-border-strong: hsl(var(--border-strong));
  --color-success: hsl(var(--success));
  --color-warning: hsl(var(--warning));
  --radius-xl: 1.25rem;
}
```

This makes `bg-brand`, `text-brand-foreground`, `bg-brand-accent`,
`text-text-secondary`, `bg-surface-muted`, `rounded-xl`, etc. available as
ordinary Tailwind utility classes anywhere in the app. Because `--brand-*`
are plain CSS custom properties (not Tailwind config values baked in at
build time), overriding them on any ancestor element at runtime — which is
exactly what `useOrganizationTheme()`'s `style` object does — changes what
every `bg-brand` etc. resolves to for that entire subtree, with zero extra
JS per component.

`--color-brand`/`--color-brand-*` are **not** wrapped in `hsl()` (unlike
the pre-existing `--color-primary` etc.) because `brand-primary` is a
complete hex color set directly by the resolver, not an HSL triplet.

## Where it's wired in (this phase's scope only)

Per the phase instructions ("empieza exclusivamente por Login, App Shell,
Sidebar, Header — deja el resto para fases posteriores"):

- `components/Auth/AuthLayout.tsx` — the login/signup/forgot/reset shell.
- `app/orgs/[orgslug]/(withmenu)/layout.tsx` — the student/instructor public
  shell (replaces its own ad hoc `primaryColor`/`customFont` reads).
- `components/Objects/Menus/OrgMenu.tsx` — the public header (nav background
  now always branded — Jelenius navy by default, never a neutral gray
  "LearnHouse" look).
- `components/Dashboard/Menus/DashLeftMenu.tsx` and `DashMobileMenu.tsx` —
  the instructor/admin sidebar's active-state indicator and highlight now
  use `bg-brand`/`var(--brand-primary)` instead of plain white, so the
  sidebar reads as the school's own even though its dark chrome (`#0f0f10`)
  stays a constant Jelenius structural choice.

Not touched (deliberately, per phase scope): the course editor, course
player, Tiptap editor, assignments, analytics, certificates. Those still
read org config the old way and will migrate in a future phase if/when
they're redesigned.

## Fallback behavior, concretely

| Org state | `brandPrimary` | `fontSans` |
|---|---|---|
| No org context at all (apex `/login`, `/admin`) | Jelenius navy `#0B1930` | Inter |
| Org exists, no `customization.general.color`/`font` set | Jelenius navy | Inter |
| Org set a valid hex color, no font | that color | Inter |
| Org set a font from the curated list, no color | Jelenius navy | that font |
| Org set an invalid/malformed color string | Jelenius navy (silently) | — |
| Org set a font not on the curated list | — | Inter (silently) |

Fallback is per-field, not all-or-nothing — see
`tests/theme-resolve.test.mjs` ("organization override" and
"invalid/missing values" describe blocks) for the exact cases this
guarantees.

## SSR vs. hydration — resolved in phase 3

This used to be documented here as a known limitation: `OrgContext`'s
`useOrg()` fetches client-side, so the raw SSR HTML fell back to the
Jelenius default and the real org's color/font only applied after
hydration. **Phase 3 closed this** — see `ssr-branding.md` for the full
architecture (`getServerOrg()` + `getServerOrgTheme()` +
`HydrationBoundary`). The short version: `app/orgs/[orgslug]/layout.tsx`
and `app/auth/layout.tsx` now resolve the org and its theme server-side and
hand React Query a pre-hydrated cache, so the value in the raw SSR HTML and
the value after hydration are the same value — verified in a real browser
by `e2e/ssr-branding.spec.ts`, not just asserted in a unit test.

No browser was available in this environment to visually confirm
post-hydration rendering — this was verified instead by (a) 36 passing unit
tests of the resolver itself, (b) confirming the correct CSS variable
(`--brand-primary`) and its correct default value appear in the raw SSR
HTML of `/login`, and (c) the existing white-label proof (organization
config → API response → `<title>`) still working end-to-end after these
changes. See the phase report's "VISUAL VERIFICATION" section for the full
disclosure.
