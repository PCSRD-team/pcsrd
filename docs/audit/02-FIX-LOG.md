# 02 — Fix log

Every change made during this audit, in commit order. Each entry gives the root cause in one
sentence, the files, the commit, and how the fix was verified.

Branch: `chore/pre-launch-audit`. Nothing pushed. `main` is discussed in
`04-OPEN-QUESTIONS.md` B3.

Verification labels are the same three used throughout:
`[VERIFIED-EXEC]` I ran it · `[VERIFIED-CODE]` read from source · `[ASSUMPTION]` stated as such.

---

## FIX-01 · Bind every session GUC the RLS policies read

**Findings:** DATA-001, DATA-003, SEC-001, SEC-002
**Commit:** `ad2a53d` — *fix(db): bind every session GUC the RLS policies actually read*
**Severity:** P0 ×2
**Effort:** S

**Root cause.** `withActor` set two of the three session settings the policies read, and the
identity bootstrap set none of them, because `current_setting(name, true)` returns NULL
rather than raising and a policy that filters every row is not an error.

**Files:** `src/db/session.ts`, `src/lib/auth/session.ts`

**What was wrong.**

`app.can_view_sensitive()` is `app.is_staff() AND current_setting('app.can_view_sensitive') = 'true'`.
`withActor` bound `app.actor_id` and `app.actor_role` and never the third, so the function
was always false and `form_submissions.rt_select` filtered every sensitive row away. The
confidential complaints inbox returned nothing and reported itself empty to the staff
responsible for answering it.

`getCurrentProfile` ran on the bare `db` handle. `profiles` is `FORCE ROW LEVEL SECURITY`
and `app_runtime` has no `BYPASSRLS`, so the statement was `anon`, matched neither branch of
`profiles.rt_select`, and returned zero rows. `[profile] ?? null` then returned null, and
every guard downstream reads null as "not signed in". Nobody could sign in to the CMS.

**Fix.** `ActorContext` gains `canViewSensitive` and `withActor` sets all three settings in
the same statement. Every existing call site already passed an `Actor`, which carries that
field, so nothing else changed — typecheck confirmed it.

The identity read uses a new `readAsSelf`, which binds **only** `app.actor_id` and leaves the
role at its `anon` default.

**Why this over the alternatives.** The obvious fix for the bootstrap is to bind a role.
There is no correct role to bind: the role is what is being read. Binding `admin` to read a
profile is a privilege escalation with a plausible excuse, and it would run for every request
including one from a deactivated account. The database already provides the right answer —
`profiles.rt_select` is `app.is_staff() OR id = app.actor_id()`, and the second branch exists
for exactly this case.

**Trade-off.** `readAsSelf` is a second, narrower entry point, so there are now two ways to
open a bound transaction. Its docstring names its one legitimate caller.

**Verification.** `[VERIFIED-EXEC]` — PGlite (real Postgres 17) with this repository's
migrations applied and `set role app_runtime`:

```
self-read binding ONLY app.actor_id:
  app.actor_role()        "anon"        app.is_staff()   false
  select profile row      rows=1        (its own)
  other profiles visible  0

sensitive submissions with the 2 GUCs withActor used to set:
  app.can_view_sensitive()  false       rows=0
  after adding the third:
  app.can_view_sensitive()  true        rows=1   {"reference":"PCS-TEST01"}
```

**Risk of fix.** Low. The widened type is enforced by the compiler; `readAsSelf` grants
strictly less than `withActor`.

---

## FIX-02 · Repair the migration journal

**Findings:** OPS-003
**Commit:** `806ce0b` — *fix(db): repair the migration journal so a fresh database can be built*
**Severity:** P1 · **Effort:** S

**Root cause.** The journal is maintained by hand here — both `0001` and `0002` were
authored outside `drizzle-kit generate` — and nothing in the toolchain checks that a journal
entry names a file that exists.

**Files:** `drizzle/meta/_journal.json`, `drizzle/meta/0002_snapshot.json`, `drizzle/meta/0003_snapshot.json`

**What was wrong.** The journal named `0001_triggers_rls`; the file is
`0001_app_runtime_layer.sql`. `0002_runtime_grants.sql` was absent from the journal
altogether. `drizzle-kit migrate` reads the journal, so against an empty database it looked
for a file that does not exist and would never have applied `0002`. **There was no working
path from a clean Postgres to this schema.**

Nothing caught it: `drizzle-kit check` validates the snapshot chain and reports
"Everything's fine", and the integration tests glob `drizzle/*.sql` directly and ignore the
journal — so they exercised migrations the migrator could not run.

