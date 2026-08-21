# Tracks T4 / T9 — Design system · Accessibility · RTL · i18n (raw findings)

Working file. Merged into `01-AUDIT-REPORT.md`.

Method note: the track compiled **every string token in all 161 `src/` files** (1,384
candidates) against the project's own design system via `tailwindcss@4.3.3`
`__unstable__loadDesignSystem().candidatesToCss()`. The class inventories below are therefore
complete, not sampled. Contrast ratios are computed from the `@theme` hex values with the
WCAG 2.x relative-luminance formula.

**I re-ran the central claim myself** (A11Y-001) rather than take it on report — see the
`[VERIFIED-EXEC]` block under it.

---

# T4 — DESIGN SYSTEM

**DS-001 · P1 — `gold-700` #B87B12 on paper is 3.42:1, and the handoff calls it "AA-safe".**
`docs/design_handoff/README.md:89` asserts the opposite of the measurement. 14 sites, all
normal-size text: every public form error (`forms/fields.tsx:82`, `:260`), every required
asterisk, both admin field errors (`bilingual-field.tsx:43`, `content-form.tsx:126`), the
`verified` attestation badge on `/verify` (`primitives.tsx:201`, 3.35 on `gold-050`), the
"EXIF not stripped" warning, and `globals.css:89` `a:hover` — **every body link's hover
state**. Ratios: 3.42 on `paper`, 3.35 on `gold-050`, 3.11 on `paper-alt`; AA needs 4.5.
Root cause: the token was chosen against the *large-text* 3:1 threshold and then documented
and used as normal text. Fix: darken to about `#8A5B0C` (4.6:1) and correct the README row.

**DS-002 · P1 — `mono-muted` #8A8272 is 3.64:1 on paper and 2.94:1 on the page ground, at 12px.**
This is the `eyebrow` utility's own colour (`globals.css:146-153`), so it covers 41 `eyebrow`
uses plus 14 `text-mono-muted`. Four sites sit on `paper-ground` at **2.94** — below even the
3:1 large-text floor, at 12px: `(site)/[locale]/page.tsx:62`, `about/page.tsx:152`,
`news/[slug]/page.tsx:74`, `projects/[slug]/page.tsx:78`. Worse: **every admin form label is
`className="eyebrow"`** (`entity-list.tsx:95,106`, `media-uploader.tsx:68,85,98,113`,
`bilingual-field.tsx:105,126`, `submissions/[id]/page.tsx:109,134`) — those are content, not
captions. Fix: darken to about `#6E6757` (4.6:1 on ground). One token.

**DS-003 · P1 — the global focus ring is 2.33:1 on paper, 1.88:1 on the page ground.**
`globals.css:91-94` — `outline: 2px solid gold-600` with `outline-offset: 2px`, which puts
the ring on the element's *background*. SC 1.4.11 needs 3:1. It clears 3:1 only against
`navy-700` (3.95) and `ink` (6.56) — i.e. only on the dark chrome. Fix: a two-tone ring, ink
outline plus gold halo, so it works on every ground.

**DS-004 · P1 — `rule` #D8D3C7 is 1.43:1 and is the only boundary on every input.**
As a decorative panel edge (57 `rule-edge` sites) 1.4.11 does not apply; as the boundary that
*identifies a form control* it does — `forms/fields.tsx:91`, `admin/controls.tsx:180`,
`bilingual-field.tsx:26`, `login-form.tsx:21`, `rich-text-editor.tsx:75`, `primitives.tsx:118`.
Root cause: one token serves two jobs with different requirements. Fix: add
`--color-rule-control: #97907F` (3.1:1) for controls only; the *weight* is unchanged, so the
three-weight system stays intact.

**DS-005 · P2** — `--text-display`, `--text-display-ar` and `--radius-none` are dead, while
the homepage `<h1>` reinvents the scale by eye: `page.tsx:63` `md:text-[3.25rem]
md:leading-[1.15]` — 52px, matching neither the 64px/1.06 Latin token nor the 38px/1.30
Arabic one, and applying Latin leading to Arabic display type.

**DS-006 · P2** — `w-[88px] h-[2px]` hand-reimplements `rule-mark` at
`programs/[slug]/page.tsx:79` and `cards.tsx:329`; note `w-`/`h-` are *physical*
(`width`/`height`) where the utility uses `inline-size`/`block-size`. Invisible to ESLint
because `eslint.config.mjs:44` exempts `[wh]-`.

