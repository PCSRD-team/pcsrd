# 01 — Pre-launch audit report

PCSRD website · branch `chore/pre-launch-audit` · baseline commit `5fb312a`
Next.js 16.3.1 · React 19.2.8 · TypeScript 5.9.3 strict · Tailwind v4 · Supabase Postgres 17

---

# 1. Verdict

## NO-GO

**In one line:** the public site is close to ready, but the CMS behind it cannot be used at
all — nobody can sign in, every audited save aborts, and the confidential complaints inbox
reports itself empty to the people responsible for answering it.

Four of those defects share one cause and I have fixed them in code. **One of them requires a
single `GRANT` to be run against the production database, which I am not permitted to do.**
Until that runs, the CMS does not work.

### The criteria I judged against

These are the brief's, made explicit so you can disagree with the bar rather than the reading.

| # | Criterion | Status |
|---|---|---|
| 1 | The build succeeds in CI | **was NO** → now yes |
| 2 | Typecheck, lint and tests pass | yes, throughout |
| 3 | A signed-in editor can perform the CMS's core loop | **NO** — needs A2 in `04-OPEN-QUESTIONS.md` |
| 4 | The confidential complaints mechanism works end to end | **NO** — fixed in code, unverified against production |
| 5 | No route linked from the site returns 404 | **NO** — six absent, including the privacy policy |
| 6 | No WCAG 2.2 Level A failure | **was NO** → now yes |
| 7 | No known route to publish a photograph of an identifiable child without documented consent | **was NO** → now yes |
| 8 | There is a working migration path to a fresh database | **was NO** → now yes |
| 9 | The security gate in CI has run at least once | **was NO** → now yes |
| 10 | No organisational fact is placeholder or invented | **NO** — `TODO(org):` renders in the live homepage `<title>` |

Six of the ten were failing when I started. Four still are, and **three of those four are
yours to close** — a database grant, a privacy policy, and the organisation's own facts.
None of the three is a large piece of work; none of them is something I may do for you.

### What would change the verdict

1. Apply `drizzle/0003_audit_log_sequence_grant.sql` to production. One `GRANT`.
2. Publish a privacy policy, and decide on the other five absent routes.
3. Replace the `TODO(org):` placeholders in `organization_settings`.
4. Smoke-test the CMS loop against the real database: sign in, publish, upload, open a
   complaint, download a CV. Every one of those paths was broken by a finding here.

With those four done I would expect to say GO, with the remaining P2s as follow-up work.

---

# 2. Findings by severity and track

Raw counts, before cross-track de-duplication. Twelve tracks were run; four pairs of them
were merged into single working documents.

| Track | P0 | P1 | P2 | P3 | Total |
|---|---:|---:|---:|---:|---:|
| T1 Architecture · T2 Types · T3 Duplication | 0 | 6 | 18 | 17 | 41 |
| T4 Design system · T9 A11y / RTL / i18n | 0 | 10 | 13 | 7 | 30 |
| T5 Next.js / React | 0 | 1 | 12 | 4 | 17 |
| T6 Data / Drizzle / Supabase | **4** | 4 | 6 | 4 | 18 |
| T7 Security / privacy | 0 | 3 | 3 | 11 | 17 |
| T8 Performance · T10 SEO · T11 State · T12 Ops | 0 | 21 | 25 | 15 | 61 |
| **Total (raw)** | **4** | **45** | **77** | **58** | **184** |

There is substantial overlap: the same defect was independently found by up to five tracks.
The largest confirmed clusters:

- `saveOrganization` missing its schema — SEC-005 = DATA-011 = NEXT-009 = TYPE-003
- the actor-less submission path — DATA-004 = SEC-002 = ARCH-007
- no loading state anywhere — ARCH-008 = STATE-005 = NEXT-002 = DS-010
- `/admin/organization` absent — ARCH-002 = STATE-006 = SEO-012
- `scripts/assert-rls.ts` missing — ARCH-003 = OPS-001
- the archive cron's actor-less UPDATE — DATA-005 = ARCH-001

