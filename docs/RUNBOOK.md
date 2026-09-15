# Operations runbook

What to do when something has gone wrong, or when something routine has to be done
carefully. `docs/DEPLOYMENT.md` is how the site gets to production; this is what happens
after. Every step here was checked against the code and the live project's configuration —
nothing about the organisation itself is asserted, because none of that lives in this
repository.

Steps that cannot be undone are marked ⚠️.

---

## 1. The site is down

Work top to bottom. Each check tells you which layer to look at next.

### 1a. Is it the application?

```
GET https://<site>/api/health
```

- `200 {"status":"ok"}` — the function runs and can reach the database. Go to §1c.
- `503 {"status":"degraded"}` — the function runs but `select 1` failed. Go to §1b.
- Timeout, 5xx from Vercel, or a Vercel error page — the deployment itself is broken.
  **Vercel → Deployments → previous good build → Promote to Production.** That is the
  application rollback and it takes seconds. Then read the failed deployment's build and
  function logs before deploying anything new.

### 1b. Is it the database?

1. **Supabase → project → Home.** A paused project (free tier pauses after inactivity) shows
   a "Restore" button; press it and wait — it takes a few minutes and needs nothing else.
2. **Supabase → Settings → Database → Connection pooling.** Confirm the pooler is up.
   `DATABASE_URL` must be the pooler on **:6543** with `app_runtime`; `DIRECT_URL` is **:5432**
   with `postgres`. If someone "fixed" an outage by pointing `DATABASE_URL` at `postgres`, the
   site comes back **with all 85 row-level policies silently disabled** — revert it.
   `npx tsx scripts/assert-rls.ts` tells you whether the runtime role still has no
   `BYPASSRLS`.
3. Intermittent `prepared statement "s1" already exists` — `DATABASE_URL` is on the wrong
   port or the client lost `prepare: false`. It is not a database fault.

### 1c. Is it the content?

- A single page 500s while `/api/health` is fine — check **Vercel → Logs** for the digest
  the error page prints; if Sentry is configured (§6), the same digest appears there with a
  stack. A page whose data cannot be loaded fails deliberately rather than rendering empty.
- The homepage `<title>` shows `TODO(org):` — the seed placeholders are live. Replace them
  in `/admin/organization`.
- `/ar/news` is empty but the admin shows published posts — a cache tag was not
  revalidated. Republishing the item from the admin busts it; if that fails, redeploy.

### 1d. Forms fail but pages render

- Every form returns the generic "unexpected error" — Upstash is unreachable or the token
  changed. The limiter is the first step of every submission and its throw is caught by
  `runAction`, so the form is refused rather than let through unlimited: it fails closed.
- "Rate limited" for one person — working as designed: 5 forms/hour, 3 uploads/hour per
  client. It resets on its own.
