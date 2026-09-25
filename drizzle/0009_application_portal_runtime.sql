-- The careers portal's runtime layer: grants, policies, triggers, functions.
--
-- Hand-written, like 0002, 0003, 0006 and 0007. `drizzle/` owns table shape;
-- authorisation is designed in the database (00-ARCHITECTURE §0.6), and
-- `drizzle-kit generate` has nothing to say about a policy. The four tables
-- created in 0008 are the only ones in this schema that would otherwise ship
-- with row-level security disabled — which on a database where every other
-- table is FORCE ROW LEVEL SECURITY is not a smaller wall, it is an open door
-- beside twenty-one locked ones.
--
-- Everything here is idempotent (`drop policy if exists`, `create or replace`),
-- because this file is applied to PGlite in the integration suite as well as to
-- Postgres, and a rerun must not be a failure.

-- ── The reference ────────────────────────────────────────────────────────
--
-- `PCS-APP-XXXXXXXX`, distinct from `form_submissions`' `PCS-XXXXXXXX` so a
-- person quoting a reference on the phone tells the recruitment file and the
-- complaints file apart without being asked which form they used.
--
-- A trigger rather than a default: the reference must also be there when a seed
-- script or a psql session inserts a row, and `gen_random_uuid()` is core in
-- PG13+, so this carries no dependency on pgcrypto and needs no grant on the
-- extensions schema.
CREATE OR REPLACE FUNCTION app.gen_application_reference()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'PCS-APP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  end if;
  return new;
end $function$
;
--> statement-breakpoint

