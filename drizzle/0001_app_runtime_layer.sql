-- Extracted from the live database with scripts/dump-app-layer.ts.
--
-- This file is NOT hand-authored. The `app` schema, its gate functions, the
-- triggers, the row-level policies and the runtime role were designed in the
-- database, and the database is the source of truth for them — Drizzle owns
-- table shape only (00-ARCHITECTURE §0.6).
--
-- It exists so PGlite reproduces production semantics in integration tests:
-- without it the consent triggers, the status-transition guard, the audit
-- append-only rule and app.submit_form are all absent locally, and a test suite
-- that passes proves nothing about what production will do.

create schema if not exists app;
--> statement-breakpoint
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    create role app_runtime nologin;
  end if;
end $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.actor_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
  select case
    when coalesce(current_setting('app.actor_id', true), '')
         ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then current_setting('app.actor_id', true)::uuid
    else null
  end
$function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.actor_role()
 RETURNS text
 LANGUAGE sql
 STABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
  select coalesce(nullif(current_setting('app.actor_role', true), ''), 'anon')
$function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.is_runtime_session()
 RETURNS boolean
 LANGUAGE sql
 STABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
  select current_user = 'app_runtime'
$function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
  select app.actor_role() in ('editor','content_manager','admin')
$function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
  select app.actor_role() = 'admin'
$function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.can_publish()
 RETURNS boolean
 LANGUAGE sql
 STABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
  select app.actor_role() in ('content_manager','admin')
$function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.can_view_sensitive()
 RETURNS boolean
 LANGUAGE sql
 STABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
  select app.is_staff()
     and coalesce(current_setting('app.can_view_sensitive', true), 'false') = 'true'
$function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.security_context()
 RETURNS TABLE(db_user name, actor_id uuid, actor_role text, can_view_sensitive boolean, is_runtime boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select current_user, app.actor_id(), app.actor_role(), app.can_view_sensitive(), app.is_runtime_session()
$function$
;
--> statement-breakpoint
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
       and deadline < current_date
    returning public.vacancies.slug_ar, public.vacancies.slug_en
  )
  select 'post'::text,    ap.slug_ar, ap.slug_en from archived_posts ap
  union all
  select 'vacancy'::text, av.slug_ar, av.slug_en from archived_vacancies av;
end $function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.assert_junction_media_consent()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  parent_table text;
  fk_column    text;
  parent_status text;
  offenders    text[];
begin
  select p, c into parent_table, fk_column from (values
    ('project_media','projects','project_id'),
    ('story_media',  'stories', 'story_id'),
    ('program_media','programs','program_id'),
    ('post_media',   'posts',   'post_id')
  ) as t(tbl, p, c) where t.tbl = tg_table_name;

  execute format('select status::text from public.%I where id = (to_jsonb($1)->>%L)::uuid',
                 parent_table, fk_column)
    into parent_status using new;

  if parent_status is distinct from 'published' then
    return new;
  end if;

  offenders := app.media_consent_violations(array[new.media_id]);

  if array_length(offenders, 1) > 0 then
    raise exception
      'PCSRD_CONSENT_REQUIRED: media without documented consent for identifiable minors: %',
      array_to_string(offenders, ', ')
      using errcode = '23514';
  end if;

  return new;
end $function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.assert_media_consent()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  rec        jsonb := to_jsonb(new);
  direct_ids uuid[];
  gallery    uuid[] := '{}';
  offenders  text[];
  junction   text;
  fk_column  text;
begin
  if coalesce(rec->>'status', '') <> 'published' then
    return new;
  end if;

  direct_ids := array_remove(array[
    nullif(rec->>'hero_media_id',  '')::uuid,
    nullif(rec->>'og_media_id',    '')::uuid,
    nullif(rec->>'photo_media_id', '')::uuid,
    nullif(rec->>'file_ar_id',     '')::uuid,
    nullif(rec->>'file_en_id',     '')::uuid
  ], null);

  select j, c into junction, fk_column from (values
    ('projects','project_media','project_id'),
    ('stories', 'story_media',  'story_id'),
    ('programs','program_media','program_id'),
    ('posts',   'post_media',   'post_id')
  ) as t(tbl, j, c) where t.tbl = tg_table_name;

  if junction is not null then
    execute format('select coalesce(array_agg(media_id), %L::uuid[]) from public.%I where %I = $1',
                   '{}', junction, fk_column)
      into gallery using new.id;
  end if;

  offenders := app.media_consent_violations(direct_ids || gallery);

  if array_length(offenders, 1) > 0 then
    raise exception
      'PCSRD_CONSENT_REQUIRED: cannot publish %; media without documented consent for identifiable minors: %',
      tg_table_name, array_to_string(offenders, ', ')
      using errcode = '23514';
  end if;

  return new;
