# Performance Baseline — Phase 1

Measured on the actual development machine (Windows 11, ~15.8 GB RAM, no
WSL2 distro), against the local Postgres/Redis containers and the API/Web/
Collab dev stack started via `npx learnhouse dev`. Single-sample `curl -w`
timings from the same machine the server runs on (no network hop) — these
are directional, not a rigorous benchmark. The point is to have *a* number
before further work, not a statistically clean one.

## Method

- **Dev mode**: `next dev --turbopack`, as started by the CLI.
- **Production**: `bun run next build && bun run next start -p 3001`, run
  against the same running API/Postgres/Redis, so only the Next.js runtime
  differs.
- Timed with `curl -s -o /dev/null -w "%{time_total}"` — server-side
  render + TTFB, not full browser paint/hydration (no browser was available
  in this environment; see Blockers in the phase report).

## Results

| Route | Dev — cold (first compile) | Dev — warm | Production — cold (server just started) | Production — first hit per route |
|---|---|---|---|---|
| `/` (org home) | 2.3s (25.8s on the very first request after `next dev` boot, before Turbopack has compiled anything) | ~0.10–0.30s | 2.06s | 0.04–0.07s |
| `/login` | 4.3s | ~0.12s | — | 0.35s |
| `/courses` | 2.4s | ~0.13s | — | 0.58s |
| `/dash` | 1.8s | ~0.12s | — | 0.53s |

## Reading these numbers

- The 25.8s figure for the very first `/` request is **Turbopack compiling
  that route on demand**, not representative of anything a user experiences
  after the first developer request of the day — don't confuse it with
  production performance, which is the mistake this doc exists to prevent
  (see phase instructions §29).
- Warm dev-mode navigation (~100–300ms) is already fast; this is Turbopack's
  HMR-hot state, not a proxy for cold production load.
- Production's per-route first-hit numbers (0.35–0.58s) being higher than
  its own steady-state `/` (0.04–0.07s) is most likely route-chunk
  lazy-loading on first access even in `next start` — worth re-measuring
  with a warm second pass once there's reason to chase production latency,
  which there isn't yet at this phase.
- No optimization was attempted based on these numbers — per phase
  instructions, this is a baseline record, not a performance pass.

## Phase 2 re-measurement (2026-09-19, after the theme engine + login/sidebar redesign)

Re-measured the same way (`bun run next build && bun run next start`,
warm-repeated `curl -w`), specifically to check for a regression from the
new theme resolver running on every render of the migrated components.

| Route | Production — cold (server just started) | Production — warm (3 repeated samples) |
|---|---|---|
| `/` | 1.70s | 0.036s / 0.016s / 0.017s |
| `/login` | — | 0.066s / 0.022s / 0.016s |
| `/courses` | — | 0.041s / 0.022s / 0.017s |
| `/dash` | — | 0.052s / 0.019s / 0.015s |

**No regression** — if anything these numbers are lower than phase 1's
(0.35–0.58s first-hit vs. phase 2's 0.02–0.07s), most plausibly because
this run's Next.js route cache was already warm from the repeated
build/test cycles earlier in the same session, not because of any specific
optimization. The theme engine's actual per-render cost
(`resolveOrganizationTheme` + `useMemo` in `useOrganizationTheme`) is a few
plain-object reads and one hex-color regex match — not something a
`curl`-level timing could distinguish from noise either way. Treat "no
significant regression" as the finding, not "measurably faster."

## Phase 3 re-measurement (2026-09-19, after SSR org resolution + secondary/accent + Playwright)

Re-measured again, specifically to check whether resolving the organization
*server-side* on every request (`getServerOrg()`/`getServerOrgTheme()` —
see `ssr-branding.md`) added a real cost, since it's strictly more work per
request than phase 2's client-only resolution (an extra backend API call
during SSR, memoized per request but still a real network hop to the API).

| Route | Production — cold (server just started) | Production — warm (3 repeated samples) |
|---|---|---|
| `/` | 5.96s | 0.040s / 0.018s / 0.018s |
| `/login` | — | 0.071s / 0.038s / 0.017s |
| `/courses` | — | 0.054s / 0.018s / 0.052s |
| `/dash` | — | 0.048s / 0.020s / 0.028s |

**Warm numbers: no regression** — same 0.02–0.07s range as phase 2, despite
every one of these routes now making a real server→API round-trip for
`getServerOrg()` on every request (memoized within a request, but not
across requests — there is no cross-request cache for it, deliberately,
since org config can change at any time). The dev machine's Postgres/Redis/
API stack sits on the same box, so that round-trip is sub-millisecond in
practice; a real production deployment with the API on a different host
would see a real, if still probably small, addition here — worth
re-measuring against an actually-remote API before treating "no
regression" as a permanent conclusion rather than "no regression on this
topology."

**Cold start: 5.96s vs. phase 2's 1.70s — not treated as a regression.**
This session had a backend test run and multiple other background
processes active on the same machine at measurement time (see the
`jelenius-phase3` git history for what else was running), and cold start is
exactly the number most sensitive to system load, single-sample noise, and
this being a genuinely fresh `next start` invocation rather than a reused
one. Re-measure in isolation before drawing any conclusion from this
number specifically.

## Known gaps in this measurement

- No real browser was used, so client-side hydration cost, JS bundle
  execution time, and perceived paint time are **not** captured here — only
  server response time.
- Single machine, single sample per route — do not treat as a regression
  gate. Re-measure with repeated samples before drawing conclusions in a
  future phase.
- RAM on this dev machine (~15.8 GB) is on the low side for running
  Postgres + Redis + API + Web + Collab + an editor simultaneously; if
  "development feels slow" comes up again, check for memory pressure before
  assuming a code regression.