**Verification.** `[VERIFIED-EXEC]` — all four entries resolve to files on disk;
`drizzle-kit check` clean. A CI step now asserts this property directly, so it cannot recur.

---

## FIX-03 · Grant USAGE on the audit_logs sequence

**Findings:** DATA-002
**Commit:** `0d482d6` — *fix(db): grant the runtime role USAGE on the audit_logs sequence*
**Severity:** P0 · **Effort:** S

**Root cause.** `USAGE` on a sequence is a privilege distinct from `INSERT` on the table that
uses it, and `0002_runtime_grants.sql` granted only the latter.

**Files:** `drizzle/0003_audit_log_sequence_grant.sql` (new)

**What was wrong.** `audit_logs.id` is `bigserial`, so every insert calls
`nextval('public.audit_logs_id_seq')` in the column default. As `app_runtime` that failed
with `permission denied for sequence audit_logs_id_seq`.

The damage is not a missing audit entry. Every service writes its audit entry inside the same
transaction as the change it records — deliberately, so an unaudited mutation cannot commit —
so the error rolled the whole transaction back. **Publishing a post, saving a project and
uploading media all aborted.**

**Why USAGE and not ALL.** `USAGE` permits `nextval` and `currval` but not `setval`, which
would let the runtime rewind the counter and overwrite existing rows in an append-only table.

**Scope.** `audit_logs.id` is the only sequence in the schema — every other primary key is a
uuid — so this closes the class, not just the instance.

**Verification.** `[VERIFIED-EXEC]`, same harness, before and after:

```
0000-0002 only : permission denied for sequence audit_logs_id_seq
with 0003      : INSERT OK id=1
```

**Not yet applied to production.** See `04-OPEN-QUESTIONS.md` A2 — this is the single item I
would not launch without.

---

## FIX-04 · Bind an actor to every statement the complaints inbox issues

**Findings:** DATA-004, DATA-005, ARCH-001, ARCH-007, SEC-002
**Commit:** `f2aaa68` — *fix(admin): bind an actor to every statement the complaints inbox issues*
**Severity:** P0 ×1, P1 ×2 · **Effort:** M

**Root cause.** `writeAudit` accepted `Db | Tx`, which made an actor-less call typecheck, and
the submission service and attachment route took that option throughout.

**Files:** `src/services/_shared/audit.ts`, `src/services/submission/submission.service.ts`,
`src/app/api/admin/submissions/[id]/attachment/route.ts`,
`src/app/api/cron/archive-expired/route.ts`, `tests/integration/submission.test.ts`

**What was wrong.**

- `getSubmission` threw `notFound` for every submission in the inbox, including
  non-sensitive ones.
- `setSubmissionState` threw `notFound` before it could write.
- `countNewSubmissions` returned 0, so the dashboard badge was always 0.
- The attachment download 404ed for every applicant CV.
- The `view_sensitive` and `download_attachment` audit entries — the two that exist to answer
  *who opened this complaint* — were refused by `audit_logs.rt_insert`. The
  highest-value audit events were the ones guaranteed to be missing.
- The archive cron ran two plain `UPDATE`s with no actor at all. Under
  `posts.rt_update using (app.is_staff())` it matched no rows and returned
  `archivedPosts: 0` — indistinguishable from nothing having expired.

**Fix, and why this shape.** Narrowing `writeAudit` to `Tx` was the structural half: it made
the compiler find the second offending call site rather than relying on me to remember it.
The archive cron now calls `app.archive_expired_content()`, which is `SECURITY DEFINER`, was
written for this, and was called by nothing. Binding a fabricated staff actor would also have
worked and would have been worse — it puts a person's role on an action no person took, in
the one place the database is asked to trust the application.

**Also fixed here.** `createSubmission` read the row back after inserting it to return an
`id`. `form_submissions.rt_select` never admits `anon`, so that read returned nothing and the
field was the empty string in production. It was correct in the integration suite only
because PGlite connects as `postgres` and matches `pcsrd_owner_all` — the tests were proving
the opposite of production. `CreatedSubmission` no longer claims an `id`, and the tests
resolve one by reference, the way the inbox does.

**Trade-off.** The attachment route now opens two short transactions rather than one, because
the signed-URL call between them is a network round trip and the pool is `max: 1`. Holding a
transaction open across it would serialise every other request behind it. The ordering is
what matters: the audit entry is written only once a usable link exists.

**Verification.** `[VERIFIED-EXEC]` — typecheck clean; `npm run test:int` 2 files / 27 tests
pass.

---

## FIX-05 · Focus, contrast, and dead classes

