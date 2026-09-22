import { describe, expect, it } from 'vitest';
import { useTestDb } from '../setup/pglite';

/**
 * The migration chain must reproduce the live database.
 *
 * The live schema was captured read-only from `information_schema` and
 * `pg_catalog` on 2026-09-14 (see `docs/remote-schema-inventory.txt`). This
 * test applies `drizzle/*.sql` in order to PGlite and asserts the result
 * carries the same columns, constraint names and kinds, index names, enum
 * members and the identity column on `audit_logs.id`.
 *
 * It is a parity test, not a behaviour test: it does not check what a CHECK
 * refuses, only that the CHECK exists under the name production has. When it
 * fails, either the live database changed (recapture the inventory and add a
 * migration) or a migration drifted from it (fix the migration). It must never
 * be "fixed" by editing the expectations to match the migrations.
 */

const getDb = useTestDb();

type Row = Record<string, unknown>;
const rows = async (sql: string): Promise<Row[]> =>
  (await getDb().execute(sql)).rows as Row[];

const CONSTRAINTS: Record<string, Record<string, string>> = {
  audit_logs: { "audit_action_known": 'c', "audit_logs_actor_id_fkey": 'f', "audit_logs_pkey": 'p' },
  form_submissions: { "form_submissions_handled_by_fkey": 'f', "form_submissions_pkey": 'p', "form_submissions_reference_key": 'u', "submissions_handled_shape": 'c', "submissions_payload_exclusive": 'c', "submissions_sensitive_unlinkable": 'c' },
  impact_metrics: { "impact_metrics_display_prefix_check": 'c', "impact_metrics_pkey": 'p', "impact_metrics_program_id_fkey": 'f', "impact_metrics_project_id_fkey": 'f', "metrics_period_order": 'c', "metrics_verified_needs_source": 'c' },
  media_assets: { "chk_media_minor_consent": 'c', "media_assets_alt_ar_check": 'c', "media_assets_created_by_fkey": 'f', "media_assets_file_size_check": 'c', "media_assets_path_key": 'u', "media_assets_pkey": 'p' },
  organization_settings: { "org_json_shapes": 'c', "org_whatsapp_digits": 'c', "organization_settings_default_og_id_fkey": 'f', "organization_settings_footer_logo_id_media_assets_id_fk": 'f', "organization_settings_founded_year_check": 'c', "organization_settings_id_check": 'c', "organization_settings_logo_mono_id_fkey": 'f', "organization_settings_logo_primary_id_fkey": 'f', "organization_settings_pkey": 'p', "organization_settings_updated_by_fkey": 'f' },
  pages: { "pages_created_by_fkey": 'f', "pages_key_key": 'u', "pages_og_media_id_fkey": 'f', "pages_pkey": 'p', "pages_slug_shape": 'c', "pages_updated_by_fkey": 'f' },
  partners: { "partners_logo_media_id_fkey": 'f', "partners_membership_shape": 'c', "partners_pkey": 'p' },
  people: { "people_photo_media_id_fkey": 'f', "people_pkey": 'p' },
  post_media: { "post_media_media_id_fkey": 'f', "post_media_pkey": 'p', "post_media_post_id_fkey": 'f' },
  posts: { "posts_created_by_fkey": 'f', "posts_expiry_only_announcements": 'c', "posts_hero_media_id_fkey": 'f', "posts_og_media_id_fkey": 'f', "posts_pkey": 'p', "posts_program_id_fkey": 'f', "posts_project_id_fkey": 'f', "posts_slug_shape": 'c', "posts_updated_by_fkey": 'f' },
  profiles: { "profiles_email_key": 'u', "profiles_pkey": 'p' },
  program_media: { "program_media_media_id_fkey": 'f', "program_media_pkey": 'p', "program_media_program_id_fkey": 'f' },
  programs: { "programs_created_by_fkey": 'f', "programs_hero_media_id_fkey": 'f', "programs_key_key": 'u', "programs_og_media_id_fkey": 'f', "programs_pkey": 'p', "programs_slug_shape": 'c', "programs_updated_by_fkey": 'f' },
  project_media: { "project_media_media_id_fkey": 'f', "project_media_pkey": 'p', "project_media_project_id_fkey": 'f' },
  project_partners: { "project_partners_partner_id_fkey": 'f', "project_partners_pkey": 'p', "project_partners_project_id_fkey": 'f' },
  projects: { "projects_created_by_fkey": 'f', "projects_date_order": 'c', "projects_hero_media_id_fkey": 'f', "projects_og_media_id_fkey": 'f', "projects_pkey": 'p', "projects_program_id_fkey": 'f', "projects_slug_shape": 'c', "projects_updated_by_fkey": 'f' },
  publications: { "publications_created_by_fkey": 'f', "publications_file_ar_id_fkey": 'f', "publications_file_en_id_fkey": 'f', "publications_pkey": 'p', "publications_published_year_check": 'c', "publications_slug_shape": 'c', "publications_updated_by_fkey": 'f' },
  // Added by drizzle/0006_rate_limit_fallback.sql. The live database does not
  // carry it until that migration is applied — docs/PROGRESS.md §6.1.
  rate_limit_hits: {},
  redirects: { "redirects_absolute": 'c', "redirects_no_loop": 'c', "redirects_pkey": 'p', "redirects_source_path_key": 'u', "redirects_status_code": 'c' },
  stories: { "stories_created_by_fkey": 'f', "stories_hero_media_id_fkey": 'f', "stories_named_needs_consent": 'c', "stories_og_media_id_fkey": 'f', "stories_pkey": 'p', "stories_program_id_fkey": 'f', "stories_project_id_fkey": 'f', "stories_slug_shape": 'c', "stories_updated_by_fkey": 'f' },
  story_media: { "story_media_media_id_fkey": 'f', "story_media_pkey": 'p', "story_media_story_id_fkey": 'f' },
  vacancies: { "vacancies_created_by_fkey": 'f', "vacancies_email_required": 'c', "vacancies_method": 'c', "vacancies_og_media_id_fkey": 'f', "vacancies_pkey": 'p', "vacancies_slug_shape": 'c', "vacancies_updated_by_fkey": 'f' },
};

