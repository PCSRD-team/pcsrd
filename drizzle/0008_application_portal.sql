-- The careers portal: four tables, four enums.
--
-- `drizzle-kit generate` wrote this, and then three statements were removed by
-- hand. They were not part of this change:
--
--   CREATE TABLE "rate_limit_hits"                  -- 0006, hand-written
--   ALTER TABLE "programs" DROP COLUMN specific_objectives  -- 0007, hand-written
--   ALTER TABLE "programs" DROP COLUMN key_interventions    -- 0007, hand-written
--
-- 0006 and 0007 were authored by hand and never produced a `meta/*_snapshot.json`,
-- so the generator's last snapshot (0005) still described a database without the
-- rate-limit table and with the two programme columns. Generating from it
-- therefore proposed both again. Replaying them is not harmless: the CREATE
-- TABLE carries no `if not exists` and the DROP COLUMNs carry no `if exists`,
-- so on any database that has already run 0006 and 0007 — which is every one
-- of them — this file would abort partway through and leave the four new
-- tables half-created.
--
-- `meta/0008_snapshot.json` keeps all three, and that is correct: the snapshot
-- describes the schema, and the schema does have `rate_limit_hits` and does not
-- have those two columns. Writing this snapshot is what stops the next
-- generated migration proposing them a third time.
--
-- The runtime layer for these tables — grants, row-level policies, the
-- reference trigger and `app.submit_application()` — is 0009, hand-written,
-- because `drizzle/` owns table shape and the database owns authorisation
-- (00-ARCHITECTURE §0.6).

CREATE TYPE "public"."application_capacity_rule" AS ENUM('close', 'waitlist');--> statement-breakpoint
CREATE TYPE "public"."application_field_type" AS ENUM('short_text', 'long_text', 'email', 'phone', 'number', 'date', 'select', 'radio', 'multi_select', 'checkbox', 'file', 'section');--> statement-breakpoint
CREATE TYPE "public"."application_form_kind" AS ENUM('job', 'volunteer', 'internship', 'training', 'consultancy', 'other');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('new', 'under_review', 'shortlisted', 'interview', 'offer', 'hired', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TABLE "application_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"actor_id" uuid,
	"from_status" "application_status",
	"to_status" "application_status" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_form_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"key" text NOT NULL,
	"type" "application_field_type" NOT NULL,
	"catalog_key" text,
	"label_ar" text NOT NULL,
	"label_en" text,
	"placeholder_ar" text,
	"placeholder_en" text,
	"help_ar" text,
	"help_en" text,
	"required" boolean DEFAULT false NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visible_when" jsonb,
	"sensitive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_form_fields_key_shape" CHECK ("application_form_fields"."key" ~ '^[a-z][a-z0-9_]{0,47}$'),
	CONSTRAINT "application_form_fields_options" CHECK ("application_form_fields"."type" not in ('select', 'radio', 'multi_select') or jsonb_array_length("application_form_fields"."options") > 0),
	CONSTRAINT "application_form_fields_section" CHECK ("application_form_fields"."type" <> 'section' or ("application_form_fields"."required" = false and "application_form_fields"."sensitive" = false))
);
--> statement-breakpoint
CREATE TABLE "application_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vacancy_id" uuid,
	"kind" "application_form_kind" DEFAULT 'job' NOT NULL,
	"slug" text NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text,
	"intro_ar" jsonb,
	"intro_en" jsonb,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"capacity" integer,
	"capacity_rule" "application_capacity_rule" DEFAULT 'close' NOT NULL,
	"submission_count" integer DEFAULT 0 NOT NULL,
	"confirmation_ar" text,
	"confirmation_en" text,
	"notify_emails" text[] DEFAULT '{}'::text[] NOT NULL,
	"retention_months" integer DEFAULT 12 NOT NULL,
	"allow_multiple_per_email" boolean DEFAULT false NOT NULL,
	"require_consent" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "application_forms_slug_shape" CHECK ("application_forms"."slug" ~ '^[^\s/]+$'),
	CONSTRAINT "application_forms_window" CHECK ("application_forms"."opens_at" is null or "application_forms"."closes_at" is null or "application_forms"."closes_at" > "application_forms"."opens_at"),
	CONSTRAINT "application_forms_capacity" CHECK ("application_forms"."capacity" is null or "application_forms"."capacity" > 0),
	CONSTRAINT "application_forms_count" CHECK ("application_forms"."submission_count" >= 0),
	CONSTRAINT "application_forms_retention" CHECK ("application_forms"."retention_months" between 1 and 60)
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"vacancy_id" uuid,
	"reference" text NOT NULL,
	"locale" "locale_code" DEFAULT 'ar' NOT NULL,
	"status" "application_status" DEFAULT 'new' NOT NULL,
	"waitlisted" boolean DEFAULT false NOT NULL,
	"answers" jsonb NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applicant_name" text,
	"applicant_email" text,
	"applicant_phone" text,
	"rating" smallint,
	"internal_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"purge_after" date NOT NULL,
	CONSTRAINT "applications_reference_key" UNIQUE("reference"),
	CONSTRAINT "applications_reviewed_shape" CHECK ("applications"."status" = 'new' or "applications"."reviewed_at" is not null),
	CONSTRAINT "applications_rating_range" CHECK ("applications"."rating" is null or "applications"."rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_form_fields" ADD CONSTRAINT "application_form_fields_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."application_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_forms" ADD CONSTRAINT "application_forms_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_forms" ADD CONSTRAINT "application_forms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_forms" ADD CONSTRAINT "application_forms_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."application_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "public"."vacancies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_events_application_idx" ON "application_events" USING btree ("application_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "application_form_fields_key_idx" ON "application_form_fields" USING btree ("form_id","key");--> statement-breakpoint
CREATE INDEX "application_form_fields_order_idx" ON "application_form_fields" USING btree ("form_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "application_forms_slug_idx" ON "application_forms" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "application_forms_vacancy_idx" ON "application_forms" USING btree ("vacancy_id") WHERE "application_forms"."vacancy_id" is not null;--> statement-breakpoint
CREATE INDEX "application_forms_open_idx" ON "application_forms" USING btree ("closes_at" DESC NULLS LAST) WHERE "application_forms"."status" = 'published';--> statement-breakpoint
CREATE INDEX "applications_form_idx" ON "applications" USING btree ("form_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("form_id","status");--> statement-breakpoint
CREATE INDEX "applications_purge_idx" ON "applications" USING btree ("purge_after");--> statement-breakpoint
CREATE INDEX "applications_email_idx" ON "applications" USING btree ("form_id","applicant_email");