**Findings:** A11Y-001, A11Y-002, A11Y-005, DS-001, DS-002, DS-003, DS-004
**Commit:** `891d13e` — *fix(a11y): make focus visible, contrast pass AA, and dead classes impossible*
**Severity:** P1 ×7 · **Effort:** M

**Root cause.** Two independent ones, sharing a property: neither is visible in a diff, in a
type error, or to a reviewer reading left-to-right.

1. Tailwind v4's **block**-axis logical utilities (`mbs`, `mbe`, `border-be`) are real and
   were used correctly; a symmetric **inline**-axis set (`mis`, `pis`, `border-is`) was
   generalised from them and does not exist. No lint rule checked whether a class resolves.
2. Four colour tokens were measured against one ground and then used on three, and one was
   chosen against the 3:1 large-text threshold and documented as "AA-safe".

**Files:** 10 component and route files, `src/app/globals.css`, `eslint.config.mjs`,
`docs/design_handoff/README.md`

**What each dead class cost.** Blockquotes in rich text and on `/impact` with no gold rule
and no indent, indistinguishable from body text · every `<ul>`/`<ol>` in rich text with zero
inline padding, so markers hung past the panel edge in RTL · the admin sidebar with no
boundary · the required asterisk flush against its label on every form · and the skip link,
whose reveal class was one of them, so on focus it gained a background and 16px of padding
**9999px off-screen** — SC 2.4.7 failing on the first tab stop of every public page.

**Measurements.**

| | before | after | threshold |
|---|---|---|---|
| `gold-700` on paper | 3.42:1 | **5.75:1** | 4.5 (AA text) |
| `mono-muted` on page ground | 2.94:1 | **4.61:1** | 4.5 |
| focus ring on page ground | 1.88:1 | **12.30:1** | 3.0 (SC 1.4.11) |
| control boundary on paper | 1.43:1 | **3.11:1** | 3.0 |

**Why the lint rule is the real fix.** The renames fix eleven names at eighteen sites;
`better-tailwindcss/no-unknown-classes` fixes the class of defect. It is the highest-value
line in this audit per character changed.

**Trade-off, flagged.** `gold-700` and `mono-muted` are design tokens and your brief lists
brand assets as a hard stop. The brand's marking gold, `gold-600 #DD991C`, is **untouched**.
See `04-OPEN-QUESTIONS.md` B1 — two lines to revert.

**Verification.** `[VERIFIED-EXEC]` — every class candidate compiled against the project's
own design system via `tailwindcss` `candidatesToCss`, before and after; ratios computed from
the `@theme` hex values with the WCAG 2.x relative-luminance formula; eslint and stylelint clean.

---

## FIX-06 · Validate media upload metadata, and define the error copy it throws

**Findings:** TYPE-002, TYPE-012, DS-013
**Commit:** `e49ec00` — *fix(media): validate upload metadata and define the error copy it throws*
**Severity:** P1 · **Effort:** S

**Root cause.** The route built its metadata from `as` casts instead of the Zod schema that
already existed — and a cast is an assertion, not a check.

**Files:** `src/app/api/admin/media/route.ts`, `src/services/media/media.service.ts`,
`src/lib/i18n/dictionaries/ar.ts`, `src/lib/i18n/dictionaries/en.ts`

**What was wrong.** `form.get('consent') as 'not_required' | 'obtained' | 'pending'` accepts
any string. The service gate is `hasIdentifiableMinors && consent === 'not_required'`, so
posting `consent=obtained&hasIdentifiableMinors=true` satisfied it and stored a photograph of
an identifiable child as consented — `CLAUDE.md`'s "never do" #8, reachable by one crafted
request from any actor holding `media.upload`, which includes the `editor` role.
`form.get('altEn') as string` was wrong more quietly: the value is a `File` when the part is
a file, and `String(File)` is `"[object File]"`, written into a text column.

**A second gap the schema does not close.** `app.media_consent_violations` gates publishing on
`consent <> 'obtained'` and nothing else, so a *claim* of consent with no reference passed
every check in the system. The rule is **documented** consent; without a reference there is
nothing to produce when a parent, a donor or a regulator asks which form was signed.
`registerMedia` now requires one. `'pending'` deliberately stays legal — uploading while the
form is being collected is a real workflow, and the database already refuses to publish it.

**And why none of it would have been legible.** 12 of the 32 `errors.*` keys thrown in `src/`
were defined in **neither** dictionary. `resolveKey` returns the key itself when it does not
resolve, so an editor who tripped the safeguarding gate saw the Latin string
`errors.media.minorConsentState` inside a right-to-left Arabic screen. All twelve are now
defined in both locales — and `Dictionary = typeof ar` turned the English half into a build
error the moment the Arabic landed, which is that guarantee working exactly as designed.

