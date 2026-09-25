# School brand example — Fundación Don Bosco

Reference: <https://www.fdonbosco.org/> (inspected 2026-09-25).

**This is a test fixture and documentation, not product code.** No component, stylesheet or
resolver knows this school. It exists to prove *same codebase + different `OrganizationConfig` =
different LMS identity* (`e2e/fixtures/org-branding.ts` → `DON_BOSCO_BRANDING`, used by
`e2e/authenticated-branding.spec.ts`).

## How the values were obtained

`curl` of the home page and its stylesheet (`/theme/css/main.css`, 71 KB). Colors were counted and
their **roles read from the selectors that use them** — not guessed from a screenshot.

| Value | Found | Evidence (selectors in `main.css` / home HTML) |
|---|---|---|
| **Primary** `#162562` | verified | `header{background-color:rgba(22,37,98,0.8)}` (= `#162562` at 80 %); 42 uses; text color of section titles (`.bg2 .center p.tt`); the only hex in the page's inline HTML |
| **Secondary** `#00001e` | verified | `background-color:#00001e` on the dark section blocks (`.ipaedbg35`, `.ipaedbg37`, `.ipaedbg39 .col.blue`, `.ipaedbg41 .col.rg`, `.ipaedbg43 .col.lf`) |
| **Accent** `#ff9d2f` | verified | 40 uses: `header .center nav a:hover` and `a.activo` (nav hover/active text), and `background-color` of the call-to-action buttons (`.bg5/.bg6/.bg7/.bg10/.bg12/.bg17 .center a.btn`), with `#162562` button text |
| Second highlight `#ffbd00` | observed, **not used** | yellow blocks and secondary buttons on the newer "ipaed" landing sections; the Jelenius theme has one accent, so it is not mapped |
| Text `#464646` / `#222222` | observed | body copy; not a brand token |
| **Logo** | found | `https://www.fdonbosco.org/theme/img/logo.png` (145 × 73 px PNG) and `logo_foot.png`. **White artwork on a transparent background**, designed to sit on the navy header. |
| **Favicon** | found | `https://www.fdonbosco.org/theme/favicon.ico` (also `apple-touch-icon.png`) |
| **Font — body / navigation** | verified | `'Open Sans', sans-serif` (Google Fonts; `header .center nav a`), loaded from `fonts.googleapis.com` |
| **Font — display headings** | observed, **not reproducible** | self-hosted `BebasNeue_Bold`, `SohoGothicPro`, `Rockwell-ExtraBold` (`@font-face`, condensed / slab display faces). They are not in Jelenius's curated Google Fonts list |

## Mapping used by the fixture

```ts
DON_BOSCO_BRANDING = {
  name: 'Fundación Don Bosco',
  color: '#162562',            // primary
  secondary_color: '#00001e',  // secondary
  accent_color: '#ff9d2f',     // accent
  font: 'Open Sans',           // closest curated match for the body/navigation face
}
```

What the theme engine derives from it (no code involved):

| Surface | Result |
|---|---|
| Header (public and authenticated) | `#162562`, white text |
| Sidebar / mobile navigation | `#00001e`, white text |
| Active navigation item | `#ff9d2f` fill, dark ink text (white on `#ff9d2f` is ~2.1:1) |
| CTAs (hero, "Login" button) | `#162562`; the header's Sign up is the accent |
| Font | Open Sans |

## What is NOT exact — and is not invented

- **Display typography.** Only Open Sans is reproduced. The condensed Bebas / Soho / Rockwell
  headings of fdonbosco.org cannot be selected; the "typographic character" (a strong condensed
  display face) is approximated by nothing rather than by a guess.
- **Logo.** The fixture does **not** upload the Foundation's logo (it is their asset and this repo
  should not carry it). Without an uploaded logo the header shows the platform icon + the school
  *name*. Their real logo is white-on-transparent, which works on the navy header the theme produces
  (primary `#162562`) but would be invisible on a light header — relevant to the future
  `navigation_style: 'light'` option (see `authenticated-branding.md`).
- The site's header is `#162562` at 80 % opacity over a hero photo; the LMS header is the solid color.
- `#ffbd00` (secondary yellow) has no slot in the three-color model.

If the Foundation onboards for real, the values to confirm with them are the three hex colors, the
supplied logo/favicon files, and whether Open Sans is acceptable for the LMS.