end $function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.assert_person_media_consent()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare offenders text[];
begin
  if not new.is_public or new.photo_media_id is null then
    return new;
  end if;
  offenders := app.media_consent_violations(array[new.photo_media_id]);
  if array_length(offenders, 1) > 0 then
    raise exception 'PCSRD_CONSENT_REQUIRED: %', array_to_string(offenders, ', ')
      using errcode = '23514';
  end if;
  return new;
end $function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.assert_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  -- Migrations, seed and maintenance run as the owner and are trusted paths.
  if not app.is_runtime_session() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'published' and not app.can_publish() then
      raise exception 'PCSRD_FORBIDDEN: role % may not publish', app.actor_role()
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status and not app.can_publish() then
    raise exception 'PCSRD_FORBIDDEN: role % may not change status from % to %',
      app.actor_role(), old.status, new.status
      using errcode = '42501';
  end if;

  return new;
end $function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.block_audit_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if coalesce(current_setting('app.maintenance', true), 'off') = 'on' and tg_op = 'DELETE' then
    return old;   -- retention purge, run by app.purge_audit_logs()
  end if;
  raise exception 'PCSRD_APPEND_ONLY: audit_logs cannot be modified' using errcode = '42501';
end $function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.gen_submission_reference()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.reference is null or new.reference = '' then
    -- gen_random_uuid() is core in PG13+, so the reference generator carries no
    -- dependency on pgcrypto and needs no grant on the extensions schema.
    new.reference := 'PCS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  end if;
  return new;
end $function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.guard_profile_privileges()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if app.is_runtime_session() then
    if (new.role               is distinct from old.role
     or new.can_view_sensitive is distinct from old.can_view_sensitive
     or new.is_active          is distinct from old.is_active)
       and not app.is_admin() then
      raise exception 'PCSRD_FORBIDDEN: only an admin may change role, sensitive access or activation'
        using errcode = '42501';
    end if;

    if new.id = app.actor_id() and new.role is distinct from old.role then
      raise exception 'PCSRD_FORBIDDEN: an admin may not change their own role'
        using errcode = '42501';
    end if;
  end if;

  -- Universal: never leave the system without an active admin.
  if old.role = 'admin'
     and (new.role is distinct from 'admin' or new.is_active = false)
     and not exists (
       select 1 from public.profiles
       where role = 'admin' and is_active and id <> new.id
     ) then
    raise exception 'PCSRD_LAST_ADMIN: refusing to remove the last active admin'
      using errcode = '23514';
  end if;

  return new;
end $function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id, email, full_name, role, can_view_sensitive, is_active)
  values (
    new.id,
    new.email,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    'editor',      -- least privilege, always
    false,         -- sensitive access is granted per person, never inherited
    true
  )
  on conflict (id) do nothing;
  return new;
end $function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.handle_user_email_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email, updated_at = now() where id = new.id;
  end if;
  return new;
end $function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.media_consent_violations(ids uuid[])
 RETURNS text[]
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(array_agg(m.path order by m.path), '{}')
  from public.media_assets m
  where m.id = any(ids)
    and m.has_identifiable_minors
    and m.consent <> 'obtained'
