# Authenticated branding — one school identity, everywhere

> Goal: a school configures its identity **once** (logo, name, primary,
> secondary, accent, font) and the whole LMS — public site, login, header,
> desktop sidebar, mobile navigation, active/hover states, primary CTAs —
> adopts it. No JSX, CSS or frontend rebuild per customer.

## The pipeline

```
OrganizationConfig (customization.general: color, secondary_color, accent_color, font, logo…)
        ↓  resolveOrganizationTheme()            lib/theme/resolveOrganizationTheme.ts
BrandTokens   primary/secondary/accent + a foreground each (real WCAG contrast)
        ↓  deriveNavigationTokens()              lib/theme/navigationTokens.ts
ApplicationThemeTokens   header / sidebar / active / hover / border / mobile nav
        ↓  themeTokensToCssVars()                 --brand-* and --app-* custom properties
SSR wrapper element (org layout + auth layout)   in the very first HTML
        ↓  @theme inline                          styles/globals.css
Tailwind utilities   bg-brand, bg-app-header, bg-app-sidebar, bg-app-nav-active …
        ↓
Header, OrgPublicHeader, DashLeftMenu, DashMobileMenu, admin top bar, CTAs
```

The single source of truth is `OrganizationConfig` + `resolveOrganizationTheme()`.
There is no per-school file, class, component or `if (orgslug === …)` anywhere.

## 1. Brand tokens

| Variable | From | Foreground variable |
|---|---|---|
| `--brand-primary` | `general.color` | `--brand-primary-foreground` |
| `--brand-secondary` | `general.secondary_color` | `--brand-secondary-foreground` |
| `--brand-accent` | `general.accent_color` | `--brand-accent-foreground` |
| `--font-org-sans` | `general.font` (curated list) | — |

Each field falls back to the Jelenius default **independently** (a school with a
valid primary but no accent keeps its primary and gets the Jelenius accent).

### Foreground = the higher real contrast

`pickForeground()` (`lib/theme/color.ts`) picks whichever of white / Jelenius ink has
the higher WCAG contrast — not a luminance threshold — and only falls back to pure black
on mid-tones where neither reaches AA. Examples:

| Surface | Foreground | Why |
|---|---|---|
| `#F4D000` (yellow) | dark ink | white would be ~1.5:1 |
| `#172033` (ink) | white | |
| `#19B7A5` (Jelenius teal) | dark ink | white is ~2.6:1 (the old cut-off chose white) |
| `#808080` (mid gray) | black | ink 4.4:1 and white 4.0:1 both miss AA; black clears it |

A unit test sweeps 216 colors and asserts every foreground is ≥ 4.5:1.

## 2. Semantic navigation tokens

Components never decide "header = primary, sidebar = secondary". That policy lives in
one function, `deriveNavigationTokens()`:

| Token (CSS variable) | Tailwind utility | Default ("branded") value |
|---|---|---|
| `--app-header-bg` / `--app-header-fg` | `bg-app-header` / `text-app-header-foreground` | primary / primary fg |
| `--app-header-fg-muted` | `text-app-header-muted` | fg mixed toward bg, kept ≥ 4.5:1 |
| `--app-header-hover-bg` | `hover:bg-app-header-hover` | bg tinted toward fg (14 %) |
| `--app-header-border` | `border-app-header-border` | bg tinted toward fg (18 %) |
| `--app-sidebar-bg` / `--app-sidebar-fg` | `bg-app-sidebar` / `text-app-sidebar-foreground` | secondary / secondary fg |
| `--app-sidebar-fg-muted` | `text-app-sidebar-muted` | as header muted |
| `--app-nav-border` | `border-app-nav-border` | sidebar bg tinted toward fg (14 %) |
| `--app-nav-hover-bg` / `--app-nav-hover-fg` | `hover:bg-app-nav-hover` / `hover:text-app-nav-hover-foreground` | sidebar bg tinted toward fg (10 %) / sidebar fg |
| `--app-nav-active-bg` / `--app-nav-active-fg` | `bg-app-nav-active` / `text-app-nav-active-foreground` | accent / accent fg |
| `--app-mobile-nav-bg` / `--app-mobile-nav-fg` | `bg-app-mobile-nav` / `text-app-mobile-nav-foreground` | = sidebar |

