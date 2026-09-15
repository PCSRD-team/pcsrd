-- Brings the migration chain to parity with the live database.
--
-- The live database was not created by `drizzle-kit migrate`: it was built from
-- hand-written DDL and then patched in place (`0004` was applied by hand — its
-- footer columns and `app.media_usage` exist, but there is no
-- `drizzle.__drizzle_migrations` table). That DDL carries thirty-one CHECK
-- constraints, Postgres-default constraint names (`<table>_<column>_fkey`,
-- `<table>_<column>_key`, `<junction>_pkey`), an identity column on
-- `audit_logs.id`, and sixty-five indexes the baseline never declared — many of
-- them exact duplicates of a baseline index under a second name.
--
-- Every statement here is a no-op where its effect already exists, so the file
-- can be applied to the live database (where everything below is already true)
-- and to a fresh database built from `0000`–`0004` (PGlite in the integration
-- tests) and produce the same schema either way. That is the only property that
-- matters for a file whose target is already there: drizzle-kit's generated
-- drop-and-recreate would have failed on the first `DROP CONSTRAINT` and,
-- worse, would have dropped and recreated fifty-five foreign keys that were
-- never wrong, only differently named.
--
-- Nothing here changes a column, a type, a default or a nullability — those
-- were already identical. See `docs/remote-schema-inventory.txt`.