$function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.media_usage(p_media_id uuid)
 RETURNS TABLE(entity_type text, entity_id uuid, field text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select 'program', id, 'hero_media_id'  from public.programs      where hero_media_id  = p_media_id
  union all select 'program', id, 'og_media_id'    from public.programs      where og_media_id    = p_media_id
  union all select 'project', id, 'hero_media_id'  from public.projects      where hero_media_id  = p_media_id
  union all select 'project', id, 'og_media_id'    from public.projects      where og_media_id    = p_media_id
  union all select 'story',   id, 'hero_media_id'  from public.stories       where hero_media_id  = p_media_id
  union all select 'story',   id, 'og_media_id'    from public.stories       where og_media_id    = p_media_id
  union all select 'post',    id, 'hero_media_id'  from public.posts         where hero_media_id  = p_media_id
  union all select 'post',    id, 'og_media_id'    from public.posts         where og_media_id    = p_media_id
  union all select 'vacancy', id, 'og_media_id'    from public.vacancies     where og_media_id    = p_media_id
  union all select 'page',    id, 'og_media_id'    from public.pages         where og_media_id    = p_media_id
  union all select 'partner', id, 'logo_media_id'  from public.partners      where logo_media_id  = p_media_id
  union all select 'person',  id, 'photo_media_id' from public.people        where photo_media_id = p_media_id
  union all select 'publication', id, 'file_ar_id' from public.publications  where file_ar_id     = p_media_id
  union all select 'publication', id, 'file_en_id' from public.publications  where file_en_id     = p_media_id
  union all select 'organization', null::uuid, 'logo_primary_id' from public.organization_settings where logo_primary_id = p_media_id
  union all select 'organization', null::uuid, 'logo_mono_id'    from public.organization_settings where logo_mono_id    = p_media_id
  union all select 'organization', null::uuid, 'default_og_id'   from public.organization_settings where default_og_id   = p_media_id
  union all select 'project_gallery', project_id, 'gallery' from public.project_media where media_id = p_media_id
  union all select 'story_gallery',   story_id,   'gallery' from public.story_media   where media_id = p_media_id
  union all select 'program_gallery', program_id, 'gallery' from public.program_media where media_id = p_media_id
  union all select 'post_gallery',    post_id,    'gallery' from public.post_media    where media_id = p_media_id
$function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.purge_audit_logs(p_retention_months integer DEFAULT 24)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_count integer;
begin
  perform set_config('app.maintenance', 'on', true);
  delete from public.audit_logs
   where created_at < now() - make_interval(months => p_retention_months);
  get diagnostics v_count = row_count;
  perform set_config('app.maintenance', 'off', true);
  return v_count;
end $function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.purge_expired_submissions()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_paths text[];
  v_count integer;
begin
  with removed as (
    delete from public.form_submissions
     where purge_after < current_date
    returning attachment_path
  )
  select coalesce(array_agg(attachment_path) filter (where attachment_path is not null), '{}'),
         count(*)
    into v_paths, v_count
    from removed;

  return jsonb_build_object('deleted', v_count, 'attachments', to_jsonb(v_paths));
end $function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.set_published_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end $function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$
;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.submit_form(p_type submission_type, p_locale locale_code DEFAULT 'ar'::locale_code, p_payload jsonb DEFAULT NULL::jsonb, p_payload_encrypted bytea DEFAULT NULL::bytea, p_payload_key_id text DEFAULT NULL::text, p_attachment_path text DEFAULT NULL::text, p_ip_hash text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_force_sensitive boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sensitive boolean := (p_type = 'complaint') or p_force_sensitive;
  v_months    integer;
  v_reference text;
begin
  -- 01-DATABASE §10 retention policy, owned by the database.
  v_months := case p_type
                when 'partnership'  then 24
                when 'fraud_report' then 24
                when 'complaint'    then 24
                else 12
              end;

  if v_sensitive then
    if p_payload_encrypted is null or p_payload_key_id is null then
      raise exception 'PCSRD_SENSITIVE_PLAINTEXT: a sensitive submission must be encrypted by the application before insert'
        using errcode = '22023';
    end if;
    p_payload    := null;
    p_ip_hash    := null;   -- DNH-8
    p_user_agent := null;
  else
    if p_payload is null then
      raise exception 'PCSRD_EMPTY_PAYLOAD: a non-sensitive submission needs a payload'
        using errcode = '22023';
    end if;
    p_payload_encrypted := null;
    p_payload_key_id    := null;
  end if;

  insert into public.form_submissions (
    type, is_sensitive, locale, payload, payload_encrypted, payload_key_id,
    attachment_path, ip_hash, user_agent, purge_after
  ) values (
    p_type, v_sensitive, p_locale, p_payload, p_payload_encrypted, p_payload_key_id,
    p_attachment_path, p_ip_hash, p_user_agent,
    (now() + make_interval(months => v_months))::date
  )
  returning reference into v_reference;

  return v_reference;
end $function$
;
--> statement-breakpoint
grant usage on schema app to app_runtime;
--> statement-breakpoint
grant SELECT on public."audit_logs" to app_runtime;
--> statement-breakpoint
alter table public."audit_logs" enable row level security;
--> statement-breakpoint
alter table public."audit_logs" force row level security;
--> statement-breakpoint
grant SELECT on public."form_submissions" to app_runtime;
--> statement-breakpoint
alter table public."form_submissions" enable row level security;
--> statement-breakpoint
alter table public."form_submissions" force row level security;
--> statement-breakpoint
grant DELETE, INSERT, SELECT, UPDATE on public."impact_metrics" to app_runtime;
--> statement-breakpoint
alter table public."impact_metrics" enable row level security;
--> statement-breakpoint
alter table public."impact_metrics" force row level security;
--> statement-breakpoint
grant DELETE, INSERT, SELECT, UPDATE on public."media_assets" to app_runtime;
--> statement-breakpoint
alter table public."media_assets" enable row level security;
--> statement-breakpoint
alter table public."media_assets" force row level security;
--> statement-breakpoint
grant SELECT, UPDATE on public."organization_settings" to app_runtime;
--> statement-breakpoint
alter table public."organization_settings" enable row level security;
--> statement-breakpoint
alter table public."organization_settings" force row level security;
--> statement-breakpoint
grant DELETE, INSERT, SELECT, UPDATE on public."pages" to app_runtime;
--> statement-breakpoint
alter table public."pages" enable row level security;
--> statement-breakpoint
alter table public."pages" force row level security;
--> statement-breakpoint
grant DELETE, INSERT, SELECT, UPDATE on public."partners" to app_runtime;
--> statement-breakpoint
alter table public."partners" enable row level security;
--> statement-breakpoint
alter table public."partners" force row level security;
--> statement-breakpoint
grant DELETE, INSERT, SELECT, UPDATE on public."people" to app_runtime;
--> statement-breakpoint
alter table public."people" enable row level security;
--> statement-breakpoint
alter table public."people" force row level security;
--> statement-breakpoint
grant DELETE, INSERT, SELECT, UPDATE on public."post_media" to app_runtime;
--> statement-breakpoint
alter table public."post_media" enable row level security;
--> statement-breakpoint
alter table public."post_media" force row level security;
--> statement-breakpoint
grant DELETE, INSERT, SELECT, UPDATE on public."posts" to app_runtime;
--> statement-breakpoint
alter table public."posts" enable row level security;
--> statement-breakpoint
alter table public."posts" force row level security;
--> statement-breakpoint
grant SELECT on public."profiles" to app_runtime;
--> statement-breakpoint
alter table public."profiles" enable row level security;
--> statement-breakpoint
alter table public."profiles" force row level security;
--> statement-breakpoint
grant DELETE, INSERT, SELECT, UPDATE on public."program_media" to app_runtime;
--> statement-breakpoint
alter table public."program_media" enable row level security;
--> statement-breakpoint
alter table public."program_media" force row level security;
--> statement-breakpoint
grant DELETE, INSERT, SELECT, UPDATE on public."programs" to app_runtime;
--> statement-breakpoint
alter table public."programs" enable row level security;
--> statement-breakpoint
alter table public."programs" force row level security;
--> statement-breakpoint
grant DELETE, INSERT, SELECT, UPDATE on public."project_media" to app_runtime;
--> statement-breakpoint
alter table public."project_media" enable row level security;
--> statement-breakpoint
alter table public."project_media" force row level security;
--> statement-breakpoint
grant DELETE, INSERT, SELECT, UPDATE on public."project_partners" to app_runtime;
--> statement-breakpoint
alter table public."project_partners" enable row level security;
--> statement-breakpoint
alter table public."project_partners" force row level security;
--> statement-breakpoint
grant DELETE, INSERT, SELECT, UPDATE on public."projects" to app_runtime;
--> statement-breakpoint
alter table public."projects" enable row level security;
--> statement-breakpoint
alter table public."projects" force row level security;
--> statement-breakpoint
grant DELETE, INSERT, SELECT, UPDATE on public."publications" to app_runtime;
--> statement-breakpoint
alter table public."publications" enable row level security;
--> statement-breakpoint
alter table public."publications" force row level security;
--> statement-breakpoint
grant DELETE, INSERT, SELECT, UPDATE on public."redirects" to app_runtime;
--> statement-breakpoint
alter table public."redirects" enable row level security;
--> statement-breakpoint
alter table public."redirects" force row level security;
--> statement-breakpoint
grant DELETE, INSERT, SELECT, UPDATE on public."stories" to app_runtime;
--> statement-breakpoint
alter table public."stories" enable row level security;
--> statement-breakpoint
alter table public."stories" force row level security;
--> statement-breakpoint
grant DELETE, INSERT, SELECT, UPDATE on public."story_media" to app_runtime;
--> statement-breakpoint
alter table public."story_media" enable row level security;
--> statement-breakpoint
alter table public."story_media" force row level security;
--> statement-breakpoint
grant DELETE, INSERT, SELECT, UPDATE on public."vacancies" to app_runtime;
--> statement-breakpoint
alter table public."vacancies" enable row level security;
--> statement-breakpoint
alter table public."vacancies" force row level security;
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."audit_logs"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_insert" on public."audit_logs"
  as permissive
  for insert
  to app_runtime
  with check ((app.is_staff() AND (NOT (actor_id IS DISTINCT FROM app.actor_id()))));
--> statement-breakpoint
create policy "rt_select" on public."audit_logs"
  as permissive
  for select
  to app_runtime
  using (app.is_admin());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."form_submissions"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_select" on public."form_submissions"
  as permissive
  for select
  to app_runtime
  using ( CASE WHEN is_sensitive THEN app.can_view_sensitive() ELSE app.can_publish() END);
--> statement-breakpoint
create policy "rt_update" on public."form_submissions"
  as permissive
  for update
  to app_runtime
  using ( CASE WHEN is_sensitive THEN app.can_view_sensitive() ELSE app.can_publish() END)
  with check ( CASE WHEN is_sensitive THEN app.can_view_sensitive() ELSE app.can_publish() END);
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."impact_metrics"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_delete" on public."impact_metrics"
  as permissive
  for delete
  to app_runtime
  using (app.is_admin());
--> statement-breakpoint
create policy "rt_insert" on public."impact_metrics"
  as permissive
  for insert
  to app_runtime
  with check (app.is_staff());
--> statement-breakpoint
create policy "rt_select" on public."impact_metrics"
  as permissive
  for select
  to app_runtime
  using ((is_public OR app.is_staff()));
--> statement-breakpoint
create policy "rt_update" on public."impact_metrics"
  as permissive
  for update
  to app_runtime
  using (app.is_staff())
  with check (app.is_staff());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."media_assets"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_delete" on public."media_assets"
  as permissive
  for delete
  to app_runtime
  using (app.can_publish());
--> statement-breakpoint
create policy "rt_insert" on public."media_assets"
  as permissive
  for insert
  to app_runtime
  with check (app.is_staff());
--> statement-breakpoint
create policy "rt_select" on public."media_assets"
  as permissive
  for select
  to app_runtime
  using (true);
--> statement-breakpoint
create policy "rt_update" on public."media_assets"
  as permissive
  for update
  to app_runtime
  using (app.is_staff())
  with check (app.is_staff());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."organization_settings"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_select" on public."organization_settings"
  as permissive
  for select
  to app_runtime
  using (true);
--> statement-breakpoint
create policy "rt_update" on public."organization_settings"
  as permissive
  for update
  to app_runtime
  using (app.can_publish())
  with check (app.can_publish());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."pages"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_delete" on public."pages"
  as permissive
  for delete
  to app_runtime
  using (app.is_admin());
--> statement-breakpoint
create policy "rt_insert" on public."pages"
  as permissive
  for insert
  to app_runtime
  with check (app.is_staff());
--> statement-breakpoint
create policy "rt_select" on public."pages"
  as permissive
  for select
  to app_runtime
  using (((status = 'published'::content_status) OR app.is_staff()));
--> statement-breakpoint
create policy "rt_update" on public."pages"
  as permissive
  for update
  to app_runtime
  using (app.is_staff())
  with check (app.is_staff());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."partners"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_delete" on public."partners"
  as permissive
  for delete
  to app_runtime
  using (app.is_admin());
--> statement-breakpoint
create policy "rt_insert" on public."partners"
  as permissive
  for insert
  to app_runtime
  with check (app.is_staff());
--> statement-breakpoint
create policy "rt_select" on public."partners"
  as permissive
  for select
  to app_runtime
  using (((status = 'published'::content_status) OR app.is_staff()));
--> statement-breakpoint
create policy "rt_update" on public."partners"
  as permissive
  for update
  to app_runtime
  using (app.is_staff())
  with check (app.is_staff());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."people"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_delete" on public."people"
  as permissive
  for delete
  to app_runtime
  using (app.is_admin());
--> statement-breakpoint
create policy "rt_insert" on public."people"
  as permissive
  for insert
  to app_runtime
  with check (app.is_staff());
--> statement-breakpoint
create policy "rt_select" on public."people"
  as permissive
  for select
  to app_runtime
  using ((is_public OR app.is_staff()));
--> statement-breakpoint
create policy "rt_update" on public."people"
  as permissive
  for update
  to app_runtime
  using (app.is_staff())
  with check (app.is_staff());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."post_media"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_select" on public."post_media"
  as permissive
  for select
  to app_runtime
  using (true);
--> statement-breakpoint
create policy "rt_write" on public."post_media"
  as permissive
  for all
  to app_runtime
  using (app.is_staff())
  with check (app.is_staff());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."posts"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_delete" on public."posts"
  as permissive
  for delete
  to app_runtime
  using (app.is_admin());
--> statement-breakpoint
create policy "rt_insert" on public."posts"
  as permissive
  for insert
  to app_runtime
  with check (app.is_staff());
--> statement-breakpoint
create policy "rt_select" on public."posts"
  as permissive
  for select
  to app_runtime
  using (((status = 'published'::content_status) OR app.is_staff()));
--> statement-breakpoint
create policy "rt_update" on public."posts"
  as permissive
  for update
  to app_runtime
  using (app.is_staff())
  with check (app.is_staff());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."profiles"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_select" on public."profiles"
  as permissive
  for select
  to app_runtime
  using ((app.is_staff() OR (id = app.actor_id())));
--> statement-breakpoint
create policy "rt_update" on public."profiles"
  as permissive
  for update
  to app_runtime
  using ((app.is_admin() OR (id = app.actor_id())))
  with check ((app.is_admin() OR (id = app.actor_id())));
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."program_media"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_select" on public."program_media"
  as permissive
  for select
  to app_runtime
  using (true);
--> statement-breakpoint
create policy "rt_write" on public."program_media"
  as permissive
  for all
  to app_runtime
  using (app.is_staff())
  with check (app.is_staff());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."programs"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_delete" on public."programs"
  as permissive
  for delete
  to app_runtime
  using (app.is_admin());
--> statement-breakpoint
create policy "rt_insert" on public."programs"
  as permissive
  for insert
  to app_runtime
  with check (app.is_staff());
--> statement-breakpoint
create policy "rt_select" on public."programs"
  as permissive
  for select
  to app_runtime
  using (((status = 'published'::content_status) OR app.is_staff()));
--> statement-breakpoint
create policy "rt_update" on public."programs"
  as permissive
  for update
  to app_runtime
  using (app.is_staff())
  with check (app.is_staff());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."project_media"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_select" on public."project_media"
  as permissive
  for select
  to app_runtime
  using (true);
--> statement-breakpoint
create policy "rt_write" on public."project_media"
  as permissive
  for all
  to app_runtime
  using (app.is_staff())
  with check (app.is_staff());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."project_partners"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_select" on public."project_partners"
  as permissive
  for select
  to app_runtime
  using (true);
--> statement-breakpoint
create policy "rt_write" on public."project_partners"
  as permissive
  for all
  to app_runtime
  using (app.is_staff())
  with check (app.is_staff());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."projects"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_delete" on public."projects"
  as permissive
  for delete
  to app_runtime
  using (app.is_admin());
--> statement-breakpoint
create policy "rt_insert" on public."projects"
  as permissive
  for insert
  to app_runtime
  with check (app.is_staff());
--> statement-breakpoint
create policy "rt_select" on public."projects"
  as permissive
  for select
  to app_runtime
  using (((status = 'published'::content_status) OR app.is_staff()));
--> statement-breakpoint
create policy "rt_update" on public."projects"
  as permissive
  for update
  to app_runtime
  using (app.is_staff())
  with check (app.is_staff());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."publications"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_delete" on public."publications"
  as permissive
  for delete
  to app_runtime
  using (app.is_admin());
--> statement-breakpoint
create policy "rt_insert" on public."publications"
  as permissive
  for insert
  to app_runtime
  with check (app.is_staff());
--> statement-breakpoint
create policy "rt_select" on public."publications"
  as permissive
  for select
  to app_runtime
  using (((status = 'published'::content_status) OR app.is_staff()));
--> statement-breakpoint
create policy "rt_update" on public."publications"
  as permissive
  for update
  to app_runtime
  using (app.is_staff())
  with check (app.is_staff());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."redirects"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_select" on public."redirects"
  as permissive
  for select
  to app_runtime
  using (true);
--> statement-breakpoint
create policy "rt_write" on public."redirects"
  as permissive
  for all
  to app_runtime
  using (app.is_admin())
  with check (app.is_admin());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."stories"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_delete" on public."stories"
  as permissive
  for delete
  to app_runtime
  using (app.is_admin());
--> statement-breakpoint
create policy "rt_insert" on public."stories"
  as permissive
  for insert
  to app_runtime
  with check (app.is_staff());
--> statement-breakpoint
create policy "rt_select" on public."stories"
  as permissive
  for select
  to app_runtime
  using (((status = 'published'::content_status) OR app.is_staff()));
--> statement-breakpoint
create policy "rt_update" on public."stories"
  as permissive
  for update
  to app_runtime
  using (app.is_staff())
  with check (app.is_staff());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."story_media"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_select" on public."story_media"
  as permissive
  for select
  to app_runtime
  using (true);
--> statement-breakpoint
create policy "rt_write" on public."story_media"
  as permissive
  for all
  to app_runtime
  using (app.is_staff())
  with check (app.is_staff());
--> statement-breakpoint
create policy "pcsrd_owner_all" on public."vacancies"
  as permissive
  for all
  to postgres
  using (true)
  with check (true);
--> statement-breakpoint
create policy "rt_delete" on public."vacancies"
  as permissive
  for delete
  to app_runtime
  using (app.is_admin());
--> statement-breakpoint
create policy "rt_insert" on public."vacancies"
  as permissive
  for insert
  to app_runtime
  with check (app.is_staff());
--> statement-breakpoint
create policy "rt_select" on public."vacancies"
  as permissive
  for select
  to app_runtime
  using (((status = 'published'::content_status) OR app.is_staff()));
--> statement-breakpoint
create policy "rt_update" on public."vacancies"
  as permissive
  for update
  to app_runtime
  using (app.is_staff())
  with check (app.is_staff());
--> statement-breakpoint
CREATE TRIGGER trg_audit_immutable BEFORE DELETE OR UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION app.block_audit_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_submission_reference BEFORE INSERT ON public.form_submissions FOR EACH ROW EXECUTE FUNCTION app.gen_submission_reference();
--> statement-breakpoint
CREATE TRIGGER trg_impact_metrics_updated_at BEFORE UPDATE ON public.impact_metrics FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_organization_settings_updated_at BEFORE UPDATE ON public.organization_settings FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_pages_published_at BEFORE INSERT OR UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION app.set_published_at();
--> statement-breakpoint
CREATE TRIGGER trg_pages_status_gate BEFORE INSERT OR UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION app.assert_status_transition();
--> statement-breakpoint
CREATE TRIGGER trg_pages_updated_at BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_partners_status_gate BEFORE INSERT OR UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION app.assert_status_transition();
--> statement-breakpoint
CREATE TRIGGER trg_partners_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_people_media_consent BEFORE INSERT OR UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION app.assert_person_media_consent();
--> statement-breakpoint
CREATE TRIGGER trg_people_updated_at BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_post_media_media_consent BEFORE INSERT OR UPDATE ON public.post_media FOR EACH ROW EXECUTE FUNCTION app.assert_junction_media_consent();
--> statement-breakpoint
CREATE TRIGGER trg_posts_media_consent BEFORE INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION app.assert_media_consent();
--> statement-breakpoint
CREATE TRIGGER trg_posts_published_at BEFORE INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION app.set_published_at();
--> statement-breakpoint
CREATE TRIGGER trg_posts_status_gate BEFORE INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION app.assert_status_transition();
--> statement-breakpoint
CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_profiles_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION app.guard_profile_privileges();
--> statement-breakpoint
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_program_media_media_consent BEFORE INSERT OR UPDATE ON public.program_media FOR EACH ROW EXECUTE FUNCTION app.assert_junction_media_consent();
--> statement-breakpoint
CREATE TRIGGER trg_programs_media_consent BEFORE INSERT OR UPDATE ON public.programs FOR EACH ROW EXECUTE FUNCTION app.assert_media_consent();
--> statement-breakpoint
CREATE TRIGGER trg_programs_published_at BEFORE INSERT OR UPDATE ON public.programs FOR EACH ROW EXECUTE FUNCTION app.set_published_at();
--> statement-breakpoint
CREATE TRIGGER trg_programs_status_gate BEFORE INSERT OR UPDATE ON public.programs FOR EACH ROW EXECUTE FUNCTION app.assert_status_transition();
--> statement-breakpoint
CREATE TRIGGER trg_programs_updated_at BEFORE UPDATE ON public.programs FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_project_media_media_consent BEFORE INSERT OR UPDATE ON public.project_media FOR EACH ROW EXECUTE FUNCTION app.assert_junction_media_consent();
--> statement-breakpoint
CREATE TRIGGER trg_projects_media_consent BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION app.assert_media_consent();
--> statement-breakpoint
CREATE TRIGGER trg_projects_published_at BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION app.set_published_at();
--> statement-breakpoint
CREATE TRIGGER trg_projects_status_gate BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION app.assert_status_transition();
--> statement-breakpoint
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_publications_media_consent BEFORE INSERT OR UPDATE ON public.publications FOR EACH ROW EXECUTE FUNCTION app.assert_media_consent();
--> statement-breakpoint
CREATE TRIGGER trg_publications_published_at BEFORE INSERT OR UPDATE ON public.publications FOR EACH ROW EXECUTE FUNCTION app.set_published_at();
--> statement-breakpoint
CREATE TRIGGER trg_publications_status_gate BEFORE INSERT OR UPDATE ON public.publications FOR EACH ROW EXECUTE FUNCTION app.assert_status_transition();
--> statement-breakpoint
CREATE TRIGGER trg_publications_updated_at BEFORE UPDATE ON public.publications FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_stories_media_consent BEFORE INSERT OR UPDATE ON public.stories FOR EACH ROW EXECUTE FUNCTION app.assert_media_consent();
--> statement-breakpoint
CREATE TRIGGER trg_stories_published_at BEFORE INSERT OR UPDATE ON public.stories FOR EACH ROW EXECUTE FUNCTION app.set_published_at();
--> statement-breakpoint
CREATE TRIGGER trg_stories_status_gate BEFORE INSERT OR UPDATE ON public.stories FOR EACH ROW EXECUTE FUNCTION app.assert_status_transition();
--> statement-breakpoint
CREATE TRIGGER trg_stories_updated_at BEFORE UPDATE ON public.stories FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_story_media_media_consent BEFORE INSERT OR UPDATE ON public.story_media FOR EACH ROW EXECUTE FUNCTION app.assert_junction_media_consent();
--> statement-breakpoint
CREATE TRIGGER trg_vacancies_published_at BEFORE INSERT OR UPDATE ON public.vacancies FOR EACH ROW EXECUTE FUNCTION app.set_published_at();
--> statement-breakpoint
CREATE TRIGGER trg_vacancies_status_gate BEFORE INSERT OR UPDATE ON public.vacancies FOR EACH ROW EXECUTE FUNCTION app.assert_status_transition();
--> statement-breakpoint
CREATE TRIGGER trg_vacancies_updated_at BEFORE UPDATE ON public.vacancies FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
