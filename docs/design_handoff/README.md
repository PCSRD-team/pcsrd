# Handoff: PCSRD Institutional Website (Next.js + Supabase)

## Overview

Bilingual (Arabic-RTL default / English-LTR) institutional website for PCSRD, plus a
self-built Arabic-first admin CMS. The site exists to do three jobs, in this priority order:

1. **Donor / partner due diligence** — let an institutional funder verify that the
   organisation is real, governed, licensed, and accountable.
2. **Anti-impersonation** — `/verify` is the authoritative list of official channels,
   so beneficiaries and donors can tell the real organisation from an impersonator.
3. **Arabic-first publishing** — staff publish programmes, projects, news, stories and
   vacancies in Arabic without a developer.

The full product specification already exists in `spec/` (docs 00–07). **Those docs are
the source of truth for architecture, schema, routes, security and build order.** This
handoff adds the layer they did not contain: the visual system and every screen, designed
and resolved in both locales and both viewports.

## About the design files

The files in `design/` are **design references authored in HTML** — prototypes showing
intended look, structure and behaviour. They are **not production code to copy**.

The task is to **recreate them in the target codebase** — Next.js App Router +
TypeScript + Tailwind v4 + shadcn/ui, per `spec/03-FRONTEND.md` — using that project's
established patterns: Server Components by default, logical CSS properties only, tokens
from `globals.css`, dictionaries for all copy.

Concretely, do **not** port the inline styles. Read a screen, take its measurements,
colours, type and states from it, and build the real component.

Open the `.dc.html` files directly in a browser. Each screen is labelled with its route,
locale and viewport.

## Fidelity

**High fidelity.** Final colours, typography, spacing, rules, states and copy patterns.
Recreate pixel-faithfully.

Three explicit exceptions:

| Exception | Status | What to do |
|---|---|---|
| **Photography** | Placeholder frames only | Every image is a marked placeholder. No photograph in the designs is real content. Components are designed to work with images absent — keep that property. |
| **Organisation facts** | Not invented | Names, licence numbers, figures, partner names, phone numbers and addresses are shown as clearly-marked example content. Per `spec` §9 no facts were invented. Real values arrive from `organization_settings` and the CMS. |
| **Impact figures** | Structure only | The metric component renders a number **locked to its period and verification status**. Do not ship a figure without both. |

## The design system

### Direction — "The Record / السِّجِل"

The site is an institutional record, not a campaign. The primary reader is a
due-diligence officer, so credibility comes from structure, provenance and restraint:
ruled paper, navy ink, one marking colour. Three directions were considered and
rejected — humanitarian photojournalism (reads as fundraising, and depends on photo
consent the organisation does not hold), the data-dashboard NGO (implies measurement
infrastructure that does not exist), and the institutional-blue template
(indistinguishable from every other NGO, therefore useless against impersonation).

Five principles govern every screen:

1. **Evidence over emphasis** — every published number renders with its period and
   verification status. Provenance is visible design, not a footnote.
2. **Ruled, not floated** — hierarchy comes from rules and column structure. Three line
   weights carry fixed meaning (below). Cards only where content is genuinely a card.
   No decorative shadows.
3. **Arabic sets the measure** — type size, line height and rhythm are tuned for Arabic
   first; the Latin cut adapts. RTL is the default drawing, not a mirror of the English.
4. **Two doors, always open** — partnership and channel verification are the two jobs the
   site exists for, so both live in persistent chrome on every page.
5. **Paper, ink, one mark** — warm paper ground, navy ink, gold as a *marking* colour
   only: the rule under a heading, the attested stamp, the focus ring. Never a fill.

### Colour tokens

Sampled from the organisation's own brochure artwork. The navy and gold ramps in
`spec/04-DESIGN-SYSTEM.md` are kept verbatim; the paper, rule and programme tokens are
additions made during design. `design/globals.css` is ready to drop into the repo.

| Token | Hex | Use |
|---|---|---|
| `ink` | `#14213F` | Primary text, strong rules, dark panels |
| `ink-70` | `#3B4560` | Body text at large sizes |
| `ink-55` | `#5A6478` | Secondary body, captions |
| `navy-900` | `#182E5D` | Dark surfaces |
| `navy-700` | `#254284` | Links, primary button, protection programme |
| `navy-100` | `#E7EBF4` | Tinted panel on navy |
| `gold-700` | `#B87B12` | Gold text on paper (AA-safe), link hover |
| `gold-600` | `#DD991C` | Marking rule, attested stamp, focus ring |
| `gold-050` | `#FEF7E7` | Attestation panel ground |
| `paper` | `#FBFAF6` | Card / panel surface |
| `paper-alt` | `#F2EFE7` | Alternating band |
| `paper-ground` | `#E5E2DA` | Page background |
| `rule` | `#D8D3C7` | Default 1px border |
| `rule-strong` | `#C9C3B4` | Emphasised hairline |
| `hairline` | `#E3DED2` | List separators inside panels |
| `mono-muted` | `#8A8272` | Mono eyebrow labels |
| `prog-protection` | `#254284` | Programme identity |
| `prog-response` | `#B3591B` | Programme identity |
| `prog-recovery` | `#1F6B54` | Programme identity |