**DS-007 · P2** — `accentToken` is `z.string().max(60)` (`validation/admin.ts:176`)
interpolated straight into a `var()` call inside an inline style (`cards.tsx:330`). A content
manager can set `--color-gold-600` and produce a gold **fill** on every programme card — the
one thing `CLAUDE.md` forbids absolutely. Not XSS (React writes via CSSOM); a design-integrity
breach reachable from the CMS. Fix: `z.enum` of the three sanctioned programme tokens.

**DS-008 · P2 — a fourth rule weight exists.** Sanctioned: 1px `rule`, 2px `ink`, 2px by 88px
`gold-600`. Actual, additionally: **1px gold** (`chrome.tsx:52`) and **2px gold as a button
underline** (`chrome.tsx:120`, `resources/page.tsx:61`, `primitives.tsx:120`). The last is
also the codebase's **only physical border property** — `border-b-2`, not `border-be-2` — and
`eslint` passes it, because `enforce-logical-properties` only rewrites the *inline* axis.

**DS-009 · P2** — three badge implementations (`py-1` vs `py-0.5`, three tone vocabularies)
and **eleven** hand-rolled buttons restating `bg-navy-700 … hover:bg-navy-900`. `Button` has
no `size` prop, which is why `px-5 py-2` (admin) and `px-6 py-3` (site) diverged. DS-001's fix
would otherwise have to be applied in three badge files.

**DS-010 · P2** — `ListSkeleton`, `ErrorState` and `dict.common.loading` have **zero call
sites**; there is no `loading.tsx` anywhere. Same as ARCH-008 / STATE-005 / NEXT-002.

**DS-011 · P3** — nine arbitrary values encoding real design decisions, chiefly
`max-w-[52rem]` used 5 times (the form measure) and the aspect ratios; plus `chrome.tsx:45`
restating `eyebrow`'s `letter-spacing: 0.16em` by hand because `eyebrow` hardcodes its colour.

**DS-012 · P3** — `/about` renders `target.value` raw (`about/page.tsx:125`) where
`MetricCard` renders the same numeric column through `formatNumber` (`cards.tsx:227`), so a
strategic target shows `25000.00` on one page and `25,000` on the other.

**DS-013 · P3** — hardcoded copy in six places, of which three are `WhatsApp` written inline
(`verify/page.tsx:93`, `contact/page.tsx:54`, `chrome.tsx:204`) when the channel row already
carries `platform`, plus `content-form.tsx:195` `label="عنوان SEO"`.

**CLEAN (T4):** zero raw hex / `rgb()` / `hsl()` in any `.ts`/`.tsx` — all 210 resolving
colour classes map to a `@theme` token · **zero `shadow-*` and zero `box-shadow`** · only four
`rounded-*`, all `rounded-full` on status pills, the one documented exception · every border
width is 1px or 2px, so no fourth *weight* (the fourth *meaning* is DS-008) · `gold-600` never
carries text on paper — its two sites are both on `bg-ink` at 6.56:1 · one CSS file, one
`@theme`, no `tailwind.config.*` · all 18 other token pairs clear AA (`ink`/`paper` 15.24,
`ink-55`/`paper-ground` 4.60, `prog-response`/`paper` 4.61) · light-only by design.

---

# T9 — ACCESSIBILITY / RESPONSIVE / RTL

**A11Y-001 · P1 — eleven invented logical-property class names compile to nothing.**
Tailwind v4 names the **block** axis `mbs`/`mbe`/`pbs`/`pbe`/`border-bs`/`border-be` — all
used correctly here — but names the **inline** axis `ms`/`me`/`ps`/`pe`/`border-s`/`border-e`/
`start`/`end`. Every `-is-`/`-ie-` form was generalised from the block-axis names and does not
exist.

`[VERIFIED-EXEC]` — I re-ran this against the project's own design system rather than accept
the report:

```
DEAD mis-1   DEAD mis-2   DEAD mis-3   DEAD mie-4   DEAD pis-4   DEAD pis-5
DEAD pis-6   DEAD border-is-2   DEAD border-ie   DEAD inset-inline-start-4   DEAD object-start
OK   ms-1  ->  .ms-1 { margin-inline-start: var(--spacing); }
OK   ps-6  ->  .ps-6 { padding-inline-start: calc(var(--spacing) * 6); }
OK   border-s-2 / border-e / start-4 / mbs-4 / mbe-6 / border-be / border-be-2 / sr-only
```

14 occurrences. What each one silently costs:

- `border-is-2 pis-5` — **every blockquote** in rich text (`rich-text.tsx:105`) and on
  `/impact` (`impact/page.tsx:66`) renders with no gold rule and no indent: indistinguishable
  from body text.
- `pis-6` — every `<ul>`/`<ol>` in rich text (`rich-text.tsx:86,93`) and the strategic
  objectives on `/about` (`about/page.tsx:109`) have zero inline padding, so the markers hang
  outside the content box — past the panel edge in RTL.
- `border-ie` — the admin sidebar (`shell.tsx:122`) has **no rule** separating it from content.
- `mis-1` — the required asterisk is flush against its label on all six public forms and every
  admin field (`fields.tsx:63,239`, `controls.tsx:200`, `bilingual-field.tsx:97`).
- `mis-2` / `mis-3` / `mie-4` / `object-start` — unspaced channels-bar label, unspaced
  file-input filename, centre-aligned partner logos.

Root cause: the author generalised a symmetric inline-axis set from Tailwind's real block-axis
names, and `better-tailwindcss/no-unregistered-classes` is **not enabled** in
`eslint.config.mjs:34-48` — only `enforce-logical-properties` and `no-conflicting-classes`
are, and both accept these strings because they *look* logical. Fix: the renames **and** the
lint rule; the rule is what stops it recurring.

**A11Y-002 · P1 — the skip link never becomes visible.** `skip-link` parks the element at
`inset-inline-start: -9999px` (`globals.css:157-162`) and `(site)/[locale]/layout.tsx:39`
reveals it with `focus:inset-inline-start-4` — one of the eleven dead classes. Its siblings
`focus:bg-paper` and `focus:p-4` compile, so on focus the link gains a background and 16px of
padding **9999px off-screen**. SC 2.4.7 fails on the first tab stop of every public page.
Fix: `focus:start-4`.

**A11Y-003 · P1 — `<html>` carries no `lang` and no `dir` on any public route.**
`src/app/layout.tsx:42` renders `<html suppressHydrationWarning>`; the locale lives on a
wrapper `<div>` at `(site)/[locale]/layout.tsx:34-38`. `<title>` is in `<head>`, outside that
wrapper, so screen readers announce every Arabic page title with an English voice. **SC 3.1.1,
Level A** — the lowest bar in WCAG. Root cause: a real Next constraint (the root layout cannot
see `params`) solved by moving the attributes down instead of making the root locale-aware.
*I confirmed this at runtime against `next start` — see `01-AUDIT-REPORT.md`.*

**A11Y-004 · P1 — nested `<html>`/`<body>`.** `(admin)/admin/layout.tsx:59` and
`(admin-auth)/admin/login/layout.tsx:33` each render their own `<html lang="ar" dir="rtl">`,
and the docstring at `(admin)/admin/layout.tsx:16` asserts "this is a **root layout**" — but
`src/app/layout.tsx` exists, and Next supports per-group root layouts only in its absence.
Root cause: multiple-root-layout syntax adopted without deleting the root that makes it
nested. *I confirmed the runtime consequence with `curl`: the admin loses `dir="rtl"`,
`lang="ar"` and its background — see `01-AUDIT-REPORT.md`.*

**A11Y-005 · P1 — `focus:outline-none` on every text control, in six files.**
`fields.tsx:92`, `controls.tsx:180`, `bilingual-field.tsx:26`, `login-form.tsx:21`,
`rich-text-editor.tsx:75`. The compiled rule is `.focus\:outline-none:focus { outline-style:
none }` — specificity 0-2-0 in `@layer utilities`, which beats the bare `:focus-visible`
(0-1-0) in `@layer base`, and `:focus-visible` is a subset of `:focus`, so **keyboard focus is
suppressed too**. The stated substitute is a 1px border *colour* change; combined with DS-004
(the unfocused border is 1.43:1) a field is barely visible in either state. The complaint form
is used by people reporting misconduct who cannot afford to type into the wrong box.