Rules that keep it safe on any school color:

- **Derived, never assumed.** Hover / border / muted are mixes of the surface with *its own
  foreground* — so on a light sidebar (dark foreground) hover gets darker, on a dark one
  lighter. There is no `white/10` overlay assumption. Tints back off (`tintKeepingContrast`)
  if they would cost the text its 4.5:1.
- **Active must be visible.** If the accent is too close to the sidebar color (contrast < 1.5)
  the active state falls back to a visible tint of the sidebar's own foreground.
- **Not color alone.** The active item also has a filled row, an indicator bar and
  `aria-current="page"`; the public header adds an underline marker and heavier weight.
- **Mobile shares the sidebar source.** No second palette to drift.
- The header CTA (Sign up) is the **accent**: a primary-colored button would vanish on a
  primary header.

Content surfaces are **not** branded: pages, cards, forms and dropdowns keep
`background / surface / surface-muted / border / foreground / text-secondary`, which respond to
light/dark mode. Brand shows in navigation, active states, primary CTAs and small highlights.
Semantic colors (`success`, `warning`, `destructive`/red for sign-out) are never replaced by
brand colors, and the sidebar's plan chip is a neutral, foreground-derived chip.

### Where the CSS defaults live

`styles/globals.css` `:root` carries the Jelenius values (used with no org context, e.g.
`/admin`, and before hydration). `tests/theme-navigation.test.mjs` fails if they drift from
`deriveNavigationTokens(Jelenius)`.

## 3. Tailwind runtime integration

See `theme-engine.md` → "Why `@theme inline`". In short: runtime tokens (`--color-brand*`,
`--color-app-*`) live in an `@theme inline { … }` block so the utilities emit
`var(--brand-primary)` directly and follow the nearest wrapper's override. Static design
tokens (surface, border, radius, shadow…) stay in the plain `@theme` block. Opacity modifiers
(`bg-brand/20`) work with the runtime variables. A unit test compiles the real stylesheet and
asserts the generated rules.

## 4. SSR, portals and no flash

- `getServerOrgTheme()` → `themeTokensToCssVars()` → inline `style` on the wrapper in
  `app/orgs/[orgslug]/layout.tsx` **and** `app/auth/layout.tsx`. The raw server HTML already
  contains `--brand-*` and `--app-*` for the school (Playwright asserts it on `/` and `/login`
  with no JavaScript involved). There is no default-then-hydrate flash.
- UI that React portals to `<body>` (mobile navigation, flyout menus, dialogs) sits outside
  the wrapper. `OrgThemeRootSync` mirrors the same variables onto `<html>` after hydration;
  those surfaces only mount after hydration, so nothing visible depends on it. (A server-rendered
  `<style>:root{…}</style>` was tried first — React does not emit a bare `<style>` from a nested
  server layout.)
- Dark mode: brand/navigation tokens are the school's identity and stay constant across
  modes; surface/background/text/border switch as before.

## 5. Surfaces migrated

| Surface | Component | Tokens |
|---|---|---|
| Authenticated header | `OrgMenu` + `OrgHeaderLogo`, `OrgMenuLinks`, `HeaderProfileBox`, `SearchBar`, `LanguageSwitcher` (via `getMenuColorClasses`) | `--app-header-*`, CTA = accent |
| Public header | `OrgPublicHeader` | same header tokens |
| Desktop sidebar | `DashLeftMenu`, `CommandPaletteTrigger`, `OnboardingSidebarBox`, `ui/hover-menu` flyouts | `--app-sidebar-*`, `--app-nav-*` |
| Mobile navigation | `DashMobileMenu` (pill + panel) | `--app-mobile-nav-*`, `--app-nav-*` |
| Superadmin top bar | `AdminTopMenu` (`AdminLeftMenu.tsx`) | header tokens; uses the org theme when an `OrgProvider` exists, the Jelenius default otherwise |
| Auth screens | `AuthBrandingPanel`, `AuthMobileHeader` default gradient | `--brand-secondary` → `--brand-primary` |
| Primary CTAs | `Button variant="brand"`, hero, cards, "Login"/"Sign up" links | `bg-brand text-brand-foreground` (now runtime) |

