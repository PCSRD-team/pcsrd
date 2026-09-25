# Progress — where the project stands, and where to pick it up

Last updated 2026-09-25, at commit `8367211`.

**If you are resuming: read §0, then start at the top of §5.** Everything above
§5 is context; §5 is the queue. Nothing in §5 needs re-discovery — each item
names its files and what "done" looks like.

`docs/audit/03-LAUNCH-CHECKLIST.md` is the launch gate. `docs/DEPLOYMENT.md` is
the deploy runbook. `docs/RUNBOOK.md` is operations. This file is the map.

---

## 0. Resume in one screen

The application is **code-complete against the spec** and every mechanical gate
is green. What remains is, in order:

1. ~~Replace the Upstash credentials~~ — **no longer a blocker** as of
   2026-09-22. The limiter now falls back to Postgres, reports the outage to
   Sentry, and lets a safeguarding disclosure through when it is degraded
   (§5.1.1). Replacing the credential is still worth doing; nothing waits on
   it.
2. ~~Soft 404s on five detail routes~~ — **closed** 2026-09-22: measured against
   `next start`, not the dev server, and the exposure that motivated it does not
   exist. Next noindexes every streamed not-found itself (§5.1.2).
3. **Finish diagnosing `/programs/[slug]`** (§5.1.3) — **confirmed against a
   production build**: the route ships no `<h1>` and no article text in its
   SSR HTML, only the loading skeleton, while the RSC payload is complete. It
   is pre-existing and it is the only route affected. Bisected down to
   `_getProgramBySlug`; §5.1.3 has the table and names the exact next step.
4. Run `visual.spec.ts` and commit the baselines (§5.2); the other six specs
   have now been run and pass.
5. Lighthouse against `next start` (§5.3).
6. The small queue in §5.4 — each is under an hour.
7. Then it is the owner's turn: §6 is blocked on credentials, decisions and
   organisational copy, and nothing in §5 unblocks it.

**A sixth pass ran on 2026-09-22** and is worth knowing about before you
trust the sentence below. It did not re-audit; it fetched served HTML and ran
the lint config against itself, and that found three things reading the code
had not: every published detail page shipped with no meta description, most of
the shared kit was never linted at all, and `/programs/[slug]` ships no heading
in its SSR HTML (§5.1.3, still open). It also closed two items by measuring
rather than building — the soft 404s and the Upstash blocker. The lesson is
narrow: **measure the output, not the source.**

Do **not** re-audit. Five full audits have run (schema parity, dependencies and
dead code, localisation and RTL, database-to-frontend completeness) plus a UI,
image and interaction pass. Their findings are fixed and recorded in §3. Another
source-reading scan would rediscover the same ground.

---

## 1. Mechanical state at `a972b07`

| Gate | Command | Result |
|---|---|---|
| Types | `npm run typecheck` | 0 errors, `strict` + `noUncheckedIndexedAccess` |
| Lint | `npm run lint` | 0 errors, 0 warnings |
| CSS | `npm run lint:css` | clean |
| Unit | `npm run test:unit` | **211** passing, 19 files |
| Integration | `npm run test:int` | **94** passing, 10 files (PGlite, real Postgres 17) |
| Schema | `npx drizzle-kit check` | clean |
| Build | `npm run build` | succeeds; 52 prerendered pages |

Design system, counted in `src/`: **0** `rounded-*`, **0** `shadow-*`, **0**
`bg-gold-600`, **0** `text-gold-600`. Code quality: **0** `any`, **0**
`@ts-ignore`, **0** non-null assertions in `src/`, **0** `console.log`.

Two of those gates got stricter on 2026-09-22 rather than merely staying green:
`no-restricted-classes` moved from `warn` to `error`, and the Tailwind plugin
now reads class strings inside `const styles = { … }` objects, which is where
most of the shared kit keeps them and where nothing had been checked before
(§3).

**Run the suites from a quiet tree.** A `next dev` server left running will
fight `npm run build` over `.next` and corrupt the generated type files;
`npm run typecheck` then fails inside `.next/dev/types` with unterminated
literals, which looks like a source error and is not one.

---

## 2. Milestones against `docs/spec/06-BUILD-PLAN.md`

| M | Name | State |
|---|---|---|
| M0 | Foundation | done |
| M1 | Data layer | done, verified column by column against the live database |
| M2 | Design system + i18n | done — one kit, `src/components/ui/**` |
| M3 | Public content routes | done — all 25 spec routes exist and render |
| M4 | Forms + email | done — six forms, React Email, decryption key ring |
| M5 | Admin CMS | done — every entity creatable, editable, publishable, deletable |
| M6 | SEO · a11y · perf | code done; **measurement outstanding** (§5.1–5.3) |
| M7 | Content load + QA + launch | not started (§6) |

