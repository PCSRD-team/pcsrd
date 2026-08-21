# Deployment runbook

Everything needed to take this repository to production, in order. Written to be followed
top to bottom by someone who has not read the rest of the docs.

Read `docs/audit/03-LAUNCH-CHECKLIST.md` alongside it — that lists what still needs a
decision. This file is the mechanics.

**Nothing here is destructive except where it says so.** Steps that cannot be undone are
marked ⚠️.

---

## 0. What you are deploying onto

| Piece | Value | Why it matters |
|---|---|---|
| Host | Vercel | `vercel.json` pins functions to `hnd1` |
| Database | Supabase Postgres 17 | project is in `ap-northeast-1` (Tokyo) |
| Region | **`hnd1`** must stay | co-located with the database; otherwise every uncached query pays a cross-Pacific round trip |
| Cron | 2 jobs | Vercel Hobby allows exactly two, which is exactly what `vercel.json` declares. A third needs a plan change. |
| Package manager | **npm** | `package-lock.json` is the lockfile. Do not introduce pnpm or yarn. |
| Node | 24 | what CI uses |

---

## 1. Before you touch production: get a green pipeline

Run locally first. If any of this is red, stop — production will not be better.

```bash
npm ci
npm run typecheck     # 0 errors
npm run lint          # 0 errors
npm run lint:css      # 0 errors
npm run test:unit     # 8 passing
npm run test:int      # 27 passing
npx drizzle-kit check # "Everything's fine"
npm run build         # needs a reachable database — see §4
```

`npm run build` reads the database at build time, because prerendering `/ar/news` reads
`organization_settings`. Point `.env.local` at a real database before running it.

---

## 2. Environment variables

Copy `.env.example` to `.env.local` for local work, and set the same keys in
**Vercel → Settings → Environment Variables** for Production and Preview.

### The two that are most often wrong

```
DATABASE_URL   pooler, port 6543, connects as app_runtime
DIRECT_URL     session,  port 5432, connects as postgres (owner)
```

**`DATABASE_URL` must connect as `app_runtime`, not as `postgres`.** `postgres` has
`BYPASSRLS`, so pointing runtime at it silently disables all 85 row-level policies. The site
keeps working, every page renders, every test passes — and the second line of defence is
gone. This is the single most consequential value in the project and it fails *open*.

The port matters too: `DATABASE_URL` is Supavisor in **transaction** mode, which is why
`src/db/index.ts` creates the client with `prepare: false`. Getting it wrong fails
intermittently, under concurrency only, with `prepared statement "s1" already exists`.

`DIRECT_URL` is for DDL only: `drizzle-kit`, migrations, seeds, `scripts/assert-rls.ts`.

### Generating the secrets that have a required shape

```bash
openssl rand -base64 48   # IP_HASH_SALT        (min 32 chars — checked)
openssl rand -hex 32      # SUBMISSION_ENC_KEY  (exactly 64 hex — checked)
openssl rand -base64 24   # CRON_SECRET         (min 16 chars — checked)
```

`SUBMISSION_ENC_KEY` is **required, not optional**. `app.submit_form()` rejects an
unencrypted sensitive payload with `PCSRD_SENSITIVE_PLAINTEXT`, so without it the complaints
form fails at the database.

⚠️ **Do not rotate `SUBMISSION_ENC_KEY` once complaints exist** — existing ciphertext is
decrypted with the key named by `SUBMISSION_ENC_KEY_ID`. To rotate, add a new key and bump
the id; do not replace the old value.

### The rest

Everything else is in `.env.example` with a comment describing its shape. Two worth calling
out:

- `MAIL_TO_SENSITIVE` — receives confidential complaints. Point it at the safeguarding focal
  point, not a shared inbox.
- `NEXT_PUBLIC_WHATSAPP_NUMBER` — digits only, no leading `+`. It is a `wa.me` path.

---

## 3. Database

### 3a. Apply the migrations

```bash
npm run db:migrate      # uses DIRECT_URL
```

This applies `drizzle/0000` … `0003` in journal order. Against a database that already has
`0000`–`0002`, it applies **`0003` only**, which is the one-line grant the CMS needs:

```sql
grant usage on sequence public.audit_logs_id_seq to app_runtime;
```

