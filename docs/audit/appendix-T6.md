# Track T6 — Supabase, Data & Schema (raw findings)

Working file. Merged into `01-AUDIT-REPORT.md`.

All findings below are [VERIFIED-CODE] against `drizzle/*.sql` and `src/`.
`CLAUDE.md:143` designates `drizzle/0001_app_runtime_layer.sql` as an extract of the
live database, so it is the best available proxy for production — but DATA-009 shows
the two have already diverged once, so DATA-001 … DATA-006 must be confirmed with a
read-only `psql` session before their fixes are applied. See `04-OPEN-QUESTIONS.md`.

I independently re-verified DATA-001, DATA-002 and DATA-003 line by line before
accepting them.

---

## DATA-001 — Identity lookup runs with no actor bound, so RLS returns zero rows and no one can sign in
**P0 · [VERIFIED-CODE]**

Evidence:
- `drizzle/0001_app_runtime_layer.sql:941-945` — the only runtime SELECT policy on `profiles`:
  `using ((app.is_staff() OR (id = app.actor_id())))`
- `drizzle/0001_app_runtime_layer.sql:56-63` — `app.is_staff()` is `app.actor_role() in ('editor','content_manager','admin')`, and `actor_role` reads a session GUC.
- `src/lib/auth/session.ts:23-32` — the read is issued on the bare `db` handle, never through `withActor`/`readAsActor`.
- `src/lib/auth/session.ts:46` — same in `getCurrentProfileDetail`.
- `src/actions/admin/auth.ts:40` — `signIn` repeats it and reads the empty result as a deactivated account.

Root cause: the identity lookup necessarily runs *before* an actor exists, and the RLS design never resolved that chicken-and-egg.

Impact: with correct credentials `signIn` returns `admin.auth.deactivated` and signs the user out; `requireAuth()` redirects to `/admin/login` forever. **The entire CMS is unreachable in production.** `lastLoginAt` (`auth.ts:51`) also updates 0 rows.

Fix: add a `SECURITY DEFINER` `app.actor_profile(p_id uuid)` returning only `(id, role, can_view_sensitive, is_active)`, grant EXECUTE to `app_runtime`, and call it from `getCurrentProfile` / `getCurrentProfileDetail` / `signIn`. Chosen over widening `rt_select`, which would let `anon` enumerate staff email addresses.

Effort: M · Requires a DB migration — **gated**.

Verification: `select id from profiles limit 1` as `app_runtime` returns 0 rows today; after the fix `select * from app.actor_profile('<uuid>')` returns the row and a browser login reaches `/admin`.

---

## DATA-002 — `app_runtime` has INSERT on `audit_logs` but no USAGE on its sequence, so every audited mutation fails
**P0 · [VERIFIED-CODE]**

Evidence:
- `drizzle/0000_baseline.sql:446` — `"id" bigserial PRIMARY KEY NOT NULL`
- `drizzle/0002_runtime_grants.sql:33` — `grant insert on public.audit_logs to app_runtime;` and nothing else; no `GRANT ... ON SEQUENCE` exists anywhere in the repo.
- `src/services/_shared/audit.ts:37` — the insert omits `id`, so `nextval()` executes as `app_runtime`.

Root cause: Postgres checks `nextval` on a column default against the **sequence**, which `GRANT INSERT ON TABLE` does not confer; commit `5fb312a` derived its fix from missing *table* grants only.

Impact: every service mutation ends in `writeAudit` inside the same transaction, so `permission denied for sequence audit_logs_id_seq` rolls back every save, publish and delete. Exactly the blast radius `0002`'s own header describes, one layer down. PGlite connects as `postgres` and cannot catch it.

Fix: `grant usage, select on sequence public.audit_logs_id_seq to app_runtime;`. `USAGE`, not `ALL`; do not convert the column to `identity` (a table rewrite for no security gain).

Effort: S · Requires a DB migration — **gated**.

Verification: `select nextval('public.audit_logs_id_seq')` as `app_runtime` fails today, succeeds after.

---

## DATA-003 — `app.can_view_sensitive` is never set, so the confidential complaints inbox is permanently empty
**P0 · [VERIFIED-CODE]**

