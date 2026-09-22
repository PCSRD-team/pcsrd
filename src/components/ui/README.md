# `src/components/ui` — the shared kit

Server Components unless stated. Radius 0, no shadow, three rule weights, gold as a
marking colour only, logical properties only, no copy of its own. Import from
`@/components/ui` (barrel) or the file; `primitives.tsx` and `states.tsx` are
compatibility re-exports and define nothing.

Every component takes `className` and applies it **last**, so a call site can override a
utility (`cn()` in `src/lib/utils.ts` is configured with the design tokens — see the
comment there for why that mattered).

`better-tailwindcss/no-restricted-classes` in `eslint.config.mjs` reports `rounded-*`,
`shadow-*`, `drop-shadow-*`, `blur-*`, `bg-gold-600/500` and `text-gold-600` at **warn**
until the call sites are migrated, then it becomes an error.

---

## Layout — `layout.tsx`

| Component | Purpose | Key props |
|---|---|---|
| `Container` | 1180px column with 64/20px gutters | `size: default \| narrow (760px) \| wide`, `as` |
| `Section` | A page section; `bounded` draws the 2px ink rule (a new record begins) | `bounded=true`, `tone: default \| alt \| inverse`, `spacing: default \| tight \| none`, `id`, `labelledBy` |
| `Stack` / `Cluster` / `Grid` | Block-axis rhythm / wrapping inline group / responsive grid | `gap` (token steps), `align`, `justify`, `cols: 1–4 \| sidebar` |
| `Rule` | One of the three weights, nothing else | `weight: edge \| section \| mark`, `as: hr \| div \| span` |
| `SectionHeading` | H2 + 88px gold mark (+ eyebrow, lead, actions) | `title`, `eyebrow`, `lead`, `as`, `id`, `actions` |
| `PageHeader` | The page's one `<h1>`: breadcrumbs → eyebrow → title + mark → meta → lede | `title`, `eyebrow`, `lede`, `breadcrumbs`, `meta`, `actions`, `as` |

**RTL** — nothing here sets `dir`; everything is inline-start/inline-end.
**A11y** — pass `labelledBy` to `Section` with the heading's `id`; `Rule` as `hr` is a
separator, as `span`/`div` it is `aria-hidden`.
**Not for** — `PageHeader` anywhere but once per page. `Rule` with a fourth meaning: if
you need a colour prop, you want `Card accent` or a `Notice`, not a rule.

## Typography — `typography.tsx`, `bidi.tsx`

| Component | Purpose |
|---|---|
| `Eyebrow` | Mono, tracked, uppercase label above a heading (`as: p \| span \| div \| dt`) |
| `Lede` | 18px introduction, 52ch |
| `Prose` | Text column at `measure: default (68ch) \| reading (74ch) \| lead (52ch)` |
| `Heading` | `level` (outline) and `size` (visual) are separate |
| `Caption`, `Meta` | Secondary text; mono meta line |
| `Bidi`, `Code`, `DateText` | Isolate Latin/numeric runs in Arabic; a code in mono; a formatted date in the locale's own direction (not LTR — see the comment) |

**RTL** — wrap every phone, email, URL, licence number, ID and version in `Bidi`/`Code`.
Wrap formatted dates in `DateText`, not `Bidi`.
**Not for** — `Eyebrow` as a heading: it labels the heading that follows.

## Actions — `button.tsx`, `submit-button.tsx` (client), `icon.tsx`, `link-pending.tsx` (client)

| Component | Purpose | Key props |
|---|---|---|
| `Button` | `<button>`; spreads native props | `tone: primary \| secondary \| quiet \| danger \| marked`, `size: sm \| md \| lg`, `loading` |
| `ButtonLink` | `next/link` or `<a>` styled as a button | `href`, `external`, `download`, `pendingMark`, `ariaLabel`, `ariaCurrent` |
| `IconButton` / `IconLink` | Square, icon-only; `label` is the accessible name (required) | |
| `buttonClasses()` | The class string for a `<summary>` or `<label>` that must look like a button | |
| `SubmitButton` | **Client** — `useFormStatus()` swaps `label` → `pendingLabel` and disables; plain submit without JS | `label`, `pendingLabel`, `name`, `value`, `formAction` |
| `Icon` | Inline SVG, `aria-hidden`; `chevron`/`arrow` flip in RTL | `name`, `size: 16 \| 20 \| 24` |
| `IconSlot` | 20px slot beside a label | |