- Every submission fails validation on a field nobody can see — the Turnstile site key and
  secret do not match (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`).
- Complaints fail, other forms work — `SUBMISSION_ENC_KEY` is missing or malformed.
  `app.submit_form()` refuses an unencrypted sensitive payload with
  `PCSRD_SENSITIVE_PLAINTEXT`. That is the database doing its job; fix the variable.
- Submissions arrive in the admin but no email — Resend. A failed send **never** fails a
  submission, so the data is safe; check the Vercel function logs for `[mail] send failed`
  (it logs the reference and the error, never the payload).

---

## 2. Restore from backup

There are two stores and they are restored separately. ⚠️ Both procedures overwrite.

### 2a. Postgres

Supabase keeps daily backups on every paid plan and point-in-time recovery (PITR) where the
add-on is enabled; the free tier has **no** automatic backups. Check which applies under
**Supabase → Database → Backups** before you need it, not after.

1. **Pause the retention purge first** (§5). A restore brings back rows whose `purge_after`
   has passed; the next 00:30 UTC run would delete them again before anyone looked.
2. **Supabase → Database → Backups → Restore** (daily) or **Point in time → choose a
   time** (PITR). The project is unavailable during the restore.
3. Afterwards, on the owner connection:
   ```bash
   npx tsx scripts/assert-rls.ts      # the authorisation layer came back with the data
   npx drizzle-kit check              # the schema still matches the migrations
   ```
4. A restore from before a migration was applied needs that migration re-applied:
   `npm run db:migrate`, then `supabase db push` for storage.
5. Un-pause the purge.

**Manual export**, which the organisation should hold itself on a schedule (the build plan's
handover item): `pg_dump "$DIRECT_URL" --no-owner --no-privileges -Fc > pcsrd-YYYY-MM-DD.dump`.
⚠️ That file contains every submission, including encrypted complaints and their key id.
Store it where the complaints themselves are allowed to be, and nowhere else.

### 2b. Storage

Supabase backups do **not** include storage objects. Media, documents and CVs live in three
buckets; if they are lost, the `media_assets` and `form_submissions` rows still point at
paths that return 404.

- **Prevention** is the only real answer: a periodic copy of `media` and `documents` with
  the Supabase CLI or S3-compatible tooling, kept with the database dump. `applications`
  (CVs) is deliberately **not** something to copy around: a CV is retained twelve months and
  then purged, and a backup that outlives the purge defeats it.
- **After a loss**: re-upload through `/admin/media`; every image is re-normalised and
  stripped of metadata on the way in. A missing hero image degrades to no image — the
  components are designed to render without one.

---

## 3. Add a user (CMS staff)

The normal path is the CMS. `/admin/users` invites by email (Supabase sends the invitation;
the `auth.users → profiles` trigger creates the profile), and an **admin** can then change the
role, grant or revoke sensitive access, and deactivate — each of which is a guarded service
call with an audit entry. Every new account starts as an **active `editor` with no sensitive
access**: least privilege is the default and is enforced by the trigger, not by the form.

Three rules the database enforces regardless of who is clicking (`guard_profile_privileges`):

- only an admin may change a role, sensitive access or activation;
- an admin may not change their **own** role;
- the last active admin cannot be demoted or deactivated.

**The first admin** has no admin to promote them. That one time, and only that one, the
promotion is a write on the owner connection (`DIRECT_URL` or the SQL editor):

```sql
update public.profiles
   set role = 'admin', is_active = true, can_view_sensitive = true
 where email = 'person@example.org';
```

`can_view_sensitive` is **not** implied by `admin`. It gates the confidential complaints inbox
and is granted per person — to the safeguarding focal point and whoever the organisation has
designated, not to everyone with `admin`. Owner-connection writes bypass the audit log; note
them wherever the organisation records such decisions.

**Remove a user**: deactivate in `/admin/users` (immediate — every guard checks `is_active` on
every request), then delete the auth user in Supabase when convenient. Do not delete the
profile row: the audit log references it by id, and the log is append-only.

---

## 4. Rotate a key

Every secret in `.env.example` can be rotated by generating a new value, setting it in
Vercel, and redeploying — **except one**.

| Secret | Rotation | Note |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → regenerate; set; redeploy | Uploads and signed CV links fail until the redeploy is live |
| `RESEND_API_KEY` | Resend dashboard → new key; set; revoke old | Mail queued in `after()` during the swap is lost, not the submission |
| `TURNSTILE_SECRET_KEY` | Cloudflare → rotate; set the pair together | Site key and secret are a pair |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash → rotate | The limiter fails closed while the token is wrong |
| `IP_HASH_SALT` | `openssl rand -base64 48` | Old hashes become uncomparable to new ones — which is fine; they exist only to rate-limit and to detect repeat abuse, never to identify |
| `CRON_SECRET` | `openssl rand -base64 24`; set; redeploy | Both cron jobs return 401 until the redeploy; check the job logs after the first run |
| `SENTRY_AUTH_TOKEN` | Sentry → new token | Build-time only; affects source-map upload, nothing at runtime |
| **`SUBMISSION_ENC_KEY`** | **Never replaced. Only added.** | See below |

### Why `SUBMISSION_ENC_KEY` is never replaced

Every confidential submission is stored as AES-256-GCM ciphertext with the key's id in
`form_submissions.payload_key_id`. The plaintext column is `null` for those rows — a
database constraint (`submissions_sensitive_unlinkable`) enforces it. **Replacing the key
value makes every existing complaint permanently unreadable**, with no error until somebody
opens one, and there is no plaintext anywhere to rebuild from.

⚠️ **As the code stands today, `src/lib/security/crypto.ts` reads a single key.**
`payload_key_id` is written on every row so that rotation is *possible*, but `decryptPayload`
does not yet look the id up — it always uses `SUBMISSION_ENC_KEY`. That means:

- To rotate, the code needs a key ring first: keep the old value under a new name
  (`SUBMISSION_ENC_KEY_<old id>`), put the new value in `SUBMISSION_ENC_KEY`, bump
  `SUBMISSION_ENC_KEY_ID`, and have `decryptPayload` choose by the row's `payload_key_id`.
  That is a small, contained change and is listed as outstanding in the launch checklist.
- Until then, **do not rotate it**. If it is believed compromised, the correct response is to
  add the key ring and then rotate — not to swap the value and lose the archive.
- Never generate it anywhere but `openssl rand -hex 32` (exactly 64 hex characters; the env
  schema rejects anything else), and never keep it in the same place as a database dump.

---

## 5. Pause the retention purge

`/api/cron/purge-submissions` runs daily at 00:30 UTC and hard-deletes every submission whose
`purge_after` has passed, then deletes the matching CVs from the `applications` bucket. It
returns a count and nothing else — deliberately, so the purge does not recreate in a log the
record it exists to destroy. ⚠️ There is no undo.

Reasons to pause: a restore is in progress (§2), a legal hold, an investigation into a
specific submission.

**To pause** — remove the entry from `vercel.json` and redeploy:

```diff
   "crons": [
-    { "path": "/api/cron/archive-expired", "schedule": "0 * * * *" },
-    { "path": "/api/cron/purge-submissions", "schedule": "30 0 * * *" }
+    { "path": "/api/cron/archive-expired", "schedule": "0 * * * *" }
   ]
```

Vercel registers cron jobs from the deployed `vercel.json`, so the change is live with the
deployment and visible under **Settings → Cron Jobs**. Rotating `CRON_SECRET` without
redeploying also stops it (both jobs 401), but that is a side effect, not a control, and it
stops the archive job too.

**To hold one submission** rather than pausing everything: push its date, as the owner —

```sql
update public.form_submissions
   set purge_after = purge_after + interval '6 months'
 where reference = 'PCS-XXXXXX';
```

and write down why, where the organisation keeps such decisions. The audit log does not see
owner-connection writes.

**To resume**: put the line back, redeploy, and check the next morning's log shows a run.

---

## 6. Error monitoring

Sentry is optional and dormant without a DSN (`DEPLOYMENT.md` §4e). If it is on:

- What it receives is fixed in `sentry.scrub.config.ts`: a message, a stack, a method and a
  path. No user, no headers, no cookies, no bodies, no query strings, no breadcrumb data, no
  replay, no tracing.
- **A complaint is never identifiable from Sentry.** The form actions catch every throw and
  return a result, so nothing from them is reported as an event; if something ever were, the
  scrubbing above still applies.
- To turn it off: unset both DSNs in Vercel and redeploy. The CSP stops naming the ingest
  origin in the same deploy.
- Do not add `Sentry.setUser`, `setExtra` or `captureMessage` with content anywhere. The
  reference number on the error page (`digest`) and the admin audit log are the debugging
  handles; they stay inside the audited system.