Evidence:
- `drizzle/0001_app_runtime_layer.sql:86-95` — the gate reads a **third** GUC:
  `select app.is_staff() and coalesce(current_setting('app.can_view_sensitive', true), 'false') = 'true'`
- `drizzle/0001_app_runtime_layer.sql:689, 699` — both `form_submissions` policies branch on it.
- `src/db/session.ts:29-33` — `withActor` sets exactly two settings, `app.actor_id` and `app.actor_role`.
- No `set_config` for `can_view_sensitive` exists anywhere in `src/` or `scripts/`; the TypeScript `Actor.canViewSensitive` field never reaches the database.

Root cause: `Actor` carries three authorisation facts; `withActor` binds two.

Impact: `listSubmissions(actor, { sensitive: true })` (`src/db/queries/admin/index.ts:280`) returns an empty list to a fully authorised safeguarding officer and the dashboard badge reads 0. The CFM complaint channel — the flow the whole encryption and DNH-8 design exists to serve — has no readable inbox.

Fix: extend `ActorContext` with `canViewSensitive` and add a third `set_config('app.can_view_sensitive', …, true)` to the same statement in `src/db/session.ts`. Do **not** derive it from role inside the SQL function — the per-person grant is the documented rule (`src/services/_shared/permissions.ts:130`).

Effort: S · **Application-only. Not gated.**

Verification: integration check against the real database — with the three GUCs set, `select count(*) from form_submissions where is_sensitive` returns > 0 as `app_runtime`.

---

## DATA-004 — The whole submission read/write path uses the actor-less handle, so the inbox 404s and state changes throw
**P0 · [VERIFIED-CODE]**

Evidence:
- `src/services/submission/submission.service.ts:158` — `getSubmission` selects on bare `db`, then `throw notFound('submission')`.
- `src/services/submission/submission.service.ts:170` — `writeAudit(db, …)` on the bare handle.
- `src/services/submission/submission.service.ts:202, 211` — `setSubmissionState` reads outside any actor and mutates in a plain `db.transaction`.
- `src/services/submission/submission.service.ts:272` — `countNewSubmissions` likewise.
- `src/app/api/admin/submissions/[id]/attachment/route.ts:30, 55` — the download route repeats both mistakes.
- Refusing policies: `drizzle/0001_app_runtime_layer.sql:689` (select), `:696` (update), `:672` (`audit_logs.rt_insert` requires `app.is_staff()`).

Root cause: these functions ignore the `withActor` contract that `content-service.ts`, `media.service.ts` and `catalog.service.ts` all honour — the inconsistency is confined to the submission module and two route handlers.

Impact: `/admin/submissions/[id]` renders `notFound()` for **every** submission; `setSubmissionState` updates 0 rows then throws an RLS violation on the audit insert; the attachment route always 404s. The list page works (it uses `readAsActor`), so the failure looks like data corruption to the operator, not like a permissions bug.

Fix: wrap the four functions and the route-handler query in `readAsActor`/`withActor`, passing `tx` into `writeAudit` so the audit entry shares the mutation's transaction — which `src/services/_shared/audit.ts:45` already requires. Do not widen `app_runtime`'s grants; the policies are correct, the callers are not.

Effort: M · **Application-only. Not gated.**

Verification: open `/admin/submissions/<id>` as a `content_manager` and get the record; `select count(*) from audit_logs where action='view_sensitive'` increments.

---

## DATA-005 — The hourly archive cron issues a plain UPDATE with no actor and silently archives nothing
**P1 · [VERIFIED-CODE]**

Evidence:
- `src/app/api/cron/archive-expired/route.ts:23` — `db.update(posts).set({ status: 'archived' })…`
- `drizzle/0001_app_runtime_layer.sql:928` — `posts.rt_update using (app.is_staff())`; with no actor `app.actor_role()` is `anon`, so 0 rows match.
- `drizzle/0001_app_runtime_layer.sql:107` — the purpose-built `SECURITY DEFINER` `app.archive_expired_content()` exists and is called by nothing (`grep -rn "archive_expired_content" src/` → no hits).

Root cause: the lesson the purge path learned and documents (`submission.service.ts:249-258`) was not applied to the archive path.

Impact: expired announcements stay `published` indefinitely — `_listPosts` (`src/db/queries/content.ts:163`) has no `expires_at` filter, so they render forever. The endpoint returns `{archivedPosts: 0}` with HTTP 200, so monitoring shows a healthy cron. Closed vacancies have the same exposure.

