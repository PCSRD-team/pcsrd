# Tracks T1 / T2 / T3 — Architecture · Types · Duplication (raw findings)

Working file. Merged into `01-AUDIT-REPORT.md`. Every finding [VERIFIED-CODE]; the track
produced no [ASSUMPTION] findings. Tools run: `tsc --noEmit` (exit 0), the same with
`noUncheckedIndexedAccess` (32 `src/` errors), `eslint` (exit 0), a custom whole-tree
unused-export scanner over 162 files, a custom import-graph cycle detector over all 160
`src/` modules (**0 cycles**), and a per-dependency import grep across all 44 packages.

---

# T1 — ARCHITECTURE

**ARCH-001 · P1** — Archive cron mutates `posts`/`vacancies` directly with no actor.
Same finding as **DATA-005**. `src/app/api/cron/archive-expired/route.ts:23-33` vs
`drizzle/0001_app_runtime_layer.sql:927-932` (`rt_update using (app.is_staff())`) and
`:36-43` (`actor_role()` defaults to `anon`). The purpose-built
`app.archive_expired_content()` at `:106-133` is called by nothing. It is **the only
mutation in the codebase that skips `withActor()`**.

**ARCH-002 · P1** — `/admin/organization` is in the primary nav (`shell.tsx:85`) but the
route directory is **empty**. `getAdminOrganization` and `saveOrganization` have no callers.
`scripts/seed.ts:44-53` writes `TODO(org):` placeholders whose documented remediation path
is this page, so placeholder text renders publicly with no way to correct it short of raw
SQL. Same as **STATE-006** / **SEO-012**.

**ARCH-003 · P1** — CI `db-verify` invokes `scripts/assert-rls.ts`, which does not exist,
and asserts "zero policies", which `CLAUDE.md:101-109` says is obsolete. `main` is
permanently red; the failure gets trained away. Same as **OPS-001**.

**ARCH-004 · P2** — `src/actions/admin/auth.ts:40-54` holds a permission rule
(`if (!profile?.isActive)`) and two raw Drizzle statements in the action layer. The
`lastLoginAt` write skips `withActor`, so under `profiles.rt_update` it runs as `anon` and
last-login is silently never recorded — while `admin/users/page.tsx:53` renders that column.

**ARCH-005 · P2** — `removeMedia` (`catalog.ts:123-132`) performs the Storage deletion, the
ordering invariant and its error handling **inside a Server Action**, though
`media.service.ts:152-158` states the ordering rule. A cron, a bulk cleanup or a test
cannot reach it.

**ARCH-006 · P2** — `admin/projects/[id]/page.tsx:30-40` is the only page in 62 route files
that imports `db`, `readAsActor` and raw schema tables; it also fetches `links.media` and
**never uses it** — a wasted round trip on every `force-dynamic` render, and a signal the
gallery editor was dropped mid-implementation (`ProjectForm` receives no gallery prop).

**ARCH-007 · P2** — The attachment route writes `download_attachment` and
`view_sensitive` audit entries on the **unbound** `db` handle. Those are the two audit
actions that exist specifically to answer *"who opened this complaint"*, so the
highest-value audit events are the ones most likely to be missing. Root cause: `writeAudit`
accepts `Db | Tx`, which makes calling it outside a transaction typecheck. **Fix: narrow the
parameter to `Tx`** — that makes the class of bug impossible rather than fixed twice.

**ARCH-008 · P2** — Non-negotiable #10 unmet: no `loading.tsx` anywhere; `ListSkeleton` and
`ErrorState` have zero references. Same as **STATE-005** / **NEXT-002**.

**ARCH-009 · P2** — Every per-slug cache tag is inert. Same as **NEXT-007**.

**ARCH-010 · P2** — The `redirects` table is read by nobody, while
`admin/redirects/page.tsx:8-13` tells editors it takes effect on the next deploy. Same as
**SEO-006**.