---

## 3. What has been built and fixed

Grouped by the pass that did it, so a finding is traceable to its evidence.

**Schema parity.** No column drift, but the repository lacked 29 CHECK
constraints and 65 indexes the live database carries, and used Drizzle's default
constraint names where Postgres uses its own. All modelled;
`drizzle/0005_live_parity.sql` adds them idempotently. `audit_logs.id` is an
identity column, and its action CHECK is a type, so an unknown action cannot
compile. Zod mirrors every constraint the database enforces.

**Component kit.** `src/components/ui/**` — layout, typography, buttons, cards,
badges, tables, stats, figures, notices, states, skeletons, fields, inputs,
dialog, breadcrumbs, pagination, tabs, skip link. Server Components except where
interaction demands otherwise. `Stat` refuses to render a figure without its
period and verification status. Read `src/components/ui/README.md` before adding
a component; the odds are it exists.

**Admin.** Partners, people, impact metrics, media metadata, redirects and users
gained create/edit screens. Twenty-five `'use server'` exports with no caller —
each a live POST endpoint — were deleted. Services rebuilt whole rows on save, so
a column no form posted was silently reset; forms now post them and the service
preserves what a form omits.

**Public site.** The six routes the navigation linked to and that returned 404
now exist. One metadata builder emits canonical, `ar`/`en`/`x-default` hreflang,
Open Graph, Twitter, the untranslated rule and pagination links. Five templates
render their own Open Graph card — Satori has no bidi, so Arabic is pre-shaped
word by word in `src/lib/seo/arabic-shaping.ts`.

**Infrastructure.** Storage buckets and policies are a real migration. Sentry is
wired with PII scrubbing, no tracing, no replay, and is inert without a DSN. A
confidential complaint's content cannot reach an inbox — the email template's
own types refuse it.

**The last pass (four parallel audits) found and fixed, among others:**

- every content detail page shipped an **empty `<title>`** (`??` does not fall
  back on `''`, and the SEO columns hold empty strings);
- `/admin/organization` **refused every save** by a content manager;
- the audit log recorded **phantom edits** (jsonb compared by `JSON.stringify`);
- the image remote pattern matched **every Supabase project on the internet**;
- the unmatched-URL 404 had **no `lang`** — WCAG 2.2 SC 3.1.1, Level A;
- media pagination dropped its own filters;
- 265 lines of hardcoded copy moved into the dictionaries.

**The lint pass (2026-09-22) found and fixed:**

- **Most of the shared kit was not being linted at all.** Sixteen files in
  `src/components/ui` keep their classes in a `const styles = { … }` object
  rather than in a `className`, and `eslint-plugin-better-tailwindcss` scans a
  variable named `styles` only when it is assigned a string *directly* — an
  object literal's values were never visited. So non-negotiable #2, "logical
  CSS properties only … the ESLint rule stays on", was unenforced across
  exactly the code the rule exists to protect.

  Measured rather than assumed: `pl-4 ml-2 text-left` placed inside
  `styles.box` produced **zero** errors, and the same three classes in a
  `className` on the next line produced **three**. Adding `objectValues` to the
  plugin's `variables` setting closes it, and it immediately found a real
  `border-b-2` in `button.tsx` — a physical property in the kit's own button,
  which is the one component every page uses.

  `src/emails/**` is now excluded from that block. React Email renders for mail
  clients, which load no stylesheet, so those files carry inline CSS style
  objects and no Tailwind; with `objectValues` on, the plugin read
  `{ fontSize: '15px', borderStyle: 'solid' }` as a class list and reported 44
  unknown classes in one file.

- **`better-tailwindcss/no-restricted-classes` is `error`, not `warn`.** Its own
  comment made that conditional on the rule reporting zero, and
  `eslint --format json` now reports zero problems of any rule across the tree.
  A radius or a shadow fails the build rather than scrolling past in a warning
  list nobody reads. Verified by injecting `rounded-lg shadow-md` and watching
  it fail.

**The production-build pass (2026-09-22) found and fixed:**