-- ── Submission ───────────────────────────────────────────────────────────
--
-- The one way an application is created. `applications` has no INSERT grant for
-- `app_runtime`, so this is not a convenience — it is the only door, exactly as
-- `app.submit_form()` is for the six public forms.
--
-- It is SECURITY DEFINER because it owns three decisions that must not be
-- re-implemented by a caller:
--
--   1. **Is the form open?** Published, inside its window, under its cap.
--   2. **Retention.** `purge_after` comes from the form's `retention_months`
--      at insert, so a file's life is fixed when it is created.
--   3. **The cap, without a race.** `select ... for update` locks the form row,
--      so the check and the increment are one atomic step. A `count(*)` over
--      `applications` in the application layer cannot do this: two applicants
--      arriving in the same second both read `n - 1`, both pass the check, and
--      the cap is exceeded by exactly as many people as were unlucky. Under
--      the lock the second one waits, re-reads a count that includes the
--      first, and is refused or waitlisted correctly.
--
-- `submission_count` counts **slots taken**, so a waitlisted application does
-- not increment it. That keeps "have we reached the cap" a comparison against
-- the column rather than against the column minus a subquery, and it means
-- raising the capacity later admits people from the waiting list rather than
-- silently doing nothing.
--
-- Every refusal raises with a `PCSRD_` prefix and errcode 22023, which the
-- service maps onto a dictionary key. The messages are for the log, never for
-- a visitor: the server has no locale.
CREATE OR REPLACE FUNCTION app.submit_application(
  p_form_id uuid,
  p_locale locale_code DEFAULT 'ar'::locale_code,
  p_answers jsonb DEFAULT '{}'::jsonb,
  p_attachments jsonb DEFAULT '[]'::jsonb,
  p_applicant_name text DEFAULT NULL::text,
  p_applicant_email text DEFAULT NULL::text,
  p_applicant_phone text DEFAULT NULL::text,
  p_ip_hash text DEFAULT NULL::text,
  p_user_agent text DEFAULT NULL::text
)
 RETURNS TABLE(id uuid, reference text, waitlisted boolean, purge_after date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_form       public.application_forms%rowtype;
  v_waitlisted boolean := false;
  v_id         uuid;
  v_reference  text;
  v_purge      date;
begin
  -- The lock. Everything below reads a form that cannot change underneath it
  -- until this transaction commits.
  select * into v_form
    from public.application_forms
   where public.application_forms.id = p_form_id
     for update;

  if not found then
    raise exception 'PCSRD_FORM_NOT_FOUND: no application form %', p_form_id
      using errcode = '22023';
  end if;

  if v_form.status <> 'published' then
    raise exception 'PCSRD_FORM_CLOSED: form % is %', p_form_id, v_form.status
      using errcode = '22023';
  end if;

  if v_form.opens_at is not null and now() < v_form.opens_at then
    raise exception 'PCSRD_FORM_NOT_OPEN: form % opens at %', p_form_id, v_form.opens_at
      using errcode = '22023';
  end if;

  if v_form.closes_at is not null and now() >= v_form.closes_at then
    raise exception 'PCSRD_FORM_CLOSED: form % closed at %', p_form_id, v_form.closes_at
      using errcode = '22023';
  end if;

  if v_form.capacity is not null and v_form.submission_count >= v_form.capacity then
    if v_form.capacity_rule = 'waitlist' then
      v_waitlisted := true;
    else
      raise exception 'PCSRD_FORM_FULL: form % reached its capacity of %',
        p_form_id, v_form.capacity
        using errcode = '22023';
    end if;
  end if;

  -- One person, one application, unless the form says otherwise. Compared
  -- case-insensitively because an email address is not case-sensitive in the
  -- part that identifies a mailbox, and a second attempt is almost always the
  -- same person typing it differently rather than a different applicant.
  if not v_form.allow_multiple_per_email
     and p_applicant_email is not null
     and p_applicant_email <> ''
     and exists (
       select 1 from public.applications a
        where a.form_id = p_form_id
          and lower(a.applicant_email) = lower(p_applicant_email)
     )
  then
    raise exception 'PCSRD_DUPLICATE_APPLICATION: % already applied to form %',
      p_applicant_email, p_form_id
      using errcode = '22023';
  end if;

  v_purge := (now() + make_interval(months => v_form.retention_months))::date;

  insert into public.applications (
    form_id, vacancy_id, locale, waitlisted, answers, attachments,
    applicant_name, applicant_email, applicant_phone,
    ip_hash, user_agent, purge_after
  ) values (
    p_form_id, v_form.vacancy_id, p_locale, v_waitlisted,
    coalesce(p_answers, '{}'::jsonb), coalesce(p_attachments, '[]'::jsonb),
    nullif(p_applicant_name, ''), nullif(p_applicant_email, ''), nullif(p_applicant_phone, ''),
    p_ip_hash, p_user_agent, v_purge
  )
  returning public.applications.id, public.applications.reference
       into v_id, v_reference;

  if not v_waitlisted then
    update public.application_forms
       set submission_count = submission_count + 1
     where public.application_forms.id = p_form_id;
  end if;

  -- The first row of the applicant's own history. Written here rather than by
  -- the service so it exists for every path that can create an application,
  -- and inside the same transaction so a history without its application is
  -- unrepresentable.
  insert into public.application_events (application_id, actor_id, from_status, to_status, note)
  values (v_id, null, null, 'new', case when v_waitlisted then 'waitlisted' else null end);

  return query select v_id, v_reference, v_waitlisted, v_purge;
end $function$
;
--> statement-breakpoint

-- ── Retention ────────────────────────────────────────────────────────────
--
-- Mirrors `app.purge_expired_submissions()`, including the part that is easy to
-- miss: it **returns the attachment paths**. Deleting the row without deleting
-- the objects leaves every CV the portal has ever received sitting in the
-- private bucket forever, which is precisely the data the retention policy
-- exists to get rid of. The caller must delete them from storage.
--
-- A plain `delete` from the application would remove nothing at all: it runs as
-- `app_runtime` with no actor bound, and `applications.rt_delete` requires
-- `app.is_admin()`, so the policy filters every row away and the statement
-- reports success having deleted zero rows.
CREATE OR REPLACE FUNCTION app.purge_expired_applications()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_paths text[];
  v_count integer;
begin
  -- `removed` is a data-modifying CTE and is referenced twice below. Postgres
  -- evaluates it exactly once and materialises the result, so the delete does
  -- not run twice — and the two numbers are read from the same set of rows.
  -- Counting rows and collecting paths in one aggregate cannot work: an
  -- application with no attachments contributes no row to the lateral
  -- expansion, so it would vanish from the count.
  with removed as (
    delete from public.applications
     where purge_after < current_date
    returning attachments
  ),
  paths as (
    select att->>'path' as path
      from removed,
           lateral jsonb_array_elements(removed.attachments) as att
  )
  select (select count(*) from removed),
         coalesce(
           (select array_agg(paths.path) from paths where paths.path is not null and paths.path <> ''),
           '{}'::text[]
         )
    into v_count, v_paths;

  return jsonb_build_object('deleted', v_count, 'attachments', to_jsonb(v_paths));
end $function$
;
--> statement-breakpoint

-- ── Grants ───────────────────────────────────────────────────────────────
--
-- Postgres checks the GRANT **before** it consults a policy, so a policy
-- without a matching grant is inert — and a grant without a policy is not a
-- permission either, because every table below is FORCE ROW LEVEL SECURITY.
-- Both halves are required, which is why they sit together in this file.
--
-- Deliberately NOT granted:
--
--   applications INSERT            app.submit_application() is SECURITY DEFINER
--                                  and owns the window, the cap and retention
--   application_events UPDATE/DELETE  the pipeline's history is append-only;
--                                  a decision that can be edited is not a record
grant SELECT, INSERT, UPDATE, DELETE on public."application_forms" to app_runtime;
--> statement-breakpoint
grant SELECT, INSERT, UPDATE, DELETE on public."application_form_fields" to app_runtime;
--> statement-breakpoint
grant SELECT, UPDATE, DELETE on public."applications" to app_runtime;
--> statement-breakpoint
grant SELECT, INSERT on public."application_events" to app_runtime;
--> statement-breakpoint

alter table public."application_forms" enable row level security;
--> statement-breakpoint
alter table public."application_forms" force row level security;
--> statement-breakpoint
alter table public."application_form_fields" enable row level security;
--> statement-breakpoint
alter table public."application_form_fields" force row level security;
--> statement-breakpoint
alter table public."applications" enable row level security;
--> statement-breakpoint
alter table public."applications" force row level security;
--> statement-breakpoint
alter table public."application_events" enable row level security;
--> statement-breakpoint
alter table public."application_events" force row level security;
--> statement-breakpoint

-- ── Policies ─────────────────────────────────────────────────────────────
--
-- `pcsrd_owner_all` is on every table in this database and is what lets the
-- owner run migrations, seeds and the integration suite. It is also why the
-- tests exercise the *service* rules and not these: PGlite connects as
-- `postgres` and matches this policy. Verifying the policies needs the real
-- database — `scripts/assert-rls.ts`.
drop policy if exists "pcsrd_owner_all" on public."application_forms";
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."application_forms"
  as permissive for all to postgres using (true) with check (true);
--> statement-breakpoint

-- A visitor reads a published form. Everything else is staff.
drop policy if exists "rt_select" on public."application_forms";
--> statement-breakpoint
create policy "rt_select" on public."application_forms"
  as permissive for select to app_runtime
  using (((status = 'published'::content_status) OR app.is_staff()));
--> statement-breakpoint
drop policy if exists "rt_insert" on public."application_forms";
--> statement-breakpoint
create policy "rt_insert" on public."application_forms"
  as permissive for insert to app_runtime with check (app.is_staff());
--> statement-breakpoint
drop policy if exists "rt_update" on public."application_forms";
--> statement-breakpoint
create policy "rt_update" on public."application_forms"
  as permissive for update to app_runtime
  using (app.is_staff()) with check (app.is_staff());
--> statement-breakpoint
-- Deleting a form cascades to every application on it. That is an admin's
-- decision, never an editor's.
drop policy if exists "rt_delete" on public."application_forms";
--> statement-breakpoint
create policy "rt_delete" on public."application_forms"
  as permissive for delete to app_runtime using (app.is_admin());
--> statement-breakpoint

drop policy if exists "pcsrd_owner_all" on public."application_form_fields";
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."application_form_fields"
  as permissive for all to postgres using (true) with check (true);
--> statement-breakpoint

-- A field is visible exactly when its form is. Restating
-- `status = 'published'` here rather than trusting the join is what makes the
-- rule hold for a query that reads fields *without* their form — which the
-- public renderer does not do today and a future caller might.
drop policy if exists "rt_select" on public."application_form_fields";
--> statement-breakpoint
create policy "rt_select" on public."application_form_fields"
  as permissive for select to app_runtime
  using (exists (
    select 1 from public.application_forms f
     where f.id = form_id
       and (f.status = 'published'::content_status or app.is_staff())
  ));
--> statement-breakpoint
drop policy if exists "rt_write" on public."application_form_fields";
--> statement-breakpoint
create policy "rt_write" on public."application_form_fields"
  as permissive for all to app_runtime
  using (app.is_staff()) with check (app.is_staff());
--> statement-breakpoint

drop policy if exists "pcsrd_owner_all" on public."applications";
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."applications"
  as permissive for all to postgres using (true) with check (true);
--> statement-breakpoint

-- An application is never readable by the public — not even by the person who
-- submitted it. There is no "check my application" page and there must not be
-- one without an authentication story: the reference is quoted in an email and
-- an email is forwarded, so a reference is not a credential. The applicant's
-- receipt comes from the return value of `app.submit_application()`, which the
-- service holds in memory and never reads back.
--
-- `app.can_publish()` — content_manager and admin — matches
-- `form_submissions.rt_select` for a non-sensitive row and the
-- `submissions.read` capability in `services/_shared/permissions.ts`. An
-- `editor` writes content; they do not read a stranger's national ID.
drop policy if exists "rt_select" on public."applications";
--> statement-breakpoint
create policy "rt_select" on public."applications"
  as permissive for select to app_runtime using (app.can_publish());
--> statement-breakpoint
drop policy if exists "rt_update" on public."applications";
--> statement-breakpoint
create policy "rt_update" on public."applications"
  as permissive for update to app_runtime
  using (app.can_publish()) with check (app.can_publish());
--> statement-breakpoint
-- Erasure on request. An admin only, and it is audited by the service.
drop policy if exists "rt_delete" on public."applications";
--> statement-breakpoint
create policy "rt_delete" on public."applications"
  as permissive for delete to app_runtime using (app.is_admin());
--> statement-breakpoint

drop policy if exists "pcsrd_owner_all" on public."application_events";
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."application_events"
  as permissive for all to postgres using (true) with check (true);
--> statement-breakpoint
drop policy if exists "rt_select" on public."application_events";
--> statement-breakpoint
create policy "rt_select" on public."application_events"
  as permissive for select to app_runtime using (app.can_publish());
--> statement-breakpoint
-- `actor_id = app.actor_id()` for the same reason `audit_logs.rt_insert`
-- carries it: an entry cannot be written in someone else's name. The null
-- actor is allowed because `app.submit_application()` writes the arrival row
-- with no human behind it.
drop policy if exists "rt_insert" on public."application_events";
--> statement-breakpoint
create policy "rt_insert" on public."application_events"
  as permissive for insert to app_runtime
  with check (app.can_publish() and (actor_id is null or actor_id = app.actor_id()));
--> statement-breakpoint

-- ── Triggers ─────────────────────────────────────────────────────────────
--
-- The same three the content tables carry, plus the reference generator.
-- `assert_status_transition` is what stops an `editor` publishing a form: the
-- service refuses it first, and this refuses it again for any path that does
-- not go through the service.
DROP TRIGGER IF EXISTS trg_application_forms_updated_at ON public.application_forms;
--> statement-breakpoint
CREATE TRIGGER trg_application_forms_updated_at BEFORE UPDATE ON public.application_forms
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_application_forms_published_at ON public.application_forms;
--> statement-breakpoint
CREATE TRIGGER trg_application_forms_published_at BEFORE INSERT OR UPDATE ON public.application_forms
  FOR EACH ROW EXECUTE FUNCTION app.set_published_at();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_application_forms_status_gate ON public.application_forms;
--> statement-breakpoint
CREATE TRIGGER trg_application_forms_status_gate BEFORE INSERT OR UPDATE ON public.application_forms
  FOR EACH ROW EXECUTE FUNCTION app.assert_status_transition();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_application_form_fields_updated_at ON public.application_form_fields;
--> statement-breakpoint
CREATE TRIGGER trg_application_form_fields_updated_at BEFORE UPDATE ON public.application_form_fields
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_application_reference ON public.applications;
--> statement-breakpoint
CREATE TRIGGER trg_application_reference BEFORE INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION app.gen_application_reference();