-- ── 1. Constraint names: Drizzle's generated names → the live database's ──
--
-- `RENAME CONSTRAINT` also renames the index behind a UNIQUE or PRIMARY KEY, so
-- the index name matches too. Guarded on both names so it is safe to re-run.
do $mig$
declare r record;
begin
  for r in
    select * from (values
      ('profiles', 'profiles_email_unique', 'profiles_email_key'),
      ('media_assets', 'media_assets_path_unique', 'media_assets_path_key'),
      ('programs', 'programs_key_unique', 'programs_key_key'),
      ('pages', 'pages_key_unique', 'pages_key_key'),
      ('form_submissions', 'form_submissions_reference_unique', 'form_submissions_reference_key'),
      ('redirects', 'redirects_sourcePath_unique', 'redirects_source_path_key'),
      ('organization_settings', 'organization_settings_singleton', 'organization_settings_id_check'),
      ('media_assets', 'media_assets_created_by_profiles_id_fk', 'media_assets_created_by_fkey'),
      ('organization_settings', 'organization_settings_logo_primary_id_media_assets_id_fk', 'organization_settings_logo_primary_id_fkey'),
      ('organization_settings', 'organization_settings_logo_mono_id_media_assets_id_fk', 'organization_settings_logo_mono_id_fkey'),
      ('organization_settings', 'organization_settings_default_og_id_media_assets_id_fk', 'organization_settings_default_og_id_fkey'),
      ('organization_settings', 'organization_settings_updated_by_profiles_id_fk', 'organization_settings_updated_by_fkey'),
      ('program_media', 'program_media_program_id_programs_id_fk', 'program_media_program_id_fkey'),
      ('program_media', 'program_media_media_id_media_assets_id_fk', 'program_media_media_id_fkey'),
      ('programs', 'programs_created_by_profiles_id_fk', 'programs_created_by_fkey'),
      ('programs', 'programs_updated_by_profiles_id_fk', 'programs_updated_by_fkey'),
      ('programs', 'programs_hero_media_id_media_assets_id_fk', 'programs_hero_media_id_fkey'),
      ('programs', 'programs_og_media_id_media_assets_id_fk', 'programs_og_media_id_fkey'),
      ('partners', 'partners_logo_media_id_media_assets_id_fk', 'partners_logo_media_id_fkey'),
      ('project_media', 'project_media_project_id_projects_id_fk', 'project_media_project_id_fkey'),
      ('project_media', 'project_media_media_id_media_assets_id_fk', 'project_media_media_id_fkey'),
      ('project_partners', 'project_partners_project_id_projects_id_fk', 'project_partners_project_id_fkey'),
      ('project_partners', 'project_partners_partner_id_partners_id_fk', 'project_partners_partner_id_fkey'),
      ('projects', 'projects_created_by_profiles_id_fk', 'projects_created_by_fkey'),
      ('projects', 'projects_updated_by_profiles_id_fk', 'projects_updated_by_fkey'),
      ('projects', 'projects_program_id_programs_id_fk', 'projects_program_id_fkey'),
      ('projects', 'projects_hero_media_id_media_assets_id_fk', 'projects_hero_media_id_fkey'),
      ('projects', 'projects_og_media_id_media_assets_id_fk', 'projects_og_media_id_fkey'),
      ('impact_metrics', 'impact_metrics_program_id_programs_id_fk', 'impact_metrics_program_id_fkey'),
      ('impact_metrics', 'impact_metrics_project_id_projects_id_fk', 'impact_metrics_project_id_fkey'),
      ('stories', 'stories_created_by_profiles_id_fk', 'stories_created_by_fkey'),
      ('stories', 'stories_updated_by_profiles_id_fk', 'stories_updated_by_fkey'),
      ('stories', 'stories_program_id_programs_id_fk', 'stories_program_id_fkey'),
      ('stories', 'stories_project_id_projects_id_fk', 'stories_project_id_fkey'),
      ('stories', 'stories_hero_media_id_media_assets_id_fk', 'stories_hero_media_id_fkey'),
      ('stories', 'stories_og_media_id_media_assets_id_fk', 'stories_og_media_id_fkey'),
      ('story_media', 'story_media_story_id_stories_id_fk', 'story_media_story_id_fkey'),
      ('story_media', 'story_media_media_id_media_assets_id_fk', 'story_media_media_id_fkey'),
      ('post_media', 'post_media_post_id_posts_id_fk', 'post_media_post_id_fkey'),
      ('post_media', 'post_media_media_id_media_assets_id_fk', 'post_media_media_id_fkey'),
      ('posts', 'posts_created_by_profiles_id_fk', 'posts_created_by_fkey'),
      ('posts', 'posts_updated_by_profiles_id_fk', 'posts_updated_by_fkey'),
      ('posts', 'posts_program_id_programs_id_fk', 'posts_program_id_fkey'),
      ('posts', 'posts_project_id_projects_id_fk', 'posts_project_id_fkey'),
      ('posts', 'posts_hero_media_id_media_assets_id_fk', 'posts_hero_media_id_fkey'),
      ('posts', 'posts_og_media_id_media_assets_id_fk', 'posts_og_media_id_fkey'),
      ('vacancies', 'vacancies_created_by_profiles_id_fk', 'vacancies_created_by_fkey'),
      ('vacancies', 'vacancies_updated_by_profiles_id_fk', 'vacancies_updated_by_fkey'),
      ('vacancies', 'vacancies_og_media_id_media_assets_id_fk', 'vacancies_og_media_id_fkey'),
      ('people', 'people_photo_media_id_media_assets_id_fk', 'people_photo_media_id_fkey'),
      ('publications', 'publications_created_by_profiles_id_fk', 'publications_created_by_fkey'),
      ('publications', 'publications_updated_by_profiles_id_fk', 'publications_updated_by_fkey'),
      ('publications', 'publications_file_ar_id_media_assets_id_fk', 'publications_file_ar_id_fkey'),
      ('publications', 'publications_file_en_id_media_assets_id_fk', 'publications_file_en_id_fkey'),
      ('pages', 'pages_created_by_profiles_id_fk', 'pages_created_by_fkey'),
      ('pages', 'pages_updated_by_profiles_id_fk', 'pages_updated_by_fkey'),
      ('pages', 'pages_og_media_id_media_assets_id_fk', 'pages_og_media_id_fkey'),
      ('form_submissions', 'form_submissions_handled_by_profiles_id_fk', 'form_submissions_handled_by_fkey'),
      ('audit_logs', 'audit_logs_actor_id_profiles_id_fk', 'audit_logs_actor_id_fkey'),
      ('program_media', 'program_media_program_id_media_id_pk', 'program_media_pkey'),
      ('project_media', 'project_media_project_id_media_id_pk', 'project_media_pkey'),
      ('project_partners', 'project_partners_project_id_partner_id_role_pk', 'project_partners_pkey'),
      ('story_media', 'story_media_story_id_media_id_pk', 'story_media_pkey'),
      ('post_media', 'post_media_post_id_media_id_pk', 'post_media_pkey')
    ) as v(tbl, old_name, new_name)
  loop
    if exists (
      select 1 from pg_constraint c
      where c.conrelid = format('public.%I', r.tbl)::regclass and c.conname = r.old_name
    ) and not exists (
      select 1 from pg_constraint c
      where c.conrelid = format('public.%I', r.tbl)::regclass and c.conname = r.new_name
    ) then
      execute format('alter table public.%I rename constraint %I to %I', r.tbl, r.old_name, r.new_name);
    end if;
  end loop;
