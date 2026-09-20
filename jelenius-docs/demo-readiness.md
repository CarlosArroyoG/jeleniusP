# Demo Readiness — Phase 3.1

One question this document answers: **can Jelenius be shown publicly without
having to explain that "the base interface still needs fixing"?** It
classifies every major surface as `READY`, `PARTIAL`, or `NOT READY` and
lists exactly what's still rough, so a demo doesn't get walked into a gap
nobody flagged.

This phase did not touch: Course Editor internals, Tiptap, Course Player,
Assignments, Certificates, Analytics, Discussions, billing, provisioning,
multi-org Enterprise, Zoom, the audio recorder, the custom video player,
anti-seek, AI features, or a mobile app — all explicitly out of scope (see
the phase instructions' "NO hacer todavía" list). Those are unaffected by
this phase in either direction: not improved, not regressed.

## Readiness by surface

| Surface | Status | Notes |
|---|---|---|
| Login | READY | SSR-branded (phase 3), white-labeled and verified on both Jelenius and Colegio Demo, no horizontal overflow at 1440×900 or 390×844. |
| Student dashboard (Trail / "My Courses") | READY | `TrailCourseCard` migrated to the Card system this phase; brand-accent progress bar, semantic success/warning states. |
| Course catalog | READY | `CourseThumbnail` migrated to the Card system; empty/no-results states unified via `EmptyState`. Catalog grid itself not screenshot-tested (real seeded course data, not stable content — see `visual-testing.md`), but responsiveness and overflow are. |
| Course player | PARTIAL | Explicitly not redesigned this phase (out of scope) — confirmed via smoke test that the route loads without a runtime crash and branding doesn't break it. Still looks like the pre-existing LearnHouse-era player visually. |
| Instructor dashboard | READY | All six dashboard-home widgets (QuickStats, ContentOverview, RecentCourses, RecentMembers, UsageOverview, the header actions row) migrated to Card/Button/Badge; primary action uses the org's brand color, not hardcoded black. |
| Course editor | PARTIAL | Explicitly not redesigned (out of scope) — confirmed the route loads without a crash via smoke test; a small watermark logo leak (LearnHouse icon) was fixed as a branding-only change, not a redesign. |
| Org settings / branding admin | READY | Unchanged data model and admin UI (phase 3 already migrated the Theme tab); this phase didn't touch it beyond the "Contact support" label fix. |
| Superadmin | PARTIAL | `AdminLeftMenu` uses the theme engine (phase 3); the "LearnHouse Admin" login heading/title was fixed in phase 3. Not otherwise re-audited this phase. |
| White-label (Jelenius vs. Colegio Demo) | READY | Re-verified this phase on dashboard and course catalog specifically (previously only proven on login) — same components, zero code branching, per `white-label.md`. |
| Mobile (390×844) | READY | Login, dashboard, and catalog checked for overflow/reflow at this viewport via Playwright. No mobile-specific visual snapshot for dashboard/catalog (see `visual-testing.md` — desktop-only was judged sufficient value for this phase). |
| Dark mode | NOT READY (no toggle exists) | See below — this is a genuinely different situation from "broken," worth reading carefully before assuming either. |

## Dark mode — read this before assuming anything

There is **no way for a real user to enable dark mode in this app today.**
The CSS custom properties for it exist (`.dark { ... }` in `globals.css`,
present since an earlier phase), but nothing in the client code ever adds a
`.dark` class to the document, and `globals.css`'s own `@media
(prefers-color-scheme: dark)` block actively pins `body` to light colors
regardless of the OS's own dark-mode setting. So it's not "dark mode is
broken" — it's "dark mode cannot be reached by anyone right now."

This phase verified, by forcing the `.dark` class via Playwright
(`e2e/dark-mode.spec.ts` — not a real user path, documented as such in the
test file itself), that **if** a toggle is added later, the new Card system
built this phase will render correctly (it uses `bg-surface`, which
correctly resolves to the dark token, instead of the old hardcoded
`bg-white`). That is the only claim being made here: the token plumbing is
sound, not that dark mode is a demoable feature.

**Recommendation:** don't demo a dark-mode toggle, because there isn't one.
If asked, the honest answer is "the design system supports it; the toggle
itself hasn't been built yet" — see "Next phase" below.

## Known issues (real, not glossed over)

- **LearnHouse branding leaks not fixed this phase** (evaluated and
  deliberately deferred, not missed):
  - `OnboardingBar.tsx`'s "Teach the world" onboarding step links to
    `https://university.learnhouse.io` with a "LearnHouse University" logo —
    a real, working external resource, but not a Jelenius one and not
    something to invent a replacement URL for. Left as-is per the phase's
    own instruction not to fabricate destinations; worth either hiding this
    onboarding step or building a real Jelenius equivalent in a future
    phase.
  - `OrgEditAI.tsx`'s AI settings tab image (`learnhouse_ai_simple_colored.png`)
    is a LearnHouse-branded asset — fixing just its alt text without
    replacing the actual icon graphic would be cosmetic, not a real fix, so
    it was left for a future phase with real design time.
  - `EERequiredScreen.tsx` / `EELicenseError.tsx` still say "LearnHouse
    Enterprise Edition" — this is arguably an accurate licensing term (the
    EE gate is a real upstream LearnHouse licensing concept Jelenius hasn't
    repurchased/rebranded), not a cosmetic leak, so it was deliberately not
    reworded without a clearer decision from whoever owns that
    relationship.
  - ~55 remaining `grep -rl "LearnHouse"` matches across `apps/web` are
    internal identifiers (`LearnHouseCourseImport`, `LearnHousePlayer`,
    `LearnHouseSpinner`, comments) with no user-visible text — correctly
    out of scope per this phase's own instruction not to do a mass rename
    of internal-only identifiers.