Fix: call `app.archive_expired_content()` via `db.execute` + `rowsOf`, and drive `revalidateEntity` from its `entity` / `slug_ar` / `slug_en` columns.

Effort: S · **Application-only. Not gated.**

Verification: seed an announcement with `expires_at = now() - interval '1 day'`, hit the endpoint with the cron token, assert `status='archived'` and a non-zero JSON count.

---

## DATA-006 — `audit_logs.rt_insert` cannot be satisfied by `SYSTEM_ACTOR`
**P2 · [VERIFIED-CODE]**

Evidence: `src/services/_shared/audit.ts:38` writes `actorId: null` for system actors; `src/services/_shared/actor.ts:20` gives `SYSTEM_ACTOR` the all-zero sentinel UUID; `drizzle/0001_app_runtime_layer.sql:674` checks `NOT (actor_id IS DISTINCT FROM app.actor_id())`, and `null IS DISTINCT FROM '000…0'` is true.

Root cause: two encodings of "no human did this" — NULL in the column, a sentinel UUID in the session — compared for equality.

Impact: latent today (no such caller exists), but the first automated job made auditable aborts with an RLS violation, and `listAudit`'s `isSystem` column (`src/db/queries/admin/index.ts:336`) is UI for rows that can never be created.

Fix: widen the policy to also allow `actor_id is null and app.actor_id() = '00000000-0000-0000-0000-000000000000'::uuid`. Do not store the sentinel instead — `audit.ts:50` is right that inventing a person is a lie in the one table that exists to be trusted.

Effort: S · Requires a DB migration — **gated**.

---

## DATA-007 — No migration creates the `auth.users` trigger, so a new Auth user never gets a `profiles` row
**P1 · [VERIFIED-CODE]**

Evidence: `drizzle/0001_app_runtime_layer.sql:339` defines `app.handle_new_user()`; the 33-trigger block at `:1216-1292` contains no trigger on `auth.users`; `supabase/migrations/` holds only the 0-byte placeholder; `CLAUDE.md:154` assigns this trigger to that directory. `app.handle_user_email_change` (`:361`) is equally unwired.

Impact: a rebuild from the repo — staging branch, Supabase branch, disaster recovery — produces a database where inviting an admin creates an `auth.users` row and nothing else, and the invitee lands in DATA-001's "deactivated" path with no recovery except manual SQL.

Fix: add `supabase/migrations/<ts>_auth_profile_trigger.sql` creating both triggers. It belongs in `supabase/`, not `drizzle/`, because `auth` is not Drizzle's schema.

Effort: S · **File creation is not gated; applying it is.**

---

## DATA-008 — Storage buckets and their policies exist in no migration
**P1 · [VERIFIED-CODE]**

Evidence: `grep -rn "storage.buckets\|create bucket" drizzle/ supabase/` → no matches. Buckets referenced only as string literals: `src/app/api/admin/media/route.ts:115` (`media` / `documents`), `src/actions/public/forms.ts:183`, `src/app/api/cron/purge-submissions/route.ts:26`, `src/app/api/admin/submissions/[id]/attachment/route.ts:50` (all `applications`). `CLAUDE.md:88` claims bucket `file_size_limit` values are a second wall; that claim is asserted nowhere in the repo.

Impact: the documented second wall on upload size is unverifiable and possibly absent; `applications` being private — the only thing between an anonymous URL and a job applicant's CV — is unversioned. A rebuilt environment has no buckets and every upload 404s.

Fix: hand-author `supabase/migrations/<ts>_storage_buckets.sql` with idempotent `insert … on conflict (id) do update` for the three buckets plus the `storage.objects` policies. Hand-authored, not `supabase db diff`, which would drag Drizzle's `public` schema in.

Effort: M · **File creation is not gated; applying it is.**

---

## DATA-009 — 28 of the 31 documented CHECK constraints, including `submissions_sensitive_unlinkable`, are absent from the migrations
**P1 · [VERIFIED-CODE]**