Older tone names (`outline`, `ghost`, `destructive`) still resolve. Every size keeps the
44px target. Hover darkens the ground; no lift, no scale. Focus is the global ring.
**Not for** — gold fills. `marked` is the only gold tone and it is a rule under the label.

## Data display — `card.tsx`, `badge.tsx`, `definition-list.tsx`, `table.tsx`, `stat.tsx`, `figure.tsx`

| Component | Purpose | Key props |
|---|---|---|
| `Panel` | Paper surface, 1px edge | `tone: paper \| alt \| gold \| navy \| white`, `padding`, `as`, `role`, `labelledBy` |
| `Card` (+ `CardMedia`, `CardBody`, `CardFooter`) | A record in a list; `accent` = 2px block-start rule in the programme colour via `--accent` | `accent` (CSS colour), `interactive`, `tone`, `padding`, `as` |
| `RuledList` / `RuledListItem` | Rows separated by the 1px rule (404 links, channels) | `bounded` |
| `Badge` | Square mono chip; state is in the words | `tone: neutral \| active \| complete \| planned \| verified \| success \| warning \| danger \| info \| accent`, `dot`, `accent` |
| `StatusBadge` | `content_status` → tone; `label` from the dictionary | `status`, `label` |
| `VerificationBadge` | `verified \| reported \| target` | `status`, `label` |
| `DefinitionList` | Identity record; drops empty values | `items[{term, value}]`, `layout: grid \| stack \| ruled` |
| `Table` | Ruled table in an `overflow-x-auto` scroller; **`caption` required**; `numeric` columns are mono + `dir="ltr"` + end-aligned; first cell carries `rowHref` | `columns[{key, header, cell, numeric, align, rowHeader}]`, `rows`, `empty`, `rowHref`, `rowKey`, `captionHidden` |
| `TableScroller`, `TimeCell` | For hand-written tables; a `<time>` cell | |
| `Stat` (`MetricTile`) | Figure locked to `period` and `verification`; **renders nothing** if either is empty (`canRenderStat`) | `value` (pre-formatted), `unit`, `label`, `period{start,end,label}`, `verification{status,label,source}`, `prefix`, `locale` |
| `StatGroup` | Grid of `Stat`s (`as="li"`) | |
| `Figure` | `next/image` + `<figcaption>` (caption, credit); **`sizes` required**; designed no-image state | `image{src,width,height,blurDataURL} \| null`, `alt`, `decorative`, `ratio`, `preload`, `fallbackLabel` |
| `NoImage`, `Avatar`, `LogoTile` | Fallback frame; initials fallback; logo or name-in-type fallback | |

**RTL** — logos and photographs never flip. `Table` numeric cells isolate themselves.
**A11y** — `Table` needs a caption; `Stat` puts period and status in the DOM as text;
`Avatar` without an image still has an `sr-only` name.
**Not for** — `Card` around prose or a whole section. `Panel` as a hover target. `Stat`
with a formatted-in-component number: format at the call site with `formatNumber`.

## Feedback & states — `notice.tsx`, `feedback.tsx`, `skeleton.tsx`

| Component | Purpose | Live semantics |
|---|---|---|
| `Notice` (`Alert`) | Inline notice, 2px inline-start accent + glyph + tint; `tone: info \| success \| warning \| danger` | `danger` → `role="alert"`; others `role="status"`; `live="off"` for static content |
| `LiveRegion` | Always-rendered polite/assertive region for form results | |
| `EmptyState` | Nothing here; `title`, `body`, `action`, `footnote`, `bounded` | none |
| `ErrorState` | Our fault; 2px destructive rule, `reference` in mono LTR | none (the page decides) |
| `UntranslatedNotice` | English route, Arabic-only record; `action` slot for the link to the original | off |
| `SubmissionReceipt` | Reference number set large and LTR | `role="status"` |
| `SkeletonBlock`, `SkeletonText`, `ListSkeleton`, `CardGridSkeleton`, `TableSkeleton`, `StatGroupSkeleton`, `FormSkeleton`, `PageHeaderSkeleton`, `ListPageSkeleton`, `DetailPageSkeleton`, `AdminPageSkeleton` | Rule-matched loading states; `aria-hidden` inside `aria-busy` | |