**ARCH-011 · P3** — `src/lib/mail/send.ts` hardcodes nine Arabic subject lines and two full
English acknowledgement bodies, bypassing the dictionaries (non-negotiable #5). It is the
only module in `src/` with hardcoded user-facing copy. Root cause: `get-dictionary.ts`
imports `server-only`, which throws inside `after()` — but the dictionary *modules*
themselves carry no such guard, so a direct import works.

**ARCH-012 · P3** — The inline `'use server'` closure in the submissions page discards its
`ActionResult`. Same as **NEXT-010**.

**ARCH-013 · P3** — `test:unit` passes with zero tests. Same as **OPS-014**. The untested
pure functions are `slugify`/`deriveSlugs`, `computeDiff`, `addMonths` (which has a
documented month-clamping edge case), `negotiateLocale`, `tagsFor`, `formDataToObject`.

**ARCH-014 · P3** — Naming deviations: four services use `<name>.service.ts` while six more
live unsuffixed inside `services/content/index.ts`; `setProjectStatusAction` /
`deleteProjectAction` carry an `Action` suffix no sibling has, added only to dodge a name
clash; and `src/lib/i18n/form-dict.ts:1` imports from `@/components` — the **only** reverse
edge in a codebase where `components → lib` happens 14 times.

**ARCH-015 · P3** — God-files: `db/queries/content.ts` (507 lines, 10 entity families),
`services/content/index.ts` (421, six services), `catalog.service.ts` (396, four unrelated
entities), `db/queries/admin/index.ts` (372, 13 reads). The first and last are touched by
every entity change, so they are the merge-conflict hotspots.

**ARCH-016 · P3** — `attachment/route.ts:24` hand-types `context: { params: Promise<{id: string}> }`
instead of `RouteContext<'…'>`. Rename the segment and it compiles unchanged while
`params.id` becomes `undefined` at runtime.

**CLEAN (T1):** services are framework-free — zero `next`/`react`/`server-only` imports
across all 11 files, ESLint rule active · **zero circular imports** (Tarjan DFS over the
full 160-file graph) · no UI component imports server env; the three that import env use
`env.public` · logical CSS properties clean under both ESLint and stylelint · guard-first
discipline holds in every action · `next/cache` imported in exactly two files, never from a
service.

---

# T2 — TYPESCRIPT

**TYPE-002 · P1 — the most serious finding this track produced, and the security track
missed it.** The media upload route parses `FormData` with raw `as` casts and **never uses
`mediaMetadataSchema`**. `src/app/api/admin/media/route.ts:74-80`:

```ts
consent: (form.get('consent') as 'not_required' | 'obtained' | 'pending') || 'not_required',
hasIdentifiableMinors: form.get('hasIdentifiableMinors') === 'true',
```

`consent as …` accepts **any** string. Posting `consent=obtained&hasIdentifiableMinors=true`
with no `consentReference` satisfies the service's `!== 'not_required'` check at
`media.service.ts:59-63` and stores a photograph of an identifiable child marked as
consented, with no consent reference. **That is CLAUDE.md's "Never do" #8 reachable by a
single crafted request from any actor holding `media.upload` — which includes the `editor`
role.** Also: `form.get('altEn') as string` is a lie whenever the part is a `File`, writing
`[object File]` into a text column; and no length limits apply.
Fix: `mediaMetadataSchema.safeParse(...)` and a 422. Effort **S**.

**TYPE-001 · P2** — `noUncheckedIndexedAccess` is off, masking **32 real unchecked accesses**
(measured by compiling with the flag): `project.service.ts` 11, `catalog.service.ts` 10,
`content-service.ts` 4, `media.service.ts` 3, `submission.service.ts` 2, plus two others.
30 are `.returning()` destructures. This is not theoretical: the runtime connects as
`app_runtime` under `FORCE RLS`, so an `UPDATE … RETURNING` whose row the policy filters out
returns **zero rows** rather than raising — and every one of those sites then dereferences
`undefined`, producing a generic `errors.unexpected` instead of the `AppError('forbidden')`
the design intends. The 20 `computeDiff(existing, row)` variants would write a corrupt audit
diff. Fix: enable the flag and add a `one<T>(rows, entity)` helper that throws `notFound` —
**not** `!`, which the PR checklist bans.

**TYPE-003 · P1** — `saveOrganization` casts to `Record<string, never>`, which is
structurally assignable to `Partial<OrganizationInput>`, so the cast *suppresses* the
missing-schema error rather than surfacing it. Same as **SEC-005** / **NEXT-009**.

**TYPE-004 · P2** — `rowsOf<T>` asserts raw-SQL shapes without validating them, and is
re-implemented inline twice in `admin/index.ts` **without** its `Array.isArray` guard.
Sharpest case: `PurgeResult.attachments` feeds `storage.remove()` directly, so a rename in
the SQL function silently yields `[]`, the purge reports success, and applicants' CVs stay
in the private bucket forever — `??` turns a missing key into a *wrong answer* rather than
an error.

**TYPE-005 · P2** — `getAdminRow` returns a structurally-typed row every caller must cast;
it is the single read behind six edit pages. Rename a column in `db/schema/posts.ts` and all
six still compile while rendering `undefined`. On the service side,
`existing.heroMediaId as string | null` on a table lacking that column yields `undefined`,
which `assertMediaConsent` filters out — **so the consent gate silently checks nothing** on
any entity whose author forgot a `storedMediaIds` override.

**TYPE-006 · P2** — `specificObjectives` / `keyInterventions` have three mutually
inconsistent declarations (schema `ProgramBlock[]`, Zod `z.array(z.unknown())`, service
`unknown[]`), and are absent from `SHAPES.program` entirely — typed three ways and reachable
through none.

**TYPE-007 · P2** — `ContentMutationResult` is declared **twice**, byte-identically, in
`_shared/content-service.ts:45` and `project.service.ts:81`; `actions/admin/content.ts:57`
passes results from both through one function. Structural typing hides it until either gains
a field. The doubled JSDoc has already drifted ("invalidated" vs "busted").

**TYPE-008 · P2** — Eleven entities each carry a hand-written service input type parallel to
a Zod schema with **no `z.infer` link** — 22 declarations of 11 entities, ~450 lines kept in
lockstep by hand. Drift already present: `projectSchema` requires `programId` and defaults
three arrays, while `ProjectInput` declares all three optional. Fix: invert to
`type X = z.infer<typeof xSchema>`. This does not make services import `next/*` — Zod is
runtime-agnostic — so the testability property CLAUDE.md protects is untouched.

**TYPE-009 · P3** — `SHAPES: Record<string, FormShape>` widens its literal keys; fix with
`satisfies`. **TYPE-010 · P3** — `submissionState` cast straight from `FormData`.
**TYPE-011 · P3** — `SKIP_ENV_VALIDATION` double-casts `process.env`, so CI builds with types
that promise values that are `undefined` — directly related to **OPS-002**.
**TYPE-012 · P3** — `resolveKey` walks the dictionary through a re-assertion per segment;
20+ `errors.*` keys thrown from services are never cross-checked against `ar.ts`/`en.ts`.

**CLEAN (T2):** zero `any`/`@ts-ignore`/`eslint-disable`/non-null `!`, re-confirmed ·
**the TipTap/jsonb boundary is the strongest part of the type story** — `richTextNode`
validates the tree recursively with `z.lazy` at every depth before it reaches
`jsonb().$type<RichText>()`, and renders through a closed node map with a scheme filter ·
`searchParams` parsing narrows every facet through a type-guard against `pgEnum` values ·
`Dictionary = typeof ar` with `en.ts` satisfying it, so a key added to one and forgotten in
the other is a build error (314 keys verified on each side) · env module boundary sound.

---

# T3 — DUPLICATION / DEAD CODE

**DUP-001 · P1 — two parallel action layers; ~360 lines of dead Server Actions.**
Whole-tree reference index: **all 18 exports of `src/actions/admin/content.ts` are
unreferenced**, as are 9 of 10 in `catalog.ts` and 3 in `entity-forms.ts`.
`entity-forms.ts:39` claims to be "a thin shell over `content.ts`"; it imports the
**services** directly and bypasses it. Two consequences beyond dead weight:
(a) **functional** — nothing in the admin UI can change a content status or delete anything;
publishing works incidentally through the upsert path, but archive-on-list, delete, and the
entire partner/person/metric CRUD have no route at all;
(b) **security surface** — every `'use server'` export is a live POST endpoint whether or not
any UI calls it, so **28 unaudited, never-manually-tested mutation endpoints are deployed**,
including `saveOrganization`, whose missing validation is TYPE-003.

**DUP-002 · P2** — Three pill-badge implementations with **already-drifted** tone maps:
`Badge.complete` is `border-rule-strong` where `STATUS_TONE.draft` is `border-rule`, and
`Badge.planned`/`STATUS_TONE.archived` are the same two states swapped. Padding differs three
ways. A designer changing the "published" chip must find four files.

**DUP-003 · P2** — Two complete form-field libraries. `inputClass` is `px-3 py-2`,
`controlClass` is `px-4 py-3` — unexplained drift, so an admin input and a public input are
visibly different heights. More seriously, `FieldShell` wires `aria-describedby` and
`role="alert"` and `Field` wires **neither**, so the admin forms lose the error-association
the public forms have.

**DUP-004 · P2** — `rowsOf` re-implemented inline twice **without its guard**, and the
Supabase-admin-client dynamic import written four times with **four different answers** to
"the object write failed" (two log-and-continue, one 500, one field error).

**DUP-005 · P2** — `project.service.ts` re-implements `content-service.ts`'s sequence,
duplicating the unpublish-first rule and the publish/archive/unpublish audit ternary
verbatim — the two behaviours where projects and the other six **must** agree, and they
agree only by transcription. The stated justification is weaker than it reads: `afterWrite`
and `storedMediaIds` hooks already exist for exactly this, and `programService` uses them.

**DUP-006 · P2** — `catalog.service.ts` has three copy-pasted delete functions and three
copy-pasted upsert bodies (~120 lines). All ten of its `noUncheckedIndexedAccess` errors are
the *same* bug replicated across the copies. The permission checks have already drifted into
three spellings of "is this going public".

**DUP-007 · P3** — Three dependencies never imported (`@react-email/components`,
`date-fns`, `@supabase/supabase-js` directly); `optimizePackageImports` names
`lucide-react`, which is not a dependency; and **`CLAUDE.md:11` plus the handoff README both
name shadcn/ui, which is absent** — so a new contributor's first instinct is
`npx shadcn add button`, which would introduce the physical CSS properties the ESLint rule
then rejects. `send.ts` hand-concatenates email HTML (what `@react-email/components` was
for) and `utils.ts` hand-rolls `addMonths` (what `date-fns` was for).

**DUP-008 · P3** — The five create-next-app SVGs remain in `public/`, referenced by nothing;
`next.config.ts:90-95` caches `/fonts/:path*`, a route that does not exist.

**DUP-009 · P3** — 16 unused exports, verified individually. Not stylistic dead code in the
important cases: `getAdminOrganization` and `getMediaUsage` are each the **query half of an
unbuilt screen**, so their presence makes those screens look implemented in a file listing.
Also unused at the SQL layer: `app.archive_expired_content`, `app.media_consent_violations`,
`app.purge_audit_logs`, `app.security_context`.

**DUP-010 · P3** — Arabic label maps duplicated across six files, three bypassing
`ADMIN_OPTIONS` entirely and typed `Record<string, string>` with `?? raw` fallbacks — so a
new enum value renders as a raw snake_case identifier in the Arabic admin instead of failing
the build, forfeiting the exact guarantee `admin-options.ts:20-24` documents.

**DUP-011 · P3** — `getCurrentProfile` / `getCurrentProfileDetail` duplicate the auth round
trip; `React.cache` memoises each separately, so every admin page makes **two**
`auth.getUser()` calls. Same as **PERF-004**.

**DUP-012 · P3** — `Badge` uses `rounded-full`, which `CLAUDE.md:195` forbids without
exception, while `primitives.tsx:185-188` grants itself the exception in a docstring. The
design judgement is sound; the governing document just does not record it.

**DUP-013 · P3** — `storageUrl` is called with the same first argument at all nine sites,
forcing `publicEnv` into seven modules that need no other env access.

**CLEAN (T3):** **TODO inventory confirmed — none is real debt.** 13 hits, 12 of them the
deliberate `TODO(org)` seed-placeholder mechanism plus one `PCS-XXXXXX` docstring. The
placeholders are *supposed* to be loud; the only thing making them a problem is that their
remediation path does not exist (ARCH-002) · **zero commented-out code** — every comment in
the codebase is explanatory prose, and consistently explains *why* rather than *what* ·
Tailwind `@theme` is the single source of truth; only two inline `style` attributes exist and
both read a CSS variable rather than hardcode a value, which is the correct escape for a
token name stored in the database · no two components doing the same job beyond DUP-002/003.

---

# COVERAGE (T1–T3)

Exhaustive: all config files; all 5 `src/actions/**`; all 11 `src/services/**`;
`db/session.ts`, `db/queries/admin/index.ts`, `_cache.ts`, `_localize.ts`; 18 `src/lib/**`
modules; 8 component modules; all 5 route handlers; `proxy.ts`; `layout.tsx`; `globals.css`;
6 admin pages; targeted reads of `0001_app_runtime_layer.sql`.

Outline or targeted grep: `db/queries/content.ts` (every `cached()` registration read in
full), `projects.ts`, the 20 remaining schema files, the 44 remaining route files, the 10
remaining component modules, `seed.ts`, both dictionaries (key-set diff), the five
`lib/security` modules.

Not read: `docs/spec/**` beyond targeted greps (CLAUDE.md supersedes them),
`0000_baseline.sql`, `0002_runtime_grants.sql`, `supabase/migrations/**`,
`package-lock.json`.

Not verifiable from the repository: the *runtime* behaviour of ARCH-001 and ARCH-007 under
live RLS — the policy text makes the conclusion mechanical, but PGlite connects as
`postgres` and cannot demonstrate it. *(I closed this gap separately: see the PGlite
role-switching harness in `01-AUDIT-REPORT.md`, which proves the same mechanism for
DATA-001/002/003.)*