Evidence: `CLAUDE.md:112` claims 31 CHECK constraints "including `submissions_sensitive_unlinkable` — DNH-8 as a constraint". `grep -n "CHECK" drizzle/0000_baseline.sql` returns exactly three (`organization_settings_singleton:97`, `projects_date_order:223`, `metrics_period_order:244`); `0001` contains no `ADD CONSTRAINT` at all. `src/services/submission/submission.service.ts:80` asserts the constraint as the third of three layers.

Impact: either the doc overstates what production enforces, or production has 28 constraints that any rebuild silently drops — including the one making DNH-8 structural rather than procedural. As shipped, the complaint-unlinkability rule has two layers, not three, and the tests validate two. Both readings block launch for a safeguarding rule.

Fix: restore the extraction script (DATA-018), extend it to emit `pg_constraint` type `c`, regenerate `0001`, diff against the doc. If the constraint genuinely does not exist, add it.

Effort: M · **Gated** (needs a production read to decide which of the two readings is true).

---

## DATA-010 — `_getOrganization` spreads the whole settings row, carrying the private address past the DNH-6 gate it just applied
**P2 · [VERIFIED-CODE]**

Evidence: `src/db/queries/content.ts:41` uses `db.select()` with no projection; `:50` computes a new `address` key gated on `addressIsPublic`, while `addressAr` / `addressEn` / `email` / `primaryPhone` / `additionalPhones` survive the `...row` spread untouched. `drizzle/0001_app_runtime_layer.sql:775` — `organization_settings.rt_select using (true)`, so RLS is not a backstop.

Impact: the private street address of an NGO operating in Gaza is one `org.addressAr` reference — in a component, a JSON-LD block, or a serialised RSC payload — away from a public page, with no type-level signal that it must not be touched. `addressIsPublic = false` is a policy the organisation set explicitly.

Fix: replace `.select()` with an explicit column projection and drop `addressAr`/`addressEn` from the returned object; keep the resolved `address`.

Effort: S · **Application-only. Not gated.**

---

## DATA-011 — `saveOrganization` spreads unvalidated client input into a Drizzle `.set()`
**P2 · [VERIFIED-CODE]**

Evidence: `src/actions/admin/catalog.ts:145` — `await updateOrganization(db, actor, input as Record<string, never>)` with a comment stating no schema is applied; `src/services/content/catalog.service.ts:383` — `.set({ ...input, updatedBy, updatedAt })`. The role split at `catalog.service.ts:369` is key-name driven, so it also depends on the key set being trustworthy.

Impact: an authenticated `content_manager` controls the exact key set reaching `.set()`. `logoPrimaryId` / `defaultOgId` are settable by a role the CONTACT_FIELDS allow-list was written to exclude, and unknown keys reach Drizzle's column mapper unfiltered. "Typed by the service" is a compile-time claim about a value cast with `as`.

Fix: add a `.strict()` partial `organizationSchema` to `src/lib/validation/admin.ts` and `safeParse` it in the action, as `saveMediaMetadata` (`catalog.ts:108`) already does.

Effort: S · **Application-only. Not gated.**

---

## DATA-012 — `createSubmission` re-reads its own row on the actor-less handle and always returns an empty `id`
**P2 · [VERIFIED-CODE]**

Evidence: `src/services/submission/submission.service.ts:110` selects by `reference` on bare `db`, then `return { id: stored?.id ?? '', … }`; `drizzle/0001_app_runtime_layer.sql:689` requires `app.can_publish()` or `app.can_view_sensitive()`, neither of which a public submitter has. The preceding `app.submit_form()` is `SECURITY DEFINER` and does succeed.

Impact: harmless today (`src/actions/public/forms.ts:116` uses only `reference`), but it is a guaranteed-empty round trip on the hot public path, and the next caller to trust `created.id` inherits a silent empty string rather than an error.

Fix: have `app.submit_form` return `(reference, id, purge_after)` and drop the follow-up SELECT.

Effort: S · **Gated** (changes a SQL function).

---

## DATA-013 — `media_assets` grants the runtime role unconditional SELECT, exposing consent references and the minors flag
**P2 · [VERIFIED-CODE]**

Evidence: `drizzle/0001_app_runtime_layer.sql:755` — `create policy "rt_select" … using (true)`, against `pages` at `:817` which uses `status = 'published' OR app.is_staff()`. Sensitive columns: `drizzle/0000_baseline.sql:60` `consent_reference`, `:62` `has_identifiable_minors`, `:39` `path`. Same pattern on `organization_settings` (`:775`), `redirects` (`:1119`) and the four `*_media` junctions.

