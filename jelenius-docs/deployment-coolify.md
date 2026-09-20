# Deploying Jelenius on Coolify

Deployment guide for the `jelenius-demo-ready` tag (and any later tag built the
same way). This documents the **real** build — audited directly from the
Dockerfiles, entrypoint scripts, and source code in this repo, not from
LearnHouse's own upstream docs, which describe a different distribution
(`ghcr.io/learnhouse/app`, LearnHouse's own image) and a different default
feature set (Enterprise Edition present, multi-org tenancy, LearnHouse's own
branding).

No application code, Dockerfiles, or scripts were changed to produce this
guide — it is a pure audit + configuration reference.

---

## 1. Architecture — what actually runs

The repo has **two different Docker topologies**. This guide uses the second
one; the first is documented here only so it isn't mistaken for the
deployment target.

- **Per-app Dockerfiles** (`apps/web/Dockerfile`, `apps/api/Dockerfile`,
  `apps/collab/Dockerfile`) — three separate images, meant for a
  multi-service `docker-compose` deployment. Not what this guide uses.
- **Root `Dockerfile`** (repo root) — a single multi-stage build that
  combines the frontend (Next.js standalone), the backend (FastAPI), and the
  collaboration server (Hocuspocus) into **one image**, reverse-proxied
  internally by nginx. **This is the one Coolify should build from** — one
  Coolify "Application" resource, one container, one exposed port.

Internal layout of that single container, orchestrated by `pm2`
(`docker/start.sh`) behind nginx (`docker/nginx.conf`) on port 80:

```
                     ┌─────────────────────────────────────────┐
                     │   Container (root Dockerfile)            │
  Coolify proxy ───▶ │   nginx :80                               │
  (HTTPS/domain)     │     │                                     │
                     │     ├─ /                     → web  :8000 │
                     │     ├─ /api/auth              → web  :8000│
                     │     ├─ /api/revalidate        → web  :8000│
                     │     ├─ /api/v1, /content      → api  :9000│
                     │     ├─ /api/v1/docs, /redoc   → api  :9000│
                     │     └─ /collab (WebSocket)    → collab:4000│
                     │                                            │
                     │   web:    node/bun, server-wrapper.js      │
                     │   api:    uv run app.py (FastAPI/uvicorn)  │
                     │   collab: node dist/index.js (Hocuspocus)  │
                     └─────────────────────────────────────────┘
                                │              │
                                ▼              ▼
                        PostgreSQL 16      Redis
                        (+ pgvector)   (separate Coolify
                     (separate Coolify    resource)
                        resource)
```

Postgres and Redis are **not** part of the image — they are separate Coolify
resources the app container connects to over the network.

---

## 2. Building the image in Coolify

- **Build pack**: Dockerfile
- **Dockerfile location**: `/Dockerfile` (repo root — not `apps/web/Dockerfile`)
- **Build context**: repo root
- **Build argument**: `LEARNHOUSE_PUBLIC=true`
  This removes the `ee/` (Enterprise Edition) folder from both the frontend
  and backend at build time. Jelenius is a white-label OSS distribution —
  this should always be `true` for a Jelenius build; leaving it `false`
  ships LearnHouse's own Enterprise Edition code, which is not part of
  Jelenius's licensing/deployment model (see `deployment-model.md` from
  earlier phases: one org = one instance, no Enterprise multi-tenancy).
- **Ports to expose**: `80` only, to Coolify's proxy. `9000` and `4000` are
  also `EXPOSE`d by the image (direct API/collab access, useful for
  debugging) but should **not** be publicly routed — nginx on `:80` is the
  only intended public entry point.

---

## 3. PostgreSQL — must be pgvector-enabled

**Image: `pgvector/pgvector:pg16`** — not plain `postgres:16`.

This is not a guess: it's the exact image both the reference dev
`docker-compose` (`.learnhouse/docker-compose.dev.yml`) and the CLI's own
production template (`apps/cli/src/templates/docker-compose.ts`,
`POSTGRES_IMAGE`/`POSTGRES_AI_IMAGE` constants) use.

Why it matters: `apps/api/src/core/events/database.py` runs
`CREATE EXTENSION IF NOT EXISTS vector` automatically on every boot. If the
extension isn't available on the Postgres server, this fails **silently**
(logged as a warning, not an error) and the app boots fine — but the
course-chatbot / RAG AI feature is permanently disabled for that
deployment, with no error surfaced to the operator later. Using the
pgvector image up front avoids ever hitting this silently-degraded state.