### Hardcoded-color audit (navigation / shell)

Classified, not blindly replaced:

- **Branding hardcodes → fixed:** `#0f0f10`/`#111113`/`#0e0e10`/`#1a1a1b` sidebar and flyout surfaces,
  `bg-black` admin bar, `white/NN` hover/border overlays, `bg-[var(--brand-primary)]/N` active
  fills, `JELENIUS_BRAND.*` gradients in the auth panel, onboarding progress, and sidebar promo art.
- **Semantic → kept:** `text-red-*` sign-out, `text-green-*` check marks, `text-amber-*`
  "Superadmin" badge, role badges (`purple`/`blue`/`green`) in the profile box, Copilot violet.
- **Legitimate neutrals → kept:** modal/mobile scrims (`bg-black/50`), skeleton pulses, code panels
  in the admin developer playground, the white plate behind an org logo, the SearchBar's white
  result popover, the shimmer on the promo button.

## 6. Admin

`AdminTopMenu` (`components/Admin/AdminLeftMenu.tsx`) is cross-org. It goes through
`useOrganizationTheme()`: with an organization in context it wears that school's header tokens;
with none (`/admin` superadmin) it resolves the Jelenius fallback — it never invents an org.

## 7. Accessibility

Foreground pairs are unit-tested ≥ 4.5:1 across 1 000 palette combinations (header, muted header,
sidebar, muted sidebar, hover, active, mobile nav). `focus-visible` rings, `aria-current`,
keyboard navigation and labelled controls are unchanged. Hover/active never rely on color alone.

## HOW TO ADD A NEW SCHOOL BRAND

1. Upload the logo (Dashboard → Organization → Branding).
2. Upload the favicon.
3. Set the **primary** color.
4. Set the **secondary** color.
5. Set the **accent** color.
6. Select the **font** (curated Google Fonts list).
7. **Save.**

That is all. There is no step 8: no React component, no CSS file, no per-customer frontend
build. Save writes `OrganizationConfig`; the resolver turns it into tokens on the next request.

Proof: `e2e/authenticated-branding.spec.ts` runs the same build against Jelenius, Colegio Demo,
a config-only Fundación Don Bosco fixture and a hypothetical **Universidad Roja**
(`#A32035` / `#541622` / `#E7B84B`, Merriweather) and asserts, from computed styles, a red header,
dark-red sidebar, gold active state, correct foregrounds, matching CTA and mobile nav.

## Known limitations / future extensions

- **`navigation_style: 'branded' | 'light'`** (light header/sidebar surfaces with brand only in
  active states, icons and borders) is **not implemented**: it needs a new `OrganizationConfig`
  field (API validation, migration of stored configs) and an admin control. The derivation is
  isolated in `deriveNavigationTokens()`, which is the one place it would branch.
- The Tailwind static `--color-accent` / `--color-secondary` (shadcn neutrals) are unrelated to
  `brand-accent` / `brand-secondary`; the two vocabularies coexist by design.
- Radix dropdown item highlights (`focus:bg-accent`) are neutral surfaces, not brand.
- A logo that is white-on-transparent (like Don Bosco's) only works on a dark header — a school
  with such a logo and a light primary would need a different logo file.
- Decorative promo art (free-plan upsell box) uses the accent/foreground tokens but was designed for
  dark sidebars; it is only shown on the multi-org SaaS free plan.
- The public landing hero still inlines `color-mix(… var(--brand-primary) …)` for its soft tint
  (`lib/publicHero.ts`) — a CSS gradient expression that cannot be a utility class, and it *reads*
  the runtime variable, so it is not the old workaround.