**A11Y-006 · P1 — errors are not programmatically associated on `<textarea>`, `<select>`,
`CheckboxGroup`, or anywhere in admin.** `FieldShell` renders the error with a predictable id
(`fields.tsx:81-85`) and only `TextField` (`:128-132`) and `FileField` (`:294-298`) consume
it. `TextArea` (`:163-171`) and `SelectField` (`:197-203`) set `aria-invalid` **and no
`aria-describedby`** — so the field announces as invalid with no reason, which is worse than
silence. `CheckboxGroup`'s error has no `id` at all. In admin, `ContentForm`'s textarea and
select branches render **no error element whatsoever**. SC 3.3.1 plus 1.3.1. Affected:
`message`, `description`, `experience`, `motivation`, `coverNote`, `enquiryType`, `category`,
`contactPreference`, `organizationType`, `ageBand`, `governorate`, `availability`, `channel`,
`interest`, `programs`, `areas`. Root cause: `FieldShell` centralised the *rendering* of
errors but left the *association* to each control, and only the first control written got it.

**A11Y-007 · P2 — Latin runs unisolated in the Arabic admin, including complainants' phone
numbers.** `<Bidi>` is used conscientiously on the public site (26 sites across 12 files) and
almost nowhere in admin or email. Worst case: `submissions/[id]/page.tsx:42-46,67-70` renders
**every submitted payload value** as a bare string in a `dir="rtl"` table — a staff member
reads a callback number off that page. Also the reference as `<h1>` (`:50-52`), the inbox
reference and purge-date columns, and every content slug. `column.numeric` is documented as
"Mono, LTR and narrow" (`controls.tsx:67`) but the implementation (`:106-111`) applies mono
and nowrap and **never sets `dir`** — fixing that one line fixes the slug, reference and date
columns at once. `mail/send.ts:98` puts the reference in the one artefact a complainant keeps.

**A11Y-008 · P2** — `<Bidi>` forces `dir="ltr"` onto Arabic-language dates. `formatDate('ar')`
returns `15 يناير 2026` — dominant direction RTL — and eight call sites wrap it in an LTR
isolate, so a period `يناير 2024 – ديسمبر 2026` places the *start* date leftmost, opposite the
reading order. `<Bidi>` already accepts `dir="rtl"`.

**A11Y-009 · P2** — `/verify`'s three-column table has **no `overflow-x-auto` wrapper**
(`verify/page.tsx:56-70`) where the admin's `DataTable` does (`controls.tsx:91`), and `grep`
for `break-words|break-all|wrap-anywhere|hyphens|truncate` across `src/` returns **zero**. An
overflowing `<table>` widens the whole document. This is the anti-impersonation page — the one
most likely to be opened on a cheap phone to compare a handle character by character.

**A11Y-010 · P2** — the admin shell has no responsive treatment at all: `w-64 shrink-0`
sidebar (`shell.tsx:122`) plus `p-8` main (`:167`), no `md:` variant anywhere. At 320px that
is 256 + 64 = **320px, leaving zero content width**; at 375px, 55px. Undeclared: nothing says
"desktop only", and the staff work in Gaza where a phone is often the only reliable device.

**A11Y-011 · P2** — the site header cannot wrap (`chrome.tsx:85`) and the logo has no
`min-w-0`/`truncate`, so a real-length `short_name_ar` alone can overflow. Nav items 4 to 8
scroll horizontally with no scrollbar, fade or snap. `a11y.openMenu`/`a11y.closeMenu` exist in
both dictionaries with **zero call sites** — the mobile menu was designed and dropped, for the
defensible reason documented at `chrome.tsx:93-98` (no-JS), but without the compensating
affordances a scroller needs.

**A11Y-012 · P2** — the TipTap editor has no accessible name: its label is an unassociated
`<p>` (`rich-text-editor.tsx:96-97`) and `editorProps.attributes` sets `dir`, `lang` and a
class but no `aria-labelledby` / `role` / `aria-multiline` (`:70-77`). Two render side by side
per field, so a screen-reader user hears two identical unnamed editable regions. SC 4.1.2.
Also: the toolbar has no `role="toolbar"`, and the link button uses `window.prompt` (`:123`),
which is unlocalised.