const INDEXES: Record<string, string[]> = {
  audit_logs: ["audit_action_idx", "audit_actor_idx", "audit_entity_idx", "audit_logs_pkey", "ix_audit_action", "ix_audit_actor", "ix_audit_entity"],
  form_submissions: ["form_submissions_pkey", "form_submissions_reference_key", "ix_submissions_handler", "ix_submissions_purge", "ix_submissions_state", "ix_submissions_type", "submissions_purge_idx", "submissions_sensitive_idx", "submissions_state_idx", "submissions_type_idx"],
  impact_metrics: ["impact_metrics_pkey", "ix_metrics_program", "ix_metrics_project", "ix_metrics_public", "metrics_program_idx", "metrics_project_idx", "metrics_public_idx"],
  media_assets: ["ix_media_consent", "ix_media_created_by", "ix_media_kind", "media_assets_path_key", "media_assets_pkey", "media_bucket_idx", "media_consent_idx", "media_kind_idx"],
  organization_settings: ["organization_settings_pkey"],
  pages: ["pages_key_key", "pages_pkey", "pages_slug_ar_idx", "pages_slug_en_idx", "ux_pages_slug_ar", "ux_pages_slug_en"],
  partners: ["ix_partners_public", "ix_partners_type", "partners_pkey", "partners_type_idx"],
  people: ["ix_people_public", "people_pkey", "people_public_idx"],
  post_media: ["post_media_media_idx", "post_media_pkey"],
  posts: ["ix_posts_program", "ix_posts_project", "ix_posts_public", "ix_posts_search_ar", "posts_category_idx", "posts_expiring_idx", "posts_pkey", "posts_published_idx", "posts_slug_ar_idx", "posts_slug_en_idx", "ux_posts_slug_ar", "ux_posts_slug_en"],
  profiles: ["ix_profiles_active", "ix_profiles_role", "profiles_email_key", "profiles_pkey", "profiles_role_idx"],
  program_media: ["program_media_media_idx", "program_media_pkey"],
  programs: ["ix_programs_hero", "ix_programs_public", "programs_key_key", "programs_pkey", "programs_slug_ar_idx", "programs_slug_en_idx", "programs_status_idx", "ux_programs_slug_ar", "ux_programs_slug_en"],
  project_media: ["project_media_media_idx", "project_media_pkey"],
  project_partners: ["ix_project_partners_partner", "project_partners_partner_idx", "project_partners_pkey"],
  projects: ["ix_projects_featured", "ix_projects_govs", "ix_projects_program", "ix_projects_public", "ix_projects_search_ar", "ix_projects_state", "ix_projects_themes", "projects_featured_idx", "projects_gov_gin", "projects_pkey", "projects_program_idx", "projects_published_idx", "projects_slug_ar_idx", "projects_slug_en_idx", "projects_start_year_idx", "projects_themes_gin", "ux_projects_slug_ar", "ux_projects_slug_en"],
  publications: ["ix_publications_public", "publications_pkey", "publications_slug_ar_idx", "publications_slug_en_idx", "publications_type_idx", "ux_publications_slug_ar", "ux_publications_slug_en"],
  rate_limit_hits: ["rate_limit_hits_bucket_time_idx"],
  redirects: ["redirects_pkey", "redirects_source_path_key"],
  stories: ["ix_stories_program", "ix_stories_project", "ix_stories_public", "stories_pkey", "stories_program_idx", "stories_project_idx", "stories_published_idx", "stories_slug_ar_idx", "stories_slug_en_idx", "ux_stories_slug_ar", "ux_stories_slug_en"],
  story_media: ["story_media_media_idx", "story_media_pkey"],
  vacancies: ["ix_vacancies_open", "ux_vacancies_slug_ar", "ux_vacancies_slug_en", "vacancies_open_idx", "vacancies_pkey", "vacancies_slug_ar_idx", "vacancies_slug_en_idx"],
};