**If you apply nothing else from this runbook, apply that.** Without it every audited
mutation aborts — publishing a post, saving a project, uploading media — because every
service writes its audit entry inside the same transaction as the change it records. You can
also run that single line in the Supabase SQL editor; `GRANT` is idempotent.

### 3b. Verify the authorisation layer

```bash
npx tsx scripts/assert-rls.ts    # uses DIRECT_URL
```

Five assertions. It fails loudly if any of them stopped being true:

1. `app_runtime` has neither `BYPASSRLS` nor `SUPERUSER`
2. `FORCE ROW LEVEL SECURITY` on every table in `public`
3. every table carries at least one policy
4. all six `app.*` gate functions exist
5. `app_runtime` holds its four grants, **including USAGE on `audit_logs_id_seq`**

Expected: `Database authorisation layer intact.` — with 21 tables and 85 policies.

### 3c. Seed the structural rows

```bash
npm run db:seed
```

Idempotent, and it never overwrites an existing row. It seeds **structure only**: the
`organization_settings` singleton, the three programme keys and the four legal page keys.

It writes every organisational fact as a visible `TODO(org): …` placeholder — deliberately,
because a plausible-looking placeholder is one that reaches production. **Those placeholders
render in the live homepage `<title>`.** Replace them in step 6.

### 3d. Storage buckets

The Drizzle migrations own tables, functions and policies. Storage buckets and their policies
are owned by `supabase/migrations/`, applied with the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Three buckets are expected: `media` (10 MB), `documents` (20 MB), `applications` (5 MB,
private). Uploads are capped at **4 MB in code** regardless — Vercel's serverless request
body limit is 4.5 MB, so a larger file is rejected with an opaque 413 before validation runs.

⚠️ **Never run `supabase db pull` or `supabase db diff` against the `public` schema.** It sees
Drizzle's tables as untracked drift and writes them into `supabase/migrations/`, producing
exactly the two-sources-of-truth failure the split exists to prevent.

`supabase/migrations/20260819113741_remote_schema.sql` is **0 bytes on purpose**. Its version
is recorded in the remote `supabase_migrations.schema_migrations` table; deleting the local
file makes `supabase migration list` report a phantom remote-only version forever.

---

## 4. Vercel

### 4a. Import and configure

1. Import the repository. Vercel detects Next.js; leave the build command as `npm run build`.
2. Confirm **Node 24**.
3. Confirm the region is **`hnd1`** — `vercel.json` sets it, do not override in the dashboard.
4. Add every variable from step 2 to **Production** and **Preview**.

### 4b. The build needs a database

`generateStaticParams`, the sitemap and the feed query the database during the build, and so
does prerendering any content page. If the database is unreachable the deploy fails.

`src/lib/build-time.ts` softens the first three — a build-time query whose result only decides
*which* pages to pre-render degrades to an empty list with a warning rather than failing the
deploy. A page's own data is deliberately **not** covered: a page that cannot load its content
should fail rather than render an empty shell.

So: apply migrations and seed (step 3) **before** the first deploy.

### 4c. Cron

`vercel.json` declares both jobs; Vercel registers them on deploy. Verify under
**Settings → Cron Jobs**:

| Path | Schedule | Does |
|---|---|---|
| `/api/cron/archive-expired` | `0 * * * *` (hourly) | archives expired announcements and closed vacancies |
| `/api/cron/purge-submissions` | `30 0 * * *` (daily) | deletes submissions past their retention deadline, and their attachments |

Both authenticate with `CRON_SECRET` via a constant-time comparison. If `CRON_SECRET` in
Vercel does not match what the deployment was built with, both return 401 silently — the
retention purge failing quietly is a data-protection problem, so check the job logs after the
first run.

⚠️ The purge is a **hard delete**. That is what retention means, but it is not reversible.

### 4d. Domain

Set `NEXT_PUBLIC_SITE_URL` to the final public origin **before** the production deploy. It is
read at module scope by `robots.ts`, `sitemap.ts`, `feed.xml` and `metadataBase`, so a wrong
value produces a sitemap and social cards pointing at the wrong host.

---

## 5. First deploy

```bash
git push origin main      # or: vercel --prod
```