Contrast: all body and label pairings meet WCAG AA in both locales. `gold-600` is
**never** used for text on paper — only as a rule, stamp or ring. Where gold must carry
text, it is `gold-700`.

### Typography

- **IBM Plex Sans Arabic** — 400 / 500 / 600 / 700. Single family for Arabic *and* Latin
  body/heading text, so the two locales share a skeleton.
- **IBM Plex Mono** — 400 / 500 / 600. Eyebrow labels, reference codes, dates, IDs,
  facet counts, and any Latin-in-Arabic technical string.

Subset both to the ranges in `spec/06-BUILD-PLAN.md` M2 step 2 and verify the WOFF2
sizes against the performance budget. Self-host; do not ship the Google Fonts link
used by the prototypes.

| Role | Size / line-height / weight | Notes |
|---|---|---|
| Display | 64px / 1.06 / 600, `letter-spacing:-0.02em` | Desktop hero, Latin |
| Display AR | 38–52px / 1.30 / 600 | Arabic needs the looser leading |
| H1 | 40px / 1.20 / 600 | |
| H2 | 28px / 1.30 / 600 | Gold 2px rule beneath, 88px wide |
| H3 | 20px / 1.40 / 600 | |
| Lead | 18px / 1.65 / 400 | `max-width:52ch`, `text-wrap:pretty` |
| Body | 16px / 1.80 (AR) · 1.65 (EN) / 400 | Arabic runs looser at the same size |
| Small | 15px / 1.60 / 400 | |
| Caption | 14.5px / 1.60 / 400 | |
| Mono eyebrow | 11–12px / `letter-spacing:.16em` / 400–500, uppercase | `mono-muted`; never below 11px |

### Rules — three weights, fixed meanings

This is the load-bearing part of the system. Do not add a fourth.

| Weight | Colour | Meaning |
|---|---|---|
| 1px | `rule` `#D8D3C7` | Container edge, list separator |
| 2px | `ink` `#14213F` | Section boundary — a new record begins |
| 2px × 88px | `gold-600` `#DD991C` | Heading mark, under an H2 |

### Spacing & layout

4px base. Steps used: 6 · 8 · 10 · 12 · 14 · 18 · 20 · 22 · 26 · 28 · 32 · 40 · 44 · 48 ·
64 · 72 · 110 · 140.

- Content max width **1180px**; prose measure **52–78ch**; desktop page padding
  **64px**; mobile **20px**.
- Desktop section rhythm **110px**; mobile **64px**.
- **Border radius: 0 everywhere.** The one exception is the pill on a status badge.
- **No shadows.** Elevation is expressed by rule weight and ground colour.

### RTL / bilingual rules

These are the defects that will otherwise reach QA:

1. **Logical properties only** — `padding-inline-start`, `margin-inline-end`,
   `inset-inline-start`, `border-inline-start`. The ESLint rule in M2 step 8 enforces
   this; keep it on.
2. **Latin inside Arabic must be isolated** — wrap every Latin/numeric run in Arabic text
   in `<bdi dir="ltr">` (the `Bidi` component in `spec/03-FRONTEND.md`). Without it,
   phone numbers, emails, URLs, licence numbers and version strings render scrambled.
   The prototypes show the correct rendering.
3. **Numerals** — Western Arabic numerals (0-9) in both locales, per spec. Dates are
   Gregorian, formatted by locale.
4. **Directional icons flip; logos and photographs never do.**
5. **The language switcher preserves the current path**, including query and facets.

## Screens

Every screen exists in four states: **AR desktop · EN desktop · AR mobile · EN mobile**.
Mobile is 390px.

| Design file | Routes covered |
|---|---|
| `PCSRD Design Language.dc.html` | Direction, principles, foundations, core components, then **Home** (`/[locale]`) in all four states, including the mobile menu |
| `PCSRD Programmes & Projects.dc.html` | `/programs`, `/programs/[slug]`, `/projects` (faceted), `/projects/[slug]` |
| `PCSRD Impact, Verify & Partner.dc.html` | `/impact`, `/impact/stories/[slug]`, `/verify`, partner inquiry |
| `PCSRD Careers, Contact & About.dc.html` | `/careers`, `/careers/[slug]` + application, `/contact` and the six-form system, `/about` ×5 (governance, strategy, structure, membership) |
| `PCSRD Remaining Routes.dc.html` | `/news`, `/news/[slug]`, `/partners`, `/resources`, `/support`, `/legal/[slug]` |
| `PCSRD Admin.dc.html` | Admin login, dashboard, projects editor, submissions inbox |
| `PCSRD Admin — Media & Entities.dc.html` | Media library + uploader, entity form configs, users, audit log |
| `PCSRD States & Audit.dc.html` | Empty · loading · error · untranslated states, plus the design audit and open decisions |

