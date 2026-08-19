-- Triggers, row-level security and privilege revocation.
--
-- drizzle-kit generates neither triggers nor `enable row level security`, so
-- this is hand-written. It lives inside the Drizzle journal rather than in
-- supabase/migrations so that `drizzle-kit check` sees it and the two migration
-- systems keep their agreed division: Drizzle owns application tables, the
-- Supabase CLI owns storage, auth and extensions.
--
-- Every statement is idempotent. The live database was provisioned before this
-- file existed, so applying it must be a no-op there and a full install on a
-- fresh database (a test instance, a rebuilt staging project).

-- ── updated_at ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;
--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','organization_settings','programs','projects','partners',
    'impact_metrics','stories','posts','vacancies','people','publications','pages'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated ON %1$I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON %1$I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- ── published_at, set once on first publish ─────────────────────────────
-- Guarded by `new.published_at is null` so re-publishing an archived item keeps
-- its original publication date: the date a story was first told does not
-- change because someone corrected a typo two years later.
CREATE OR REPLACE FUNCTION set_published_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'published'
     AND OLD.status IS DISTINCT FROM 'published'
     AND NEW.published_at IS NULL THEN
    NEW.published_at = now();
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'programs','projects','stories','posts','vacancies','publications','pages'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_published ON %1$I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_published BEFORE UPDATE ON %1$I
         FOR EACH ROW EXECUTE FUNCTION set_published_at()', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- ── submission reference ────────────────────────────────────────────────
-- The application also generates a reference, so this is a backstop for any
-- insert that bypasses the service (a manual fix, a data import).
--
-- The expression is chosen at install time. On Supabase pgcrypto lives in the
-- `extensions` schema and a function pinned to `search_path = public` cannot
-- see it; on a bare Postgres (the PGlite test instance) that schema does not
-- exist at all, and hard-coding either spelling breaks the other environment.
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'extensions' AND p.proname = 'gen_random_bytes'
  ) THEN
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION gen_submission_reference() RETURNS trigger
      LANGUAGE plpgsql AS $body$
      BEGIN
        IF NEW.reference IS NULL OR NEW.reference = '' THEN
          NEW.reference := 'PCS-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
        END IF;
        RETURN NEW;
      END $body$;
    $f$;
  ELSE
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION gen_submission_reference() RETURNS trigger
      LANGUAGE plpgsql AS $body$
      BEGIN
        IF NEW.reference IS NULL OR NEW.reference = '' THEN
          NEW.reference := 'PCS-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        END IF;
        RETURN NEW;
      END $body$;
    $f$;
  END IF;
END $do$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_submission_ref ON form_submissions;
--> statement-breakpoint
CREATE TRIGGER trg_submission_ref BEFORE INSERT ON form_submissions
  FOR EACH ROW EXECUTE FUNCTION gen_submission_reference();
--> statement-breakpoint

-- ── Row-level security ──────────────────────────────────────────────────
-- RLS is enabled on every table with **zero policies**, which is not a
-- half-finished configuration: it is the tripwire. The application connects as
-- the table owner and bypasses RLS entirely (00-ARCHITECTURE D1); `anon` and
-- `authenticated` therefore see nothing at all. If the anon key leaks, it
-- unlocks an empty database.
--
-- Revoking privileges is the second half. Supabase grants ALL on new tables in
-- `public` to `anon` and `authenticated` by default, and a grant with no policy
-- still produces a "permission denied" rather than a clean empty result — but a
-- future policy added by mistake would then expose everything the grant allows.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','organization_settings','media_assets','programs','projects',
    'partners','project_partners','impact_metrics','stories','posts',
    'vacancies','people','publications','pages','project_media','story_media',
    'program_media','post_media','form_submissions','audit_logs','redirects'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- The PostgREST roles exist only on Supabase; a plain Postgres has neither.
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', t);
    END IF;
  END LOOP;
END $$;