**Not for** — skeletons with text (no locale in `loading.tsx`). `Notice` as a page header.

## Forms — `field.tsx`, `inputs.tsx`

Contract: three ids from `name` — `name`, `name-hint`, `name-error`. `Field`/`Fieldset`
render label, hint and error; the control derives `id`, `aria-invalid`, `aria-describedby`
from the same `name`/`hint`/`error`. Pass `hint` and `error` to **both**.

| Component | Purpose | Key props |
|---|---|---|
| `Field` | Label + hint + control + error | `name`, `label`, `hint`, `error: string \| string[]`, `required`, `optionalLabel` |
| `Fieldset` / `Legend` | Group with legend, hint, group error | same as `Field` + `disabled` |
| `FieldError`, `FieldHint`, `RequiredMark` | The parts, for custom layouts | |
| `FormStack`, `FieldRow`, `FormActions` | Form rhythm; two-up row; actions row with the 1px rule | |
| `Input` | Native input; `email/url/tel/number/password` are `dir="ltr"` + `text-start` | spreads native props; `hint`, `error` |
| `Textarea` | | `rows=6` |
| `Select` | Native select; `placeholder` disabled first option; `multiple` shows ≤6 rows | `options[{value,label,disabled}]` |
| `Checkbox` | One box with its label beside it | `label`, `hint`, `error`, `id` |
| `CheckboxGroup` / `RadioGroup` | Options under a `Fieldset` | `legend`, `options`, `defaultValue`, `columns: 1 \| 2` |
| `FileInput` | Native file input, LTR | `accept` |
| `Honeypot` | Hidden from viewport and a11y tree | `name` |
| `describedBy(name, hint?, error?)`, `errorText(error)` | The helpers both existing field modules already have | |

**No JS** — all native; `SubmitButton` is the only client component and degrades to a
plain submit.
**Not for** — controlled inputs (`value` + `onChange`) inside a Server Component; use
`defaultValue`.

## Overlay — `dialog.tsx` (client)

| Export | Use | Key props |
|---|---|---|
| `Dialog` | The modal surface: backdrop, scroll container, stacking context, named heading | `title`, `titleId` (both required), `description`, `close`, `onDismiss`, `size: 'sm' \| 'md' \| 'lg'` |
| `DialogBody` | A block under the heading, at the kit's rhythm | |

`title` is required because it is also the accessible name, and it is the one
thing a hand-rolled modal forgets. `titleId` is the caller's so two dialogs on a
page cannot collide.

**Focus is the component's, not the caller's.** `Dialog` moves focus in on
open, cycles Tab and Shift+Tab within itself, pulls stray focus back, closes on
Escape when `onDismiss` is given, and returns focus to whatever was focused
before it opened. This used to be documented as the caller's job; the one caller
implemented Escape and nothing else, so with `aria-modal="true"` set a screen
reader confined its cursor to the dialog while the keyboard stayed on the
trigger behind it. **Do not re-add an Escape listener in a caller** — there would
then be two.

**Why this file is `'use client'`** — the kit's one standing exception besides
`submit-button.tsx` and `link-pending.tsx`. A focus trap needs a ref, a keydown
listener and a restore-on-close. A modal is never server-only in any case:
something has to open and close it.

**No `<dialog>` element** — `showModal()` is script, and a `<dialog>` rendered
without it is inert and closed, so the content would simply not appear.


## Navigation — `breadcrumbs.tsx`, `pagination.tsx` (+ `pagination-model.ts`), `tabs.tsx`, `skip-link.tsx`

| Component | Purpose | Key props |
|---|---|---|
| `Breadcrumbs` | `<nav aria-label>` + `<ol>`; last item is `aria-current="page"`; `jsonLd` slot for `<BreadcrumbJsonLd>`; `toBreadcrumbList(items, origin)` builds the schema.org object from the same items | `items[{label, href?}]`, `label` |
| `Pagination` | Windowed; `rel="prev/next"`; current page is text; every target is a real link | `page`, `totalPages`, `hrefFor`, `label`, `previousLabel`, `nextLabel`, `pageLabel` |
| `paginationModel()`, `paginationRels()` | The pure model; the `<link rel>` hrefs for `generateMetadata` | |
| `Tabs` | Links, not ARIA tabs — `<nav aria-label>`, `aria-current`; counts in mono | `items[{label, href, current, count}]`, `label` |
| `SkipLink` | First focusable element; `href="#main"` | `label` |

