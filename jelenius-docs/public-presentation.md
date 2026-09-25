# Public presentation & Image block sizing

Scope: how a **signed-out visitor** sees an organization's public home, and how
instructors size images inside Dynamic Pages. Nothing here touches the course
player, course editor architecture, auth, permissions, RBAC, the PostgreSQL
schema or any API.

## 1. Two shells: public vs. authenticated

| Visitor | Header | Where |
|---|---|---|
| Not signed in (`session.status === 'unauthenticated'`) | `OrgPublicHeader` — logo, Home, Courses, school-configured links, Log in, accent-colored Sign up — painted from the shared navigation tokens | `components/Objects/Menus/OrgPublicHeader.tsx` |
| Signed in | `OrgMenu` full LMS shell — unchanged | `components/Objects/Menus/OrgMenu.tsx` |

`OrgMenu` hands off to `OrgPublicHeader` right before it would render the LMS
shell (`usesPublicHeader(session?.status)`). `'loading'` never selects the
public header: `SessionGate` blocks rendering until the session resolves, and
treating "unknown" as public would flash the wrong header at signed-in users.

### What the public nav contains (`lib/publicNav.ts`)

- **Home** and **Courses** (Courses only when the `courses` feature is enabled).
- The school's own **custom menu items** (`customization.menu.items`, `type:
  'custom'`, enabled, with a URL). Nothing is invented.
- A link to the first **`people` landing section**, labelled with that
  section's own title (anchor `#landing-people`) — only if the landing is
  enabled and has such a section.
- **Not** advertised publicly: Library, Communities, Podcasts, Playgrounds,
  Store, global LMS search. Those are application surfaces; they stay in the
  authenticated shell.

## 2. Branding: the global semantic theme

The public header and sections use the same runtime tokens as the rest of the LMS
(`bg-app-header`, `text-app-header-foreground`, `bg-brand`, `text-brand-foreground`, `surface`,
`text-secondary`, `border`, `shadow-card`, `rounded-xl`). The org wrapper in
`app/orgs/[orgslug]/layout.tsx` sets `--brand-*` and `--app-*` inline in the server HTML.

