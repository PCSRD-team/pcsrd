# Tracks T8 / T10 / T11 / T12 — Performance · SEO · States · Operations (raw findings)

Working file. Merged into `01-AUDIT-REPORT.md`.

## Verification note — two P1 claims independently proven by me

**OPS-002 upgraded to [VERIFIED-EXEC].** Simulated CI conditions locally:

```
$ env -u NEXT_PUBLIC_SITE_URL SKIP_ENV_VALIDATION=1 npx tsx _probe.ts
TypeError … at src/app/robots.ts:4:45
```

`src/app/robots.ts:4` and `src/app/sitemap.ts:19` both call
`publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')` **at module scope**. Under
`SKIP_ENV_VALIDATION=1`, `env.public.ts:38` returns the raw `source` object, so the value
is `undefined` and `.replace` throws. The local build succeeds **only** because Next loads
`.env.local`; CI has no such file.

**OPS-003 independently confirmed by me before the track reported it.**
`drizzle/meta/_journal.json` names `0001_triggers_rls`; the file on disk is
`0001_app_runtime_layer.sql`, and `0002_runtime_grants.sql` has **no journal entry at all**.
`drizzle-kit check` passes because it validates snapshots, not journal-to-file
correspondence, and `tests/setup/pglite.ts:35` globs `*.sql` and ignores the journal — so
neither gate catches it.

---

# T8 — PERFORMANCE

**PERF-001 · P1 · [VERIFIED-EXEC]** — The whole Zod runtime plus its 53 locale packs ships to
the browser on five public routes: 297.7 KB raw / **69.9 KB gzip**. Chunk
`2a-fqdzr22uvu.js` contains 1,112 `zod` markers and 43,356 Arabic characters — one copy of
every message table in `node_modules/zod/v4/locales/`. Two independent paths pull it in:
`src/components/forms/public-forms.tsx:11-22` imports option arrays from
`src/lib/validation/forms.ts:1`, which constructs all six schemas at module scope; and
`src/components/forms/turnstile.tsx:4` imports `@/lib/env.public`, which runs a module-scope
`safeParse` (`env.public.ts:52`). Loaded by `careers/[slug]`, `contact`,
`get-involved/partner`, `get-involved/volunteer`, `verify` — 10 URLs across both locales.
**Nothing on the client ever calls a Zod schema.** Fix: extract the option arrays into a
zod-free `option-values.ts`; pass `siteKey` to `Turnstile` as a prop from the server page;
add an ESLint `no-restricted-imports` ban on `zod` inside `src/components/**`. Effort M.

**PERF-002 · P1 · [VERIFIED-EXEC]** — 221.9 KB of woff2 is `rel=preload`-ed on all 19 site
routes — **85% over the 120 KB budget** — and three of the seven declared weights are
provably unused. `src/app/layout.tsx:19-31` declares Arabic 400/500/600/700 and Mono
400/500/600; `.next/server/next-font-manifest.json` maps every `(site)` route to the same 11
files totalling 227,176 bytes, and `grep -c 'rel="preload".*as="font"'` on a built page
returns 11. `grep -ro "font-bold" src | wc -l` → **0** (weight 700 dead, ~51 KB), and no
`font-mono` element carries a weight class while `globals.css:146-153` sets no
`font-weight`, so Mono 500/600 are unreachable (~20 KB). `(admin)/admin/layout.tsx:32-44`
declares the identical seven a second time. The LCP element on `/ar` is the `<h1>` at
`page.tsx:63` in Arabic 600, queuing behind ~180 KB it does not need. Fix: drop `'700'` and
Mono `'500','600'`, add `preload: false` to Mono. Lands at ~122 KB, zero visual change.
Effort S.

**PERF-003 · P2 · [VERIFIED-EXEC]** — TipTap/ProseMirror is 392.2 KB raw / **125.4 KB gzip**
(`1wt0r15ok22f3.js`, 34 tiptap + 57 prosemirror markers), statically imported by
`content-form.tsx:13` and `project-form.tsx:13`. `grep -rn "next/dynamic" src` → **no
matches anywhere**. Correctly contained — referenced by admin editor manifests only, zero
`(site)` routes — but every editor waits on it, and `project-form.tsx:207-228` mounts six
instances. Fix: `next/dynamic({ ssr: false })`; safe because `rich-text-editor.tsx:52`
already sets `immediatelyRender: false` and the hidden input at `:141` carries the value
pre-mount. Effort S. *(Same defect as NEXT-013.)*

