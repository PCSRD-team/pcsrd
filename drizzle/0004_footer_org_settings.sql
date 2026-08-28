ALTER TABLE "organization_settings" ADD COLUMN "short_description_ar" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "short_description_en" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "secondary_email" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "footer_cta_title_ar" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "footer_cta_title_en" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "footer_cta_description_ar" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "footer_cta_description_en" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "footer_cta_button_label_ar" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "footer_cta_button_label_en" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "footer_cta_url" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "footer_cta_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "footer_logo_id" uuid;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_footer_logo_id_media_assets_id_fk" FOREIGN KEY ("footer_logo_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
  union all select 'organization', null::uuid, 'footer_logo_id'  from public.organization_settings where footer_logo_id  = p_media_id
  union all select 'organization', null::uuid, 'logo_mono_id'    from public.organization_settings where logo_mono_id    = p_media_id
  union all select 'organization', null::uuid, 'default_og_id'   from public.organization_settings where default_og_id   = p_media_id
  union all select 'project_gallery', project_id, 'gallery' from public.project_media where media_id = p_media_id
  union all select 'story_gallery',   story_id,   'gallery' from public.story_media   where media_id = p_media_id
  union all select 'program_gallery', program_id, 'gallery' from public.program_media where media_id = p_media_id
  union all select 'post_gallery',    post_id,    'gallery' from public.post_media    where media_id = p_media_id
$function$
;