- **The modal dialog documented a focus contract its only caller did not
  meet.** `dialog.tsx` said "a caller that opens a dialog owns three things:
  moving focus in, Escape, and returning focus to the trigger". The one caller,
  `media-picker-impl.tsx`, implemented Escape. With `aria-modal="true"` set,
  that confined a screen-reader user’s cursor to the dialog while keyboard
  focus stayed on the trigger behind it — Tab then walked a subtree assistive
  technology had been told was inert. WCAG 2.4.3, failed by a component whose
  own comment named whose job it was. The trap now lives in `Dialog`, which
  costs it a `use client` boundary and is worth it: a contract its only caller
  does not meet is a bug with documentation.

- **Admin sign-in had no anti-automation of any kind.** `signIn` called
  none of `checkRateLimit`, `verifyTurnstile` or `writeAudit`. A Server Action
  is a POST endpoint reachable without rendering the login page, so nothing on
  that page could gate it: unlimited, unlogged, unalerted password guessing
  against every admin account. It is now limited on two hashed keys at once —
  the address and the account — because the address alone lets one attacker
  spread a list across a botnet and the account alone lets one host walk the
  staff list. The uniform wrong-password message stays; it is correct, and it
  is what made the missing throttle matter.

- **Every published detail page shipped with no `meta description` and no
  `og:description`.** The SEO columns hold an empty string rather than nulls, and the
  six detail routes resolved the description with `??`, which falls back on `null`
  but not on an empty string — so a blank SEO textarea produced nothing at all instead of
  the record's own summary. This is the exact bug that was found and fixed for
  the `<title>` one pass earlier; the title call sites were changed to `||`
  and the description call sites were not. Measured before and after by
  fetching the served HTML of the two published pages, not by reading code.
  The resolution is now one tested function, `seoFallback` in
  `src/lib/seo/metadata.ts`, so the two paths cannot drift apart again.

**The browser run (2026-09-21/22) found and fixed:**

- **`unstable_cache` returns strings where the types promised `Date`.** The
  cache stores JSON, so a hit hands back an ISO string and a miss the real
  `Date`. The Arabic homepage was serving `<html id="__next_error__">` with no
  `<h1>` and no `<main>` on any warm cache, and the news list, both detail
  routes, two cards, the sitemap and the feed with it. A build never shows it,
  because a build populates the cache. `cached()` now declares a `Serialized<T>`
  return type, which turned the class into 22 compile errors.
- **An unmatched URL under a locale** now renders the designed 404 with the site
  chrome, through a catch-all segment, instead of Next's built-in bare document.
- A `robots.txt` assertion that required a trailing slash the implementation
  deliberately omits.

---

## 3b. The careers portal (added 2026-09-24)

A feature the spec does not describe, built on request: **admin-defined
application forms** for jobs, volunteering, internships, training and
consultancies, with an applicant pipeline and an Excel export.

**It does not reuse `form_submissions`.** That table is six known forms behind
one `payload` column, with retention fixed per *type*; this needs a form whose
shape is a row, retention set per *form*, and a pipeline with a reviewer, a
rating and a history. Four new tables own it:

| Table | What it holds |
|---|---|
| `application_forms` | one form: slug, window, capacity, retention, consent switch, optional `vacancy_id` |
| `application_form_fields` | its fields, ordered; type, labels, validation, options, `visible_when` |
| `applications` | one submitted application: `answers` jsonb, attachments, status, rating, note |
| `application_events` | append-only status history |

**The capacity cap is enforced inside `app.submit_application()`**, under
`select … for update` on the form row. It cannot be done in TypeScript: two
applicants arriving in the same second both read `n - 1` and both pass. The
function also owns the window check, the duplicate-email rule and
`purge_after`. `applications` has **no INSERT grant** for `app_runtime`, so
that function is the only door — the same shape as `app.submit_form()`.

`submission_count` counts **slots taken**, so a waitlisted row does not
increment it; raising the capacity later therefore admits the people already on
the list.

**The field catalogue** (`src/lib/applications/field-catalog.ts`) is 87
ready-made bilingual fields in eleven groups, with validation an admin could
not write — a Palestinian ID shape, E.164 phones, the `governorate` enum's
members. A `catalogKey` on the row records provenance. Alongside it is a
free-form builder for anything the catalogue does not cover; between them the
admin is never blocked and never able to weaken a vetted rule.

**Two things the builder deliberately cannot do**, both in
`src/lib/validation/applications.ts`:

- **No author-supplied `config.pattern`.** The key is absent from the schema, so
  a regular expression can only ever have been copied from the catalogue by the
  service. `(a+)+$` against a 200-character answer is a denial of service that
  looks like a typo.
- **No free-text file types.** `accept` is a named choice of three.