end
$mig$;
--> statement-breakpoint
-- ── 2. audit_logs.id: bigserial → bigint generated always as identity ────
--
-- Behaviourally identical for every insert the application makes (none supplies
-- an id); the identity form refuses an explicit id without OVERRIDING SYSTEM
-- VALUE, which is the right property for an append-only log. The sequence keeps
-- its name, so the USAGE grant from `0003` still applies — re-granted here in
-- case a fresh database is being built, because dropping the serial sequence
-- drops the grant with it.
do $mig$
declare next_id bigint;
begin
  if (select attidentity from pg_attribute
      where attrelid = 'public.audit_logs'::regclass and attname = 'id') = '' then
    select coalesce(max(id), 0) + 1 into next_id from public.audit_logs;
    alter table public.audit_logs alter column id drop default;
    drop sequence if exists public.audit_logs_id_seq;
    alter table public.audit_logs alter column id
      add generated always as identity (sequence name public.audit_logs_id_seq);
    perform setval('public.audit_logs_id_seq', next_id, false);
    if exists (select 1 from pg_roles where rolname = 'app_runtime') then
      grant usage on sequence public.audit_logs_id_seq to app_runtime;
    end if;
  end if;
end
$mig$;
--> statement-breakpoint
-- ── 3. CHECK constraints the baseline never declared ───────────────────────
--
-- Expressions are the live database's own (`pg_get_constraintdef`), verbatim.
do $mig$
declare r record;
begin
  for r in
    select * from (values
      ('media_assets', 'media_assets_file_size_check', $chk$((file_size > 0))$chk$),
      ('media_assets', 'media_assets_alt_ar_check', $chk$((length(btrim(alt_ar)) > 0))$chk$),
      ('media_assets', 'chk_media_minor_consent', $chk$(((has_identifiable_minors = false) OR ((consent = 'obtained'::consent_status) AND (consent_reference IS NOT NULL))))$chk$),
      ('organization_settings', 'organization_settings_founded_year_check', $chk$(((founded_year >= 1900) AND (founded_year <= 2100)))$chk$),
      ('organization_settings', 'org_whatsapp_digits', $chk$(((whatsapp_number IS NULL) OR (whatsapp_number ~ '^[0-9]{8,15}$'::text)))$chk$),
      ('organization_settings', 'org_json_shapes', $chk$(((jsonb_typeof(core_values) = 'array'::text) AND (jsonb_typeof(principles) = 'array'::text) AND (jsonb_typeof(strategic_objectives) = 'array'::text) AND (jsonb_typeof(socials) = 'array'::text) AND (jsonb_typeof(official_channels) = 'array'::text)))$chk$),
      ('programs', 'programs_slug_shape', $chk$(((slug_ar ~ '^[^\s/]+$'::text) AND (slug_en ~ '^[^\s/]+$'::text)))$chk$),
      ('partners', 'partners_membership_shape', $chk$(((membership_level IS NULL) OR (type = ANY (ARRAY['network'::partner_type, 'membership'::partner_type]))))$chk$),
      ('projects', 'projects_slug_shape', $chk$(((slug_ar ~ '^[^\s/]+$'::text) AND (slug_en ~ '^[^\s/]+$'::text)))$chk$),
      ('impact_metrics', 'impact_metrics_display_prefix_check', $chk$(((display_prefix IS NULL) OR (display_prefix = ANY (ARRAY['+'::text, '~'::text]))))$chk$),
      ('impact_metrics', 'metrics_verified_needs_source', $chk$(((status <> 'verified'::metric_status) OR ((verification_source IS NOT NULL) AND (length(btrim(verification_source)) > 0))))$chk$),
      ('stories', 'stories_slug_shape', $chk$(((slug_ar ~ '^[^\s/]+$'::text) AND (slug_en ~ '^[^\s/]+$'::text)))$chk$),
      ('stories', 'stories_named_needs_consent', $chk$((subject_anonymized OR consent_obtained))$chk$),
      ('posts', 'posts_slug_shape', $chk$(((slug_ar ~ '^[^\s/]+$'::text) AND (slug_en ~ '^[^\s/]+$'::text)))$chk$),
      ('posts', 'posts_expiry_only_announcements', $chk$(((expires_at IS NULL) OR (category = 'announcement'::post_category)))$chk$),
      ('vacancies', 'vacancies_slug_shape', $chk$(((slug_ar ~ '^[^\s/]+$'::text) AND (slug_en ~ '^[^\s/]+$'::text)))$chk$),
      ('vacancies', 'vacancies_method', $chk$((application_method = ANY (ARRAY['form'::text, 'email'::text])))$chk$),
      ('vacancies', 'vacancies_email_required', $chk$(((application_method <> 'email'::text) OR (application_email IS NOT NULL)))$chk$),
      ('publications', 'publications_slug_shape', $chk$(((slug_ar ~ '^[^\s/]+$'::text) AND (slug_en ~ '^[^\s/]+$'::text)))$chk$),
      ('publications', 'publications_published_year_check', $chk$(((published_year IS NULL) OR ((published_year >= 1900) AND (published_year <= 2100))))$chk$),
      ('pages', 'pages_slug_shape', $chk$(((slug_ar ~ '^[^\s/]+$'::text) AND (slug_en ~ '^[^\s/]+$'::text)))$chk$),
      ('form_submissions', 'submissions_handled_shape', $chk$(((state = 'new'::submission_state) OR (handled_at IS NOT NULL)))$chk$),
      ('form_submissions', 'submissions_payload_exclusive', $chk$(((is_sensitive AND (payload IS NULL) AND (payload_encrypted IS NOT NULL) AND (payload_key_id IS NOT NULL)) OR ((NOT is_sensitive) AND (payload IS NOT NULL) AND (payload_encrypted IS NULL) AND (payload_key_id IS NULL))))$chk$),
      ('form_submissions', 'submissions_sensitive_unlinkable', $chk$(((NOT is_sensitive) OR ((ip_hash IS NULL) AND (user_agent IS NULL))))$chk$),
      ('audit_logs', 'audit_action_known', $chk$((action = ANY (ARRAY['create'::text, 'update'::text, 'publish'::text, 'unpublish'::text, 'delete'::text, 'login'::text, 'invite'::text, 'set_role'::text, 'deactivate'::text, 'view_sensitive'::text, 'set_state'::text, 'upload'::text, 'purge'::text, 'archive'::text])))$chk$),
      ('redirects', 'redirects_absolute', $chk$(((source_path ~~ '/%'::text) AND (destination_path ~~ '/%'::text)))$chk$),
      ('redirects', 'redirects_no_loop', $chk$((source_path <> destination_path))$chk$),
      ('redirects', 'redirects_status_code', $chk$((status_code = ANY (ARRAY[301, 302, 307, 308])))$chk$)
    ) as v(tbl, con_name, expr)
  loop
    if not exists (
      select 1 from pg_constraint c
      where c.conrelid = format('public.%I', r.tbl)::regclass and c.conname = r.con_name
    ) then
      execute format('alter table public.%I add constraint %I check %s', r.tbl, r.con_name, r.expr);
    end if;
  end loop;