**Two findings were refuted by measurement and struck**, and I have left the reasoning in the
appendix so nobody re-derives them:

- **SEC-003 / NEXT-006** claimed the admin CSP nonce never reaches the HTML, so
  `'strict-dynamic'` blocks every admin script. A single request refuted it: the header nonce
  `7b618f6c…` equals the body nonce and **11 of 11** script tags carry it.
- **SEC-008** claimed two competing CSP headers on `/admin`. `curl -sI` returned exactly **1**
  on both `/admin/login` and `/ar`.

Fixed in this audit: **4 of 4 P0**, and **19 P1**. See `02-FIX-LOG.md` and `05-BEFORE-AFTER.md`.

---

# 3. The five worst, in plain language

### 1. Nobody can sign in to the CMS

The code that looks up who you are ran without telling the database who was asking. The
database is configured to show you nothing unless you identify yourself, so it returned no
rows — not an error, just nothing. The application read "no rows" as "not signed in". Every
login failed, and it failed quietly.

**Fixed** (`ad2a53d`). Proven against a real Postgres.

### 2. Every save in the CMS was aborting, silently and completely

Every change in the CMS writes an audit entry in the same transaction as the change itself —
deliberately, so a change can never be saved without a record of who made it. The database
account the site runs as had permission to write those entries but not to use the counter
that numbers them. That is a separate permission in Postgres, and it was missing.

So the audit write failed, and because it shares the transaction, it took the change down
with it. Publishing a post, saving a project, uploading a photograph: all of them rolled back.

**Fixed in a migration** (`0d482d6`) — **and this is the one thing I cannot do for you.**
It is one line of SQL. Until it is applied to production, the CMS does not work.

### 3. The confidential complaints inbox reported itself empty

The database decides whether you may read a confidential complaint by checking a specific
setting. The application never set it. The check therefore always answered "no", and the
inbox returned zero rows — to staff who had been granted exactly that permission, on a page
that looked like it was working.

A complaints mechanism that silently shows nothing is worse than one that is visibly broken:
nobody escalates an empty inbox.

**Fixed** (`ad2a53d`). Proven before and after.

### 4. A photograph of an identifiable child could be marked as consented by anyone who could upload

The upload endpoint took the consent value straight from the form and told TypeScript to
trust it, without checking. The safeguarding rule downstream only rejects the value
`not_required`, so sending `obtained` walked straight past it — no consent form, no reference,
nothing. Any account with upload rights, which includes the `editor` role, could do it with a
single request.

Separately, even a legitimate claim of consent needed no reference to an actual document, so
there was nothing to produce if a parent or a regulator asked which form was signed.

**Both fixed** (`e49ec00`).

### 5. CI could not build, so the check that guards against a total key compromise had never run

The build step in CI could not complete — first because a configuration shortcut left a
required value undefined, and then because the site's pages need a database to render and CI
had none.

The step that checks whether the Supabase service-role key leaked into the browser bundle runs
*after* the build, in the same job. A build that never finishes means that check never runs.
The project's own architecture document calls that key reaching the browser "a total
compromise". It had never been checked, not once.

**Fixed.** CI now runs a real Postgres, applies this repository's migrations to it, asserts
the whole database authorisation layer on every pull request, and greps for the key's actual
value rather than only for its name.

---

# 4. P0 findings

All four are in the database authorisation layer, all four were reproduced by execution, and
all four are fixed in code.

---

### DATA-001 · Identity lookup runs with no actor bound, so nobody can sign in

**Severity** P0 · **Confidence** `[VERIFIED-EXEC]` · **Conflict type** code ↔ database policy

**Evidence.** `src/lib/auth/session.ts:23-32` selected from `profiles` on the bare `db`
handle. `drizzle/0001_app_runtime_layer.sql:941-945`:

```sql
create policy "rt_select" on public."profiles"
  for select to app_runtime
  using ((app.is_staff() OR (id = app.actor_id())));
```

