CREATE TYPE "public"."consent_status" AS ENUM('not_required', 'obtained', 'pending');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'in_review', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."governorate" AS ENUM('north_gaza', 'gaza', 'middle', 'khan_younis', 'rafah');--> statement-breakpoint
CREATE TYPE "public"."locale_code" AS ENUM('ar', 'en');--> statement-breakpoint
CREATE TYPE "public"."logo_permission" AS ENUM('granted', 'pending', 'denied');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video', 'document');--> statement-breakpoint
CREATE TYPE "public"."membership_level" AS ENUM('full', 'observer');--> statement-breakpoint
CREATE TYPE "public"."metric_status" AS ENUM('target', 'reported', 'verified');--> statement-breakpoint
CREATE TYPE "public"."partner_role" AS ENUM('implementing', 'donor');--> statement-breakpoint
CREATE TYPE "public"."partner_type" AS ENUM('implementing', 'donor', 'network', 'membership');--> statement-breakpoint
CREATE TYPE "public"."person_category" AS ENUM('board', 'executive', 'staff');--> statement-breakpoint
CREATE TYPE "public"."post_category" AS ENUM('news', 'statement', 'announcement');--> statement-breakpoint
CREATE TYPE "public"."program_key" AS ENUM('protection', 'humanitarian_response', 'early_recovery');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('planned', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."publication_type" AS ENUM('report', 'policy', 'profile', 'strategy', 'evaluation', 'other');--> statement-breakpoint
CREATE TYPE "public"."submission_state" AS ENUM('new', 'in_progress', 'handled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."submission_type" AS ENUM('partnership', 'contact', 'volunteer', 'job', 'complaint', 'fraud_report');--> statement-breakpoint
CREATE TYPE "public"."target_group" AS ENUM('children', 'youth', 'women', 'poor_families', 'elderly', 'pwd');--> statement-breakpoint
CREATE TYPE "public"."theme_tag" AS ENUM('women', 'children', 'youth_adolescents', 'psychosocial_health', 'relief');--> statement-breakpoint
CREATE TYPE "public"."translation_status" AS ENUM('ar_only', 'machine_draft', 'human_translated', 'reviewed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'content_manager', 'editor');--> statement-breakpoint
CREATE TYPE "public"."vacancy_type" AS ENUM('job', 'volunteer');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "user_role" DEFAULT 'editor' NOT NULL,
	"can_view_sensitive" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "media_kind" DEFAULT 'image' NOT NULL,
	"bucket" text DEFAULT 'media' NOT NULL,
	"path" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"blur_data_url" text,
	"alt_ar" text NOT NULL,
	"alt_en" text,
	"caption_ar" text,
	"caption_en" text,
	"credit" text,
	"consent" "consent_status" DEFAULT 'not_required' NOT NULL,
	"consent_reference" text,
	"has_identifiable_minors" boolean DEFAULT false NOT NULL,
	"exif_stripped" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "media_assets_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"legal_name_ar" text NOT NULL,
	"legal_name_en" text NOT NULL,
	"short_name_ar" text NOT NULL,
	"short_name_en" text NOT NULL,
	"acronym" text NOT NULL,
	"alternate_names" text[] DEFAULT '{}' NOT NULL,
	"founded_year" smallint NOT NULL,
	"license_number" text NOT NULL,
	"license_authority_ar" text,
	"license_authority_en" text,
	"legal_form_ar" text,
	"legal_form_en" text,
	"vision_ar" text,
	"vision_en" text,
	"mission_ar" text,
	"mission_en" text,
	"core_values" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"principles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"strategic_objectives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"primary_phone" text,
	"additional_phones" text[] DEFAULT '{}' NOT NULL,
	"whatsapp_number" text,
	"email" text,
	"address_ar" text,
	"address_en" text,
	"address_is_public" boolean DEFAULT false NOT NULL,
	"office_hours_ar" text,
	"office_hours_en" text,
	"socials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"official_channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"logo_primary_id" uuid,
	"logo_mono_id" uuid,
	"default_og_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "organization_settings_singleton" CHECK ("organization_settings"."id")
);
--> statement-breakpoint
CREATE TABLE "program_media" (
	"program_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "program_media_program_id_media_id_pk" PRIMARY KEY("program_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"translation_status" "translation_status" DEFAULT 'ar_only' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"slug_ar" text NOT NULL,
	"slug_en" text NOT NULL,
	"key" "program_key" NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text,
	"tagline_ar" text,
	"tagline_en" text,
	"accent_token" text DEFAULT '--color-prog-protection' NOT NULL,
	"introduction_ar" jsonb,
	"introduction_en" jsonb,
	"rationale_ar" jsonb,
	"rationale_en" jsonb,
	"strategic_objective_ar" text,
	"strategic_objective_en" text,
	"specific_objectives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_interventions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sustainability_ar" jsonb,
	"sustainability_en" jsonb,
	"impact_statement_ar" jsonb,
	"impact_statement_en" jsonb,
	"eligibility_ar" jsonb,
	"eligibility_en" jsonb,
	"how_to_access_ar" jsonb,
	"how_to_access_en" jsonb,
	"target_groups" "target_group"[] DEFAULT '{}' NOT NULL,
	"hero_media_id" uuid,
	"display_order" integer DEFAULT 0 NOT NULL,
	"seo_title_ar" text,
	"seo_title_en" text,
	"seo_description_ar" text,
	"seo_description_en" text,
	"og_media_id" uuid,
	"no_index" boolean DEFAULT false NOT NULL,
	CONSTRAINT "programs_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"type" "partner_type" NOT NULL,
	"membership_level" "membership_level",
	"sector_ar" text,
	"sector_en" text,
	"description_ar" text,
	"description_en" text,
	"website" text,
	"logo_media_id" uuid,
	"logo_permission" "logo_permission" DEFAULT 'pending' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_media" (
	"project_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "project_media_project_id_media_id_pk" PRIMARY KEY("project_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "project_partners" (
	"project_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"role" "partner_role" NOT NULL,
	CONSTRAINT "project_partners_project_id_partner_id_role_pk" PRIMARY KEY("project_id","partner_id","role")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"translation_status" "translation_status" DEFAULT 'ar_only' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"slug_ar" text NOT NULL,
	"slug_en" text NOT NULL,
	"program_id" uuid NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text,
	"summary_ar" text,
	"summary_en" text,
	"objective_ar" jsonb,
	"objective_en" jsonb,
	"activities_ar" jsonb,
	"activities_en" jsonb,
	"outcomes_ar" jsonb,
	"outcomes_en" jsonb,
	"project_state" "project_status" DEFAULT 'active' NOT NULL,
	"start_date" date,
	"end_date" date,
	"governorates" "governorate"[] DEFAULT '{}' NOT NULL,
	"localities" text[] DEFAULT '{}' NOT NULL,
	"themes" "theme_tag"[] DEFAULT '{}' NOT NULL,
	"hero_media_id" uuid,
	"is_featured" boolean DEFAULT false NOT NULL,
	"source_note" text,
	"seo_title_ar" text,
	"seo_title_en" text,
	"seo_description_ar" text,
	"seo_description_en" text,
	"og_media_id" uuid,
	"no_index" boolean DEFAULT false NOT NULL,
	CONSTRAINT "projects_date_order" CHECK ("projects"."end_date" is null or "projects"."start_date" is null or "projects"."end_date" >= "projects"."start_date")
);
--> statement-breakpoint
CREATE TABLE "impact_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label_ar" text NOT NULL,
	"label_en" text,
	"value" numeric(14, 2) NOT NULL,
	"unit" text NOT NULL,
	"display_prefix" text,
	"program_id" uuid,
	"project_id" uuid,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" "metric_status" NOT NULL,
	"verification_source" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metrics_period_order" CHECK ("impact_metrics"."period_end" >= "impact_metrics"."period_start")
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"translation_status" "translation_status" DEFAULT 'ar_only' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"slug_ar" text NOT NULL,
	"slug_en" text NOT NULL,
	"program_id" uuid,
	"project_id" uuid,
	"title_ar" text NOT NULL,
	"title_en" text,
	"summary_ar" text,
	"summary_en" text,
	"body_ar" jsonb,
	"body_en" jsonb,
	"quote_text_ar" text,
	"quote_text_en" text,
	"quote_attribution_ar" text,
	"quote_attribution_en" text,
	"subject_anonymized" boolean DEFAULT true NOT NULL,
	"consent_obtained" boolean DEFAULT false NOT NULL,
	"consent_reference" text,
	"hero_media_id" uuid,
	"is_featured" boolean DEFAULT false NOT NULL,
	"seo_title_ar" text,
	"seo_title_en" text,
	"seo_description_ar" text,
	"seo_description_en" text,
	"og_media_id" uuid,
	"no_index" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_media" (
	"story_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "story_media_story_id_media_id_pk" PRIMARY KEY("story_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "post_media" (
	"post_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "post_media_post_id_media_id_pk" PRIMARY KEY("post_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"translation_status" "translation_status" DEFAULT 'ar_only' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"slug_ar" text NOT NULL,
	"slug_en" text NOT NULL,
	"category" "post_category" DEFAULT 'news' NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text,
	"excerpt_ar" text,
	"excerpt_en" text,
	"body_ar" jsonb,
	"body_en" jsonb,
	"program_id" uuid,
	"project_id" uuid,
	"hero_media_id" uuid,
	"expires_at" timestamp with time zone,
	"is_featured" boolean DEFAULT false NOT NULL,
	"seo_title_ar" text,
	"seo_title_en" text,
	"seo_description_ar" text,
	"seo_description_en" text,
	"og_media_id" uuid,
	"no_index" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"translation_status" "translation_status" DEFAULT 'ar_only' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"slug_ar" text NOT NULL,
	"slug_en" text NOT NULL,
	"type" "vacancy_type" DEFAULT 'job' NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text,
	"location_ar" text,
	"location_en" text,
	"employment_type" text,
	"description_ar" jsonb,
	"description_en" jsonb,
	"requirements_ar" jsonb,
	"requirements_en" jsonb,
	"deadline" date NOT NULL,
	"application_method" text DEFAULT 'form' NOT NULL,
	"application_email" text,
	"posted_at" date DEFAULT CURRENT_DATE NOT NULL,
	"seo_title_ar" text,
	"seo_title_en" text,
	"seo_description_ar" text,
	"seo_description_en" text,
	"og_media_id" uuid,
	"no_index" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text,
	"role_ar" text NOT NULL,
	"role_en" text,
	"category" "person_category" DEFAULT 'board' NOT NULL,
	"bio_ar" text,
	"bio_en" text,
	"photo_media_id" uuid,
	"is_public" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"translation_status" "translation_status" DEFAULT 'ar_only' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"slug_ar" text NOT NULL,
	"slug_en" text NOT NULL,
	"type" "publication_type" DEFAULT 'report' NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text,
	"description_ar" text,
	"description_en" text,
	"file_ar_id" uuid,
	"file_en_id" uuid,
	"published_year" smallint,
	"is_featured" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"translation_status" "translation_status" DEFAULT 'ar_only' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"slug_ar" text NOT NULL,
	"slug_en" text NOT NULL,
	"key" text NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text,
	"body_ar" jsonb,
	"body_en" jsonb,
	"seo_title_ar" text,
	"seo_title_en" text,
	"seo_description_ar" text,
	"seo_description_en" text,
	"og_media_id" uuid,
	"no_index" boolean DEFAULT false NOT NULL,
	CONSTRAINT "pages_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"type" "submission_type" NOT NULL,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"locale" "locale_code" DEFAULT 'ar' NOT NULL,
	"payload" jsonb,
	"payload_encrypted" "bytea",
	"payload_key_id" text,
	"attachment_path" text,
	"state" "submission_state" DEFAULT 'new' NOT NULL,
	"handled_by" uuid,
	"handled_at" timestamp with time zone,
	"internal_note" text,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purge_after" date NOT NULL,
	CONSTRAINT "form_submissions_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_path" text NOT NULL,
	"destination_path" text NOT NULL,
	"status_code" smallint DEFAULT 308 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redirects_sourcePath_unique" UNIQUE("source_path")
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_logo_primary_id_media_assets_id_fk" FOREIGN KEY ("logo_primary_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_logo_mono_id_media_assets_id_fk" FOREIGN KEY ("logo_mono_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_default_og_id_media_assets_id_fk" FOREIGN KEY ("default_og_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_media" ADD CONSTRAINT "program_media_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_media" ADD CONSTRAINT "program_media_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_hero_media_id_media_assets_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_og_media_id_media_assets_id_fk" FOREIGN KEY ("og_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_logo_media_id_media_assets_id_fk" FOREIGN KEY ("logo_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_media" ADD CONSTRAINT "project_media_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_media" ADD CONSTRAINT "project_media_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_partners" ADD CONSTRAINT "project_partners_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_partners" ADD CONSTRAINT "project_partners_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_hero_media_id_media_assets_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_og_media_id_media_assets_id_fk" FOREIGN KEY ("og_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_metrics" ADD CONSTRAINT "impact_metrics_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_metrics" ADD CONSTRAINT "impact_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_hero_media_id_media_assets_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_og_media_id_media_assets_id_fk" FOREIGN KEY ("og_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_media" ADD CONSTRAINT "story_media_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_media" ADD CONSTRAINT "story_media_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_media_id_media_assets_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_hero_media_id_media_assets_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_og_media_id_media_assets_id_fk" FOREIGN KEY ("og_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_og_media_id_media_assets_id_fk" FOREIGN KEY ("og_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_photo_media_id_media_assets_id_fk" FOREIGN KEY ("photo_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_file_ar_id_media_assets_id_fk" FOREIGN KEY ("file_ar_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_file_en_id_media_assets_id_fk" FOREIGN KEY ("file_en_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_og_media_id_media_assets_id_fk" FOREIGN KEY ("og_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_handled_by_profiles_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profiles_role_idx" ON "profiles" USING btree ("role") WHERE "profiles"."is_active";--> statement-breakpoint
CREATE INDEX "media_kind_idx" ON "media_assets" USING btree ("kind","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "programs_slug_ar_idx" ON "programs" USING btree ("slug_ar");--> statement-breakpoint
CREATE UNIQUE INDEX "programs_slug_en_idx" ON "programs" USING btree ("slug_en");--> statement-breakpoint
CREATE INDEX "programs_status_idx" ON "programs" USING btree ("status","display_order");--> statement-breakpoint
CREATE INDEX "partners_type_idx" ON "partners" USING btree ("type","display_order") WHERE "partners"."status" = 'published';--> statement-breakpoint
CREATE INDEX "project_partners_partner_idx" ON "project_partners" USING btree ("partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_ar_idx" ON "projects" USING btree ("slug_ar");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_en_idx" ON "projects" USING btree ("slug_en");--> statement-breakpoint
CREATE INDEX "projects_program_idx" ON "projects" USING btree ("program_id","status");--> statement-breakpoint
CREATE INDEX "projects_published_idx" ON "projects" USING btree ("status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "projects_gov_gin" ON "projects" USING gin ("governorates");--> statement-breakpoint
CREATE INDEX "projects_themes_gin" ON "projects" USING gin ("themes");--> statement-breakpoint
CREATE INDEX "projects_featured_idx" ON "projects" USING btree ("is_featured") WHERE "projects"."status" = 'published';--> statement-breakpoint
CREATE INDEX "metrics_public_idx" ON "impact_metrics" USING btree ("status","is_public","display_order");--> statement-breakpoint
CREATE INDEX "metrics_program_idx" ON "impact_metrics" USING btree ("program_id") WHERE "impact_metrics"."is_public";--> statement-breakpoint
CREATE UNIQUE INDEX "stories_slug_ar_idx" ON "stories" USING btree ("slug_ar");--> statement-breakpoint
CREATE UNIQUE INDEX "stories_slug_en_idx" ON "stories" USING btree ("slug_en");--> statement-breakpoint
CREATE INDEX "stories_published_idx" ON "stories" USING btree ("status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "posts_slug_ar_idx" ON "posts" USING btree ("slug_ar");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_slug_en_idx" ON "posts" USING btree ("slug_en");--> statement-breakpoint
CREATE INDEX "posts_category_idx" ON "posts" USING btree ("category","status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "posts_published_idx" ON "posts" USING btree ("status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "posts_expiring_idx" ON "posts" USING btree ("expires_at") WHERE "posts"."expires_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "vacancies_slug_ar_idx" ON "vacancies" USING btree ("slug_ar");--> statement-breakpoint
CREATE UNIQUE INDEX "vacancies_slug_en_idx" ON "vacancies" USING btree ("slug_en");--> statement-breakpoint
CREATE INDEX "vacancies_open_idx" ON "vacancies" USING btree ("type","deadline" DESC NULLS LAST) WHERE "vacancies"."status" = 'published';--> statement-breakpoint
CREATE INDEX "people_public_idx" ON "people" USING btree ("category","display_order") WHERE "people"."is_public";--> statement-breakpoint
CREATE UNIQUE INDEX "publications_slug_ar_idx" ON "publications" USING btree ("slug_ar");--> statement-breakpoint
CREATE UNIQUE INDEX "publications_slug_en_idx" ON "publications" USING btree ("slug_en");--> statement-breakpoint
CREATE INDEX "submissions_type_idx" ON "form_submissions" USING btree ("type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "submissions_state_idx" ON "form_submissions" USING btree ("state") WHERE "form_submissions"."state" = 'new';--> statement-breakpoint
CREATE INDEX "submissions_purge_idx" ON "form_submissions" USING btree ("purge_after");--> statement-breakpoint
CREATE INDEX "submissions_sensitive_idx" ON "form_submissions" USING btree ("is_sensitive","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_id","created_at" DESC NULLS LAST);