**Flagged.** Those twelve strings are mine, not the organisation's voice.
`04-OPEN-QUESTIONS.md` B2.

**Verification.** `[VERIFIED-EXEC]` — key cross-check script over all 161 `src/` files
(32 referenced, 0 undefined after); typecheck, eslint, 27/27 integration tests.

---

## FIX-07 · Give each route group a real root layout

**Findings:** A11Y-003, A11Y-004, PERF-002
**Commit:** `468cbeb` — *fix(a11y): give each route group a real root layout with lang and dir*
**Severity:** P1 ×3 · **Effort:** M

**Root cause.** A real Next constraint — the root layout cannot see `params` — was solved by
moving `lang`/`dir` down to a wrapper `<div>` instead of by removing the root layout, which is
what Next's own multiple-root-layout support is for.

**Files:** `src/app/layout.tsx` (deleted), `src/app/fonts.ts` (new),
`src/app/(site)/[locale]/layout.tsx`, `src/app/(admin)/admin/layout.tsx`,
`src/app/(admin-auth)/admin/login/layout.tsx`

**What was wrong.** `<title>` lives in `<head>`, outside any wrapper, so assistive technology
announced every Arabic page title in an English voice, and `<html>` computed to `ltr` on
Arabic pages. That is **WCAG 2.2 SC 3.1.1, Level A** — the lowest bar in the specification —
failing on every public page in the default locale.

Meanwhile both admin layouts rendered their own `<html lang="ar" dir="rtl">`, and one's
docstring asserted "this is a **root layout**". It was not: `src/app/layout.tsx` sat above it,
so the admin served a second `<html>` nested inside the first. The parser discards it along
with the `lang` and `dir` it carried — an Arabic-only CMS rendering left-to-right.

**Why this fix.** Next's documentation is explicit on both halves: *"Any layout without a
`layout.js` above it is a root layout"*, and *"the root layout can be under a dynamic
segment, for example `app/[lang]/layout.js`"*. Removing the top-level layout is the
documented approach, not a workaround, and it is what all three files already assumed.

**Also fixed here.** All three layouts called `IBM_Plex_Sans_Arabic()` themselves. Each call
is a separate `next/font` instance with its own module hash and generated `@font-face` block,
so the same family was downloaded and served three times; the login layout had additionally
drifted to a narrower weight set, so anything rendered semibold there fell back to a
synthesised bold. One shared module, one instance.

**Verification.** `[VERIFIED-EXEC]` — `next build` then `curl` against `next start`:

```
/ar           <html lang="ar" dir="rtl">     1 <html>
/en           <html lang="en" dir="ltr">     1 <html>
/admin/login  <html lang="ar" dir="rtl">     1 <html>, 1 <body>
```

`/ar` and `/admin/login` now resolve to the same font CSS chunk.

**Risk of fix.** Medium — it changes the routing tree's shape. Mitigated by a full production
build and runtime checks on all three groups.

---

## FIX-08 · Make CI able to build, and make its security gate mean something

**Findings:** OPS-001, OPS-002, ARCH-003, TYPE-011
**Commit:** see below · **Severity:** P1 ×2 · **Effort:** M

**Root cause.** Two, compounding: `SKIP_ENV_VALIDATION=1` hands back raw `process.env` cast to
a type that promises values, so a build under it is not the build that runs in production;
and prerender treats a database round trip as guaranteed, which it is not in CI.

**Files:** `.github/workflows/ci.yml`, `scripts/assert-rls.ts` (new),
`src/lib/build-time.ts` (new), `src/app/sitemap.ts`, `src/app/feed.xml/route.ts`,
`src/app/(site)/[locale]/projects/[slug]/page.tsx`,
`src/app/(site)/[locale]/programs/[slug]/page.tsx`, `.env.example` (restored)

**What was wrong.**

1. Under `SKIP_ENV_VALIDATION=1` with no variables set, `publicEnv` parses to `{}`, so
   `src/app/robots.ts:4` — which calls `.replace()` on `NEXT_PUBLIC_SITE_URL` at module
   scope — threw `TypeError: Cannot read properties of undefined (reading 'replace')`.
   `[VERIFIED-EXEC]`, reproduced directly.
2. With that fixed, the build still failed: `generateStaticParams` for projects and
   programmes queries the database, and CI has none.
   `Error: Failed to collect page data for /[locale]/projects/[slug]`.

Either one is enough to fail the job. **`Assert no service-role key in the client bundle`
runs after `Build` in the same job**, so the check that `00-ARCHITECTURE §0.9 rule 10` calls a
total compromise if it fails had never executed once.