`drizzle/0001_app_runtime_layer.sql:36-43` — `app.actor_role()` coalesces to `'anon'` when
unset, so `app.is_staff()` is false; `app.actor_id()` is null, so the second branch is false too.

**Root cause.** The identity read is the one query that cannot bind a role, because the role
is what it is reading — and it was written on the unbound handle rather than given a narrower
one.

**Impact.** No one can sign in to the CMS. The failure is silent: `[profile]` is `undefined`,
the function returns null, and every guard reads null as "not signed in".

**Reproduced:**
```
select id from profiles (as app_runtime, no actor): rows=0
app.actor_role(): "anon"    app.is_staff(): false
```

**Fix** `readAsSelf`, binding only `app.actor_id`. See FIX-01. **Effort** S · **Risk** low.

---

### DATA-002 · `app_runtime` has INSERT on `audit_logs` but no USAGE on its sequence

**Severity** P0 · **Confidence** `[VERIFIED-EXEC]` · **Conflict type** grant ↔ schema

**Evidence.** `drizzle/0002_runtime_grants.sql:33` grants `insert on public.audit_logs`.
`src/db/schema/audit.ts:24` — `id: bigserial({ mode: 'number' }).primaryKey()`. No sequence
grant existed anywhere in the repository (`grep -rn "on sequence" drizzle/ supabase/` → empty).

**Root cause.** `USAGE` on a sequence is a privilege distinct from `INSERT` on the table whose
default calls it, and only the table grant was written.

**Impact.** Every audited mutation aborts. `writeAudit` runs inside the mutation's own
transaction, so the failure rolls the mutation back: publish, save, upload.

**Reproduced:**
```
before: ERROR permission denied for sequence audit_logs_id_seq
after : INSERT OK id=1
```

**Fix** `drizzle/0003_audit_log_sequence_grant.sql` — `grant usage`, not `grant all`, so
`setval` stays denied on an append-only table. **Effort** S · **Risk** low.

> **Not yet applied to production.** `04-OPEN-QUESTIONS.md` A2.

---

### DATA-003 · `app.can_view_sensitive` is never set, so the complaints inbox is permanently empty

**Severity** P0 · **Confidence** `[VERIFIED-EXEC]` · **Conflict type** code ↔ database policy

**Evidence.** `drizzle/0001_app_runtime_layer.sql:86-95`:

```sql
create or replace function app.can_view_sensitive() returns boolean as $$
  select app.is_staff()
     and coalesce(current_setting('app.can_view_sensitive', true), 'false') = 'true'
$$;
```

`src/db/session.ts:30-33` set `app.actor_id` and `app.actor_role` and nothing else.
`form_submissions.rt_select` (`:689`) is
`CASE WHEN is_sensitive THEN app.can_view_sensitive() ELSE app.can_publish() END`.

**Root cause.** The policies read three session settings; `withActor` set two, and
`current_setting(name, true)` returns NULL rather than raising, so the omission was silent.

**Impact.** A confidential complaint is invisible to the staff granted permission to read it,
on a page that renders normally. An empty inbox does not get escalated.

**Reproduced:**
```
with the 2 GUCs withActor set: can_view_sensitive() false, rows=0
after adding the third:        can_view_sensitive() true,  rows=1  {"reference":"PCS-TEST01"}
```

**Fix** third `set_config` in the same statement; `ActorContext` widened. **Effort** S · **Risk** low.

---

### DATA-004 · The whole submission read/write path uses the actor-less handle

**Severity** P0 · **Confidence** `[VERIFIED-CODE]`, mechanism `[VERIFIED-EXEC]` · **Conflict type** code ↔ policy

**Evidence.** `src/services/submission/submission.service.ts:158`, `:170`, `:202`, `:211`,
`:272` — every statement on `db`, including `db.transaction`, which opens a transaction and
binds no actor. `src/app/api/admin/submissions/[id]/attachment/route.ts:30`, `:55`.