> **History.** This document previously recorded a known issue: `bg-brand` always rendered the
> default navy because `--color-brand: var(--brand-primary)` sat in a plain `@theme` block, and the
> public components worked around it with `bg-[var(--brand-primary)]`. That was fixed at the root
> (`@theme inline`, see `theme-engine.md` → "Why `@theme inline`") and the workarounds were
> removed. The public header now paints from the **navigation tokens** shared with the
> authenticated header (primary background, accent Sign up CTA, active link = filled + underline).
>
> Remaining direct `var(--brand-*)` in public code, with the reason: `lib/publicHero.ts`
> (`color-mix(in srgb, var(--brand-primary) 9%, hsl(var(--surface)))` for the hero's soft tint) — a
> CSS gradient expression that has no utility-class form, and it reads the runtime variable.

## 3. Hero (`components/Landings/LandingCustom.tsx`, case `'hero'`)

The hero is still configured in `customization.landing.sections[]` (type
`hero`) — the capability is unchanged, only the renderer was redesigned:

- Desktop: two columns, text ≈ 45–50 %, image ≈ 50–55 % (`illustration.size`
  small/medium/large → 40/50/55 %, see `heroImageShare`), `min-height`
  340 px (420 px at `lg`), growing only if the content needs it.
- Mobile: text → CTA → image, single column.
- The image fills its column (`absolute inset-0 h-full w-full object-cover`) —
  no small picture floating in a big box.
- `illustration.position: 'left' | 'right'` still decides which side the image is on.
- Side margins were halved: sections used to stack `px-16` on the container
  *and* `lg:mx-16` on every section.

### Legacy editor defaults → brand tokens (`lib/publicHero.ts`)

The landing editor used to persist hard-coded defaults into every school's
config: heading `#000000`, subheading `#666666`, background `#ffffff`, CTA
`#000000` on `#ffffff`. Rendering those verbatim is why schools' public pages
ignored their branding. Values that are still **exactly** those defaults (or
empty) resolve to theme tokens; anything the admin actually changed is kept.
The first button is the primary CTA (solid brand), later ones are brand-outline.
A button counts as customised if *either* of its two colors differs from the
legacy default. Consequence to be aware of: an admin who deliberately chose
pure black on white for a CTA gets the brand color instead.

## 4. Sections and cards

- `text-and-image`, `logos`, `featured-courses`: `py-16` → `my-8/my-10`,
  surface/text tokens instead of `gray-*`/`white`, image `object-cover` in a
  4:3 box capped at 340 px.
- `people` now renders **cards** (photo or avatar, name, 4-line description,
  optional "View more" link when the person has a `link`) in a 1 / 2 / 3
  column grid. `LandingUsers.link` is a new optional field (no editor input yet).
- Course cards (`CourseThumbnail`, `CourseThumbnailLanding`): token text
  colors, brand CTA instead of `bg-black`.

### About "docentes / semblanzas" (limitation)

There is **no metadata** on Dynamic Pages (or landing sections) that says "this
is a teacher bio": no `type`, no `featured`, no tag. Detecting them by a title
containing "Semblanza" would be brittle, so nothing does. What was improved is
the *generic* renderers above (compact `text-and-image`, card-based `people`).
A future `type: 'person' | 'featured'` (or `extra_metadata`) on the activity
would allow a real "Conoce a tus docentes" section fed from Dynamic Pages.

## 5. Footer / platform credit

Before: `OrgFooter` rendered a Jelenius **icon** (15 % opacity) *and* `Watermark`
rendered a fixed floating "Hecho con / Made with Jelenius" pill.
After: `OrgFooter` renders the org's `footer_text` and a single inline
`<Watermark />` ("Hecho con Jelenius", the existing `common.made_with` i18n
key). Visibility rules are unchanged and centralised in `Watermark`: hidden in
EE, always shown on the SaaS free plan, otherwise the admin's `watermark`
toggle. The AGPL notices / `LICENSE` / `NOTICE.md` are not touched.

## 6. Image block (`blockImage`)

Files: `components/Objects/Editor/Extensions/Image/ImageBlock.ts`,
`ImageBlockComponent.tsx`, `lib/imageBlock.ts`, `styles/globals.css`.

Stored inside the activity's JSON document (`Activity.content`) — **no
database change**.

| Attribute | Status | Meaning |
|---|---|---|
| `blockObject`, `unsplash_*` | existing | image source |
| `size` `{ width: px }` | existing | legacy pixel width (drag handle) |
| `alignment` | existing | `left` / `center` / `right` (default `center`) |
| `widthPreset` | **new** | `'25' \| '50' \| '75' \| '100'` — percent of the usable content width; `null` = legacy |
| `alt` | **new** | accessible description, default `''` |

- Editor: a control row in the block header — **25 / 50 / 75 / 100 %**,
  align left/center/right, expand — and an alt-text input under the image.
  Dragging the handle still works; it switches back to an exact pixel width and
  clears the preset.
- Learner and editor share `resolveImageWidth()` / `imageFrameStyle()`. The
  frame is `width: N%; max-width: 100%`, the `<img>` is `height: auto` →
  aspect ratio preserved, never `100vw`, never horizontal scroll.
- Narrow screens (< 640 px): presets collapse to 100 % of the content width
  (`.lh-image-frame[data-image-preset]` in `globals.css`), so a 25 % image is
  never a thumbnail on a phone.
- **Backward compatibility:** content saved before this feature has no
  `widthPreset`/`alt` → it keeps its `size.width` (default 300 px), alignment
  and empty alt. Nothing is migrated or rewritten.
- `ActivityPreview` (the small preview renderer) also passes the alt text through.

## 7. Tests

| File | Covers |
|---|---|
| `tests/public-nav.test.mjs` | which shell a visitor gets; public nav contents; authenticated shell untouched |
| `tests/public-hero.test.mjs` | hero/CTA use brand tokens, legacy defaults, customised colors kept; hero height/image; footer credit |
| `tests/image-block.test.mjs` | presets 25/50/75/100, fallback, alignment, legacy images, alt, shared helper |
| `e2e/public-home.spec.ts` | header, hero, cards, footer, overflow, screenshots — Jelenius **and** Colegio Demo — desktop + mobile; authenticated shell |
| `e2e/dynamic-image.spec.ts` | a real Dynamic Page: 25/50/75/100 %, alignment, legacy image, aspect ratio, full-width screenshot, editor presets |

`e2e/fixtures/public-content.ts` seeds through the real admin API (landing,
course → chapter → Dynamic Page) with inline SVG images, and always restores /
deletes what it created.

The API rate-limits logins to 30 per 5 minutes per IP. `dynamic-image.spec.ts`
therefore signs in once per project instead of once per test.