end
$mig$;
--> statement-breakpoint
-- ── 4. Indexes present on the live database and absent from the baseline ─
--
-- Definitions are `pg_indexes.indexdef` from the live database with
-- `IF NOT EXISTS` added. The `ix_*` / `ux_*` family is the hand-written DDL the
-- database was built from; where one duplicates a baseline index exactly it is
-- noted in the schema file. They are reproduced here so `drizzle/` describes
-- production — drop them there first, then remove them from the schema.
CREATE INDEX IF NOT EXISTS ix_profiles_active ON public.profiles USING btree (is_active);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_profiles_role ON public.profiles USING btree (role) WHERE is_active;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS media_bucket_idx ON public.media_assets USING btree (bucket);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS media_consent_idx ON public.media_assets USING btree (consent) WHERE has_identifiable_minors;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_media_created_by ON public.media_assets USING btree (created_by);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_media_kind ON public.media_assets USING btree (kind, created_at DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_media_consent ON public.media_assets USING btree (consent) WHERE has_identifiable_minors;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS program_media_media_idx ON public.program_media USING btree (media_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_programs_hero ON public.programs USING btree (hero_media_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_programs_public ON public.programs USING btree (display_order, published_at DESC) WHERE (status = 'published'::content_status);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ux_programs_slug_ar ON public.programs USING btree (slug_ar);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ux_programs_slug_en ON public.programs USING btree (slug_en);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_partners_public ON public.partners USING btree (display_order, name_ar) WHERE (status = 'published'::content_status);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_partners_type ON public.partners USING btree (type);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS project_media_media_idx ON public.project_media USING btree (media_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_project_partners_partner ON public.project_partners USING btree (partner_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS projects_start_year_idx ON public.projects USING btree (start_date) WHERE (status = 'published'::content_status);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_projects_program ON public.projects USING btree (program_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_projects_state ON public.projects USING btree (project_state, start_date DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_projects_public ON public.projects USING btree (published_at DESC) WHERE (status = 'published'::content_status);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_projects_featured ON public.projects USING btree (published_at DESC) WHERE ((status = 'published'::content_status) AND is_featured);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_projects_govs ON public.projects USING gin (governorates);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_projects_themes ON public.projects USING gin (themes);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_projects_search_ar ON public.projects USING gin (to_tsvector('simple'::regconfig, ((COALESCE(title_ar, ''::text) || ' '::text) || COALESCE(summary_ar, ''::text))));--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ux_projects_slug_ar ON public.projects USING btree (slug_ar);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ux_projects_slug_en ON public.projects USING btree (slug_en);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS metrics_project_idx ON public.impact_metrics USING btree (project_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_metrics_program ON public.impact_metrics USING btree (program_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_metrics_project ON public.impact_metrics USING btree (project_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_metrics_public ON public.impact_metrics USING btree (display_order, period_end DESC) WHERE is_public;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS stories_program_idx ON public.stories USING btree (program_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS stories_project_idx ON public.stories USING btree (project_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_stories_program ON public.stories USING btree (program_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_stories_project ON public.stories USING btree (project_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_stories_public ON public.stories USING btree (published_at DESC) WHERE (status = 'published'::content_status);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ux_stories_slug_ar ON public.stories USING btree (slug_ar);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ux_stories_slug_en ON public.stories USING btree (slug_en);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS story_media_media_idx ON public.story_media USING btree (media_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS post_media_media_idx ON public.post_media USING btree (media_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_posts_program ON public.posts USING btree (program_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_posts_project ON public.posts USING btree (project_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_posts_public ON public.posts USING btree (category, published_at DESC) WHERE (status = 'published'::content_status);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_posts_search_ar ON public.posts USING gin (to_tsvector('simple'::regconfig, ((COALESCE(title_ar, ''::text) || ' '::text) || COALESCE(excerpt_ar, ''::text))));--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ux_posts_slug_ar ON public.posts USING btree (slug_ar);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ux_posts_slug_en ON public.posts USING btree (slug_en);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_vacancies_open ON public.vacancies USING btree (deadline) WHERE (status = 'published'::content_status);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ux_vacancies_slug_ar ON public.vacancies USING btree (slug_ar);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ux_vacancies_slug_en ON public.vacancies USING btree (slug_en);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_people_public ON public.people USING btree (category, display_order) WHERE is_public;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS publications_type_idx ON public.publications USING btree (type, display_order) WHERE (status = 'published'::content_status);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_publications_public ON public.publications USING btree (type, published_year DESC) WHERE (status = 'published'::content_status);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ux_publications_slug_ar ON public.publications USING btree (slug_ar);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ux_publications_slug_en ON public.publications USING btree (slug_en);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS pages_slug_ar_idx ON public.pages USING btree (slug_ar);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS pages_slug_en_idx ON public.pages USING btree (slug_en);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ux_pages_slug_ar ON public.pages USING btree (slug_ar);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ux_pages_slug_en ON public.pages USING btree (slug_en);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_submissions_type ON public.form_submissions USING btree (type, created_at DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_submissions_state ON public.form_submissions USING btree (state, created_at DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_submissions_purge ON public.form_submissions USING btree (purge_after);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_submissions_handler ON public.form_submissions USING btree (handled_by);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_action_idx ON public.audit_logs USING btree (action, created_at DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_audit_entity ON public.audit_logs USING btree (entity_type, entity_id, created_at DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_audit_actor ON public.audit_logs USING btree (actor_id, created_at DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_audit_action ON public.audit_logs USING btree (action, created_at DESC);
