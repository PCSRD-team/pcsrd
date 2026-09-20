# Progress — where the project stands, and where to pick it up

Last updated 2026-09-20, at commit `0b7f31b`.

**If you are resuming: read §0, then start at the top of §5.** Everything above
§5 is context; §5 is the queue. Nothing in §5 needs re-discovery — each item
names its files and what "done" looks like.

`docs/audit/03-LAUNCH-CHECKLIST.md` is the launch gate. `docs/DEPLOYMENT.md` is
the deploy runbook. `docs/RUNBOOK.md` is operations. This file is the map.

---

## 0. Resume in one screen

The application is **code-complete against the spec** and every mechanical gate
is green. What remains is, in order:

1. Run the browser suites end to end and act on what they find (§5.1). The
   accessibility half has been run once; the journeys, forms, visual and
   security halves have not.
2. Commit visual baselines (§5.2), then Lighthouse against `next start` (§5.3).
3. The small queue in §5.4 — each is under an hour.
4. Then it is the owner's turn: §6 is blocked on credentials, decisions and
   organisational copy, and nothing in §5 unblocks it.

Do **not** re-audit. Four full audits have run (schema parity, dependencies and
dead code, localisation and RTL, database-to-frontend completeness) plus a UI,
image and interaction pass. Their findings are fixed and recorded in §3. A fifth
scan would rediscover the same ground.

---

## 1. Mechanical state at `0b7f31b`

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
| `a11y.spec.ts` | yes | 29 routes × 2 locales **pass with zero violations**; the one failure (404 `lang`) is fixed |
| `shell.spec.ts` | no | locale negotiation, skip link, switcher, 375px overflow |
| `routes.spec.ts` | no | every route: one `<h1>`, `<main>`, title, description, canonical, hreflang |
| `forms.spec.ts` | no | the six forms, invalid input only, with and without JavaScript |
| `journeys.spec.ts` | no | J1–J6 from the spec |
| `security.spec.ts` | no | headers, no third-party script, robots/sitemap/feed |
| `admin.spec.ts` | no | unauthenticated redirects, login without JavaScript |
| `visual.spec.ts` | no | see §5.2 |

Classify each failure as (a) a real defect in `src/`, (b) missing published
content — the live database has one published programme, so most lists render
their empty state and that is a pass, or (c) a test problem. Fix (a) and (c).

### 5.2 Visual baselines

`npm run test:visual:update`, then look at each PNG before committing it.
Baselines are per platform; CI runs `--ignore-snapshots` until Linux baselines
exist.

### 5.3 Lighthouse

`npm run lhci` against **`next start`**, not the dev server — the development
bundle is several times larger and the numbers are meaningless. Budgets are in
`lighthouserc.cjs`, from `docs/spec/03-FRONTEND.md` §9.

### 5.4 Small, each under an hour

- **Render the galleries that queries now return.** `_getStoryBySlug`,
  `_getPostBySlug` and `_getProgramBySlug` return `gallery`; the three detail
  pages render only `hero`. Files: `impact/stories/[slug]/page.tsx`,
  `news/[slug]/page.tsx:118`, `programs/[slug]/page.tsx:127`.
- **`/careers` vacancy-type tabs.** `listOpenVacancies` accepts `{ type }` and
  nothing sets it (`careers/page.tsx:43`). Use the kit `Tabs`.
- **Home featured posts.** `listPosts` now accepts `featuredOnly`
  (`page.tsx:657`). Editorial decision: latest three, or the featured ones?
  Without it the "featured" checkbox in the news form does nothing.
- **`errors.content.keyTaken`.** The page-key collision currently reuses
  `errors.slug.taken`. Add the precise key to `ar.ts`/`en.ts` and use it in
  `createContentService`.
- **`safeReturnPath`** (`src/actions/admin/flash.ts:21`) rejects any `returnTo`
  carrying a querystring, so publishing from page 3 of a list returns you to
  page 1. Widen the pattern to accept `?page=` without opening a redirect.
- **Flip the restricted-classes rule to `error`** in `eslint.config.mjs`. The
  tree has been at zero for several passes.
- **Delete `docs/audit/**` if you want it gone** — it is a point-in-time report,
  not documentation. `CLAUDE.md`, `DEPLOYMENT.md` and this file reference it, so
  update those three if you do. Kept for now because it records *why* several
  non-obvious decisions were made.

### 5.5 Two that need a decision, not an implementation

- **`media-uploader.tsx` is the one form that needs JavaScript.** It streams a
  file, and non-negotiable #7 says every form works without it. A documented
  exception, or a no-JS fallback that posts to a route handler?
- **`programs.specific_objectives` and `key_interventions`** are live columns
  that nothing reads or writes. Either an `ArrayField` in the admin plus a block
  on the programme page, or drop them in a migration.

---

## 6. Blocked on the owner

Nothing in §5 unblocks these; they need a credential, a decision, or
organisational copy.

1. **Apply the migrations to production.** `npm run db:migrate` covers `0003`
   (the audit sequence grant — without it every audited mutation aborts) and
   `0005`. Then `supabase db push` for the storage buckets; the live project has
   no `supabase_migrations` schema yet, so this is its first push.
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
9. **M7 in full**: real content, cross-browser and real-device testing, the
   domain cutover, Search Console, an uptime monitor, an Arabic admin guide with
   screenshots, and a credentials handover under organisational accounts.