Root cause: `media_assets` has no `status` column, so the "published or staff" template had nothing to key on and defaulted to `true`.

Impact: no leak through the current app surface (public queries always reach media through a published parent), but the second line of defence is absent on the one table holding safeguarding metadata — and `consent_reference` by design names a real consent document.

Fix: column-level privileges — revoke blanket SELECT and grant it on the render columns only, adding a staff-only policy for `consent`, `consent_reference` and `has_identifiable_minors`. Column privileges are the right tool because the row set genuinely is public; only three columns are not.

Effort: M · Requires a DB migration — **gated**.

---

## DATA-014 — `app.media_usage()` runs 20 unindexed scans; no FK pointing at `media_assets` is indexed
**P2 · [VERIFIED-CODE]**

Evidence: `drizzle/0001_app_runtime_layer.sql:387` — 20 union branches, each an equality on an unindexed column. `drizzle/0000_baseline.sql:517-552` is the complete index list; indexed FKs are only `project_partners.partner_id`, `projects.program_id`, `impact_metrics.program_id`, `audit_logs.actor_id`. Unindexed: every `hero_media_id` and `og_media_id`, `people.photo_media_id`, `partners.logo_media_id`, `publications.file_ar_id`/`file_en_id`, `organization_settings.logo_*_id`, all four `*_media.media_id`, `posts.program_id`/`project_id`, `stories.program_id`/`project_id`, `impact_metrics.project_id`, `form_submissions.handled_by`, every `created_by`/`updated_by`. Called at `src/db/queries/admin/index.ts:262`.

Impact: the delete-confirmation dialog costs 20 sequential scans. Worse, `deleteMedia` (`src/services/media/media.service.ts:184`) fires `ON DELETE SET NULL` against 17 unindexed columns and `CASCADE` against 4 more, so Postgres scans each referencing table in full inside the transaction, holding locks on tables the public site is reading.

Fix: one migration adding btree indexes on the 21 media-referencing FK columns plus the five other unindexed FKs, mirrored in `src/db/schema/*.ts` so `drizzle-kit generate` stays clean.

Effort: M · Requires a DB migration — **gated**.

---

## DATA-015 — Every admin list sorts on an unindexed `updated_at` and searches with a leading-wildcard ILIKE
**P3 · [VERIFIED-CODE]**

Evidence: `src/db/queries/admin/index.ts:81` (`ilike(…, '%'+search+'%')`) and `:98` (`.orderBy(desc(table.updatedAt))`), applied across all seven tables in `TABLES` (`:56`). No `updated_at` index exists in `drizzle/0000_baseline.sql:517-552`; no `pg_trgm` index anywhere. Same shape at `:247` for `listAdminMedia`.

Impact: each admin list page is a sequential scan plus a full sort, with `OFFSET` cost growing linearly. Invisible at launch volume; the first list to reach five figures makes the CMS feel broken.

Fix: add `(updated_at desc)` indexes per content table and `(created_at desc)` on `media_assets`. Leave the ILIKE alone until search is measurably slow — `pg_trgm` is an extension decision belonging in `supabase/migrations/`.

Effort: S · Requires a DB migration — **gated**.

---

## DATA-016 — Nine list queries have no LIMIT
**P3 · [VERIFIED-CODE]**

Evidence: `src/db/queries/admin/index.ts:190, 196, 202, 208, 312, 356, 363, 367`; `src/db/queries/content.ts:87, 316, 375, 404, 463`. `src/services/submission/submission.service.ts:272` fetches every matching id purely to call `.length` on it. (`src/db/queries/projects.ts:280` is unbounded by design for `generateStaticParams` — correct.)

Fix: add explicit caps plus a "showing first N" state on the affected admin lists, and change `countNewSubmissions` to `select count(*)::int`. The cap matters less than the query stating its own bound.

Effort: S · **Application-only. Not gated.**

---

## DATA-017 — `partnerId` reaches raw SQL as an unvalidated string in a `uuid` comparison
**P3 · [VERIFIED-CODE]**

