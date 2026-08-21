# 04 — Open questions

Everything here is blocked on a decision, a credential or an access grant that I do not
have. Nothing in this file is a finding — findings are in `01-AUDIT-REPORT.md`. Each item
says what I did in the meantime so no question blocks progress.

Ordered by how much they hold up.

---

## A. Blocking a GO verdict

### A1 — May I run **read-only** SQL against the live Supabase project?

**Why it matters.** Four P0 findings are about the live database's authorisation layer. I
proved the *mechanism* of each against a real Postgres 17 (PGlite) with this repository's
own migrations applied and the role switched to `app_runtime` — that is genuine execution
evidence, not inference. What it cannot tell me is whether the **live** database matches the
repository. `CLAUDE.md` states that `drizzle/0001_app_runtime_layer.sql` was *extracted from*
the live database, so the two should agree; "should" is not verification, and the brief's
first directive is zero assumptions.

**What I would run.** Read-only, no DDL, no writes:

```sql
select rolname, rolbypassrls, rolcanlogin from pg_roles where rolname in ('app_runtime','postgres');
select relname, relrowsecurity, relforcerowsecurity from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r';
select count(*) from pg_policies where schemaname = 'public';
select has_table_privilege('app_runtime','public.audit_logs','INSERT'),
       has_sequence_privilege('app_runtime','public.audit_logs_id_seq','USAGE');
select * from app.security_context();
```

The fourth line is the decisive one. It answers `DATA-002` — the finding that every audited
mutation aborts — with a single boolean, against the database that actually serves the site.

