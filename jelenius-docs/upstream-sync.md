# Upstream Sync Model

Jelenius is a white-label distribution built directly on top of LearnHouse
(`https://github.com/learnhouse/learnhouse`, AGPL-3.0). We want to keep
receiving LearnHouse's features and, more importantly, its security fixes,
for as long as this architecture holds. This document describes how the
git remotes are set up and the procedure for pulling in upstream changes
without losing Jelenius-specific work.

## Remote layout

```
upstream  → https://github.com/learnhouse/learnhouse.git   (read-only, never push)
origin    → https://github.com/CarlosArroyoG/jeleniusP.git  (our repo)
```

Branches:

- `dev` — mirrors `upstream/dev` exactly. Never commit directly here.
  It exists purely as a clean reference point to diff against.
- `jelenius-dev` — our integration branch. All Jelenius work (branding,
  white-label, product features) happens here or in short-lived branches
  merged into it.

```
upstream/dev
     │
     ▼
    dev  (local mirror, ff-only from upstream)
     │
     ▼
jelenius-dev  (our work)
```

## Pulling in upstream updates (conceptual flow)

Do this periodically (e.g. monthly, or immediately for a security advisory),
not as a reflex on every upstream commit — each sync has a real chance of
conflicting with branding/theme changes, so batch it.

```bash
# 1. Update the clean mirror of upstream's dev branch
git checkout dev
git fetch upstream
git merge --ff-only upstream/dev

# 2. Bring those changes into our branch
git checkout jelenius-dev
git merge dev

# 3. Resolve conflicts (see "Where conflicts are likely" below),
#    then run the same verification as any other change:
#    typecheck, lint, build, smoke test.

# 4. Push
git push origin dev
git push origin jelenius-dev
```

Use `merge`, not `rebase`, for the sync itself — `jelenius-dev` is a shared
branch (or will be, once collaborators exist) and rebasing rewrites history
that others may have already pulled. Rebase is fine for our own short-lived
feature branches before they land on `jelenius-dev`.

If a specific upstream security fix needs to land faster than a full sync,
cherry-pick the individual commit(s) onto `jelenius-dev` instead of merging
all of `dev`:

```bash
git fetch upstream
git cherry-pick <commit-sha>
```

## Where conflicts are likely

Because Jelenius intentionally keeps the delta small (see principle below),
conflicts should concentrate in a predictable, short list of files:

- Anything under `apps/web` touched for branding: layout/header/sidebar,
  login screen, `<head>`/metadata, global CSS/theme tokens.
- `apps/web/public/` if LearnHouse changes its own logo/favicon assets in a
  way that touches files we've replaced.
- Organization-related API models/schemas, if upstream extends
  `OrganizationConfig.customization` further (it already did once — see the
  sync log below).

Conflicts should NOT show up in: auth logic, course/activity data models,
the editor, the collaboration server, payments/analytics — because this
phase does not touch that code.

## Minimizing the delta (why this matters for sync)

- No cosmetic reorganization of upstream folders.
- No renaming of files just to "make them ours."
- Branding changes go through a small number of injection points (a brand
  config/provider, semantic CSS tokens, a handful of components) rather than
  being scattered inline across every screen. Fewer touched files = fewer
  future conflicts.
- Technical identifiers (env vars, package names, API routes, docker service
  names) are left as `LEARNHOUSE_*` / `learnhouse-*` unless there's a concrete
  reason to change them. Renaming these for cosmetic reasons multiplies
  merge conflicts for no product value.

## Sync log

**2026-09-19 (phase 2).** `git fetch upstream` showed `upstream/dev` had not
moved since the fork point (`0ec01f291`, still its tip) — only
`upstream/renovate/all-minor-patch` had a newer commit, and that branch
isn't merged into `dev`. Result: 7 commits ahead, 0 behind. `git merge
upstream/dev` was a genuine no-op ("Already up to date").

**Correction to the note this doc previously carried:** Phase 1 flagged
`upstream/feat/branding-redesign-square-logo` and
`upstream/feat/email-whitelabel` as branches "visible on upstream, worth
diffing" as if unmerged. They are not unmerged — `git merge-base
--is-ancestor <branch> upstream/dev` confirms both were already merged into
`upstream/dev` *before* our fork point. In other words, both were already
part of the code Phase 1 audited and built on top of:
`apps/api/src/services/email/branding.py` (the org-scoped email
white-labeling Phase 1's email work extended) and the whole
`OrgEditBranding` five-tab admin UI (Logos/Theme/Auth/Social/Previews) both
came from these two PRs, not from Jelenius. `git branch -a` lists a remote
branch ref forever regardless of merge status — always check
`--is-ancestor`, not just presence in the branch list, before assuming
something is unmerged.

## What we do NOT do

- Never push to `upstream`. We have no write access and no intention of
  contributing this fork back — this is a private commercial distribution.
- Never force-push `dev` — it must stay a faithful, fast-forward-only mirror
  of `upstream/dev` so future diffs against upstream stay meaningful.