Evidence: `src/db/queries/projects.ts:64` — `sql\`… pp.partner_id = ${filters.partnerId}\``. `src/app/(site)/[locale]/projects/page.tsx:33-49` never populates it, so no route supplies it today.

Impact: not injectable — the value is a bound parameter, not interpolated text. But the first route to wire `?partner=` without a UUID check turns a malformed query string into an unhandled `22P02` and a 500 on a cached public page.

Fix: guard with a UUID test inside `whereFor`, or brand the type and parse it in `readFilters`.

Effort: S · **Application-only. Not gated.**

---

## DATA-018 — `scripts/dump-app-layer.ts`, named as the only supported way to regenerate `0001`, is absent
**P3 · [VERIFIED-CODE]**

Evidence: `drizzle/0001_app_runtime_layer.sql:1` — "Extracted from the live database with scripts/dump-app-layer.ts. This file is NOT hand-authored." `CLAUDE.md:143` — "Regenerate it rather than editing it by hand." `ls scripts/` → `_env.ts`, `_owner-db.ts`, `seed.ts`.

Impact: the 1,292-line file that reproduces production authorisation semantics in tests has no reproducible source, so every future policy change must be hand-edited into a file that forbids hand-editing. That is precisely how the missing CHECK constraints (DATA-009) and the missing sequence grant (DATA-002) went unnoticed.

Fix: commit the script and add a `db:dump-app-layer` npm script, extracting `pg_proc` (schema `app`), `pg_policy`, `pg_trigger`, table grants, **sequence grants** and `pg_constraint` type `c` — the last three being the categories currently missing.

Effort: M

---

## CLEAN (T6)

- **Public `status='published'` filtering** — all 14 public query functions checked; every one filters, matching its policy. `people` uses `is_public`, `impact_metrics` uses `is_public AND status='verified'`. The doubled rule is intact.
- **`partners.logo_permission` gating** — enforced in SQL at both call sites (`content.ts:396`, `projects.ts:171`), not in components.
- **`people.is_public` (DNH-5)** — four independent layers: query filter, RLS policy, service gate, DB trigger.
- **`profiles` / `audit_logs` anon exposure** — neither is reachable by an actor-less caller. The policies are right; DATA-001 is a caller bug.
- **`withActor` transaction-local semantics** — `set_config(..., true)` is correct for a transaction-mode pooler.
- **`rowsOf` driver normalisation** — handles both `postgres-js` and PGlite shapes, used consistently.
- **Connection settings** — `prepare: false`, `max: 1`, `casing: 'snake_case'`, HMR global cache, `DIRECT_URL` for DDL. All four correct.
- **Timestamp consistency** — every timestamp is `timestamptz`; `date` is used only for genuine calendar dates.
- **Enum discipline** — 22 enums cover every closed domain; remaining free-text columns are open by design.
- **`ON DELETE` behaviour** — `set null` for authorship/media, `cascade` for junctions, `restrict` on `projects.program_id`, `set null` on `audit_logs.actor_id`. Matches the documented reasoning.
- **Transaction boundaries in content services** — all wrap read-check-write-audit in one `withActor` transaction.
- **Consent gate coverage** — application check plus two independent DB triggers, on both the upsert and the status-change paths.
- **Retention purge** — correctly delegates to the `SECURITY DEFINER` function and deletes storage objects before returning. The one path where the RLS-vs-actor problem was recognised and solved.
- **Supabase error handling** — all six `{ data, error }` destructurings check `error`; the two that only log are correct.
- **Signed-URL usage** — 60-second signed URL on the private bucket, sensitive rows refused before the URL is minted.

## COVERAGE (T6)

Exhaustive: all three `drizzle/*.sql` files (2,000+ lines — every gate function, trigger, grant, RLS statement, all 85 policies); `src/db/**`; `src/services/**`; all five API route handlers; `src/lib/auth/**`; `src/actions/admin/auth.ts`; `src/actions/public/forms.ts`.

Sampled: `src/db/schema/**` (4 of 18 files read in full and diffed against the SQL; the rest checked via the generated baseline); `src/actions/admin/catalog.ts` (partial); `src/app/(admin)/**` (only pages importing `@/db`); test bodies not read.

Not verifiable from the repository: whether the live database matches `0001` + `0002`.