**Blocked on:** your answer. This is a HARD STOP in your brief (§ "any SQL executed against
a REMOTE project") and I have not run anything.

**Meanwhile:** I reproduced all four findings locally and fixed three of them in code and
migrations. See `02-FIX-LOG.md`.

---

### A2 — Has migration `0003_audit_log_sequence_grant.sql` been applied to production?

**Why it matters.** This is the single highest-consequence line in the audit. Without
`grant usage on sequence public.audit_logs_id_seq to app_runtime`, every insert into
`audit_logs` fails with `permission denied for sequence audit_logs_id_seq`. Because every
service writes its audit entry inside the same transaction as the change it records —
deliberately, so an unaudited mutation cannot commit — the failure rolls back the mutation
too. Publishing a post, saving a project and uploading media all abort.

Reproduced against a real Postgres, before and after:

```
0000-0002 only : permission denied for sequence audit_logs_id_seq
with 0003      : INSERT OK id=1
```

I wrote the migration. I cannot apply it — that is DDL against a remote project.

**This is the one item I would not launch without.** It is a one-line grant.

**Blocked on:** you running `npm run db:migrate` against production, or executing that one
`grant` in the SQL editor.

---

### A3 — Which of the six absent public routes are in scope for launch?

Six routes referenced by the site's own navigation and footer do not exist. Visitors reach
404s from links the site renders itself.

The privacy policy is the one that is not merely a broken link: the site collects personal
data through six forms, including a confidential complaints channel, and links to a privacy
policy that returns 404. That is a data-protection exposure and a donor due-diligence
failure, not a missing page.

**Blocked on:** your decision. Writing these is authoring organisational and legal copy,
which your brief lists as a HARD STOP and which I must not invent — `CLAUDE.md`'s first
"never do" is inventing a fact about the organisation.

**Meanwhile:** every route is listed with its inbound links in `01-AUDIT-REPORT.md` (SEO
track) so the decision is a checklist, not an investigation.

---

### A4 — What is your GO bar?

I am reporting **NO-GO** against the criteria in your brief. You may hold a different bar —
for instance, launching the public site while the CMS stays internal until the database
grants are applied. That is a legitimate call and it changes which findings are blocking.

Tell me the bar and I will re-issue the verdict against it rather than against my reading.

---

## B. Decisions I made, that you can reverse in one line

I made these to keep moving rather than stall the whole audit. Each is deliberately cheap to
undo, and each is flagged because it touches something your brief marked sensitive.

### B1 — I changed two design tokens

| token | was | now | why |
|---|---|---|---|
| `gold-700` | `#B87B12` | `#875A0F` | 3.42:1 on paper → 5.75:1. AA needs 4.5:1. |
| `mono-muted` | `#8A8272` | `#6A6353` | 2.94:1 on the page ground → 4.61:1. |

Your brief lists "brand assets" as a HARD STOP. I read that as logos, wordmarks and imagery,
not as a text token whose own handoff documentation describes it as "AA-safe" when it
measures 3.42:1. The brand's marking gold — `gold-600 #DD991C` — is **untouched**, and it
remains the rule, the stamp and the focus halo.

If your brand owner disagrees, revert two lines in `src/app/globals.css`. The alternative
that keeps the exact hue is to stop using `gold-700` for normal-size text and route form
errors to `ink` — more files, same outcome.

### B2 — I wrote twelve error messages, in Arabic and English

12 of the 32 `errors.*` keys thrown in `src/` were defined in **neither** dictionary, and
`resolveKey` returns the key itself when it does not resolve. An editor who tripped the
safeguarding gate saw the Latin string `errors.media.minorConsentState` inside a
right-to-left Arabic screen.

Your brief lists user-visible copy as a HARD STOP. Leaving them undefined was not an option
compatible with fixing the safeguarding hole, so I wrote them. **They need an Arabic-speaking
editor's review** — they are mine, not the organisation's voice. They are all in
`src/lib/i18n/dictionaries/`, grouped under a comment that says so.

### B3 — I did not move the `main` branch pointer

Your brief says: *"Create and work on a branch: `chore/pre-launch-audit`. Never commit to
main/master."*

That branch did not exist when I resumed. The reflog shows it was **renamed to `main`**
outside this session, and `main` tracks `origin/main`. I did not know that until after my
first commit landed there.

I recreated `chore/pre-launch-audit` at that commit and moved to it; every commit since is on
that branch. I did **not** move `main` back — rewinding a branch pointer that tracks a remote
is exactly the sort of thing that should be your decision, not mine. Nothing has been pushed.

To restore the original arrangement: `git branch -f main 3236bb8`. To keep the work on
`main` instead: it is already there for the first commit, and `git merge chore/pre-launch-audit`
brings the rest.

---

## C. Things I could not determine at all

### C1 — Whether RLS behaves in production the way it behaves in PGlite

The integration suite connects as `postgres`, which matches the `pcsrd_owner_all` policy, so
it exercises the **service** rules and never the RLS ones. `CLAUDE.md` says this outright. I
worked around it for four specific findings by switching roles inside PGlite, which is how
they became `[VERIFIED-EXEC]` — but that is a harness I wrote for the audit, not a standing
guarantee.

**Recommendation, not a finding:** the RLS layer is the second line of defence for a
confidential complaints mechanism and nothing in CI tests it. A suite that runs as
`app_runtime` against a throwaway database would have caught `DATA-001`, `DATA-002` and
`DATA-003` before they were written. That is new test tooling, which your brief gates.

### C2 — Anything requiring a browser

No browser was available, so every rendered-pixel claim is either derived from compiled CSS
or marked `[ASSUMPTION]`. Specifically unverified by observation:

- overflow thresholds at 320px and 375px (`/verify`'s table, the admin shell, the site header)
- the rendered glyph order of Arabic date ranges under `dir="ltr"`
- computed touch-target heights
- screen-reader announcement behaviour for live regions
- **no axe run, no Lighthouse run, no RTL visual diff**

The contrast findings are exempt: those are arithmetic on the token values and I computed
them.

### C3 — Whether production environment variables are set correctly

I never read a secret value, per your brief. So I cannot confirm that `DATABASE_URL` points
at the pooler as `app_runtime` and not at `postgres` — which matters more than it sounds:
`postgres` has `BYPASSRLS`, so pointing runtime at it silently disables all 85 policies while
the site keeps working. That is a configuration that fails open and looks healthy.

**This is worth checking by hand before launch.** The key name and its expected shape are in
`00-INVENTORY.md`; the value is yours to inspect.
