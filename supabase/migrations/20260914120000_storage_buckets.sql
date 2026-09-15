-- Storage buckets and their policies.
--
-- This file is owned by the Supabase CLI (`supabase db push`), never by
-- drizzle-kit. `drizzle/` owns every table, enum, function, trigger and policy
-- in `public`; this directory owns `storage.*`, the `auth.users → profiles`
-- trigger and extensions. Nothing in one touches the other — see CLAUDE.md,
-- "Database ownership".
--
-- Every statement is idempotent. Applying this against a project that already
-- has the three buckets is a no-op except where a value drifted, in which case
-- the value here wins (`on conflict … do update`). It was written against the
-- live project's `storage.buckets` and `pg_policies`, read-only, on
-- 2026-09-14; the only drift found was `image/svg+xml` in `media`, which is
-- removed below on purpose.
--
-- Limits are the SECOND wall. `src/lib/security/upload.ts` rejects anything
-- over 4 MB before a byte reaches Storage, because Vercel's request body limit
-- is 4.5 MB and a larger file dies as an opaque 413 before validation runs. The
-- bucket limits below are deliberately larger so the message a user sees is
-- always ours. Do not "align" them down to 4 MB — a mismatch between the two
-- walls is what tells you which one you hit.
--
-- Writes are service-role only on every bucket. There is NO insert/update/
-- delete policy for `anon` or `authenticated`: the app uploads server-side
-- with the service-role client (`src/app/api/admin/media/route.ts`,
-- `src/actions/public/forms.ts`), and the service role bypasses RLS. A browser
-- holding the anon key can read a public object and nothing else.

-- ── media ─────────────────────────────────────────────────────────────────
-- Public read. Every image is normalised to WebP with all metadata stripped
-- (`processImageUpload`, DNH-1), so `image/webp` is the only type the app
-- ever writes; the other three are accepted so an operator uploading through
-- the dashboard is not blocked. `image/svg+xml` is NOT allowed: an SVG is a
-- document that can carry script, and this bucket is served to the public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── documents ─────────────────────────────────────────────────────────────
-- Public read. Publications and downloadable reports. PDF only: a Word file
-- on a public URL is editable, unsigned and can carry macros.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  true,
  20971520, -- 20 MB
  array['application/pdf']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── applications ──────────────────────────────────────────────────────────
-- PRIVATE. CVs from the job-application form. Read only through a signed URL
-- minted server-side with a 60-second expiry
-- (`src/app/api/admin/submissions/[id]/attachment/route.ts`), deleted by the
-- retention purge (`/api/cron/purge-submissions`). The mime list mirrors
-- `CV_MIME` in `src/lib/security/upload.ts` exactly — change both or neither.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'applications',
  'applications',
  false,
  5242880, -- 5 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Policies on storage.objects ───────────────────────────────────────────
-- `storage.objects` already has row level security enabled by Supabase. Two
-- read policies, and deliberately nothing else. `applications` has no policy
-- at all: with RLS on and no matching policy, `anon` and `authenticated` see
-- zero rows, which is the intended state for a bucket of CVs.

drop policy if exists pcsrd_public_read_media on storage.objects;
create policy pcsrd_public_read_media
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'media');

drop policy if exists pcsrd_public_read_documents on storage.objects;
create policy pcsrd_public_read_documents
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'documents');

-- If a write policy for `applications` ever appears here, the CV of every
-- applicant becomes readable to anyone holding the public anon key. There is
-- no legitimate reason for one: every write path is service-role.