**Privacy.** `20-PRIVACY §5` says collect an age band, not a birth date, and no
national ID. The owner asked for both. They are in the catalogue, **off by
default**, marked `sensitive: true`, and a form carrying any sensitive field
**cannot publish** unless `require_consent` is on (`setFormStatus`). Sensitive
columns are excluded from the export unless explicitly requested, and asking
for them writes a `view_sensitive` audit entry. Attachment downloads are
audited the same way.

**Rule 7 holds on every screen.** The builder reorders with arrow buttons
posting to Server Actions, not drag-and-drop; the option editor is three
parallel arrays because that is what a plain form can express; the tabs are
links. Nothing in the portal requires JavaScript.

**The export** is a hand-written XLSX writer (`src/lib/export/xlsx.ts`, no new
dependency, `node:zlib` only): RTL sheet view, frozen header, autofilter,
Arabic verbatim, and a formula-injection guard — applicant text beginning `=`,
`+`, `-` or `@` is quote-prefixed so Excel stores it as text.

**Retention** rides the existing `purge-submissions` cron (Vercel Hobby allows
two jobs and both are declared). `app.purge_expired_applications()` returns the
attachment paths so the objects are deleted with the rows.

**Not yet exercised in a browser.** Typecheck, lint, 384 unit and integration
tests and a production build all pass, but no screen in this feature has been
opened by a human — the e2e suite holds no admin credentials. See §5.4.

---

## 4. Facts that will bite if forgotten

- `cacheComponents` stays **off**. Turning it on breaks `unstable_cache`,
  `revalidate` and `force-dynamic`, which the whole caching design rests on.
- The connection pool is small off production and one on it
  (`src/db/index.ts`). `max: 1` is a serverless rule; a build and `next dev` are
  one process serving concurrent requests, and on one connection against a
  database in Tokyo the browser suite timed out on every route.
- **A stale `.next` makes routes 404 in dev.** After changing `next.config.ts`,
  or after a build was interrupted, `rm -rf .next` before trusting a 404. Two
  hours went into diagnosing this twice.
- Never run `supabase db pull` or `supabase db diff` against the `public`
  schema. Drizzle owns those tables.
- `drizzle/0001_app_runtime_layer.sql` is extracted from the live database.
  Regenerate it; do not hand-edit it.
- The integration suite connects as `postgres`, so it exercises the service
  rules and never the row-level policies. Verifying those needs the real
  database and `scripts/assert-rls.ts`.
- **Drizzle wraps a driver error rather than rethrowing it.** It throws its own
  `Failed query: …` and hangs the real one off `cause`, so matching a
  `PCSRD_*` refusal on the top-level message alone silently never matches. See
  `messageChain` in `src/services/applications/application.service.ts`; the
  same trap applies to anything reading `app.submit_form()`'s refusals.
- **`drizzle-kit generate` replays hand-written migrations that have no
  snapshot.** 0006 and 0007 were authored by hand, so generating 0008 proposed
  both again — and the replay would have aborted on any database that already
  had them. `drizzle/0008_application_portal.sql` documents the three
  statements removed. `meta/0008_snapshot.json` now includes them, so it should
  not recur.
- `src/lib/applications/attachments.ts` is `server-only` on purpose: it reaches
  `sharp` through `security/upload.ts`, and importing it from a Client
  Component put `require('fs')` in the browser bundle and broke the build. The
  browser-safe half is `attachment-kinds.ts`, which has no imports at all.
- **`next dev` compiles on first hit**, 30–70s for a heavy route, which reads
  as a 60s navigation timeout in Playwright. Warm every route with `curl`
  before treating any browser failure as a defect.
- `origin/main` is a shared remote and other people push to it. Check
  `git log --oneline HEAD..origin/main` before a large commit; when a merge
  conflicts, compare file hashes (`git show <rev>:<path> | md5sum`) against
  local history before choosing a side.

---

## 5. The queue — start here

### 5.1 Run the browser suites (half a day)

Chromium is installed. The suites live in `tests/e2e/`; read
`tests/e2e/README.md` first — in particular **never submit a valid form**: the
database and the mail service are live.

```sh
rm -rf .next                       # see §4
npx next dev --port 3100           # leave running
npm run test:e2e                   # all five projects
```

Status of each spec:

| Spec | Run? | Result |
|---|---|---|
| `a11y.spec.ts` | yes | 29 routes × 2 locales **pass with zero violations** |
| `shell.spec.ts` | yes | passes warm |
| `routes.spec.ts` | yes | passes warm, except the soft-404 below |
| `security.spec.ts` | yes | **65 passed, 0 failed** (with `admin.spec.ts`); 4 flaky, all Turnstile-bearing pages on first compile |
| `admin.spec.ts` | yes | passes |
| `journeys.spec.ts` | yes | J1 passes warm; the rest need content |
| `forms.spec.ts` | yes | all failed on the limiter outage; the cause is fixed (§5.1.1) and they need a re-run |
| `visual.spec.ts` | no | see §5.2 |

**Always warm the routes before judging a failure.** `next dev` compiles a
route on its first hit and a heavy one takes 30–70s, which reads as a 60s
navigation timeout. Roughly 20 of the failures in the first full run were this
and nothing else:

```sh
for L in ar en; do for p in "" /about /programs /projects /impact /news   /partners /get-involved /careers /verify /contact /resources; do
  curl -s -o /dev/null --max-time 280 "http://localhost:3100/$L$p"; done; done
```

### 5.1.1 The rate limiter's backend — **no longer a blocker**

**What happened.** The free-tier Upstash database was reclaimed and its host —
`native-boar-37077.upstash.io` — began returning NXDOMAIN. `checkRateLimit`
had no `try/catch` around `.limit()`, so the fetch error propagated out of
`submit()`, reached `runAction` as an unexpected throw, and every one of the
six public forms answered `errors.unexpected` — "Something went wrong" — in
both locales, with and without JavaScript. The confidential safeguarding
complaints channel included.

Worse than the outage: **nothing reported it.** `runAction` catches the throw,
and `instrumentation.ts` only reports errors that escape a request, which this
one never did. The failure reached a visitor as a generic message and paged
nobody. It lasted days.

**Fixed 2026-09-22.** A limiter whose own outage takes down the forms it
protects is worse than no limiter, so it now has a second wall:

- `drizzle/0006_rate_limit_fallback.sql` — a sliding window in Postgres behind
  `app.check_rate_limit`, `SECURITY DEFINER` for the same reason
  `app.submit_form` is: the public form path sets no actor, and every table
  here is `FORCE ROW LEVEL SECURITY`. The runtime role has **no grant on the
  table**, only `execute` on the function, so a compromised role cannot forge
  or clear another client's window. Seven integration tests against real
  Postgres cover the allowance boundary, that a refused call does not record a
  hit (otherwise a retry extends its own lockout forever), bucket isolation,
  the sliding behaviour, and the two degenerate inputs.
- `checkRateLimit` catches, reports to Sentry once per process under the tag
  `area: rate-limit`, and falls through to the database. The report is
  deliberately **not awaited** — a slow transport must not be what makes a form
  submission time out.
- `timeout: 2000` on the `Ratelimit` constructor. Without it a host that hangs
  rather than refusing holds the request open until the platform kills the
  function, and the fallback is never reached.
- The result now carries `degraded`, and `src/actions/public/forms.ts` uses it:
  **a sensitive submission is allowed through when the limiter is degraded.**
  A complainant who cannot reach the organisation because a Redis host expired
  is a worse outcome than an unthrottled complaint — the honeypot and Turnstile
  both still stand, and the throttle is the outer wall, not the only one. The
  other five forms are unchanged and still refuse.
- Spent windows are dropped by the existing daily purge cron, not a third cron
  job: Vercel Hobby allows exactly two and `vercel.json` declares both. A
  failure there is logged and cannot fail the retention purge.

**Still worth doing, but no longer blocking:** replace the Upstash credentials
(§6.10). Until then the database carries the limiting, which is correct but
slower and shares the request pool.

### 5.1.2 Soft 404s on five detail routes — **CLOSED, working as designed**

Measured 2026-09-22 against a production build and `next start`, not the dev
server, and then against the framework's own documentation. The previous
entry's conclusion was wrong in the way that mattered.

**What is true.** `/ar/projects/no-such-slug` and its four siblings answer
**200**, and `/legal/…` answers 404.

**What is not true.** The previous entry said "every dead link into those five
content types is indexable". It is not. Next injects
`<meta name="robots" content="noindex">` into every streamed not-found body —
verified on all five routes by fetching the served HTML. `not-found.md` and
`loading.md` §"Status Codes" in `node_modules/next/dist/docs/` state it
outright:

> Some crawlers may label these responses as "soft 404s". In the streaming
> case, this does not lead to indexation because the page is explicitly marked
> `noindex` in the HTML.

**The mechanism**, settled by experiment rather than inference:

- `loading.tsx` is **not** the cause. Removed it from `projects/[slug]`, rebuilt
  clean, requested a never-seen slug: still 200.