- **Testing infrastructure bug found and fixed**: `playwright.config.ts` was
  starting the server with `next start`, which Next.js does not support
  against this project's `output: 'standalone'` build — it caused
  intermittent request failures under load (`Error: The destination stream
  closed early`) that had gone unnoticed in phase 3. Fixed by switching to
  the real production entry point (`node .next/standalone/server.js`, via
  the new `start:standalone` script) — see `theme-engine.md` and
  `visual-testing.md`. This means phase 3's Playwright results were
  obtained against a subtly-wrong server; phase 3.1's are against the real
  one.
- **Dashboard/catalog card migration is desktop+mobile-overflow-tested, not
  pixel-snapshot-tested for the catalog grid**, because the dev database's
  seeded course content (thumbnails, authors, dates) is real data that
  varies independently of branding — a snapshot there would flag content
  drift, not a design regression. See `visual-testing.md`.
- **Analytics dashboard widgets** (`CourseWidgetCard` and the deeper
  `/dash/analytics` pages) were **not** migrated to the Card system this
  phase — only the dashboard *home* screen and the course catalog were, per
  the phase's own scope ("pantallas de dashboard más visibles"). They still
  use the pre-existing `bg-white rounded-xl nice-shadow` pattern, which is
  visually similar but not token-driven.
- **Pre-existing i18n hydration mismatch, found (not introduced) by this
  phase's new smoke tests**: on a non-English browser, the server renders
  the English i18n fallback while the client's language detector
  (`i18next-browser-languagedetector`) switches to the browser's real
  locale during hydration, producing a real text mismatch (React error
  #418). Reproduced identically on `/login` and `/home` — neither touched
  this phase — via a temporary dev-mode run that decoded the minified
  production error into its full message: server rendered "Welcome back" /
  "Your Organizations", client corrected to "Bienvenido de nuevo" / "Tus
  organizaciones". This is a real SSR/i18n architecture gap (no
  locale-detection cookie is set before the first server render), not
  something introduced by the Card/Button/Badge/branding work — fixing it
  properly means adding server-side locale resolution to the i18n setup,
  which is out of this phase's scope. `e2e/smoke.spec.ts` filters this
  specific, identified error signature so the suite still catches genuinely
  new crashes; it is not swept under the rug.

## Demo credentials procedure

Never commit a real password. The e2e suite and any manual demo walkthrough
use the dev instance's `admin@jelenius.dev` account; its password lives only
in `apps/web/.env.test.local` (gitignored) as `PLAYWRIGHT_ADMIN_PASSWORD`.
For an actual Coolify demo deployment, provision a separate demo-only
account with its own password set via that deployment's environment
variables — never reuse a local dev password in a shared/public
environment.

## Deployment expectations

The Coolify deployment target runs the same standalone Next.js server this
phase's Playwright suite now tests against (`server-wrapper.js` →
`.next/standalone/server.js` — see `Dockerfile`/`docker-entrypoint.sh`), not
`next dev` or `next start`. `NEXT_PUBLIC_*` environment variables are
injected at container start by `server-wrapper.js`, which also writes
`public/runtime-config.js` for client-side access — this was not exercised
by this phase's local Playwright runs (which invoke `server.js` directly,
skipping the wrapper), so a first real Coolify deploy should specifically
confirm `window.__RUNTIME_CONFIG__` populates correctly before treating this
report's "READY" statuses as fully proven in that environment.

## Features intentionally not redesigned yet

Course Editor (content authoring, Tiptap), Course Player, Assignments,
Certificates (beyond the org-name fallback fix), Analytics dashboards,
Discussions/Communities. These still function — confirmed via smoke
test — and still visually read as the pre-existing LearnHouse design
underneath Jelenius's color/logo/font layer. That gap is real and expected;
closing it is explicitly future-phase work, not something this phase's
"card system" language should be read as covering.
