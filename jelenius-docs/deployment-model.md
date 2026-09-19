# Deployment Model — Phase 1

## Decision: one organization = one instance = one school

For this phase, Jelenius Community Edition is deployed as a fully separate
instance per school. We are **not** unlocking or reimplementing LearnHouse's
Enterprise Multi-Org feature, and we are not attempting to evade its
licensing checks (`resolve_feature`, EE gating, etc. in `apps/api`).

```
Escuela A                          Escuela B
campus.escuela-a.mx                campus.escuela-b.mx
Jelenius instance A                Jelenius instance B
  ├── own Postgres                   ├── own Postgres
  ├── own Redis                      ├── own Redis
  ├── own API + Web + Collab         ├── own API + Web + Collab
  └── own BrandConfig                └── own BrandConfig
```

Each instance is a single-tenant LearnHouse/Jelenius deployment (community
edition, single organization) with its own branding applied through the
white-label layer described in `white-label.md`. There is no cross-instance
data sharing and no shared control plane in this phase.

## Per-installation configuration (documented now, not yet provisioned)

Every future installation will need its own independent configuration for:

- **school name / slug** — used in the org record and default branding
- **domain** — e.g. `campus.escuela-a.mx`, mapped to that instance's Web/API
- **branding** — logo, colors, font, favicon (see `white-label.md`)
- **admin** — the school's own admin account, not shared across schools
- **database** — a dedicated Postgres instance/schema per school, never shared
- **redis** — dedicated cache/queue per school
- **storage** — local filesystem in dev; S3-compatible bucket per school (or
  per-school prefix in a shared bucket) in production — see storage section
  below
- **email** — sender identity / provider credentials, per school where
  white-labeled email is needed (out of scope for this phase — see
  `feat/email-whitelabel` on upstream)
- **plan** — which LearnHouse feature tier applies to that school (community
  features only in this phase; Enterprise features stay off)

None of this is provisioned automatically yet. Phase 1 only needs to prove
that a single codebase can present two different brand identities from
configuration (Jelenius default + "Colegio Demo") without editing components.
Automating the creation of new instances is explicitly out of scope — see
"Not implemented yet" below.

## Storage

Development: local filesystem, as already configured by LearnHouse.
Production target: S3-compatible object storage, one bucket (or prefix) per
school, so no school's uploaded media (logos, course videos, etc.) ever ends
up committed to this git repository. Large binary assets — video, per-school
logos beyond small placeholder SVGs — must never be committed; they belong in
the object storage layer even during development testing.

## What this implies for the future Control Plane

A future, separate Control Plane (not part of this phase) would be
responsible for:

- Provisioning a new instance (compute, database, redis, storage, domain/TLS)
  for a new school
- Storing the roster of instances and their configuration
- Billing across schools (multi-tenant billing is explicitly out of scope
  here — see "Not implemented yet")

The Control Plane is a separate system that manages many single-tenant
Jelenius instances — it is not the same thing as LearnHouse's Enterprise
Multi-Org feature (which runs multiple orgs inside *one* instance). Do not
conflate the two when planning future phases.

## Not implemented in this phase

Per the phase-1 scope, none of the following are implemented, even partially:

- Control Plane (central management of multiple instances)
- Billing / Stripe / Mercado Pago, multi-school or otherwise
- Automated provisioning of new school instances
- Multi-Org Enterprise (unlocking or otherwise)
- Zoom webhook integration
- Audio recorder
- Anti-seek video protection
- Personalized AI features beyond what LearnHouse already ships
- Mobile app
- SCORM
- Migration to a proprietary backend