**RTL** — chevrons flip; "previous" points backwards in both directions.
**Not for** — `Tabs` for in-page state without a URL (that is a client concern with real
`tablist` semantics, and it is not in this kit on purpose).

---

## Migration guide

### `src/components/forms/fields.tsx` (public)

Keep `FormDict`, `resolveKey` and `OptionLabels` — they are the dictionary layer. The
components become thin wrappers that resolve keys, then delegate:

| Today | Tomorrow |
|---|---|
| `FieldShell` | `Field` from the kit, with `error={messages.map(k => resolveKey(dict, k))}` and `optionalLabel={dict.common.optional}` |
| `describedBy(name, hint, errors)` | `describedBy(name, hint, errors?.[name])` from `@/components/ui/field` (same signature; empty arrays now count as absent) |
| `controlClass` (`rounded-xl`, `focus:shadow-[…]`) | delete — `Input`/`Textarea`/`Select` wear the `control` utility |
| `TextField` | `<Field …><Input name type hint error={resolved} … /></Field>` |
| `TextArea` | `<Field …><Textarea … /></Field>` |
| `SelectField` | `<Field …><Select options placeholder="—" … /></Field>` |
| `CheckboxGroup` | `CheckboxGroup` from the kit (`legend`, `options`, `error={resolved}`, `required`) |
| `FileField` | `<Field …><FileInput accept … /></Field>` |
| `Honeypot` | `Honeypot` from the kit (`name="website"` is the default) |
| `SubmissionReceipt` | `SubmissionReceipt` from the kit with `title={dict.forms.successWithReference}` and `body={dict.forms.keepReference}` |
| the submit button in each form | `SubmitButton label pendingLabel` |
| the result region | `LiveRegion` (always rendered) with a `Notice tone="danger"` inside on failure |

Errors change colour from `gold-700` to `destructive` and gain a glyph — that is the
design (`04-DESIGN-SYSTEM §3.5 FieldError: icon + text; never colour alone`).

### `src/components/admin/controls.tsx` (admin)

| Today | Tomorrow |
|---|---|
| `STATUS_LABEL` | keep — it is the admin's Arabic copy |
| `STATUS_TONE` + `StatusBadge` (pill + shadow) | `StatusBadge status label={STATUS_LABEL[status]}` from the kit |
| `TranslationBadge` | `<Badge tone="warning">ترجمة ناقصة</Badge>` |
| `Column<T>`, `DataTable` (`rounded-2xl`, shadows, `bg-white/90`) | `Table` — same `rows`, `columns`, `empty`, `rowHref`; add `caption` (the list's heading, `captionHidden`) |
| `TimeCell({ value })` | `<TimeCell dateTime={value.toISOString()}>{formatDate(value, 'ar', …)}</TimeCell>` |
| `Pagination({ page, totalPages, hrefFor })` | `Pagination` + `label="ترقيم الصفحات"`, `previousLabel`, `nextLabel` |
| `inputClass` (`rounded-xl`, `focus:shadow-[…]`, `bg-white`) | delete — controls wear `control` |
| `fieldDescribedBy(name, hint, error)` | `describedBy` from the kit (identical signature) |
| `Field` (`rounded-xl bg-white/55 p-3`) | `Field` from the kit — same props, minus the tinted box |
| `EnumSelect` | `<Field …><Select options multiple placeholder="—" … /></Field>` |
| `CheckboxField` | `Checkbox` from the kit (`label`, `hint`, `defaultChecked`) |
| `PublishBar` (`rounded-2xl`, `shadow-[…]`, `backdrop-blur`) | keep the component (it owns capability logic) but rebuild its surface as `Panel tone="paper" padding="sm"` with `sticky inset-be-0`, and its buttons as `SubmitButton`/`Button` with `name="status" value="…"`, `tone="secondary"` for draft/review, `primary` for publish, `danger` for archive |

The only rule to remember when migrating: **a control receives the same `hint`/`error`
its `Field` renders**, and nothing else has to be wired.