**Coolify setup:**
- Resource type: PostgreSQL (or "Postgresql" custom-image database) —
  Coolify lets you override the image; set it to `pgvector/pgvector:pg16`.
- Set a real database user/password/name (not the `learnhouse`/`learnhouse`
  defaults in `config/config.yaml` — those are for local dev only).
- Coolify provisions the data volume automatically
  (`/var/lib/postgresql/data`) — nothing extra to configure there.
- **No manual schema step needed for a fresh database.** The app creates
  its full current schema automatically on first boot
  (`SQLModel.metadata.create_all`, unconditional, every boot — safe/no-op
  on an already-correct schema). See §7 for the one real gap this leaves
  for *future* upgrades.

---

## 4. Redis

**Image: `redis:7.2.3-alpine`** (the CLI's own pinned production version;
`redis:8.6.1-alpine` from the dev compose file also works — Redis's wire
protocol is stable across this range). Enable append-only persistence:

- **Start command**: `redis-server --appendonly yes`
- **Volume**: `/data`

Redis backs: rate limiting, organization-config caching (branding, secondary/
accent colors, etc. — see `theme-engine.md`), and the Boards real-time
collaboration feature (Hocuspocus's Redis extension). Losing Redis data on
restart degrades performance and briefly resets rate-limit counters, but
does **not** lose durable data (that's all in Postgres) — `--appendonly yes`
is a good-practice recommendation, not a hard requirement for correctness.

**Coolify setup:**
- Resource type: Redis, image overridden to `redis:7.2.3-alpine`
- Command override: `redis-server --appendonly yes`
- No auth by default in the reference configs (both `.env` templates
  connect via a bare `redis://host:6379`) — add a password
  (`requirepass`) and reflect it in the connection string if this Redis
  instance is reachable from outside Coolify's internal network.

---

## 5. Persistent storage (uploaded content)

Default content delivery (`LEARNHOUSE_CONTENT_DELIVERY_TYPE=filesystem`,
the default in `config/config.yaml`) stores all uploaded media — course
thumbnails, videos, SCORM packages, everything under
`apps/api/src/services/media/media_serve.py`'s `Path("content") / rel_key`
— on the **local filesystem, relative to the API's working directory**,
which in this image is `/app/api`.

**Mount a persistent Coolify volume at `/app/api/content`.**
Without it, every redeploy (new image, container recreated) silently
**deletes all uploaded course media** — the container filesystem is
ephemeral by default. The directory does not need to be pre-created; the
app creates it itself on boot if missing
(`src/core/events/content.py::check_content_directory`).

**Alternative — S3-compatible object storage** (skip the volume entirely):
set `LEARNHOUSE_CONTENT_DELIVERY_TYPE=s3api`, `LEARNHOUSE_S3_API_BUCKET_NAME`,
`LEARNHOUSE_S3_API_ENDPOINT_URL`, plus the **standard boto3 credential env
vars** — `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` if
your provider needs one. These are *not* `LEARNHOUSE_`-prefixed: the code
(`apps/api/src/services/utils/upload_content.py`) calls
`boto3.client('s3', endpoint_url=...)` with no explicit credentials,
so boto3 resolves them from its own standard environment variables. This is
the more production-appropriate option for a real deployment (survives
redeploys, no volume management, easy backups) — the filesystem + volume
approach is simpler to stand up for a first demo.

---

## 6. Health checks

**App container**: `GET http://localhost/api/v1/health` (port 80, i.e. through
nginx to the API). This is not a guess — it's the exact path both
`apps/api/Dockerfile`'s own `HEALTHCHECK` directive and the CLI's production
`docker-compose.ts` template use. It runs `SELECT 1` against Postgres
(`apps/api/src/services/health/health.py`) and returns `200` if reachable,
`503` otherwise. It does **not** check Redis, collab, or the web process
individually — a reasonable single signal (if API+DB are up, the rest is
almost always fine in this architecture), not an exhaustive one.

Recommended Coolify healthcheck settings (matching the CLI template):
- Path: `/api/v1/health`
- Port: `80`
- Interval: `30s`
- Timeout: `10s`
- Retries: `3`
- **Start period: `60s`** — cold start involves pm2 booting three runtimes
  (uv/Python, bun/web, node/collab) plus nginx; a shorter start period risks
  Coolify killing the container before it's finished booting.

Postgres and Redis healthchecks (`pg_isready -U <user>` /
`redis-cli ping`) are provided automatically by Coolify's own resource
types — no extra configuration needed there.

---

## 7. Environment variables

Generate secrets with:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# or
openssl rand -base64 32
```

### Required — the container will not boot correctly without these

| Variable | Notes |
|---|---|
| `LEARNHOUSE_AUTH_JWT_SECRET_KEY` | ≥32 characters. The app raises a `ValueError` and refuses to start if unset or too short (`config/config.py`). Shared secret — collab also reads this same variable to verify auth tokens on WebSocket connections. |
| `LEARNHOUSE_SQL_CONNECTION_STRING` | `postgresql://user:password@<postgres-host>:5432/<db>` — point at the Coolify Postgres resource's internal hostname. |
| `LEARNHOUSE_REDIS_CONNECTION_STRING` | `redis://<redis-host>:6379/0` (or `/learnhouse` as a path-style db name, per the reference configs) — read by the API. |
| `LEARNHOUSE_REDIS_URL` | **Separate variable name**, read by the collab server specifically (`apps/collab/src/*.ts`). Point it at the **same** Redis instance as above. Easy to miss since it isn't the same name as the API's Redis var. |
| `LEARNHOUSE_INITIAL_ADMIN_PASSWORD` | **Verified end-to-end**: on a fresh (org-less) database, `auto_install()` runs automatically on every API boot (`src/core/events/events.py`) and calls the same install routine `cli.py`'s manual command uses. If this password is unset, that routine raises `typer.Exit(1)`, which is **not caught anywhere** in the startup path — it propagates through FastAPI's lifespan and crashes the whole API process, which pm2 then restarts into the same failure forever (crash loop), since the database is still org-less on every retry. Set this before the very first deploy. |
| `LEARNHOUSE_API_URL` | Set to **`http://localhost:9000`**. The collab server reads this to reach the API for Boards persistence (`apps/collab/src/*.ts` → `${API_URL}/api/v1/boards/...`). Its own fallback default is `http://localhost:8000` — **that's the web port, not the API port**, and would silently break real-time Boards collaboration if this variable is left unset in this single-container topology. This is the one misconfiguration most likely to go unnoticed (nothing crashes; Boards just fails to persist). |
| `COLLAB_INTERNAL_KEY` | Shared secret for collab's internal authenticated calls. Generate one; do not leave blank. |

### Strongly recommended — needed for a correctly-branded, correctly-scoped deployment

| Variable | Notes |
|---|---|
| `LEARNHOUSE_DOMAIN`, `LEARNHOUSE_FRONTEND_DOMAIN` | Your real domain (Coolify-assigned or custom), no protocol. |
| `LEARNHOUSE_COOKIE_DOMAIN` | e.g. `.yourdomain.com` (leading dot). Since web+API are same-origin behind this container's own nginx, this mostly needs to just match your domain. |
| `LEARNHOUSE_SSL` | `true` once Coolify's proxy terminates HTTPS in front of this container. |
| `LEARNHOUSE_ALLOWED_ORIGINS` | Comma-separated list of your real origin(s), e.g. `https://demo.yourdomain.com`. The shipped default (`config/config.yaml`'s `allowed_regexp`) is an intentionally permissive catch-all — see the comment in that file — scoping this is a real hardening step for a public deployment, not just hygiene. |
| `LEARNHOUSE_TENANCY` | Set to **`single`**. Jelenius's deployment model is one organization per instance (see `deployment-model.md`); `multi` requires the Enterprise Edition folder, which this build excludes via `LEARNHOUSE_PUBLIC=true`. |
| `LEARNHOUSE_INITIAL_ADMIN_EMAIL` | Defaults to `admin@school.dev` if unset — set a real address. |
| `LEARNHOUSE_INITIAL_ORG_NAME`, `LEARNHOUSE_INITIAL_ORG_SLUG` | Default to `"Default Organization"` / `default`. Set to your real school/demo name and slug. |
| `NEXT_PUBLIC_LEARNHOUSE_API_URL` | `https://yourdomain.com/api/v1/` — the **public** API URL (browser-facing, through Coolify's proxy — not the internal `:9000` one used server-side). |
| `NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL` | `https://yourdomain.com/` |
| `NEXT_PUBLIC_LEARNHOUSE_DOMAIN`, `NEXT_PUBLIC_LEARNHOUSE_TOP_DOMAIN` | Your public domain. |
| `NEXT_PUBLIC_LEARNHOUSE_DEFAULT_ORG` | Should match `LEARNHOUSE_INITIAL_ORG_SLUG`. |
| `NEXT_PUBLIC_LEARNHOUSE_HTTPS` | `True` once served over HTTPS. |
| `NEXT_PUBLIC_COLLAB_URL` | `wss://yourdomain.com/collab` (or `ws://` if not yet on HTTPS). |

**Note on rebuilds**: the `NEXT_PUBLIC_*` variables above are re-injected at
**container start**, not only baked in at build time —
`apps/web/server-wrapper.js` writes them into `runtime-config.json` /
`public/runtime-config.js` every boot, and `services/config/config.ts`
reads that file before falling back to `process.env`. Practically: changing
a domain or URL in Coolify's environment settings and restarting the
container is enough — a full image rebuild is not required for these.

### Optional feature flags

| Feature | Variables |
|---|---|
| AI (course chatbot, planning assistant) | `LEARNHOUSE_IS_AI_ENABLED=true`, `LEARNHOUSE_AI_PROVIDER` (`google`\|`openai`\|`anthropic`\|...), `LEARNHOUSE_AI_API_KEY` or `LEARNHOUSE_GEMINI_API_KEY`, optionally `LEARNHOUSE_AI_MODEL_FAST`/`_STANDARD`/`_PRO`, `LEARNHOUSE_AI_EMBEDDING_*`. Needs the pgvector extension (§3) to actually work end-to-end for RAG. |
| Email (magic login, password reset, notifications) | `LEARNHOUSE_EMAIL_PROVIDER` (`resend`\|`smtp`, default `resend`), `LEARNHOUSE_SYSTEM_EMAIL_ADDRESS`, then either `LEARNHOUSE_RESEND_API_KEY` or the `LEARNHOUSE_SMTP_HOST`/`_PORT`/`_USERNAME`/`_PASSWORD`/`_USE_TLS` set. Without any of this configured, transactional email silently doesn't send — worth testing explicitly post-deploy (see §9). |
| S3 content delivery | See §5. |
| Shared self-resetting demo org | `LEARNHOUSE_DEMO_ENABLED=true`, optionally `LEARNHOUSE_DEMO_SLUG` (default `demo`), `LEARNHOUSE_DEMO_REFRESH_MINUTES` (default `10`). Creates a shared org with fake students that periodically resets itself — built specifically so a public-facing demo doesn't show one visitor's mess to the next (`src/services/demo/flags.py`). Worth strongly considering for a **public** Coolify demo specifically, separate from the real single-org instance. Not enabled by default; a deliberate choice for whoever runs this deployment, not decided here. |
| Payments (Stripe) | `LEARNHOUSE_STRIPE_SECRET_KEY`, `_PUBLISHABLE_KEY`, `_CLIENT_ID`, `_WEBHOOK_STANDARD_SECRET`, `_WEBHOOK_CONNECT_SECRET`. Out of scope for a demo instance. |
| Error tracking | `LEARNHOUSE_SENTRY_DSN` |

### Found but not actually used — safe to omit

- `NEXTAUTH_URL`, `NEXTAUTH_SECRET` — present in the CLI's own `.env`
  generator template, but `next-auth` is **not a dependency** of
  `apps/web` at all (checked `package.json` directly). Vestigial from an
  earlier architecture; do not bother setting these.
- `NEXT_PUBLIC_LEARNHOUSE_MULTI_ORG` — explicitly not read
  (`services/config/config.ts` has an inline comment: "We deliberately do
  NOT consult `NEXT_PUBLIC_LEARNHOUSE_MULTI_ORG` here"). Superseded by
  `LEARNHOUSE_TENANCY` on the backend.
- `LEARNHOUSE_LOGFIRE_ENABLED` — appears in the CLI's env template; no
  reference to it found anywhere in the backend source.

---

## 8. Schema, migrations, and the one real upgrade gap

- **First deploy, empty database**: nothing manual to do.
  `_bootstrap_schema()` (`apps/api/src/core/events/database.py`) runs
  `CREATE EXTENSION IF NOT EXISTS vector` and
  `SQLModel.metadata.create_all(...)` on **every** boot — the second call
  is a safe no-op once tables exist, and creates the full current schema in
  one shot on a genuinely empty database.
- **`auto_install()`** (same startup sequence) then checks for zero
  organizations and, if so, creates the initial org + superadmin from the
  `LEARNHOUSE_INITIAL_*` variables (§7) — no separate `cli.py install`
  invocation needed for a first boot.
- **The gap**: there are **68 real Alembic migrations** under
  `apps/api/migrations/versions/`, but `alembic upgrade head` is **never
  invoked automatically** anywhere in this image's startup path (checked
  `docker/start.sh`, `apps/api/docker-entrypoint.sh` — unused by this image
  but checked for completeness — and `database.py` directly; none call it).
  `create_all()` only creates tables that don't exist yet; it does **not**
  apply `ALTER TABLE`-style changes to tables that already exist. This is
  invisible on a first deploy (empty DB) but means: **before redeploying a
  future Jelenius image that includes new migrations, against this same
  already-populated database, run `alembic upgrade head` manually** (a
  one-off Coolify command inside the running container, `cd /app/api && uv
  run alembic upgrade head`, or equivalent) — otherwise the running schema
  can silently drift out of sync with what the new code expects. Not an
  issue for this initial Phase 0 deployment; a real operational item for
  whoever does the next one.

---

## 9. Post-deploy verification checklist

1. `curl https://yourdomain.com/api/v1/health` → `200`, no `503`.
2. Load `https://yourdomain.com/login` in a browser — confirm Jelenius
   branding renders (navy `#0B1930`, no LearnHouse leaks — see
   `demo-readiness.md` for the two known, documented exceptions).
3. Log in with `LEARNHOUSE_INITIAL_ADMIN_EMAIL` /
   `LEARNHOUSE_INITIAL_ADMIN_PASSWORD` — confirms `auto_install()` actually
   ran and created the org + superadmin.
4. Upload a course thumbnail or similar media asset, then **restart the
   container** in Coolify and confirm the asset is still reachable — proves
   the `/app/api/content` volume (§5) is actually mounted and persistent,
   not just present for the current container's lifetime.
5. Open the Boards feature and confirm real-time collaboration actually
   saves (not just renders) — this is the one feature that silently breaks
   if `LEARNHOUSE_API_URL` (§7) was left at its wrong default.
6. If email was configured (§7): trigger a password-reset or magic-login
   email and confirm delivery — a misconfigured provider fails silently
   from the UI's perspective (the request "succeeds," no email arrives).
7. Confirm `docker/nginx.conf`'s `/api/v1/docs` and `/api/v1/redoc` are
   either reachable (fine for a private demo) or intentionally not exposed
   externally if this is a public-facing instance — FastAPI serves these
   by default; the comment above them in `nginx.conf` describing them as
   "only available in development mode" is aspirational, not enforced by
   this nginx config.

---

## 10. Known gaps and things this guide deliberately does not decide

- **Resource sizing**: no minimum CPU/RAM is documented anywhere in this
  repo. The single container runs three runtimes (Python/uvicorn,
  Node/Bun, Node/Hocuspocus) plus nginx concurrently. As a starting point,
  **not a verified spec**: 1 vCPU / 2 GB RAM for the app container is
  likely the practical floor for a low-traffic demo; size up before any
  real usage and watch memory specifically, since this codebase's own dev
  machine notes (`performance-baseline.md`) already flag ~16 GB as "on the
  low side" for the full local dev stack (which additionally runs
  Postgres/Redis in-process — a Coolify deployment splits those out, so
  the app container's own footprint should be meaningfully smaller).
- **Demo mode** (§7) is documented as available, not turned on — enabling
  it is a product decision for whoever owns this specific deployment, not
  assumed here.
- **S3 vs. filesystem** (§5): filesystem + volume is documented as the
  faster path to a first deploy; S3 is documented as the more durable
  long-term choice. Which one to actually use is left to the deployer.
- This guide does not cover Coolify's own backup scheduling for the
  Postgres volume or the content volume — set one up before treating any
  deployment as more than a demo.
