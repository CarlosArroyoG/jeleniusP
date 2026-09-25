# PRODUCTION ASSET FIX REPORT

## Root cause

The local equivalent of the production image reproduced the SVG 404 despite
both files being present. The tenant proxy rewrote
`/jelenius/jelenius-icon.svg` to
`/orgs/default/jelenius/jelenius-icon.svg` (confirmed by the
`x-middleware-rewrite` response header). The matcher excluded root public files
but did not exclude the nested `/jelenius/` directory.

The fix adds only `jelenius/` to the proxy matcher exclusions. It does not
change API logic, Next configuration, Analytics, or transport settings.

## Runtime structure verified before changing code

The root Dockerfile builds `apps/web` at `/app`, so the standalone entry point
is `/app/.next/standalone/server.js`, not a nested `apps/web/server.js`.
`frontend-runner` uses `WORKDIR /app` and already copies standalone into `/app`,
public into `/app/public`, and static into `/app/.next/static`.
The final stage copies `/app` from that stage to `/app/web`, uses final
`WORKDIR /app`, and starts the wrapper with PM2 `--cwd /app/web`.
The generated `server.js` calls `process.chdir(__dirname)`.

Executed in the existing local equivalent (`jelenius-clean`), and again in
the newly built final image:

```sh
find /app -name "jelenius-icon.svg" -o -name "jelenius-wordmark.svg"
# /app/web/public/jelenius/jelenius-wordmark.svg
# /app/web/public/jelenius/jelenius-icon.svg
find /app -type d -name public
# /app/web/public
ls -ld /app/web/.next/static
# present
```

Was public/ absent from standalone runtime: **NO**

Was .next/static present: **YES**

Dockerfile files changed: **None**. Existing copies are correct; adding duplicate
copies would not fix the reproduced routing failure.

## Verification

All HTTP results below are from the locally built final image through its
Nginx entry point, not from a deployed Coolify release.

| Check | Result |
| --- | --- |
| jelenius-icon.svg | 200 |
| jelenius-wordmark.svg | 200 |
| Existing LearnHouse `/lrn.svg` | 200 |
| Existing LearnHouse `/learnhouse_logo.png` | 200 |
| `/_next/static/chunks/2uwyj-b4m57vy.js` | 200 |
| Frontend tests | PASS: 60 tests, 112 assertions |
| Typecheck | PASS: `tsc --noEmit --incremental false` |
| Production build | PASS: `bun run build` inside Docker |
| Docker build | PASS: root Dockerfile, final stage |
| Runtime smoke | PASS: real login, dashboard, published course |
| API health | 200 |

Tests: `public-assets-routing.test.mjs`, `brand-fallback.test.mjs`, and
`theme-resolve.test.mjs`. Routing regressions use Next's actual matcher utility
and verify public paths bypass the tenant proxy while application paths still
match it.

Local image: `jelenius-test:assets-27ee021a9` (parent commit plus this fix).
Image ID: `sha256:82a88dbf04141e487fc84018ae52c401a0dcd9d585f57f0df20141eacc61497a`.
The image was started with its default entry point on port 8098, using the
existing local development PostgreSQL/Redis and local test credentials.
Playwright used the existing smoke spec against that image; no mocked backend.
The additional login/logout test also passed at the project's desktop viewport
(1440 x 900). Its initial run at the temporary runner's default viewport timed
out hovering an account menu outside the viewport; no application change was
made for that test setup issue.

## QUIC

**Cloudflare HTTP/3 test required.** This test has not been performed on the
production zone by this change.

1. Record the failing navigation/RSC/API URLs and Chrome Network protocol.
2. In the Cloudflare zone, temporarily set HTTP/3 OFF under Speed > Settings.
3. Restart Chrome to discard existing connections, repeat the same navigation
   with cache disabled, and confirm `h2` in the Network Protocol column.
4. Compare repeated runs under the same conditions. If the QUIC error disappears
   over HTTP/2, record it as an HTTP/3/QUIC transport issue, not an application
   error. Preserve timestamps and network evidence; this alone does not identify
   which browser/network/edge component caused it.
5. Record the outcome before deciding whether to restore HTTP/3 or continue
   transport investigation. Do not modify Next.js or API logic for this error
   without application-level evidence.

References: [Cloudflare HTTP/3 settings](https://developers.cloudflare.com/speed/optimization/protocol/http3/)
and [protocol troubleshooting](https://developers.cloudflare.com/speed/optimization/protocol/troubleshooting/protocol-troubleshooting/).

Analytics related: **NO**. `/api/v1/analytics/...` 503 responses are independent
and remain outside this change.

No demo tag was moved and no production deployment was performed. Release from
the new `jelenius-dev` commit with a new immutable tag that includes its SHA.
