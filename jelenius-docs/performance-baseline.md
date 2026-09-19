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