- `notFound()` in `generateMetadata` is **not** a fix. Next 16 streams metadata
  too, so it is not "before the response starts". Tested with a clean
  `.next` and a fresh slug: still 200.
- It is a **race**, not a structural difference. In one run
  `/ar/impact/stories/…` answered 404 while the other four answered 200 — the
  stories template resolved before its shell flushed. Nothing about that route
  is different in kind.
- The status cannot change once streaming has begun. That is the whole of it.

**A trap that invalidated two earlier measurements, and will invalidate yours.**
`.next/cache` survives `npm run build`. The first request to an unknown slug
caches a 200, and every later measurement — across rebuilds, across ports —
serves that entry. `x-nextjs-cache: HIT` is the tell. **Always measure with a
slug that has never been requested, and read the header.**

**Why it stays as it is.** The documented way to get a real 404 status is a
check in `src/proxy.ts` before the response streams. That would put five slug
lookups on the hot path of every site request, and — worse — a newly published
item whose cached slug list has not refreshed would get a **false 404 on real
content**. Serving a wrong 404 for a published project is a considerably worse
failure than serving a noindex'd 200 for a dead link. The SEO exposure that
motivated the item does not exist, so the cost buys nothing.

Revisit only if a real 404 status is needed for compliance or analytics, which
is the one reason the Next documentation itself gives.

### 5.1.3 `/[locale]/programs/[slug]` ships no heading in its SSR HTML — **CONFIRMED in production, cause narrowed, not fixed**

Found 2026-09-22 by fetching served HTML rather than by reading code, which is
the only way this class of defect shows up.

**Confirmed against a production build**, not the dev server:

```
h1=0  /ar/programs/<published-slug>     ← the only route
h1=1  /ar/news/<published-slug>   /ar/careers   /ar
```

The response is the `loading.tsx` skeleton — 42 `loading-surface` elements,
`aria-busy`, an unresolved `<template id="B:0">`. The **RSC payload is
complete**: `.rsc` carries three `"h1"` entries, the `.html` carries none. So
the content renders; it never reaches the HTML.

This is baked in at build time. `.next/server/app/ar/programs/<slug>.html` is
77 935 bytes of skeleton with `h1=0`, while the news equivalent is correct.
`x-nextjs-prerender: 1`, `x-nextjs-cache: HIT`. Deleting the prerendered files
and forcing an on-demand render reproduces it exactly, and the server logs
nothing.

**Bisected on a dev server** (reproduces identically, seconds per iteration
instead of six-minute builds). Replacing the page body one piece at a time:

| page body | `h1` |
|---|---|
| full page | 0 |
| minimal — `PageHeader` only, same data | 0 |
| no data fetching at all | **1** |
| `getDictionary` only | **1** |
| `listPrograms(locale)` only (a real DB query, 2 ms) | **1** |
| `getProgramBySlug` only | 0 |
| `_getProgramBySlug` — the raw, uncached function | 0 |
| awaits `_getProgramBySlug`, renders a **hardcoded** title | 0 |

So: **it is `_getProgramBySlug`, and it is the call rather than the value** —
awaiting it breaks the HTML pass even when the result is discarded. It is not
`cached()`, because the raw function fails the same way, and it is not "any
database query", because `listPrograms` on the same route is fine.

**Not yet established:** which part of that function does it. It issues a
`.select()` on `programs`, then three parallel queries — hero media, a project
`count(*)`, and `galleryFor`. The next step is to bisect *inside* the function
the same way, with a probe that awaits each of the four in turn.

**One measurement worth repeating carefully:** a probe that awaited the raw
function and logged the result reported `null` after ~1 s on a minimal page,
while the full page clearly gets a row. That may be a probe artefact — the
minimal page passed the slug slightly differently — or it may be the whole
answer. Check it first.

**Why nothing caught it:** `a11y.spec.ts` runs axe against the live DOM, where
the browser has executed the RSC payload and the heading is present. Only
fetching the served HTML shows the difference. Consider one e2e assertion that
greps the *response body* for `<h1` on each detail route.

**Impact:** a crawler or reader without JavaScript gets a skeleton with no
heading and no article text on the route describing what the organisation does.
`<title>` and the meta tags are correct either way, so a search result would not
look broken — which is exactly what makes it worth fixing rather than noticing.

### 5.2 Visual baselines

`npm run test:visual:update`, then look at each PNG before committing it.
Baselines are per platform; CI runs `--ignore-snapshots` until Linux baselines
exist.

### 5.3 Lighthouse

