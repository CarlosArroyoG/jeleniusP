# Brand Reference

Source: **https://jelenius.com.mx/** (fetched 2026-09-19). Values below are
extracted verbatim from that site's `css/styles.css` `:root` block and
`assets/logo/*.svg` — not approximated or invented. If the real site changes
its identity, re-extract and update this file and `apps/web/lib/brand.ts`
together; nothing else should hardcode these values independently.

## How it was extracted

```bash
curl -sL https://jelenius.com.mx/ -o home.html            # find asset paths
curl -sL https://jelenius.com.mx/css/styles.css           # :root tokens
curl -sL https://jelenius.com.mx/assets/logo/favicon.svg  # the mark, verbatim
```

`WebFetch` (HTML→markdown) was tried first and could not see CSS at all —
worth remembering for any future brand-reference refresh: fetch the raw
HTML/CSS with `curl`, not the markdown-converted page.

## Logo

The mark is a navy rounded square (`rx="30"` on a 128×128 box — ~23% corner
radius) containing a teal stylized "J"-like glyph and a small blue accent
shape:

```html
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="30" fill="#0B1930"/>
  <path d="M40 28H91V50H63V78C63 88 58 94 48 94C43 94 38 93 34 91V70C38 73 41 74 44 74C48 74 50 72 50 67V50H40V28Z" fill="#19B7A5"/>
  <path d="M74 50H91V93H74V50Z" fill="#2F80ED"/>
</svg>
```

This exact markup is vendored at `apps/web/public/jelenius/jelenius-icon.svg`
(same paths/colors, same viewBox — not redrawn). The header lockup pairs
this mark with the text "JELENIUS" (uppercase, `letter-spacing: .18em`,
`font-weight: 800`, color `--navy`) rather than a single wordmark SVG;
`apps/web/public/jelenius/jelenius-wordmark.svg` reconstructs that lockup
(scaled-down mark + `<text>`) since the real site doesn't ship one as a
standalone asset.

Favicon: `assets/logo/favicon.svg` — identical file to the mark above.

## Color palette (verbatim `:root` custom properties)

```css
--navy: #0B1930;
--teal: #19B7A5;
--blue: #2F80ED;
--ivory: #F7F8F5;
--white: #fff;
--ink: #172033;
--muted: #667085;
--line: #e7e9ee;
--shadow: 0 24px 70px rgba(11,25,48,.12);
```

| Role | Hex | Used for |
|---|---|---|
| Primary (navy) | `#0B1930` | Brand surfaces, headings, primary buttons' text-on-brand contexts |
| Accent (teal) | `#19B7A5` | Primary CTA fill, hover states, focus rings, links |
| Tertiary (blue) | `#2F80ED` | Sparingly — one shape in the mark, not used as a general UI color on the source site |
| Ivory | `#F7F8F5` | Section background alternate to white |
| Ink | `#172033` | Body/heading text (darker and slightly bluer than pure black) |
| Muted | `#667085` | Secondary/caption text |
| Line | `#e7e9ee` | Borders/dividers |

`<meta name="theme-color" content="#0B1930">` confirms navy as the intended
browser-chrome color too.

Mapped into `apps/web/lib/brand.ts` (`JELENIUS_BRAND`) as `primaryColor`,
`accentColor`, `tertiaryColor`, `surfaceColor`, `mutedColor`, `lineColor`,
`secondaryColor` respectively, and into `apps/web/styles/globals.css`'s
`:root` as the theme engine's static defaults (see `theme-engine.md`).

## Typography

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Single family for everything — no separate heading/body face. `Inter` is
already on this codebase's curated Google Fonts list
(`apps/web/lib/fonts.ts`), so it's now also the **platform default**
(`DEFAULT_FONT`), loaded in `apps/web/app/layout.tsx` via `next/font/google`.

## Radius scale

The real site's border-radius values, from smallest to largest observed use:

| Value | Where |
|---|---|
| `6–9px` | inputs, small product icons |
| `10px` | buttons |
| `11–18px` | icons/logos in cards, small integration chips |
| `22–24px` | cards (`.identity-card`, `.demo-box`) |
| `28–30px` | large icon containers, the mark's own corner radius |
| `999px` | pills |
| `50%` | circular avatars |

Mapped as Jelenius design-system tokens (not organization-configurable —
see `theme-engine.md`): buttons/inputs use an explicit `rounded-[10px]` /
`rounded-[9px]` where the redesigned login needed exact fidelity; a new
`--radius-xl: 1.25rem` (20px) token was added to `@theme` for card-level
surfaces, sitting alongside the existing `--radius-sm/md/lg`.

## Shadows

```css
--shadow: 0 24px 70px rgba(11, 25, 48, .12);          /* large cards */
/* smaller, more specific shadows seen elsewhere: */
0 12px 30px rgba(11, 25, 48, .08);                     /* chips */
0 10px 30px rgba(25, 183, 165, .22);                   /* primary button */
0 0 0 3px rgba(25, 183, 165, .12);                     /* input focus ring */
```

Note the shadow tint is the brand navy (`rgba(11,25,48,…)`), not neutral
gray — a detail worth carrying into any future card-shadow token.

## Buttons

```css
.btn { border-radius: 10px; padding: 14px 20px; font-weight: 750; }
.btn-primary { background: var(--teal); color: #052b2b; box-shadow: 0 10px 30px rgba(25,183,165,.22); }
.btn-secondary, .btn-outline { border-color: #cfd5df; background: white; color: var(--navy); }
.btn:hover { transform: translateY(-2px); }
```

Primary CTAs are teal-filled with near-black text (not white) — `#052b2b`,
which is a very dark teal, chosen for contrast rather than pure black.
Secondary/outline buttons are white with a light gray border and navy text.

## Inputs

```css
input { border: 1px solid #d8dde5; border-radius: 9px; padding: 12px; }
input:focus { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(25,183,165,.12); }
```

## Navigation / header

Sticky header, `76px` tall, `rgba(255,255,255,.88)` background with
`backdrop-filter: blur(14px)`, a `1px` bottom border
(`rgba(231,233,238,.8)`, i.e. `--line` at 80% opacity). Logo mark + tracked
uppercase wordmark on the left, nav links center-right, a small outline
"Solicitar demo" CTA button on the far right.

## Overall tone

Modern, minimal, institutional-but-not-stiff — generous whitespace, large
confident headline type (`clamp(48px, 5.5vw, 76px)` for the hero `<h1>`),
numbered step sections, soft large shadows on floating card mockups rather
than hard borders. This is the tone the login redesign and sidebar accents
in this phase aimed at (see `theme-engine.md`), not a full identity
invention.