3. `db-verify` ran `scripts/assert-rls.ts`, which **did not exist**, and described itself as
   asserting "RLS on and zero policies" — which `CLAUDE.md` records as out of date. It would
   have failed against a correct database and passed against one whose policies had all been
   dropped: a security check that was wrong in both directions at once.

**Fix.**

- CI sets the full placeholder environment and no longer skips validation, so the build
  exercises the real env contract.
- `prerenderData()` degrades a build-time query to an empty result with a warning.
  `dynamicParams` is unset and defaults to `true`, so a slug that was not pre-rendered is
  rendered on demand and cached — the cost is a cold first hit, against a failed deploy.
- `scripts/assert-rls.ts` is written, and asserts the layer the database **actually** carries:
  `app_runtime` has neither `BYPASSRLS` nor `SUPERUSER`; `FORCE ROW LEVEL SECURITY` on every
  table; every table carries at least one policy; all six `app.*` gate functions exist; and
  the four grants exist, including the sequence grant from FIX-03.
- The leak check now greps for the **canary value** injected into the environment, not only
  for the words `service_role`. Grepping for the name proves the name is absent; grepping for
  the value proves the value did not travel. It also fails loudly if `.next/static` is
  missing, rather than passing vacuously — which is what it did before.
- A step asserts every journal entry resolves to a real file, so FIX-02 cannot regress.
- `.env.example` is restored. Both env modules tell the user to copy it and it had been
  deleted.

**Trade-off.** `prerenderData` swallows an error. Its docstring is explicit that it is for
build-time prerender only and never a request path, where an empty list is a lie told to a
visitor. It warns rather than staying silent.

**Verification.** `[VERIFIED-EXEC]` — I caught a bug in my own `assert-rls.ts` this way: the
column is `relforcerowsecurity`, not `relforcerowlevelsecurity`. All five queries then ran
against a real Postgres with this repository's migrations applied and returned **21 tables,
85 policies, 0 unforced** — independently reproducing the figures in `CLAUDE.md`. The full
build then completed with placeholder values and no database.

---

## FIX-09 · Bind the caller's id in `signIn` — which still rejected every login

**Findings:** ARCH-004, and the unfinished half of DATA-001
**Commit:** `95b1c61` — *fix(auth): bind the caller's id in signIn, which still rejected every login*
**Severity:** P0 · **Effort:** S

**A correction to FIX-01.** FIX-01 fixed `getCurrentProfile` and I reported sign-in as
working. It was not. `signIn` performs its **own, separate** read of `profiles` on the bare
`db` handle to check `isActive`, and I did not notice it until re-examining the login path
while answering a question about whether the site could be deployed.

**Root cause.** The same one as DATA-001 — an unbound statement against a `FORCE ROW LEVEL
SECURITY` table — in a second place, because the permission rule lives in the action layer
rather than in a service (which is ARCH-004's point, and why the duplicate existed at all).

**Files:** `src/actions/admin/auth.ts`, `src/db/session.ts`

**What was wrong.** The select ran as `anon`, matched neither branch of
`profiles.rt_select`, and returned zero rows. `profile` was then `undefined`, so
`!profile?.isActive` evaluated to **true**, and every correct password was rejected with
`admin.auth.deactivated` — *"your account has been deactivated"*.

Of the available wrong answers that is the worst one. It is the message that sends a real
user to an administrator rather than to a retry, and it would have been read as an account
problem rather than as a bug — possibly for a long time.

The `lastLoginAt` write was unbound too, so it silently updated nothing while
`/admin/users` renders that column as though it were real.

**Reproduced**, as `app_runtime`:

```
unbound : rows=0 -> !profile?.isActive = true  -> REJECTS LOGIN ("deactivated")
bound   : rows=1 -> !profile?.isActive = false -> ALLOWS LOGIN
update lastLoginAt: unbound rows=0 · bound rows=1
```

**Fix.** Both statements now run inside one `readAsSelf` transaction. `profiles.rt_update`
carries the same `id = app.actor_id()` branch as `rt_select`, so binding the id alone is
exactly enough for both, and nothing else becomes reachable. `readAsSelf`'s docstring is
widened to say so.

**What I did differently after finding it.** I swept the whole tree for the same class rather
than fixing the instance and moving on. Every remaining bare-handle statement is correct by
design: `app.submit_form`, `app.archive_expired_content` and `app.purge_expired_submissions`
are all `SECURITY DEFINER`, and the health check is `select 1`. The class is closed.

**Verification.** `[VERIFIED-EXEC]` — the before/after above; typecheck, eslint, stylelint
clean; 27/27 integration tests.