`npm run lhci` against **`next start`**, not the dev server — the development
bundle is several times larger and the numbers are meaningless. Budgets are in
`lighthouserc.cjs`, from `docs/spec/03-FRONTEND.md` §9.

### 5.4 Small, each under an hour

Five of the seven are done (2026-09-22). What is left:

- **Smoke-test the careers portal in a browser** (added 2026-09-24, §3b). None
  of its eight screens has been opened by a human — the e2e suite holds no
  admin credentials and the whole feature sits behind auth. Typecheck, lint,
  384 tests and a production build pass; that is not the same thing. The pass:
  create a form, add a catalogue field and a custom one, reorder them with the
  arrows, try to publish with a sensitive field and consent off (must refuse),
  turn consent on and publish, open `/ar/apply/<slug>` in both locales, submit
  an application, check the applicant appears, change its status, download the
  CV, and export the spreadsheet — then open the .xlsx in real Excel and
  confirm the Arabic, the RTL sheet direction and the frozen header. Do the
  same pass once with JavaScript disabled; every screen is built to work
  without it and none of that has been verified.
- **Decide the retention default.** It is 12 months per form, chosen to match
  the existing `job` submission retention. It is the owner's policy call, and
  shortening it later shortens the life of rows already stored.
- ~~Flip the restricted-classes rule to `error`~~ — **done** 2026-09-22, and
  widening the plugin to see style objects at the same time found a real
  physical property in `button.tsx`. See §3.
- **Delete `docs/audit/**` if you want it gone** — it is a point-in-time report,
  not documentation. `CLAUDE.md`, `DEPLOYMENT.md` and this file reference it, so
  update those three if you do. Kept for now because it records *why* several
  non-obvious decisions were made.

Done:

- ~~Render the galleries that queries now return.~~ All three, plus the story
  page's **hero**, which it did not render either — so `_getStoryBySlug`'s hero
  join was dead as well. The heading moved from `projects.gallery` to
  `contentUi.gallery`; "From the field" was never project-specific.
- ~~`/careers` vacancy-type tabs.~~ Kit `Tabs`, so the filter is a URL: the
  filtered view canonicalises to itself, and an unknown `?type=` falls back to
  the unfiltered canonical rather than advertising a duplicate.
- ~~Home featured posts.~~ No editorial decision was needed: the page already
  does featured-first-latest-as-fallback for the story and the metrics, so the
  posts now match it.
- ~~`errors.content.keyTaken`.~~ Reusing `errors.slug.taken` was defensible for
  pages, where the key *is* the path, and wrong for programmes, where it is an
  internal identifier that never appears in a URL.
- ~~`safeReturnPath`.~~ Needed three changes, not one: the pattern was written
  out twice and the Zod copy runs first, `withFlash` concatenated `?ok=` where
  it now has to merge, and `entity-list` sent a bare path regardless. 24 tests
  on it now, including protocol-relative, `javascript:`, traversal, fragment
  and query-smuggled hosts — it is attacker-controllable and had none.

### 5.5 Decisions, taken 2026-09-22

- ~~**`media-uploader.tsx` is the one form that needs JavaScript.**~~ —
  **fixed** 2026-09-22, and it turned out not to need the exception at all.
  The stated obstacle was real but not the obstacle: no Server Action can
  stream a file and hand back a record for the picker, true — and the route
  handler already accepted a plain `multipart/form-data` POST, because that is
  what `fetch` was sending it. What it did not do was answer a *browser*. It
  returned JSON, so a no-JS submit landed on a page of raw JSON with no way
  back.

  It now content-negotiates: `Accept: application/json` gets the JSON the
  picker consumes, anything else gets a **303** — not 307, which would repeat
  the multipart POST — carrying the outcome as a dictionary key through the
  same `withFlash` contract every other admin mutation uses, rendered by the
  `<Flash>` already on `/admin/media`. The form carries a real `action`,
  `method` and `encType`; the client handler is now an enhancement layered on
  top rather than the only way in.

  One real gap closed on the way: `kind` was computed in the client, and the
  schema defaults it to `image`, so a PDF posted without scripting would have
  gone to `processImageUpload` and been refused. It is derived in the route
  now, which is also one implementation instead of two.

  Verified against a running server, both shapes:

  ```
  Accept: text/html        -> 303  /admin?err=errors.unauthorized
  Accept: application/json -> {"ok":false,"code":"unauthorized",...}
  ```