**A11Y-013 · P2** — two targets under 24 by 24 (SC 2.5.8), both in persistent chrome and both
the only route to their destination: the language switcher (`language-switcher.tsx:37`, about
23.2px, no padding) and the channels-bar `/verify` link (`chrome.tsx:52`, about 23.2px). The
24px spacing exception does not rescue them — the switcher sits `gap-4` from its neighbour.

**A11Y-014 · P3** — Arabic `alt` is served to English pages without `lang="ar"`. `pickCol`
(`_localize.ts:24-27`) coalesces `alt_en` to `alt_ar`, and `alt_ar` is mandatory at upload
while `alt_en` is not, so this is the *common* case on `/en/*`. SC 3.1.2. The codebase already
does this correctly for its own bilingual blocks in `not-found.tsx:17,29`.

**A11Y-015 · P3** — card lists are `<ul>`/`<li>` on five pages and bare `<div className="grid">`
on three (`news/page.tsx:52`, `page.tsx:94,123,138`, `programs/*`), because `Panel`'s `as` prop
lets each card pick its own element. List length is undiscoverable on exactly the paginated pages.

**A11Y-016 · P3** — live regions are conditionally *inserted* rather than pre-rendered
(`media-uploader.tsx:57-64` `role="status"`, `form-shell.tsx:55-59` `role="alert"`,
`fields.tsx:81-85`). Polite regions frequently do not announce on insertion;
`media-uploader.tsx:47` then calls `window.location.reload()` immediately, destroying the
region before any AT can read it.

**A11Y-017 · P3** — pagination renders one link per page with no windowing
(`projects/page.tsx:130`, `controls.tsx:158`). Semantics are correct (`aria-current`, per-link
labels); only the volume is wrong. 40 pages means 40 tab stops before the footer.

**CLEAN (T9):** the two linters catch **every** inline-axis physical utility — `ml-`, `mr-`,
`pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `border-l/r`, `rounded-l/r` all
return zero across `src/` · `globals.css` is fully logical · **bidirectional form inputs are
right** — `dir="ltr"` on email/url/tel (`fields.tsx:135`), on login email and password, and
`bilingual-field.tsx:112-113,141-142` sets `dir` **and** `lang` per side so the Arabic and
English inputs are correctly directional on the same row; this is the hardest bidi case in the
app · **numerals verified by execution** — `Intl.NumberFormat('ar-u-nu-latn').format(1234567)`
returns byte-identical ASCII to `en-GB`, calendar pinned Gregorian, timezone explicitly UTC ·
landmarks complete, exactly one `<h1>` per route across all 21 public files, `SectionHeading`
constrained to h1–h3 and `RichText` clamped to h2–h4 so an editor cannot inject a second
`<h1>` · zero `onClick` on a non-interactive element; all five are real `<button>`s ·
`prefers-reduced-motion` zeroes everything and the only motion in the codebase is
`transition-colors` · both tables use `scope="col"`, `/verify` has an `sr-only` caption · the
honeypot is correctly `aria-hidden` plus `tabIndex={-1}` and its `-inset-x-[9999px]` does
compile · **no icons exist at all** — zero `<svg>`, zero `lucide-react` imports — so the
directional-icon-flip requirement has nothing to violate (and `optimizePackageImports:
['lucide-react']` names a package that is not a dependency; see DUP-007).

**Blind spots in the linters, individually verified:** invented logical class names (A11Y-001,
no `no-unregistered-classes` rule) · block-axis physical properties (`border-b-2`,
`primitives.tsx:120`, passes ESLint) · inline `style={{}}` (2 sites) · the `[wh]-` ignore
exemption (`eslint.config.mjs:44`, which is what let DS-006 through) · HTML attributes
(`align="right"` in `mail/send.ts:71`) · DOM order (`ProjectFilterPanel` renders before its
results, so a mobile reader scrolls past the whole facet panel).

**Not covered:** no browser and no screenshots, so every rendered-pixel claim is either
derived from compiled CSS or marked `[ASSUMPTION]` — specifically the overflow thresholds
(A11Y-009/010/011), the glyph order of Arabic dates (A11Y-008), computed target heights
(A11Y-013) and AT announcement behaviour (A11Y-016). No axe or Lighthouse run.
