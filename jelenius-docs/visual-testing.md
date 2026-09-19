# Visual / Browser Testing

Playwright, added this phase. Chromium only, per the phase instructions —
no Firefox/WebKit installed, and the mobile "device" is Chromium at a
mobile viewport (390×844) rather than a separate WebKit-based emulation, to
avoid installing a second browser engine for one viewport size.

## Setup

```bash
cd apps/web
bun add -D @playwright/test   # already done — see package.json
npx playwright install chromium
```

### If `playwright install` times out in your environment

This actually happened in the environment this phase was built in — the
Node-based downloader hit a 30s connection timeout against
`cdn.playwright.dev` even though the same URL downloaded in ~5s via `curl`.
If you hit the same thing:

```bash
# 1. Download the two Chromium builds curl can fetch fine (check the exact
#    URLs/revision in node_modules/playwright-core/browsers.json — the
#    revision number changes with the installed @playwright/test version):
curl -sL -o chrome.zip "https://cdn.playwright.dev/builds/cft/<version>/win64/chrome-win64.zip"
curl -sL -o chrome-headless-shell.zip "https://cdn.playwright.dev/builds/cft/<version>/win64/chrome-headless-shell-win64.zip"

# 2. Extract into Playwright's own cache location and mark them installed
#    (PowerShell shown; adjust for your OS's cache path):
Expand-Archive chrome.zip "$env:LOCALAPPDATA\ms-playwright\chromium-<revision>"
Expand-Archive chrome-headless-shell.zip "$env:LOCALAPPDATA\ms-playwright\chromium_headless_shell-<revision>"
New-Item -ItemType File "$env:LOCALAPPDATA\ms-playwright\chromium-<revision>\DEPENDENCIES_VALIDATED"
New-Item -ItemType File "$env:LOCALAPPDATA\ms-playwright\chromium-<revision>\INSTALLATION_COMPLETE"
# ...same two marker files under the chromium_headless_shell-<revision> folder
```

Re-run `npx playwright install chromium` afterward — it should report
success immediately once both revisions are in place.

### Admin credential fixture

The white-label and dashboard-authenticated specs need to log in for real.
Create `apps/web/.env.test.local` (gitignored, same convention as
`.env.local` — never commit it):

```
PLAYWRIGHT_ADMIN_PASSWORD=<this dev instance's admin@jelenius.dev password>
```

`e2e/fixtures/org-branding.ts` throws immediately with a clear message if
this is missing, rather than letting every test fail with an opaque 401.

### Prerequisites before running the suite

The backend stack (`npx learnhouse dev`, or however you start Postgres +
Redis + the API) must already be running and reachable at
`http://localhost:1338` — Playwright's `webServer` only manages the
Next.js production server, not the API/DB/Redis containers.

## Commands

```bash
bun run test:e2e                        # full suite, both projects
bun run test:e2e:update-snapshots       # (re)generate screenshot baselines
bun run test:visual                     # only specs tagged @visual (currently none use the tag explicitly — see note below)
npx playwright test --project=chromium-desktop   # one viewport only
npx playwright show-report                        # open the last HTML report
```