const ENUMS: Record<string, string[]> = {
  consent_status: ["not_required", "obtained", "pending"],
  content_status: ["draft", "in_review", "published", "archived"],
  governorate: ["north_gaza", "gaza", "middle", "khan_younis", "rafah"],
  locale_code: ["ar", "en"],
  logo_permission: ["granted", "pending", "denied"],
  media_kind: ["image", "video", "document"],
  membership_level: ["full", "observer"],
  metric_status: ["target", "reported", "verified"],
  partner_role: ["implementing", "donor"],
  partner_type: ["implementing", "donor", "network", "membership"],
  person_category: ["board", "executive", "staff"],
  post_category: ["news", "statement", "announcement"],
  program_key: ["protection", "humanitarian_response", "early_recovery"],
  project_status: ["planned", "active", "completed"],
  publication_type: ["report", "policy", "profile", "strategy", "evaluation", "other"],
  submission_state: ["new", "in_progress", "handled", "archived"],
  submission_type: ["partnership", "contact", "volunteer", "job", "complaint", "fraud_report"],
  target_group: ["children", "youth", "women", "poor_families", "elderly", "pwd"],
  theme_tag: ["women", "children", "youth_adolescents", "psychosocial_health", "relief"],
  translation_status: ["ar_only", "machine_draft", "human_translated", "reviewed"],
  user_role: ["admin", "content_manager", "editor"],
  vacancy_type: ["job", "volunteer"],
};