### Persistent chrome (every public page)

- **Official-channels bar** — thin bar above the header carrying the verification link.
  This is principle 4 and the anti-impersonation job; it does not scroll away on mobile
  behind a menu.
- **Header** — logo, main nav, language switcher, partnership CTA.
- **Footer** — identity record (legal name, licence number, licensing authority, founding
  year), official channels repeated, programme links, legal links.

The identity record in the footer is the single most-reused due-diligence element. It
reads from `organization_settings` — one row, editable at launch without a deploy, which
is also the mitigation for the pending naming decision (`spec/06-BUILD-PLAN.md` §12).

### Screen-level notes that the HTML cannot express

**`/verify`** — the authoritative channel list. Each channel row shows the channel, its
handle isolated with `<bdi>`, and a "last verified" date. The page must also state
plainly what the organisation will *never* do (e.g. never solicit payment through a
personal account). Copy for that statement must come from the organisation; the design
reserves the block.

**`/projects`** — faceted list. Facets: programme, status, governorate, year, partner.
Facet state lives in the URL (`parseProjectFilters`), so a filtered view is shareable —
that is the partner journey J3. Counts render in mono. Zero-result state is designed.

**Project / programme detail** — every figure carries period + status. Partner logos are
optional; the layout must not collapse when absent.

**Forms (six)** — contact, partnership, volunteer, job application, support request,
complaint. All must submit **with JavaScript disabled** (Server Actions), which is the
reason for that choice and the thing that silently regresses. Validation messages are
localised, inline, and announced. The complaint form stores `ip_hash = null` and fires no
analytics event — that is a privacy requirement, not a preference.

**Admin** — Arabic-only interface, `force-dynamic`, never cached. Guard first, then
mutate, then write an audit entry. An editor cannot publish. Media without `alt_ar`
cannot be uploaded.

## Interactions & behaviour

Restrained by design. There is no decorative motion.

| Interaction | Specification |
|---|---|
| Link hover | `navy-700` → `gold-700`; underline `1px`, offset `3px` |
| Button hover | Ground darkens one step; no lift, no scale |
| Focus visible | `2px` `gold-600` outline, `2px` offset — on every interactive element, both locales |
| Transitions | `120ms` `ease-out`, colour only |
| Disclosure (mobile menu, filters, accordions) | Height + opacity, `180ms` |
| Reduced motion | `prefers-reduced-motion` removes all transitions |
| Loading | Skeletons that match the final rule structure — see the state gallery |
| Untranslated content | Explicit notice + link to the Arabic original. Never an empty page, never machine translation |

## State management

Server Components by default; client state only where it is unavoidable:

- **Facet filters** — URL search params, not component state.
- **Mobile menu / disclosure** — local `useState`.
- **Form submission** — Server Action + `useFormStatus`; the JS-disabled path must work.
- **Admin editor** — controlled form state, optimistic publish, revalidate the correct
  cache tags on success.

Data fetching, caching tags and query modules are specified in `spec/01-DATABASE.md` and
`spec/02-API.md`.

## Assets

| Asset | Source | Status |
|---|---|---|
| `assets/pcsrd-logo.jpg` | Supplied by the client | Raster. **Needs an SVG** before launch — request the vector from whoever produced the brochure. |
| Photography | — | **None supplied.** All image frames are placeholders. Each needs a real file *and* a documented consent status; images of identifiable children without documented consent must not be published. |
| Icons | lucide-react | Per spec. Directional icons flip in RTL. |
| Fonts | IBM Plex Sans Arabic, IBM Plex Mono | Self-host and subset. |

`design/image-slot.js` and `design/support.js` exist only to make the prototypes run.
Do not port them.

## Files

```
design/     8 .dc.html design references + globals.css + assets
spec/       the 8 product specification docs (00–07)
CLAUDE.md   drop at the repo root — conventions + non-negotiables
START-HERE.md   the order of operations
```

## Open items before launch

1. **Naming decision** — blocks the domain. Build on a placeholder subdomain; every name
   reads from `organization_settings`.
2. **Licence number and licensing authority** — the first thing a due-diligence officer
   looks for, and currently absent.
3. **Official channel list** — must be complete. A partial list on `/verify` is worse
   than no list.
4. **Photography + consent** — see above.
5. **Verified impact figures with periods** — or ship without the metric blocks.
6. **Vector logo.**