CI runs on the push: typecheck, lint, both test suites, `drizzle-kit check`, a journal
integrity check, migrations against a throwaway Postgres 17, `assert-rls.ts` against it, the
build, and the service-role-leak assertion.

---

## 6. After the first deploy — do these before announcing the site

### 6a. Create the first admin user

Supabase Auth creates the account; the `auth.users → profiles` trigger creates the profile.

1. **Supabase → Authentication → Users → Add user.** Use a real address; confirm the email.
2. Promote it, on the **owner** connection:

```sql
update public.profiles
   set role = 'admin', is_active = true, can_view_sensitive = true
 where email = 'you@example.org';
```

`can_view_sensitive` is **not** implied by `admin`. It is granted per person, and it is what
gates the confidential complaints inbox. Grant it only to the people who should read
complaints.

⚠️ `guard_profile_privileges` refuses a self-promotion at the database level, so this must run
as the owner. That is deliberate: a metadata write must never be able to decide a role.

### 6b. Smoke-test the CMS loop

Every one of these paths was broken by a finding in the audit. Each is fixed in code; none has
been exercised against your database.

- [ ] Sign in at `/admin/login`
- [ ] `/admin` dashboard loads and the submissions badge shows a number
- [ ] Publish a post → it appears on `/ar/news`
- [ ] Upload an image with Arabic alt text → it appears in `/admin/media`
- [ ] Submit the contact form on `/ar/contact` → it appears in `/admin/submissions`
- [ ] Submit a complaint → it appears under `/admin/submissions/sensitive` **and opens**
- [ ] Download a CV from a job application
- [ ] Check `/admin/audit` — every action above should be recorded

If publishing fails, `0003` was not applied. If sign-in fails with "your account has been
deactivated", the profile row is missing or `is_active` is false.

### 6c. Replace the placeholders

Go to **`/admin/organization`** and replace every field starting with `TODO(org):` — legal
name, short name, acronym, licence number, licence authority, contact details, official
channels.

Until you do, `TODO(org):` renders in the live homepage `<title>`, which is what a search
engine indexes and what appears when somebody shares the link.

### 6d. Verify privacy behaviour end to end

Submit a complaint, then check the row as the owner:

```sql
select reference, is_sensitive, ip_hash, user_agent, payload, purge_after
  from public.form_submissions
 where is_sensitive
 order by created_at desc limit 1;
```

Expected, and each one is a rule rather than a nicety:

- `ip_hash` **null** and `user_agent` **null** — DNH-8: a complainant must not be
  re-identifiable from what is kept
- `payload` **null**, with the content in `payload_encrypted` — a database dump of a complaint
  is inert on its own
- `purge_after` 24 months out

---

## 7. Still outstanding at launch

From `docs/audit/03-LAUNCH-CHECKLIST.md`. These are not deployment steps; they are things
only you can decide or write.

- **A privacy policy.** The site collects personal data through six forms including a
  confidential complaints channel, and links to a privacy policy that returns 404. This is a
  data-protection exposure, not a broken link.
- **Five other routes** the site's own navigation links to and that do not exist.
- **Review of twelve error messages** written during the audit — they are not the
  organisation's voice.
- **An axe pass and a keyboard pass in a real browser**, both locales. No browser was
  available during the audit, so every rendered-pixel claim is derived from compiled CSS or
  marked as an assumption.

---

## 8. Rollback

Vercel keeps every deployment. **Deployments → … → Promote to Production** on the previous one
reverts the application in seconds.

The database does **not** roll back with it. `0003` only adds a grant, so it is safe to leave
in place across an application rollback — and revoking it would re-break the CMS.

⚠️ There is no undo for `/api/cron/purge-submissions`. If you need to pause retention while
investigating something, remove the cron entry and redeploy rather than letting it run.

---

## 9. Routine operations

| Task | Command |
|---|---|
| New migration | `npm run db:generate`, review the SQL, `npm run db:migrate` |
| Check schema/migration parity | `npx drizzle-kit check` |
| Verify the authorisation layer | `npx tsx scripts/assert-rls.ts` |
| Inspect data | `npm run db:studio` |
| Re-seed structure (idempotent) | `npm run db:seed` |

After any migration touching policies, grants or the `app` schema, re-run `assert-rls.ts`.
That is the check that tells you whether the second line of defence is still there — and its
absence is invisible from the site itself.