- ~~**`programs.specific_objectives` and `key_interventions`**~~ — **dropped**
  2026-09-22 in `drizzle/0007_drop_unused_program_blocks.sql`. Checked against
  the live database first, not inferred: all three programmes, both columns,
  zero entries. Nothing was lost. `ProgramBlock` went with them — it typed
  nothing else — and `keep()` now guards one column, `accent_token`, which the
  same test already pinned.

---

## 6. Blocked on the owner

Nothing in §5 unblocks these; they need a credential, a decision, or
organisational copy.

1. ~~**Apply the pending migrations to production.**~~ — **done 2026-09-25.**
   `0006`, `0007`, `0008` and `0009` were applied with
   `scripts/apply-pending-migrations.ts --apply` and verified against the live
   database afterwards, not assumed:

   - the four careers tables exist, with row-level security **enabled *and*
     forced**, like the other twenty-one
   - 15 policies — 5 / 3 / 4 / 3, the expected counts
   - 3 `app.*` functions and 5 triggers
   - **`applications` has no `INSERT` grant for `app_runtime`**, so
     `app.submit_application()` really is the only door
   - an end-to-end probe: a real submission returned `PCS-APP-FD8FBBCA`, and
     deleting its form cascaded the application away. The probe rows were
     removed.
   - `0006`: `rate_limit_hits` plus both limiter functions present, so the
     fallback now has something to fall back to
   - `0007`: both unused `programs` columns gone
   - public tables went 21 → 26

   **The `drizzle-kit migrate` trap still stands** for any future migration.
   `drizzle.__drizzle_migrations` does not exist — the `drizzle` schema is
   absent entirely, because this database was built from hand-written DDL and
   drizzle-kit has never run against it. `npm run db:migrate` would therefore
   read an empty journal, conclude nothing is applied, start at
   `0000_baseline.sql` and abort on the first `CREATE TABLE` of a table that
   already exists. Use `scripts/apply-pending-migrations.ts`, which probes each
   file against the live schema and applies only what is missing, each in its
   own transaction. Baselining the journal so the ordinary command works again
   is still worth doing, and is still bookkeeping that silently skips a real
   migration if done wrong.

   Still outstanding from this item: `supabase db push` for the storage
   buckets. The live project has no `supabase_migrations` schema yet, so that
   is its first push.

2. **Confirm `DATABASE_URL` connects as `app_runtime`, not `postgres`.** The
   wrong value disables all 85 row-level policies while the site keeps working.
   `npx tsx scripts/assert-rls.ts` checks it.
3. **Set `NEXT_PUBLIC_SITE_URL` to the real origin.** It is
   `http://localhost:3000` today, and that string is in every canonical,
   hreflang and sitemap entry of the built pages.
4. **Publish a privacy policy**, and decide the terms and accessibility copy.
   Six forms collect personal data, one of them a confidential complaints
   channel.
5. **Review the twelve error messages** written during the pre-launch audit —
   they are not the organisation's voice.
6. **Point `MAIL_TO_SENSITIVE` at the safeguarding focal point**, not a shared
   inbox.
7. **`public/about/women-session.jpg`** showed an identifiable child and was
   removed from the repository rather than shipped; the rule is documented
   consent and none is on file. If consent exists, record its reference and
   restore it.
8. **Smoke-test the CMS** after the migrations: sign in, publish a post, upload
   an image, open a complaint, download a CV, check the audit log.

   Add one item to that pass: **open the media picker and check the focus**.
   The dialog gained a real focus trap on 2026-09-22 — it previously documented
   the job as the caller's, and its one caller did a third of it. The logic is
   typechecked and linted but **has not been exercised in a browser**, because
   the e2e suite deliberately holds no admin credentials and the picker sits
   behind auth. With the picker open: Tab should cycle inside the dialog and
   never reach the page behind it, Escape should close it, and focus should
   land back on the "Choose" button.
9. **Replace the Upstash rate-limit credentials.** `UPSTASH_REDIS_REST_URL` in
   `.env.local` points at `native-boar-37077.upstash.io`, which returns
   NXDOMAIN — the free-tier database was reclaimed. This is **no longer a
   blocker**: as of 2026-09-22 the limiter falls back to Postgres, reports the
   outage to Sentry, and lets a safeguarding disclosure through while degraded
   (§5.1.1). Replacing it restores the faster backend and takes the limiting
   off the request pool. Create a new Upstash database and set both variables
   locally and in Vercel.

10. **M7 in full**: real content, cross-browser and real-device testing, the
   domain cutover, Search Console, an uptime monitor, an Arabic admin guide with
   screenshots, and a credentials handover under organisational accounts.
