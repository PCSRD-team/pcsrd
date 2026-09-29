-- Pins the search_path of `public.generate_submission_reference()`.
--
-- Hand-written, like 0006, 0007 and 0009. Supabase's security advisor flags
-- the function as `function_search_path_mutable` (lint 0011): a function
-- without a fixed search_path resolves unqualified names against the caller's
-- path, so a caller who can create objects in an earlier schema can shadow
-- what it calls.
--
-- The function exists on the live database only. No code, trigger or default
-- calls it — `form_submissions.reference` is written by `app.submit_form()` —
-- so it is pinned rather than rewritten. Its body calls `now()`, `to_char`,
-- `upper`, `substr`, `replace` and `gen_random_uuid()`, all in `pg_catalog`,
-- which Postgres searches implicitly even under an empty path, so `''` changes
-- nothing about what it returns.
--
-- Guarded, because a database built from `drizzle/` alone (PGlite, a fresh
-- environment) never had the function, and this must not fail there.
DO $$
BEGIN
  IF to_regprocedure('public.generate_submission_reference()') IS NOT NULL THEN
    ALTER FUNCTION public.generate_submission_reference() SET search_path = '';
  END IF;
END $$;