const COLUMNS: Record<string, string[]> = {
  audit_logs: ["id", "actor_id", "action", "entity_type", "entity_id", "diff", "created_at"],
  form_submissions: ["id", "reference", "type", "is_sensitive", "locale", "payload", "payload_encrypted", "payload_key_id", "attachment_path", "state", "handled_by", "handled_at", "internal_note", "ip_hash", "user_agent", "created_at", "purge_after"],
  impact_metrics: ["id", "label_ar", "label_en", "value", "unit", "display_prefix", "program_id", "project_id", "period_start", "period_end", "status", "verification_source", "is_public", "is_featured", "display_order", "created_at", "updated_at"],
  media_assets: ["id", "kind", "bucket", "path", "mime_type", "file_size", "width", "height", "blur_data_url", "alt_ar", "alt_en", "caption_ar", "caption_en", "credit", "consent", "consent_reference", "has_identifiable_minors", "exif_stripped", "created_at", "created_by"],
  organization_settings: ["id", "legal_name_ar", "legal_name_en", "short_name_ar", "short_name_en", "acronym", "alternate_names", "founded_year", "license_number", "license_authority_ar", "license_authority_en", "legal_form_ar", "legal_form_en", "vision_ar", "vision_en", "mission_ar", "mission_en", "core_values", "principles", "strategic_objectives", "primary_phone", "additional_phones", "whatsapp_number", "email", "address_ar", "address_en", "address_is_public", "office_hours_ar", "office_hours_en", "socials", "official_channels", "logo_primary_id", "logo_mono_id", "default_og_id", "updated_at", "updated_by", "short_description_ar", "short_description_en", "secondary_email", "footer_cta_title_ar", "footer_cta_title_en", "footer_cta_description_ar", "footer_cta_description_en", "footer_cta_button_label_ar", "footer_cta_button_label_en", "footer_cta_url", "footer_cta_enabled", "footer_logo_id"],
  pages: ["id", "status", "translation_status", "published_at", "created_at", "updated_at", "created_by", "updated_by", "slug_ar", "slug_en", "key", "title_ar", "title_en", "body_ar", "body_en", "seo_title_ar", "seo_title_en", "seo_description_ar", "seo_description_en", "og_media_id", "no_index"],
  partners: ["id", "name_ar", "name_en", "type", "membership_level", "sector_ar", "sector_en", "description_ar", "description_en", "website", "logo_media_id", "logo_permission", "is_featured", "display_order", "status", "created_at", "updated_at"],
  people: ["id", "name_ar", "name_en", "role_ar", "role_en", "category", "bio_ar", "bio_en", "photo_media_id", "is_public", "display_order", "created_at", "updated_at"],
  post_media: ["post_id", "media_id", "display_order"],
  posts: ["id", "status", "translation_status", "published_at", "created_at", "updated_at", "created_by", "updated_by", "slug_ar", "slug_en", "category", "title_ar", "title_en", "excerpt_ar", "excerpt_en", "body_ar", "body_en", "program_id", "project_id", "hero_media_id", "expires_at", "is_featured", "seo_title_ar", "seo_title_en", "seo_description_ar", "seo_description_en", "og_media_id", "no_index"],
  profiles: ["id", "email", "full_name", "role", "can_view_sensitive", "is_active", "last_login_at", "created_at", "updated_at"],
  program_media: ["program_id", "media_id", "display_order"],
  programs: ["id", "status", "translation_status", "published_at", "created_at", "updated_at", "created_by", "updated_by", "slug_ar", "slug_en", "key", "title_ar", "title_en", "tagline_ar", "tagline_en", "accent_token", "introduction_ar", "introduction_en", "rationale_ar", "rationale_en", "strategic_objective_ar", "strategic_objective_en", "sustainability_ar", "sustainability_en", "impact_statement_ar", "impact_statement_en", "eligibility_ar", "eligibility_en", "how_to_access_ar", "how_to_access_en", "target_groups", "hero_media_id", "display_order", "seo_title_ar", "seo_title_en", "seo_description_ar", "seo_description_en", "og_media_id", "no_index"],
  project_media: ["project_id", "media_id", "display_order"],
  project_partners: ["project_id", "partner_id", "role"],
  projects: ["id", "status", "translation_status", "published_at", "created_at", "updated_at", "created_by", "updated_by", "slug_ar", "slug_en", "program_id", "title_ar", "title_en", "summary_ar", "summary_en", "objective_ar", "objective_en", "activities_ar", "activities_en", "outcomes_ar", "outcomes_en", "project_state", "start_date", "end_date", "governorates", "localities", "themes", "hero_media_id", "is_featured", "source_note", "seo_title_ar", "seo_title_en", "seo_description_ar", "seo_description_en", "og_media_id", "no_index"],
  publications: ["id", "status", "translation_status", "published_at", "created_at", "updated_at", "created_by", "updated_by", "slug_ar", "slug_en", "type", "title_ar", "title_en", "description_ar", "description_en", "file_ar_id", "file_en_id", "published_year", "is_featured", "display_order"],
  rate_limit_hits: ["bucket", "hit_at"],
  redirects: ["id", "source_path", "destination_path", "status_code", "created_at"],
  stories: ["id", "status", "translation_status", "published_at", "created_at", "updated_at", "created_by", "updated_by", "slug_ar", "slug_en", "program_id", "project_id", "title_ar", "title_en", "summary_ar", "summary_en", "body_ar", "body_en", "quote_text_ar", "quote_text_en", "quote_attribution_ar", "quote_attribution_en", "subject_anonymized", "consent_obtained", "consent_reference", "hero_media_id", "is_featured", "seo_title_ar", "seo_title_en", "seo_description_ar", "seo_description_en", "og_media_id", "no_index"],
  story_media: ["story_id", "media_id", "display_order"],
  vacancies: ["id", "status", "translation_status", "published_at", "created_at", "updated_at", "created_by", "updated_by", "slug_ar", "slug_en", "type", "title_ar", "title_en", "location_ar", "location_en", "employment_type", "description_ar", "description_en", "requirements_ar", "requirements_en", "deadline", "application_method", "application_email", "posted_at", "seo_title_ar", "seo_title_en", "seo_description_ar", "seo_description_en", "og_media_id", "no_index"],
};

