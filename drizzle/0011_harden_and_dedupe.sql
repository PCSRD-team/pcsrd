-- Database review, 2026-09-29. Hand-written, like 0006–0010.
--
-- 1. EXECUTE on the careers-portal functions.
--
--    Every function in 0001 carries an explicit `{postgres, app_runtime}` ACL.
--    The three added by 0009 were created with Postgres's default — EXECUTE to
--    PUBLIC — so `anon` and `authenticated` hold it too. The only thing
--    standing between a visitor and a SECURITY DEFINER insert that skips the
--    rate limit and the validation is that they lack USAGE on schema `app`.
--    One grant on that schema, or exposing it to PostgREST, would open it.
REVOKE ALL ON FUNCTION app.submit_application(uuid, locale_code, jsonb, jsonb, text, text, text, text, text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.purge_expired_applications() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.gen_application_reference() FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  -- `app_runtime` exists on the live database, not in PGlite.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    GRANT EXECUTE ON FUNCTION app.submit_application(uuid, locale_code, jsonb, jsonb, text, text, text, text, text) TO app_runtime;
    GRANT EXECUTE ON FUNCTION app.purge_expired_applications() TO app_runtime;
  END IF;
END $$;
--> statement-breakpoint

-- 2. The duplicate-application check compares `lower(applicant_email)`, which
--    an index on the raw column cannot serve beyond narrowing by form.
DROP INDEX IF EXISTS public.applications_email_idx;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS applications_email_lower_idx ON public.applications (form_id, lower(applicant_email));
--> statement-breakpoint

-- 3. Twenty-nine indexes byte-identical to a sibling (advisor `duplicate_index`).
--    The live database was built from hand-written DDL (`ix_*` / `ux_*`) and
--    Drizzle then added its own names for the same shapes. Each pair doubles
--    the write cost for nothing; the Drizzle-named twin is kept.
DROP INDEX IF EXISTS public.ix_audit_action;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ix_audit_actor;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ix_audit_entity;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ix_submissions_purge;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ix_submissions_type;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ix_metrics_project;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ix_media_consent;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ix_media_kind;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ux_pages_slug_ar;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ux_pages_slug_en;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ix_people_public;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ux_posts_slug_ar;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ux_posts_slug_en;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ix_profiles_role;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ux_programs_slug_ar;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ux_programs_slug_en;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ix_project_partners_partner;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ix_projects_govs;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ix_projects_themes;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ux_projects_slug_ar;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ux_projects_slug_en;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ux_publications_slug_ar;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ux_publications_slug_en;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ix_stories_program;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ix_stories_project;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ux_stories_slug_ar;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ux_stories_slug_en;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ux_vacancies_slug_ar;
--> statement-breakpoint
DROP INDEX IF EXISTS public.ux_vacancies_slug_en;
--> statement-breakpoint

-- 4. A vacancy's last day is a day in Palestine, not in UTC.
--
--    `current_date` is the session's date, and the session runs in UTC. A
--    vacancy's portal form closes at 23:59 Asia/Gaza (`ensureFormForVacancy`),
--    so the archive job and the "open vacancies" list must agree on the same
--    calendar, or the page invites applications for two or three hours after
--    the form has started refusing them. Body otherwise unchanged from 0001.
CREATE OR REPLACE FUNCTION app.archive_expired_content()
 RETURNS TABLE(entity text, slug_ar text, slug_en text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return query
  with archived_posts as (
    update public.posts
       set status = 'archived'
     where category   = 'announcement'
       and status     = 'published'
       and expires_at is not null
       and expires_at < now()
    returning public.posts.slug_ar, public.posts.slug_en
  ),
  archived_vacancies as (
    update public.vacancies
       set status = 'archived'
     where status   = 'published'
       and deadline < (now() at time zone 'Asia/Gaza')::date
    returning public.vacancies.slug_ar, public.vacancies.slug_en
  )
  select 'post'::text,    ap.slug_ar, ap.slug_en from archived_posts ap
  union all
  select 'vacancy'::text, av.slug_ar, av.slug_en from archived_vacancies av;
end $function$
;