**Root cause.** `writeAudit` accepted `Db | Tx`, so an actor-less call typechecked and the
pattern spread.

**Impact.** `getSubmission` and `setSubmissionState` throw `notFound` for every submission;
`countNewSubmissions` always returns 0; attachment downloads 404. The `view_sensitive` and
`download_attachment` audit entries — the two that exist to answer *who opened this
complaint* — were refused, so the highest-value audit events were the ones certain to be
missing.

**Fix, and why over the alternative.** Narrowing `writeAudit` to `Tx` rather than fixing the
two call sites: it makes the compiler find them, and makes the class unrepresentable. FIX-04.
**Effort** M · **Risk** low.

---

# 5. P1 findings

Fixed here, in commit order. Full detail in `02-FIX-LOG.md`.

| ID | Finding | Commit |
|---|---|---|
| OPS-003 | Journal names a file that does not exist; `0002` absent — no path to a fresh database | `806ce0b` |
| DATA-005 / ARCH-001 | Archive cron issues an actor-less UPDATE, matches nothing, reports success | `f2aaa68` |
| ARCH-007 | `writeAudit` accepted `Db`, so the two most important audit entries were never written | `f2aaa68` |
| A11Y-001 | Eleven Tailwind class names that do not exist, at 18 sites | `891d13e` |
| A11Y-002 | Skip link never becomes visible — SC 2.4.7 on every page's first tab stop | `891d13e` |
| A11Y-005 | `focus:outline-none` suppresses keyboard focus on every text control | `891d13e` |
| DS-001 | `gold-700` 3.42:1, documented as "AA-safe" — every form error, the verified badge, link hover | `891d13e` |
| DS-002 | `mono-muted` 2.94:1 on the page ground at 12px — 41 eyebrows and every admin label | `891d13e` |
| DS-003 | Focus ring 1.88:1 — SC 1.4.11 | `891d13e` |
| DS-004 | Control boundary 1.43:1 — a text field's only visual boundary | `891d13e` |
| TYPE-002 | Media consent taken from an unchecked cast — safeguarding bypass | `e49ec00` |
| TYPE-012 | 12 of 32 thrown error keys undefined; users saw raw Latin identifiers | `e49ec00` |
| A11Y-003 | `<html>` with no `lang`/`dir` — **SC 3.1.1, Level A**, every public page | `468cbeb` |
| A11Y-004 | Nested `<html>`/`<body>` — the Arabic CMS silently loses `dir="rtl"` | `468cbeb` |
| PERF-002 | Three separate `next/font` instances of the same two families | `468cbeb` |
| OPS-001 / ARCH-003 | `scripts/assert-rls.ts` did not exist; CI asserted an obsolete, inverted rule | FIX-08 |
| OPS-002 / TYPE-011 | CI build threw at module scope, so the key-leak gate never ran | FIX-08 |

**P1 findings NOT fixed** — understood, unblocked, and listed in `03-LAUNCH-CHECKLIST.md`:

| ID | Finding | Why not fixed here |
|---|---|---|
| A11Y-006 | Errors not associated on textarea/select/checkbox groups — SC 3.3.1 | Touches every form component; wanted a browser to verify |
| ARCH-002 | `/admin/organization` is in the nav and the route directory is empty | Building a new admin screen exceeds an audit's remit |
| DUP-001 | 28 unreferenced `'use server'` exports = 28 live, untested POST endpoints | Deleting them changes product surface — your call |
| SEO-* | Six routes the site links to return 404, including the privacy policy | Organisational and legal copy; I must not invent it |

---

# 6. P2 and P3 findings

77 P2 and 58 P3, with full evidence, root cause and fix per finding, are in the appendix
files beside this one. They are kept rather than folded in because each carries `file:line`
evidence that would triple this document's length:

| File | Tracks |
|---|---|
| `appendix-T1-T3.md` | Architecture, TypeScript, duplication / dead code |
| `appendix-T4-T9.md` | Design system, accessibility, RTL, i18n |
| `appendix-T5.md` | Next.js 16 and React |
| `appendix-T6.md` | Data, Drizzle, Supabase |
| `appendix-T7.md` | Security and privacy |
| `appendix-T8-T12.md` | Performance, SEO, state, ops |

The P2s worth reading first, because each is a latent P1 rather than tidiness:

- **TYPE-001** — `noUncheckedIndexedAccess` is off, masking **32 measured** unchecked
  accesses. 30 are `.returning()` destructures, and under RLS an `UPDATE … RETURNING` whose
  row the policy filters returns **zero rows** rather than raising. Every one of those sites
  then dereferences `undefined`, turning an intended `forbidden` into a generic
  `errors.unexpected`.
- **DUP-001** — 28 `'use server'` exports with no caller. Every one is a live POST endpoint
  whether or not any UI reaches it, including `saveOrganization`, which has no schema.
- **DS-007** — `accentToken` is unvalidated free text interpolated into `var()`, so a content
  manager can set `--color-gold-600` and produce a gold **fill** — the one thing the design
  system forbids absolutely.
- **A11Y-007** — the admin renders every submitted payload value unisolated in an RTL table.
  Staff read complainants' callback numbers off that page.
- **ARCH-009 / NEXT-007** — every per-slug cache tag is inert, so an edit does not drop its
  own page.

---

# 7. What I could NOT verify

Stated plainly, because the brief's first directive is zero assumptions and this is where I
have them.

### No access to the production database

Every database finding was proven against **PGlite** — a real Postgres 17 — with this
repository's own migrations applied and the connection switched to `app_runtime`. That is
genuine execution evidence about the *mechanism*. It is not evidence about the *live
database*. `CLAUDE.md` states `0001_app_runtime_layer.sql` was extracted from production, so
the two should agree; "should" is not verification.

The decisive check is one line and I have written it into `scripts/assert-rls.ts`. See
`04-OPEN-QUESTIONS.md` A1.

### No browser

No axe run, no Lighthouse, no RTL visual diff, no screenshots. Every rendered-pixel claim is
either derived from compiled CSS or explicitly marked `[ASSUMPTION]`. Specifically unverified
by observation: overflow thresholds at 320/375px, the glyph order of Arabic date ranges under
`dir="ltr"`, computed touch-target heights, and screen-reader announcement behaviour.

The contrast findings are exempt — those are arithmetic on the token values, and I computed
them.

### No secret values

I never read one, per your brief. So I cannot confirm the single most consequential
configuration fact in the project: whether `DATABASE_URL` connects as `app_runtime` or as
`postgres`. `postgres` has `BYPASSRLS`, so the wrong value disables all 85 policies **while
the site keeps working and every test passes**. A configuration that fails open and looks
healthy. `scripts/assert-rls.ts` now checks the role's attributes, once you can run it.

### RLS is not covered by any test, and still is not

The integration suite connects as `postgres` and matches `pcsrd_owner_all`, so it exercises
the service rules and never the policies — `CLAUDE.md` says so outright. I worked around it
for four findings with a role-switching harness I wrote for this audit. That is not a standing
guarantee, and a suite that runs as `app_runtime` would have caught DATA-001, DATA-002 and
DATA-003 before they were written. New test tooling is gated by your brief.

### No organisational facts checked

I did not verify a single fact about PCSRD — not the licence number, not the channels, not
the impact figures. `CLAUDE.md`'s first "never do" is inventing one, and checking them is not
something the repository can answer.

### Two claims I disproved rather than reported

Worth stating because it cuts the other way: two agent findings about the admin CSP were
plausible, well-evidenced, and **wrong**. I found that by measuring rather than reviewing. I
have no reason to think the remaining findings carry a different error rate than the ones I
checked — the P0s are all `[VERIFIED-EXEC]`, and the P2/P3 set is `[VERIFIED-CODE]` and has
not been individually re-derived by me.