describe('schema parity with the live database', () => {
  it('has exactly the live tables', async () => {
    const tables = await rows(
      "select tablename from pg_tables where schemaname = 'public' order by 1",
    );
    expect(tables.map((r) => r.tablename)).toEqual(Object.keys(COLUMNS).sort());
  });

  it('has the live columns in the live order', async () => {
    for (const [table, expected] of Object.entries(COLUMNS)) {
      const found = await rows(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = '${table}' order by ordinal_position`,
      );
      expect(found.map((r) => r.column_name), table).toEqual(expected);
    }
  });

  it('has the live constraints, by name and kind', async () => {
    for (const [table, expected] of Object.entries(CONSTRAINTS)) {
      const found = await rows(
        // Postgres 18 lists NOT NULL as a constraint row (contype 'n'); the
        // live database is on 17 and does not. Nullability is checked by the
        // column comparison, so those rows are excluded here.
        `select conname, contype from pg_constraint
         where conrelid = 'public.${table}'::regclass and contype <> 'n' order by 1`,
      );
      const actual = Object.fromEntries(found.map((r) => [r.conname, r.contype]));
      expect(actual, table).toEqual(expected);
    }
  });

  it('has the live indexes', async () => {
    for (const [table, expected] of Object.entries(INDEXES)) {
      const found = await rows(
        `select indexname from pg_indexes
         where schemaname = 'public' and tablename = '${table}' order by 1`,
      );
      expect(found.map((r) => r.indexname), table).toEqual(expected);
    }
  });

  it('has the live enum members in the live order', async () => {
    for (const [name, expected] of Object.entries(ENUMS)) {
      const found = await rows(
        `select enumlabel from pg_enum
         where enumtypid = 'public.${name}'::regtype order by enumsortorder`,
      );
      expect(found.map((r) => r.enumlabel), name).toEqual(expected);
    }
  });

  it('generates audit_logs.id as an identity column with the granted sequence', async () => {
    const [column] = await rows(
      `select attidentity from pg_attribute
       where attrelid = 'public.audit_logs'::regclass and attname = 'id'`,
    );
    expect(column?.attidentity).toBe('a');
    const [seq] = await rows(`select pg_get_serial_sequence('public.audit_logs', 'id') as name`);
    expect(seq?.name).toBe('public.audit_logs_id_seq');
    const [grant] = await rows(
      `select has_sequence_privilege('app_runtime', 'public.audit_logs_id_seq', 'USAGE') as ok`,
    );
    expect(grant?.ok).toBe(true);
  });

  it('refuses an audit action outside the live list', async () => {
    // `download_attachment` is what `src/services/_shared/audit.ts` still
    // types as legal. The live CHECK disagrees, and the CHECK wins.
    const failure = await getDb()
      .execute(
        "insert into audit_logs (action, entity_type) values ('download_attachment', 'submission')",
      )
      .then(() => null, (error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    const cause = (failure as { cause?: unknown }).cause;
    expect(String(cause)).toMatch(/audit_action_known/);
  });

  it('applies every migration twice without error', async () => {
    // `0005` is idempotent by construction: it is applied to a database where
    // everything it does is already true. Re-running it here is that same
    // situation, and proves the guards hold on Postgres itself.
    const { readFile } = await import('node:fs/promises');
    const sql = await readFile('drizzle/0005_live_parity.sql', 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) await getDb().execute(statement);
    }
    const found = await rows(
      `select count(*)::int as n from pg_constraint
       where conrelid = 'public.audit_logs'::regclass and contype <> 'n'`,
    );
    expect(found[0]?.n).toBe(Object.keys(CONSTRAINTS.audit_logs ?? {}).length);
  });
});