**PERF-004 · P2 · [VERIFIED-CODE]** — Every admin render performs **two** Supabase
`auth.getUser()` HTTP calls and two `profiles` queries, because `getCurrentProfile` and
`getCurrentProfileDetail` (`session.ts:17-21`, `:39-43`) are separately `cache()`-wrapped —
React dedupes each function, not across two. `/admin` additionally runs the six-query
dashboard batch twice: `layout.tsx:50` and `page.tsx:36`, since `getDashboard`
(`admin/index.ts:125`) is not memoised. Fix: collapse to one `cache()`d profile function;
wrap `getDashboard` in `cache()`; split cheap nav badges from the full batch. Effort M.

**PERF-005 · P2 · [VERIFIED-CODE]** — `src/components/content/cards.tsx:37-45` passes no
`preload`, so every list card image is `loading="lazy"` — including the LCP element on
`/ar`, `/news` and `/projects`, both of which are already dynamic. The detail routes do it
correctly (`projects/[slug]:102`, `news/[slug]:102` use Next 16's `preload`). Fix: optional
`preload` prop threaded to `index === 0` at each call site. Effort S.

**PERF-006 · P2 · [VERIFIED-CODE]** — `about/page.tsx:158-167` and `partners/page.tsx:64-70`
render images with no `placeholder`/`blurDataURL`, though `content.ts:457` selects
`photoBlur` and pays for it. `cards.tsx:42-43` does it correctly. Up to ~30 empty frames
each on the two pages a donor uses to judge whether the organisation is real. Effort S.

**PERF-007 · P2 · [VERIFIED-EXEC]** — Same as NEXT-001: three slugged routes lack
`generateStaticParams`. Fix jointly with SEO-005 — one set of slug queries serves both.

**PERF-008 · P2 · [VERIFIED-CODE]** — `chrome.tsx:114-117` gives the language switcher an
**empty** `<span>` as its Suspense fallback while the label string is already in hand
server-side. Zero-width → labelled link is a layout shift in a `flex gap-4` row on every
route in both locales, and in RTL it pushes the adjacent CTA. Fix: render `{label}` in the
fallback — only the *href* needs the client hooks. Also fixes NEXT-014's no-JS visibility.
Effort S.

**PERF-009 · P3 · [VERIFIED-CODE]** — Two dead `next.config.ts` entries:
`optimizePackageImports: ['lucide-react']` (`:70-71`) names a package that is not a
dependency, and the `/fonts/:path*` cache header (`:90-95`) targets a route that does not
exist — `next/font/google` serves from `/_next/static/media/`. Effort S.

**CLEAN (T8):** TipTap containment verified against client-reference manifests — zero
`(site)` routes · all 19 `(site)` pages batch with `Promise.all`, no waterfalls · barrel
tree-shaking verified empirically by probing chunks for known-unique Arabic strings · all
five `next/image` sites use `fill` inside a fixed-ratio container with explicit `sizes` ·
`_cache.ts:21-31` constructs `unstable_cache` per invocation with a key-sorting serialiser ·
dictionaries dynamically imported per locale · all five baseline chunks attributed (392 KB
TipTap, 298 KB zod, 222+132 KB framework baseline, 110 KB `nomodule` polyfills).

---

# T10 — SEO & METADATA

**SEO-001 · P1 · [VERIFIED-EXEC]** — No `metadataBase` anywhere, so all 18
`generateMetadata` emit **relative** canonical and hreflang URLs. Built output:
`<link rel="canonical" href="/en/about"/><link rel="alternate" hrefLang="ar" href="/ar/about"/>`.
Google discards relative hreflang entirely, so the ar↔en pairing is invisible. Fix:
`metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL)`. **Blocked by OPS-002** —
`new URL(undefined)` throws. Effort S.

**SEO-002 · P1 · [VERIFIED-EXEC]** — `x-default` absent from every route and the sitemap
(count 0 across 30 prerendered files). Effort M.

**SEO-003 · P1 · [VERIFIED-CODE]** — **The untranslated rule is not implemented in
metadata.** Same finding as NEXT-011, in all six detail routes. Every `ar_only` record ships
an indexable `/en/` URL declaring itself the English alternate while containing Arabic
text — which can demote *both* members of the pair, and it fires on most records given the
Arabic-complete launch plan. Effort M.

**SEO-004 · P1 · [VERIFIED-EXEC]** — `sitemap.ts:35-37` advertises `/legal/privacy`,
`/legal/accessibility`, `/legal/terms`; `.next/server/app/ar/legal/privacy.meta` records
`"status": 404`. Six advertised 404s and **no reachable privacy policy** on a site
collecting complaint and job-application data. Effort M. *(= OPS-005.)*

**SEO-005 · P1 · [VERIFIED-CODE]** — Sitemap omits every news post, impact story and
vacancy. The same three families are also not prerendered (PERF-007), so deep articles may
never be crawled and `JobPosting` never reaches Google Jobs. Effort M.

**SEO-006 · P1 · [VERIFIED-CODE]** — The CMS `redirects` table is **never applied**.
`src/db/schema/redirects.ts:9-13` says it is read at build time by `next.config.ts`
`redirects()`; that key does not exist, and `proxy.ts` does not consult it either.
`admin/redirects/page.tsx:8-13` tells editors it takes effect on the next deploy. Every
migrated legacy URL 404s at domain cutover. Effort M. *(= OPS-009; independently observed
by T7.)*

**SEO-007 · P2 · [VERIFIED-EXEC]** — **Zero Open Graph and zero Twitter tags site-wide**
(count 0 on all 30 prerendered pages). No `opengraph-image.*`. Worse: `ogMediaId`
(`_shared.ts:55`) is offered in the admin forms and written by the services but **selected
by no query and read by no `generateMetadata`** — editors upload a card image that is
silently discarded. Every WhatsApp share renders as a bare link, on a site whose stated
threat model is impersonation. Effort L.

**SEO-008 · P2 · [VERIFIED-CODE]** — `sitemap.ts:62-67` gives the **Arabic** slug as the
English alternate for every programme, because `listPrograms('ar')` collapses to one
locale-resolved `slug`. `/en/programs/<arabic-slug>` 404s. The adjacent projects block is
correct. Effort S.

**SEO-009 · P2 · [VERIFIED-CODE]** — `/news` and `/projects` canonicalise every paginated
page to page 1 (`projects/page.tsx:16-29` never reads `searchParams` for the canonical while
`:130-134` renders crawlable links to every page). Google reads that as a de-indexing
instruction. Effort M.

**SEO-010 · P2 · [VERIFIED-EXEC]** — Ten prerendered routes ship no meta description: both
`about`, both `contact`, both `get-involved/*`, all six `legal/*`. Effort S.

**SEO-011 · P2 · [VERIFIED-EXEC]** — `/en/get-involved/volunteer` has
`<title>Why you want to volunteer — PCSRD</title>` — `volunteer/page.tsx:18` uses
`dict.forms.motivation` because `nav` has no `volunteer` key. The highest-weight on-page
signal on the volunteer recruitment page is a form-field label. Effort S.

**SEO-012 · P1 · [VERIFIED-EXEC]** — The built homepage title is literally
`<title>TODO(org): الاسم القانوني بالعربية — PCSRD</title>`, and the same placeholder is the
RSS channel title and the `schema.org/NGO` name. The only guard is a `console.warn` at
`scripts/seed.ts:142`. Fix: a pre-deploy check failing on `^TODO\(org\)` in any
`organization_settings` text column — never a runtime fallback, which would hide that launch
data was never entered. **Blocked by STATE-006: no admin screen exists in which to replace
these values.** Effort S.

**SEO-013 · P2** — `programs/[slug]/page.tsx:38` never reads `seoTitleEn`; an editor's
English SEO title is stored and discarded. **SEO-014 · P2** — `legal/[slug]:30-36` ignores
`seoTitle*`, `seoDescription*` and **`noIndex`**, all already loaded, so "prevent indexing"
is silently not obeyed. **SEO-015 · P2** — `careers/[slug]:49-57` passes `vacancy.location`
as the JobPosting `description`; a one-word description fails Rich Results and is a
manual-action risk. **SEO-016 · P3** — `NewsArticle` omits `image`/`author`/`dateModified`;
the `NGO` node omits `logo`, the knowledge-panel field most valuable to an
anti-impersonation NGO. **SEO-017 · P3** — `BreadcrumbJsonLd` has zero importers.
**SEO-018 · P3** — contradictory `robots` pair on every 404. **SEO-019 · P3** — `robots.ts:19`
emits `Host: http://localhost:3000`; `Host` takes a bare hostname. **SEO-020 · P3** —
publication sitemap entries are `#fragment` URLs that normalise to duplicates; 16 static
paths carry no `lastModified`. **SEO-021 · P3** — every `<loc>` is `/ar`; English exists only
as an alternate. **SEO-022 · P3** — `layout.tsx:34-36` hard-codes `'%s — PCSRD'`, but the
acronym is an `organization_settings` field — a CLAUDE.md rule-6 violation, and it appends
an unisolated Latin run to every Arabic title. **SEO-023 · P3** — no manifest, no icons, no
`theme-color`; RSS autodiscovery declared on `/news` only.

**CLEAN (SEO):** `notFound()` on all six slug routes verified as real 404s via `.meta`
status records · 404 noindex present · trailing-slash consistency · robots.txt disallow vs
sitemap contents consistent · `feed.xml` well-formed RSS 2.0 with `atom:self`, absolute
URLs, RFC-822 dates and an `escapeXml` that escapes `&` first · JSON-LD injection-safe · no
invented organisation facts in structured data, `sameAs` filtered to `is_official`, address
gated on the opt-in · proxy locale routing correct.

---

# T11 — ERROR HANDLING, STATES & OBSERVABILITY

**STATE-001 · P1 · [VERIFIED-CODE]** — The most likely production failure — the database
being unreachable — renders Next's **unstyled English** error page on every public route,
because the only boundary sits *below* the layout that fetches.
`(site)/[locale]/layout.tsx:31` awaits `getDictionary` + `getOrganization`; an `error.tsx`
catches its segment's children, never its own sibling layout. No `global-error.tsx` exists.
Fix: `src/app/global-error.tsx` rendering its own `<html>`/`<body>`, importing **nothing** —
a boundary that fetches can fail the same way the page did. Effort S.

**STATE-002 · P1 · [VERIFIED-CODE]** — The whole `(admin)` group — 28 `force-dynamic` pages
— has **no `error.tsx`, no `loading.tsx`, no `not-found.tsx`**. Eight `[id]` pages call
`notFound()` with nothing to render it. `layout.tsx:47-51` runs `requireAuth()` and
`getDashboard()` in a root layout, catchable only by the `global-error.tsx` that does not
exist. Staff meet every CMS failure as an unstyled English LTR page inside an Arabic RTL
tool, with no retry and no navigation. Effort S.

**STATE-003 · P1 · [VERIFIED-CODE]** — `/admin/users` uses `assertCan` (which **throws**)
where it should use `requireRole` (which redirects), contradicting `guard.ts:14-17`'s own
stated doctrine. Combined with STATE-002, a routine permission boundary is presented to
staff as a crash. Fix: `requireRole(['admin'])`. Effort S.

**STATE-004 · P2** — `guard.ts:26-37` redirects to `/admin?error=forbidden`; `admin/page.tsx:34`
takes no props and never reads `searchParams`, so the parameter is inert and the user is
silently bounced. The `?saved=1` equivalent *is* handled in seven detail routes. Effort S.

**STATE-005 · P1 · [VERIFIED-CODE]** — There is no `loading.tsx` anywhere, and
`ListSkeleton` (`states.tsx:66-84`) — written to the design handoff for exactly this — has
**zero importers**. Of the four required states, loading is the only one with zero coverage
app-wide, against CLAUDE.md non-negotiable 10. Three files cover every dynamic surface.
Effort S.

**STATE-006 · P1 · [VERIFIED-EXEC]** — **Nine Server Actions have no caller.** `savePartnerForm`,
`savePersonForm`, `saveMetricForm`, `removePartner`, `removePerson`, `removeMetric`,
`saveMediaMetadata`, `removeMedia`, `saveOrganization` — each verified to have no importer
in `src/**/*.tsx`. Partners, people, impact metrics, media metadata and
`organization_settings` **cannot be created or edited through the CMS at all**: the five
list screens have no `new` route, no `[id]` route and no row actions. This is the mechanism
SEO-012 depends on — the `TODO(org):` placeholders are in the homepage title and there is no
screen in which to replace them. Media alt text cannot be corrected on a site whose rules
forbid publishing media without `alt_ar`. Fix: five form screens reusing the existing
`ContentForm`; actions, services, validation and cache tags all already exist and are
tested, so this is UI wiring. Effort M.

**STATE-007 · P2** — `ContentForm` shows "تحقّق من الحقول المميّزة" for *every* failure
including ones with no field errors (`content-form.tsx:66-70` discards `state.code` and
`state.messageKey`), and four of its seven field kinds never call `firstError`. An editor
who trips the consent gate is told to check highlighted fields with nothing highlighted.
Effort S.

**STATE-008 · P2** — `media-uploader.tsx:29-50` has `try`/`finally` with **no `catch`**; a
platform 413 returns non-JSON so `response.json()` throws into an admin boundary that does
not exist, losing the alt text, consent status and minors flag the editor just typed.
Effort S.

**STATE-009 · P2** — Three actions redirect with `?saved=1` to list pages that never render
a saved banner. Latent until STATE-006 lands. Effort S.

**STATE-010 · P2** — `(site)/[locale]/error.tsx:14` discards the `error` prop, so
`error.digest` is neither shown nor logged — with no Sentry, it is the only correlator back
to the server log, dropped at the one place it is available. Effort S. *(= NEXT-017.)*

**STATE-011 · P2 · [VERIFIED-CODE]** — Four failure paths swallow their error with no log.
Worst: `turnstile.ts:21-33` — fail-closed is correct, but a Cloudflare incident or an
8-second timeout then rejects **all six public forms** indefinitely with nothing in any log.
The organisation's only inbound channel goes dark and the first signal is a phone call. Also
`health/route.ts:11-14`, `media/route.ts:57-62` (discards the Supabase error object),
`upload.ts:100-102`. Fix: log in the leaf, keep the returned value identical. Effort S.

**STATE-012 · P3** — `ErrorState` is designed, exported and used by nothing (11 call sites
for `EmptyState`, 6 for `UntranslatedNotice`, 0 for `ErrorState`). **STATE-013 · P3** —
`media-uploader.tsx:57-64` announces failures through `role="status"` (polite) rather than
`role="alert"`; every other error surface in the codebase gets this right.

**CLEAN (T11):** public form UX covers all four states — `useActionState` pending, disabled
submit blocking double-submit, `role="alert"` banner resolved from the dictionary, field
errors, and `SubmissionReceipt` on success; progressive enhancement holds · public form a11y
— `aria-invalid` + `aria-describedby` + `role="alert"` on every field, honeypot correctly
`tabIndex={-1}` · `ActionResult` contract uniform across all five action modules, no
hand-rolled `{ok:false}` outside `errors.ts`, `redirect()` correctly outside `runAction` ·
all 11 `(site)` lists render `EmptyState`, all 6 detail routes render `UntranslatedNotice`,
every admin table supplies `DataTable`'s required `empty` prop · two catch-and-continue
sites are correct and documented · 404 handling on all six public detail routes.

---

# T12 — RELEASE READINESS & OPERATIONS

**OPS-001 · P1 · [VERIFIED-EXEC]** — `ci.yml:72-77` runs `npx tsx scripts/assert-rls.ts`;
`git log --all --name-only -- scripts/` shows it was **never committed**. Every push to
`main` fails, and the only automated check of the authorisation layer has never executed.
The job's own comment ("zero policies") also contradicts the 85 that exist. Effort M.

**OPS-002 · P1 · [VERIFIED-EXEC by me]** — **The CI Build step cannot succeed.** See the
verification note above. Consequence: the "Assert no service-role key in the client bundle"
step — the one guard whose failure CLAUDE.md treats as total compromise — **never runs**,
because `.next/static/` is never produced. Fix: give the Build step placeholder public vars
rather than adding fallbacks to `robots.ts`/`sitemap.ts`; a fallback would let production
ship a sitemap pointing at the wrong origin. Effort S.

**OPS-003 · P1 · [VERIFIED-EXEC by me]** — **No working migration path to a fresh database.**
See the verification note above. `readMigrationFiles()` throws
`No file ./drizzle/0001_triggers_rls.sql found`, and `0002` — the commit granting
`app_runtime` its privileges — would never be applied even if the name matched. Fix: rewrite
the journal and generate `meta/0002_snapshot.json`; do **not** rename the SQL files, since
`0001_app_runtime_layer.sql` is extracted from the live database and named in CLAUDE.md.
Effort M.

**OPS-004 · P1 · [VERIFIED-EXEC]** — `.env.example` deleted in `9a11a5b`; **19 required
variables exist only inside two Zod schemas**. A new deploy has no manifest, and the error
message points at a file that does not exist. Effort S. *(= SEC-013.)*

**OPS-005 · P1 · [VERIFIED-CODE]** — `scripts/seed.ts:128-134` inserts the three legal pages
as `status: 'draft'` with `titleAr` only; the query filters on `published`; the route calls
`notFound()`. Footer and sitemap advertise them unconditionally. **No reachable privacy
policy** on a site collecting complaint, volunteer and job-application data. Effort M.

**OPS-006 · P1 · [ASSUMPTION on dashboard state]** — No preview/production separation exists
anywhere in the repo: no `VERCEL_ENV` reference in `src/` or `scripts/`, no `env` block in
`vercel.json`, no `supabase/config.toml`. `purge-submissions/route.ts:19` performs an
irreversible delete with **no environment guard**. If `DATABASE_URL` is scoped "All
Environments" in Vercel — the default — a manually-triggered preview purge irreversibly
deletes production submissions and their CVs. Fix: separate preview project **plus** a
code-level refusal when `VERCEL_ENV` is present and not `production`; dashboard scoping is
invisible to review. Effort L.

**OPS-007 · P1 · [VERIFIED-CODE]** — No backup, restore or rollback story. No `*.down.sql`,
no `db:rollback`/`db:dump`/`db:restore` script, no `pg_dump` workflow (spec
`01-DATABASE.md:835` promises one), no runbook (spec `06-BUILD-PLAN.md:253` requires one).
A bad migration has no recovery beyond Supabase PITR, a paid-tier feature nothing confirms
is enabled — and `0001` contains role, policy and `SECURITY DEFINER` DDL, the hardest
category to reverse by hand. Effort L.

**OPS-008 · P2 · [VERIFIED-CODE]** — **Sentry is declared and absent.** `env.ts:62` has
`SENTRY_DSN` optional; `package.json` has no `@sentry/*`; there is no `instrumentation.ts`.
Nothing in production reports a failure to a human — the cron jobs, whose whole value is
running unattended, fail into a log nobody is subscribed to. Fix must include a `beforeSend`
scrubbing `email`, `phone`, `message` and everything under `payload`: an unscrubbed event
from a complaint form recreates outside the database exactly the record `app.submit_form()`
encrypts and the purge destroys. Effort M.

**OPS-011 · P2 · [VERIFIED-EXEC]** — `src/app/favicon.ico` is the **Next.js default
triangle**, 25,931 bytes, byte-for-byte unchanged since the scaffold commit. `public/` holds
only the five scaffold SVGs, referenced by nothing. The brand asset exists at
`docs/design_handoff/design/assets/pcsrd-logo.jpg` and is never wired in. An organisation
whose site exists partly to prove it is real ships another company's mark in the browser tab
and in every search result. Effort M.

**OPS-012 · P2 · [VERIFIED-CODE]** — The retention purge deletes rows **before** their CVs
and only `console.error`s a storage failure (`purge-submissions/route.ts:19-32`), so a
Storage outage leaves an applicant's CV in the bucket permanently with nothing pointing at
it — the exact failure the route's own comment names. `archive-expired/route.ts:23-50` runs
two updates with no transaction and no `catch`. Fix: a retry table rather than reordering —
reordering trades an orphaned file for an orphaned row, which is worse under DNH-8. Effort M.

**OPS-013 · P2** — `README.md` is the unmodified create-next-app template: it offers
yarn/pnpm/bun against CLAUDE.md's npm rule and points at `app/page.tsx`, which does not
exist. No deploy, release or migration script; no answer to "how do I deploy", "what do I do
when the site is down", or "how do I rotate `SUBMISSION_ENC_KEY`" — the last matters because
`SUBMISSION_ENC_KEY_ID` exists specifically to make rotation possible. Effort M.

**OPS-014 · P2 · [VERIFIED-CODE]** — `test:unit` is green against **zero tests**;
`tests/unit/` does not exist. The spec names that layer as covering `hashIp`, upload
validation and `buildWhatsAppUrl` — privacy and security primitives with no test at all. No
Playwright, no axe, no Lighthouse CI, though `.gitignore:45-46` reserves directories for a
harness never installed. Every PR-checklist item beyond typecheck and lint is honour-system,
on an RTL-primary site. Effort XL.

**OPS-017 · P3** — No `CODEOWNERS`, no `dependabot.yml`, no PR template; `db-verify` is gated
on `push`, so the database assertion validates only *after* merge. CI never runs `npm audit`.
**OPS-018 · P3** — Neither cron sets `maxDuration`, though the convention exists at
`media/route.ts:10`; the archive job's unbounded `revalidateEntity` loop, killed mid-run,
leaves rows archived with caches never invalidated. **OPS-019 · P3** — `scripts/seed.ts` has
no environment guard and connects as owner via the same `.env.local` a developer uses daily;
mitigated by genuine idempotency and draft-only inserts. **OPS-020 · P3** — nothing consults
`VERCEL_ENV` for robots; the `www` decision is unrecorded.

**CLEAN (OPS):** cron authentication rejects before any work with a ≥16-char secret, and
both `vercel.json` paths map to real handlers · **analytics and consent — none is wired**,
verified by pattern sweep across `src/` and `package.json`; the only "analytics" matches are
`analytics: false` on the Upstash limiters, so CLAUDE.md's complaint-analytics rule is
satisfied by construction and no consent banner is required · committed secrets — one hit
across all tracked files, the deliberate `placeholder:placeholder` in `ci.yml:42` · security
headers complete on `/:path*` with `poweredByHeader: false` · `vercel.json` regions correct,
exactly two crons within the Hobby ceiling · `/api/health` correct, with the error text
deliberately withheld because it would name the host and user.

---

# Cross-track duplicates — one fix each

| Same defect | Filed as |
|---|---|
| Missing `metadataBase` | **SEO-001** = OPS-010 |
| Legal pages seeded draft → 404 | **SEO-004** = OPS-005 |
| `redirects` table never applied | **SEO-006** = OPS-009 (observed by T7 too) |
| Missing icons / OG / manifest | **OPS-011** + OPS-016 ≈ SEO-023 ≈ NEXT-005 |
| Missing root error & not-found boundaries | **STATE-001** + **STATE-002** supersede OPS-015 (P3 → P1); = NEXT-003, NEXT-004 |
| No observability | **OPS-008**, with STATE-010 / STATE-011 as consequences |
| Three routes unprerendered *and* absent from the sitemap | **PERF-007** + **SEO-005** = NEXT-001 + NEXT-012 |
| `TODO(org)` in production metadata | **SEO-012**, blocked by **STATE-006** |
| `saveOrganization` unvalidated | **SEC-005** = DATA-011 = NEXT-009 |
| Missing `loading.tsx` | **STATE-005** = NEXT-002 |
| Cron secret not constant-time | **SEC-014** = NEXT-015 = OPS-018 |
| `.env.example` deleted | **OPS-004** = SEC-013 |
| TipTap statically imported | **PERF-003** = NEXT-013 |
| Language switcher fallback | **PERF-008** = NEXT-014 |
| `error.digest` discarded | **STATE-010** = NEXT-017 |

# COVERAGE

**T8:** all five baseline chunks fingerprinted and attributed via
`page_client-reference-manifest.js`; all 11 client modules read; fonts measured from
`next-font-manifest.json` and cross-checked against the emitted preload count; weight usage
counted across `src/` and `globals.css`; all five image sites read; all 19 `(site)` pages
checked for waterfalls. *Not covered:* no Lighthouse or device run — none installed
(OPS-014), so LCP/INP figures are reasoned from build output, not measured.

**T10:** all 18 `generateMetadata`, `sitemap.ts`, `robots.ts`, `feed.xml`, `json-ld.tsx`
read; assertions verified against 30 prerendered HTML files and the `.meta` status records
rather than inferred. *Not covered:* no live Rich Results Test (needs a deployed origin).

**T11:** all 52 pages in both route groups enumerated for the four states; all 11 client
components read; every `catch` (9) and every `console.*` (4) classified; Sentry confirmed
absent. *Not covered:* no screen-reader or axe run.

**T12:** `.github/` enumerated and `ci.yml` read job by job with both failures confirmed by
execution; all 22 env vars enumerated; migration integrity confirmed by running
`readMigrationFiles()`; secret sweep across all tracked files. *Not covered:* Vercel
dashboard state (env scoping, branch protection, domain, plan tier) is not inspectable from
the repository — which is itself OPS-006/017/020's finding.
