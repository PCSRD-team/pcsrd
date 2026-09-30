-- Drop the two anon read policies on storage.objects. Security review, 2026-09-29.
--
-- `20260914120000_storage_buckets.sql` gave `anon` and `authenticated` SELECT
-- on every object in `media` and `documents`. Serving a file never needed it:
-- both buckets are `public`, and `/storage/v1/object/public/<bucket>/<path>`
-- is answered by the storage server without consulting row level security.
--
-- What the policy did grant was the *listing*. With the anon key — which is
-- in every page's bundle — `storage.from('media').list()` enumerated every
-- object, including uploads attached to drafts and to entries that were
-- later archived: an unpublished report or photograph, found by name before
-- anyone chose to publish it.
--
-- Nothing in this app reads storage as anon. Every `storage.from(...)` call in
-- `src/` goes through `createSupabaseAdminClient()` (service role, which
-- bypasses RLS), and public pages build `/object/public/` URLs as strings.
--
-- With RLS on and no matching policy, `anon` and `authenticated` see zero
-- rows in `storage.objects` — the same state `applications` has always had.
-- If a signed URL or an anon `download()` is ever needed from a public page,
-- the fix is a policy scoped to exactly the published paths, not these two.

drop policy if exists pcsrd_public_read_media on storage.objects;
drop policy if exists pcsrd_public_read_documents on storage.objects;