`playwright.config.ts` starts a **production build**
(`bun run build && bun run start -p 3010`), not `next dev` — dev-mode
Turbopack cold-compile times are not representative of what a visual
regression baseline should be judged against (see
`performance-baseline.md`'s own warning about the same confusion).
`reuseExistingServer: !process.env.CI` means a server left running from a
previous local run is reused rather than rebuilt — kill it (or run with
`CI=true`) if you need a fresh build after a code change.

Serial, not parallel (`fullyParallel: false, workers: 1`): every spec
shares the same single organization (id 1) in this single-tenant dev
backend, and the white-label spec temporarily rewrites its branding to
"Colegio Demo" and back. Running specs concurrently would race that
mutation against any other spec assuming Jelenius-default branding. A real
multi-org test backend would remove this constraint; not worth building
for a suite this size.

## What's covered

| File | What it checks |
|---|---|
| `e2e/ssr-branding.spec.ts` | The org's brand color is in the raw SSR HTML (no JS), and stays the same value before/after hydration in a real browser — see `ssr-branding.md`. |
| `e2e/network.spec.ts` | Loading `/` or `/login` makes zero client-side requests to `/orgs/slug/*` — the hydrated data is used as-is. |
| `e2e/login.spec.ts` | Logo, org name, inputs, submit button visible; visible focus state; no horizontal overflow; primary button isn't the old hardcoded black. Runs on both `chromium-desktop` (1440×900) and `chromium-mobile` (390×844) automatically — one spec, two projects. |
| `e2e/white-label.spec.ts` | Jelenius baseline + a Colegio Demo fixture (see below) rendering *different* branding through the *same* components, with before/after screenshots. |
| `e2e/accessibility.spec.ts` | Keyboard reachability, labeled form fields, accessible names on the sidebar's nav controls (desktop links, mobile icon buttons) — a regression check, not a WCAG audit (explicitly out of this phase's scope). |

## The Colegio Demo fixture

`e2e/fixtures/org-branding.ts`'s `withOrgBranding()` sets the org's
name/color/secondary/accent/font via the **real** admin API (the same
`PUT /orgs/{id}/config/{field}` endpoints `ThemeTab.tsx` calls — not a DB
shortcut), runs the test, then restores whatever branding was there before
— even if the test throws. Values used, exactly as named in this phase's
own instructions:

```
name:            Colegio Demo
color:           #7A1F35
secondary_color: #32121A
accent_color:    #D6AA52
font:             Merriweather
```

`Merriweather` was not previously on the curated Google Fonts list
(`lib/fonts.ts`) — it's the list's first and only serif, added specifically
so this fixture (and any real institution that wants a more traditional
look) has somewhere to land other than the existing all-sans-serif set.

The write path invalidates the backend's Redis org-config cache itself;
`withOrgBranding()` polls the read-back value (up to 5s) rather than a
fixed sleep before proceeding, since a fixed short delay produced
intermittent failures when the full 44-test suite ran back-to-back (a
later spec's `goto()` could occasionally race a still-propagating write
from an earlier spec's fixture) — polling is what actually eliminated that
flakiness, not just a longer sleep.

## Screenshots

Baselines live in `e2e/*.spec.ts-snapshots/`, one file per (spec, project)
combination — `jelenius-login-chromium-desktop-win32.png`,
`colegio-demo-dashboard-sidebar-chromium-mobile-win32.png`, etc. Generated
with `--update-snapshots`; a plain `test:e2e` run compares against them.

Two deliberate choices to keep these stable:

- **Sidebar-only, not full-page, for the dashboard.** The dashboard body
  has variable data (course counts, "recent" lists, timestamps) that would
  make a full-page snapshot flaky for reasons that have nothing to do with
  branding. The sidebar is static chrome — its color/active-state accent is
  exactly what this phase's white-label work touches, and nothing in it
  varies run to run.
- **Full-page for login**, since that page has no comparably variable
  content.

No regions are masked/ignored to force a pass — if a login screenshot ever
becomes flaky, the right fix is finding what's actually non-deterministic
on that page, not hiding it from the diff.

`playwright-report/` and `test-results/` are build output — gitignored
(added to `apps/web/.gitignore` this phase), never committed. The
`e2e/*.spec.ts-snapshots/` baseline PNGs **are** committed — they're the
whole point of a visual regression suite.

## Network/perf instrumentation

`e2e/network.spec.ts` is also how "no duplicate organization fetch" is
verified end-to-end (see `ssr-branding.md`) — Playwright's `page.on('request', …)`
observes exactly what the phase's own §40 asked for: organization requests
per initial load, from a real browser, not a guess from reading the code.
