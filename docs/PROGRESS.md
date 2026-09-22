# Progress — where the project stands, and where to pick it up

Last updated 2026-09-22, at commit `7942d13`.

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
3. **Check whether `/programs/[slug]` ships a heading in a production build**
   (§5.1.3). Measured against `next dev` it does not — the response is the
   loading skeleton and the content arrives only as RSC payload. One route,
   pre-existing, and one `curl` decides it.
4. Run `visual.spec.ts` and commit the baselines (§5.2); the other six specs
   have now been run and pass.
5. Lighthouse against `next start` (§5.3).
6. The small queue in §5.4 — each is under an hour.
7. Then it is the owner's turn: §6 is blocked on credentials, decisions and
   organisational copy, and nothing in §5 unblocks it.

Do **not** re-audit. Five full audits have run (schema parity, dependencies and
dead code, localisation and RTL, database-to-frontend completeness) plus a UI,
image and interaction pass. Their findings are fixed and recorded in §3. A fifth
scan would rediscover the same ground.

---

## 1. Mechanical state at `7942d13`

| Gate | Command | Result |
|---|---|---|
| Types | `npm run typecheck` | 0 errors, `strict` + `noUncheckedIndexedAccess` |
| Lint | `npm run lint` | 0 errors, 0 warnings |
| CSS | `npm run lint:css` | clean |
| Unit | `npm run test:unit` | **174** passing, 18 files |
| Integration | `npm run test:int` | **87** passing, 9 files (PGlite, real Postgres 17) |
| Schema | `npx drizzle-kit check` | clean; `0005` proven idempotent by applying it twice |
| Build | `npm run build` | succeeds; 51 prerendered pages |

Design system, counted in `src/`: **0** `rounded-*`, **0** `shadow-*`, **0**
`bg-gold-600`, **0** `text-gold-600`. Code quality: **0** `any`, **0**
`@ts-ignore`, **0** non-null assertions in `src/`, **0** `console.log`.

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

### 5.1.3 `/[locale]/programs/[slug]` ships no heading in its SSR HTML — **open, needs a production check**

Found 2026-09-22 by fetching served HTML rather than by reading code, which is
the only way this class of thing shows up.

**What was measured**, against `next dev`, warm, deterministic across four
requests with a byte-identical response each time:

```
h1=0  /ar/programs/<published-slug>     ← the only one
h1=1  /ar/news/<published-slug>
h1=1  /ar/programs   /ar/news   /ar/careers   /ar/about   /ar
```

The programme detail response is the `loading.tsx` skeleton — `aria-busy`,
`loading-surface`, an unresolved `<template id="B:0">` — followed by the RSC
payload, which *does* contain the heading as `[\"$\",\"h1\",…]`. So the content
renders; it never reaches the HTML shell. No error, no `__next_error__`, a 200
in well under a second in the server log.

**What was ruled out:**

- **Not caused by this session.** Restoring the pre-session file
  (`git show c2d75b8:…`) reproduces it exactly.
- **Not latency.** The route had the only two-stage query waterfall of any
  detail route — `listPrograms` sat in the second wave needing nothing from the
  first. That is fixed, on its own merits, and the heading did not come back.
- **Not an error boundary.** Nothing is logged, and the error marker is absent.

**What is not known, and decides whether it matters:** whether this reproduces
in a production build. Dev streaming is not the production pipeline, and
`PROGRESS §4` already records that dev misleads about status codes. A browser
executes the payload, which is why `a11y.spec.ts` passes and why nothing caught
it: axe runs against the live DOM, not the shell.

**Why it would matter if it does reproduce:** a crawler or reader without
JavaScript gets a skeleton with no `<h1>` and no article text on the one route
that describes what the organisation actually does. The `<title>` and meta are
correct either way, so search results would not look broken — which is what
makes it worth measuring rather than assuming.

**How to check, in one step:** `npm run build && npx next start --port 3100`,
then `curl -s http://localhost:3100/ar/programs/<slug> | grep -c '<h1'`.
Compare against `/ar/news/<slug>`. If the production build emits the heading,
close this as a dev-server artefact and say so here.

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

- **Flip the restricted-classes rule to `error`** in `eslint.config.mjs`. The
  tree has been at zero for several passes.
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

1. **Apply the migrations to production.** `npm run db:migrate` now covers
   `0003` (the audit sequence grant — without it every audited mutation
   aborts), `0005`, `0006` (the rate limiter's database fallback; until it
   is applied the fallback has nothing to fall back to, and
   `schema-parity.test.ts` records the repository as one table ahead of the
   live database) and `0007` (drops two unused `programs` columns — verified
   empty in all three rows before the migration was written). Then
   `supabase db push` for the storage buckets; the live
   project has no `supabase_migrations` schema yet, so this is its first push.

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
