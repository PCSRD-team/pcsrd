# 01 — Database Layer

Supabase Postgres. Drizzle owns application tables; the Supabase CLI owns storage and auth objects (`00-ARCHITECTURE §0.6`).

---

## 1. Extensions

```sql
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";       -- fuzzy search in admin
create extension if not exists "unaccent";      -- search normalization
-- pg_cron: enable via Supabase dashboard (Database → Extensions)
```

---

## 2. Enums

```sql
create type locale_code        as enum ('ar','en');
create type content_status     as enum ('draft','in_review','published','archived');
create type translation_status as enum ('ar_only','machine_draft','human_translated','reviewed');
create type user_role          as enum ('admin','content_manager','editor');

create type program_key        as enum ('protection','humanitarian_response','early_recovery');
create type project_status     as enum ('planned','active','completed');
create type governorate        as enum ('north_gaza','gaza','middle','khan_younis','rafah');
create type theme_tag          as enum ('women','children','youth_adolescents','psychosocial_health','relief');
create type target_group       as enum ('children','youth','women','poor_families','elderly','pwd');

create type partner_type       as enum ('implementing','donor','network','membership');
create type partner_role       as enum ('implementing','donor');   -- role within a project
create type membership_level   as enum ('full','observer');
create type logo_permission    as enum ('granted','pending','denied');

create type post_category      as enum ('news','statement','announcement');
create type vacancy_type       as enum ('job','volunteer');
create type metric_status      as enum ('target','reported','verified');
create type person_category    as enum ('board','executive','staff');
create type publication_type   as enum ('report','policy','profile','strategy','evaluation','other');
create type media_kind         as enum ('image','video','document');
create type consent_status     as enum ('not_required','obtained','pending');

create type submission_type    as enum ('partnership','contact','volunteer','job','complaint','fraud_report');
create type submission_state   as enum ('new','in_progress','handled','archived');
```

---

## 3. Shared column blocks

To avoid restating 20 columns per table, three blocks are referenced by name below. Every content table includes all three.

**BLOCK A — identity & lifecycle**
```sql
  id                 uuid primary key default gen_random_uuid(),
  status             content_status not null default 'draft',
  translation_status translation_status not null default 'ar_only',
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references profiles(id) on delete set null,
  updated_by         uuid references profiles(id) on delete set null
```

**BLOCK B — bilingual slugs**
```sql
  slug_ar            text not null,
  slug_en            text not null
  -- + unique index per column, per table
```

**BLOCK C — SEO**
```sql
  seo_title_ar       text,
  seo_title_en       text,
  seo_description_ar text,
  seo_description_en text,
  og_media_id        uuid references media_assets(id) on delete set null,
  no_index           boolean not null default false
```

---

## 4. Tables

Creation order matters (FKs). Follow this sequence.

### 4.1 `profiles` — admin users

```sql
create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null unique,
  full_name           text not null,
  role                user_role not null default 'editor',
  can_view_sensitive  boolean not null default false,
  is_active           boolean not null default true,
  last_login_at       timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index profiles_role_idx on profiles (role) where is_active;
```

`can_view_sensitive` is deliberately **not** derived from `role`. Access to confidential complaints is granted per person by the organization's policy, and an admin is not automatically on that list.

### 4.2 `media_assets`

Created early — many tables reference it.

```sql
create table media_assets (
  id                uuid primary key default gen_random_uuid(),
  kind              media_kind not null default 'image',
  bucket            text not null default 'media',
  path              text not null unique,          -- storage object path
  mime_type         text not null,
  file_size         integer not null,              -- bytes
  width             integer,
  height            integer,
  blur_data_url     text,                          -- base64 LQIP for next/image
  alt_ar            text not null,                 -- RULE 7: required
  alt_en            text,
  caption_ar        text,
  caption_en        text,
  credit            text,
  consent           consent_status not null default 'not_required',
  consent_reference text,
  has_identifiable_minors boolean not null default false,
  exif_stripped     boolean not null default false,
  created_at        timestamptz not null default now(),
  created_by        uuid references profiles(id) on delete set null
);
create index media_kind_idx on media_assets (kind, created_at desc);
```

### 4.3 `organization_settings` — singleton

```sql
create table organization_settings (
  id                    boolean primary key default true check (id),   -- one row, enforced
  legal_name_ar         text not null,
  legal_name_en         text not null,
  short_name_ar         text not null,
  short_name_en         text not null,
  acronym               text not null,
  alternate_names       text[] not null default '{}',   -- schema.org alternateName
  founded_year          smallint not null,
  license_number        text not null,
  license_authority_ar  text,
  license_authority_en  text,
  legal_form_ar         text,
  legal_form_en         text,

  vision_ar             text,
  vision_en             text,
  mission_ar            text,
  mission_en            text,
  values                jsonb not null default '[]',    -- [{title_ar,title_en,body_ar,body_en}]
  principles            jsonb not null default '[]',
  strategic_objectives  jsonb not null default '[]',    -- [{text_ar,text_en}]

  primary_phone         text,
  additional_phones     text[] not null default '{}',
  whatsapp_number       text,                            -- digits only, wa.me format
  email                 text,
  address_ar            text,
  address_en            text,
  address_is_public     boolean not null default false,  -- DNH-6
  office_hours_ar       text,
  office_hours_en       text,
  socials               jsonb not null default '[]',     -- [{platform,url,is_official}]

  logo_primary_id       uuid references media_assets(id) on delete set null,
  logo_mono_id          uuid references media_assets(id) on delete set null,
  default_og_id         uuid references media_assets(id) on delete set null,

  updated_at            timestamptz not null default now(),
  updated_by            uuid references profiles(id) on delete set null
);
```

The `check (id)` on a `boolean primary key default true` makes a second row impossible at the database level. One `.limit(1)` query, always.

### 4.4 `programs`

```sql
create table programs (
  -- BLOCK A, BLOCK B, BLOCK C
  key                     program_key not null unique,
  title_ar                text not null,
  title_en                text,
  tagline_ar              text,
  tagline_en              text,
  accent_token            text not null default '--prog-protection',
  introduction_ar         jsonb,      -- TipTap doc
  introduction_en         jsonb,
  rationale_ar            jsonb,
  rationale_en            jsonb,
  strategic_objective_ar  text,
  strategic_objective_en  text,
  specific_objectives     jsonb not null default '[]',  -- [{title_ar,title_en,body_ar,body_en}]
  key_interventions       jsonb not null default '[]',
  sustainability_ar       jsonb,
  sustainability_en       jsonb,
  impact_statement_ar     jsonb,
  impact_statement_en     jsonb,
  eligibility_ar          jsonb,      -- "who qualifies"  (spec §28-B2)
  eligibility_en          jsonb,
  how_to_access_ar        jsonb,      -- "how to reach the service"
  how_to_access_en        jsonb,
  target_groups           target_group[] not null default '{}',
  hero_media_id           uuid references media_assets(id) on delete set null,
  display_order           smallint not null default 0
);
create unique index programs_slug_ar_idx on programs (slug_ar);
create unique index programs_slug_en_idx on programs (slug_en);
create index programs_status_idx on programs (status, display_order);
```

Only 3 rows, ever. Modelled as a table rather than constants because the content is fully CMS-editable and the org will rewrite this copy.

### 4.5 `projects`

```sql
create table projects (
  -- BLOCK A, BLOCK B, BLOCK C
  program_id      uuid not null references programs(id) on delete restrict,
  title_ar        text not null,
  title_en        text,
  summary_ar      text,
  summary_en      text,
  objective_ar    jsonb,
  objective_en    jsonb,
  activities_ar   jsonb,
  activities_en   jsonb,
  outcomes_ar     jsonb,
  outcomes_en     jsonb,
  project_state   project_status not null default 'active',
  start_date      date,
  end_date        date,
  governorates    governorate[] not null default '{}',
  localities      text[] not null default '{}',
  themes          theme_tag[] not null default '{}',
  hero_media_id   uuid references media_assets(id) on delete set null,
  is_featured     boolean not null default false,
  source_note     text,           -- internal provenance, never rendered
  constraint projects_date_order check (end_date is null or start_date is null or end_date >= start_date)
);
create unique index projects_slug_ar_idx on projects (slug_ar);
create unique index projects_slug_en_idx on projects (slug_en);
create index projects_program_idx    on projects (program_id, status);
create index projects_published_idx  on projects (status, published_at desc);
create index projects_gov_gin        on projects using gin (governorates);
create index projects_themes_gin     on projects using gin (themes);
create index projects_featured_idx   on projects (is_featured) where status = 'published';
```

GIN indexes on the two enum arrays are what make the `/projects` facet query fast with `&&` (array overlap) — see `02-API §4.2`.

### 4.6 `partners`

```sql
create table partners (
  id                uuid primary key default gen_random_uuid(),
  name_ar           text not null,
  name_en           text,
  type              partner_type not null,
  membership_level  membership_level,          -- null unless type in (network, membership)
  sector_ar         text,
  sector_en         text,
  description_ar    text,
  description_en    text,
  website           text,
  logo_media_id     uuid references media_assets(id) on delete set null,
  logo_permission   logo_permission not null default 'pending',
  is_featured       boolean not null default false,
  display_order     smallint not null default 0,
  status            content_status not null default 'draft',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index partners_type_idx on partners (type, display_order) where status = 'published';
```

The logo renders only when `logo_permission = 'granted'` — enforced in the query, not the component (`02-API §4.5`).

### 4.7 `project_partners` — junction

```sql
create table project_partners (
  project_id  uuid not null references projects(id) on delete cascade,
  partner_id  uuid not null references partners(id) on delete cascade,
  role        partner_role not null,
  primary key (project_id, partner_id, role)
);
create index project_partners_partner_idx on project_partners (partner_id);
```

Composite PK includes `role` so one organization can be both implementer and donor on the same project — which actually occurs (Palestinian Bible Society).

### 4.8 `impact_metrics`

```sql
create table impact_metrics (
  id                  uuid primary key default gen_random_uuid(),
  label_ar            text not null,
  label_en            text,
  value               numeric(14,2) not null,
  unit                text not null,               -- people | families | children | sessions | ILS …
  display_prefix      text,                        -- '+' | '~' | null
  program_id          uuid references programs(id) on delete set null,
  project_id          uuid references projects(id) on delete cascade,
  period_start        date not null,
  period_end          date not null,
  status              metric_status not null,
  verification_source text,
  is_public           boolean not null default false,
  is_featured         boolean not null default false,
  display_order       smallint not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint metrics_period_order check (period_end >= period_start)
);
create index metrics_public_idx  on impact_metrics (status, is_public, display_order);
create index metrics_program_idx on impact_metrics (program_id) where is_public;
```

`period_start`/`period_end` are `not null` so `MetricCard` can always render its period label. `status` exists so `/impact` filters `status='verified'` and `/about/strategy` filters `status='target'` — one table, two contexts, no editorial process required.

### 4.9 `stories`

```sql
create table stories (
  -- BLOCK A, BLOCK B, BLOCK C
  program_id          uuid references programs(id) on delete set null,
  project_id          uuid references projects(id) on delete set null,
  title_ar            text not null,
  title_en            text,
  summary_ar          text,
  summary_en          text,
  body_ar             jsonb,
  body_en             jsonb,
  quote_text_ar       text,
  quote_text_en       text,
  quote_attribution_ar text,
  quote_attribution_en text,
  subject_anonymized  boolean not null default true,
  consent_obtained    boolean not null default false,
  consent_reference   text,
  hero_media_id       uuid references media_assets(id) on delete set null,
  is_featured         boolean not null default false
);
create unique index stories_slug_ar_idx on stories (slug_ar);
create unique index stories_slug_en_idx on stories (slug_en);
create index stories_published_idx on stories (status, published_at desc);
```

### 4.10 `posts` — news · statements · announcements

```sql
create table posts (
  -- BLOCK A, BLOCK B, BLOCK C
  category      post_category not null default 'news',
  title_ar      text not null,
  title_en      text,
  excerpt_ar    text,
  excerpt_en    text,
  body_ar       jsonb,
  body_en       jsonb,
  program_id    uuid references programs(id) on delete set null,
  project_id    uuid references projects(id) on delete set null,
  hero_media_id uuid references media_assets(id) on delete set null,
  expires_at    timestamptz,      -- announcements only; auto-archived by cron
  is_featured   boolean not null default false
);
create unique index posts_slug_ar_idx on posts (slug_ar);
create unique index posts_slug_en_idx on posts (slug_en);
create index posts_category_idx  on posts (category, status, published_at desc);
create index posts_published_idx on posts (status, published_at desc);
create index posts_expiring_idx  on posts (expires_at) where expires_at is not null;
```

### 4.11 `vacancies`

```sql
create table vacancies (
  -- BLOCK A, BLOCK B, BLOCK C
  type               vacancy_type not null default 'job',
  title_ar           text not null,
  title_en           text,
  location_ar        text,
  location_en        text,
  employment_type    text,                       -- FULL_TIME | PART_TIME | VOLUNTEER (schema.org)
  description_ar     jsonb,
  description_en     jsonb,
  requirements_ar    jsonb,
  requirements_en    jsonb,
  deadline           date not null,
  application_method text not null default 'form',   -- 'form' | 'email'
  application_email  text,
  posted_at          date not null default current_date
);
create unique index vacancies_slug_ar_idx on vacancies (slug_ar);
create unique index vacancies_slug_en_idx on vacancies (slug_en);
create index vacancies_open_idx on vacancies (type, deadline desc) where status = 'published';
```

`deadline` is `not null`. A vacancy without one is the `[FB 2026-05-11]` failure mode.

### 4.12 `people`

```sql
create table people (
  id            uuid primary key default gen_random_uuid(),
  name_ar       text not null,
  name_en       text,
  role_ar       text not null,
  role_en       text,
  category      person_category not null default 'board',
  bio_ar        text,
  bio_en        text,
  photo_media_id uuid references media_assets(id) on delete set null,
  is_public     boolean not null default false,     -- DNH-5: opt-in, never default
  display_order smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index people_public_idx on people (category, display_order) where is_public;
```

### 4.13 `publications`

```sql
create table publications (
  -- BLOCK A, BLOCK B
  type            publication_type not null default 'report',
  title_ar        text not null,
  title_en        text,
  description_ar  text,
  description_en  text,
  file_ar_id      uuid references media_assets(id) on delete set null,
  file_en_id      uuid references media_assets(id) on delete set null,
  published_year  smallint,
  is_featured     boolean not null default false,
  display_order   smallint not null default 0
);
create unique index publications_slug_ar_idx on publications (slug_ar);
create unique index publications_slug_en_idx on publications (slug_en);
```

### 4.14 `pages` — generic (legal, verify, misc)

```sql
create table pages (
  -- BLOCK A, BLOCK B, BLOCK C
  key       text not null unique,     -- 'privacy' | 'accessibility' | 'terms' | 'verify'
  title_ar  text not null,
  title_en  text,
  body_ar   jsonb,
  body_en   jsonb
);
```

### 4.15 Media junctions

```sql
create table project_media (
  project_id    uuid not null references projects(id) on delete cascade,
  media_id      uuid not null references media_assets(id) on delete cascade,
  display_order smallint not null default 0,
  primary key (project_id, media_id)
);
create table story_media  (like project_media including all);  -- rename cols per table
create table program_media(like project_media including all);
create table post_media   (like project_media including all);
```
> `like … including all` is shorthand for the doc. In Drizzle, define each junction explicitly with correctly named FK columns (`story_id`, `program_id`, `post_id`).

### 4.16 `form_submissions`

```sql
create table form_submissions (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique,          -- 'PCS-' || upper(substr(md5(random()::text),1,6))
  type          submission_type not null,
  is_sensitive  boolean not null default false,
  locale        locale_code not null default 'ar',
  payload       jsonb not null,
  attachment_path text,                        -- private 'applications' bucket
  state         submission_state not null default 'new',
  handled_by    uuid references profiles(id) on delete set null,
  handled_at    timestamptz,
  internal_note text,
  ip_hash       text,                          -- sha256(ip+salt); NULL when is_sensitive
  user_agent    text,                          -- NULL when is_sensitive
  created_at    timestamptz not null default now(),
  purge_after   date not null
);
create index submissions_type_idx  on form_submissions (type, created_at desc);
create index submissions_state_idx on form_submissions (state) where state = 'new';
create index submissions_purge_idx on form_submissions (purge_after);
create index submissions_sensitive_idx on form_submissions (is_sensitive, created_at desc);
```

### 4.17 `audit_logs`

```sql
create table audit_logs (
  id          bigserial primary key,
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null,                   -- 'create' | 'update' | 'publish' | 'delete'
  entity_type text not null,
  entity_id   uuid,
  diff        jsonb,
  created_at  timestamptz not null default now()
);
create index audit_entity_idx on audit_logs (entity_type, entity_id, created_at desc);
create index audit_actor_idx  on audit_logs (actor_id, created_at desc);
```

### 4.18 `redirects`

```sql
create table redirects (
  id               uuid primary key default gen_random_uuid(),
  source_path      text not null unique,
  destination_path text not null,
  status_code      smallint not null default 308,
  created_at       timestamptz not null default now()
);
```

Read at **build time** by `next.config.ts` `redirects()` — no runtime DB call in middleware.

---

## 5. Triggers & functions

```sql
-- updated_at, applied to every table that has the column
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_programs_updated  before update on programs
  for each row execute function set_updated_at();
-- …repeat for every table with updated_at

-- published_at set once, on first transition to 'published'
create or replace function set_published_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'published' and old.status is distinct from 'published'
     and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end $$;

create trigger trg_projects_published before update on projects
  for each row execute function set_published_at();
-- …repeat for programs, posts, stories, vacancies, publications, pages

-- submission reference
create or replace function gen_submission_reference() returns trigger
language plpgsql as $$
begin
  if new.reference is null then
    new.reference := 'PCS-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,6));
  end if;
  return new;
end $$;
create trigger trg_submission_ref before insert on form_submissions
  for each row execute function gen_submission_reference();

-- auth.users → profiles  (supabase/migrations/02_auth_trigger_profiles.sql)
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
          'editor')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
```

> The `handle_new_user` trigger inserts with role `'editor'` — the least privileged role. Promotion is a deliberate admin action. (This is the same class of bug as the OnlineMihna superadmin clobber: never let a metadata write decide a role.)

**Scheduled jobs** (`pg_cron`, or Vercel Cron hitting `/api/cron/*` with `CRON_SECRET`):

```sql
-- archive expired announcements, hourly
select cron.schedule('archive-expired-posts','0 * * * *', $$
  update posts set status='archived'
  where category='announcement' and expires_at < now() and status='published';
$$);

-- archive closed vacancies, daily
select cron.schedule('archive-closed-vacancies','15 0 * * *', $$
  update vacancies set status='archived'
  where deadline < current_date and status='published';
$$);

-- purge submissions past retention, daily
select cron.schedule('purge-submissions','30 0 * * *', $$
  delete from form_submissions where purge_after < current_date;
$$);
```

> The archive jobs change published content, so they must also bust the cache. Either run them through `/api/cron/*` route handlers that call `revalidateTag()` (preferred), or accept up to one ISR window of staleness. **Use the route-handler approach** — a closed vacancy showing as open is exactly the bug the deadline field exists to prevent.

---

## 6. RLS

```sql
-- every application table
alter table profiles              enable row level security;
alter table organization_settings enable row level security;
alter table media_assets          enable row level security;
alter table programs              enable row level security;
alter table projects              enable row level security;
alter table partners              enable row level security;
alter table project_partners      enable row level security;
alter table impact_metrics        enable row level security;
alter table stories               enable row level security;
alter table posts                 enable row level security;
alter table vacancies             enable row level security;
alter table people                enable row level security;
alter table publications          enable row level security;
alter table pages                 enable row level security;
alter table project_media         enable row level security;
alter table story_media           enable row level security;
alter table program_media         enable row level security;
alter table post_media            enable row level security;
alter table form_submissions      enable row level security;
alter table audit_logs            enable row level security;
alter table redirects             enable row level security;

-- NO POLICIES. Intentional.
-- anon + authenticated get zero rows. All access is server-side via the
-- owner connection (00-ARCHITECTURE D1). If the anon key leaks: nothing.
```

Add a CI assertion so this cannot silently regress:

```sql
-- tests/rls.sql — must return 0 rows
select tablename from pg_tables t
where schemaname='public'
  and not exists (select 1 from pg_class c
                  join pg_namespace n on n.oid=c.relnamespace
                  where c.relname=t.tablename and n.nspname='public' and c.relrowsecurity);
```

---

## 7. Storage

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media',        'media',        true,  10485760, array['image/jpeg','image/png','image/webp','image/avif','image/svg+xml']),
  ('documents',    'documents',    true,  20971520, array['application/pdf']),
  ('applications', 'applications', false,  5242880, array['application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

-- public read on media + documents
create policy "public read media" on storage.objects
  for select using (bucket_id = 'media');
create policy "public read documents" on storage.objects
  for select using (bucket_id = 'documents');

-- 'applications' gets NO policy. Server-side signed URLs only.
```

Uploads always go through the server (`02-API §5`), never a browser-direct upload, so EXIF stripping and MIME magic-byte checks cannot be skipped.

---

## 8. Drizzle setup

`src/db/index.ts`
```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Supavisor transaction mode (:6543) does not support prepared statements.
const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: 1,            // one connection per serverless invocation
  idle_timeout: 20,
});

export const db = drizzle(client, { schema, casing: 'snake_case' });
export type DB = typeof db;
```

`drizzle.config.ts`
```ts
import type { Config } from 'drizzle-kit';
export default {
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DIRECT_URL! },   // :5432 for DDL
  casing: 'snake_case',
  verbose: true,
  strict: true,
} satisfies Config;
```

**Schema files** — one per domain, all re-exported:

```
src/db/schema/
├── index.ts          # export * from every file below
├── enums.ts          # all pgEnum definitions (§2)
├── profiles.ts
├── organization.ts
├── media.ts
├── programs.ts
├── projects.ts       # projects + project_partners + project_media
├── partners.ts
├── metrics.ts
├── stories.ts
├── posts.ts
├── vacancies.ts
├── people.ts
├── publications.ts
├── pages.ts
├── submissions.ts
├── audit.ts
└── relations.ts      # all Drizzle `relations()` in one place
```

Keeping `relations()` in one file avoids the circular-import problem that appears the moment `projects` references `partners` and `partners` references `projects`.

Example — `src/db/schema/projects.ts`:
```ts
import { pgTable, uuid, text, date, boolean, smallint, timestamp, jsonb, index, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { contentStatus, translationStatus, projectStatus, governorate, themeTag } from './enums';
import { programs } from './programs';
import { mediaAssets } from './media';
import { profiles } from './profiles';

export const projects = pgTable('projects', {
  id: uuid().primaryKey().defaultRandom(),
  status: contentStatus().notNull().default('draft'),
  translationStatus: translationStatus().notNull().default('ar_only'),
  publishedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid().references(() => profiles.id, { onDelete: 'set null' }),
  updatedBy: uuid().references(() => profiles.id, { onDelete: 'set null' }),

  slugAr: text().notNull(),
  slugEn: text().notNull(),

  programId: uuid().notNull().references(() => programs.id, { onDelete: 'restrict' }),
  titleAr: text().notNull(),
  titleEn: text(),
  summaryAr: text(),
  summaryEn: text(),
  objectiveAr: jsonb(), objectiveEn: jsonb(),
  activitiesAr: jsonb(), activitiesEn: jsonb(),
  outcomesAr: jsonb(), outcomesEn: jsonb(),

  projectState: projectStatus().notNull().default('active'),
  startDate: date(), endDate: date(),
  governorates: governorate().array().notNull().default(sql`'{}'`),
  localities: text().array().notNull().default(sql`'{}'`),
  themes: themeTag().array().notNull().default(sql`'{}'`),

  heroMediaId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
  isFeatured: boolean().notNull().default(false),
  sourceNote: text(),

  seoTitleAr: text(), seoTitleEn: text(),
  seoDescriptionAr: text(), seoDescriptionEn: text(),
  ogMediaId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
  noIndex: boolean().notNull().default(false),
}, (t) => [
  uniqueIndex('projects_slug_ar_idx').on(t.slugAr),
  uniqueIndex('projects_slug_en_idx').on(t.slugEn),
  index('projects_program_idx').on(t.programId, t.status),
  index('projects_published_idx').on(t.status, t.publishedAt.desc()),
  index('projects_gov_gin').using('gin', t.governorates),
  index('projects_themes_gin').using('gin', t.themes),
  check('projects_date_order', sql`${t.endDate} is null or ${t.startDate} is null or ${t.endDate} >= ${t.startDate}`),
]);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
```

---

## 9. Seed

`scripts/seed.ts` — idempotent, safe to re-run:

1. `organization_settings` — one row, placeholder values, `TODO` markers where spec §28 Group A decisions are outstanding
2. `programs` — 3 rows, Arabic content lifted from the strategic plan
3. `partners` — 11 rows (4 implementing, 7 donor/network), `logo_permission = 'pending'`
4. `people` — 7 board members, `is_public = false`
5. `pages` — `privacy`, `accessibility`, `terms`, `verify`
6. Dev only: 12 projects, 15 posts, 4 stories, 6 metrics, 2 vacancies

```json
// package.json
"db:generate": "drizzle-kit generate",
"db:migrate":  "drizzle-kit migrate",
"db:push":     "drizzle-kit push",
"db:studio":   "drizzle-kit studio",
"db:seed":     "tsx scripts/seed.ts",
"db:reset":    "supabase db reset && pnpm db:migrate && pnpm db:seed"
```

---

## 10. Backup & retention

| Item | Policy |
|---|---|
| Postgres | Supabase daily automated backup + PITR on a paid tier. Additionally: weekly `pg_dump` to external storage via GitHub Action — the org must not depend on one vendor. |
| Storage | Monthly export of `media` + `documents` handed to the organization. |
| Submissions | `purge_after` set at insert: partnership 24 mo · contact 12 mo · volunteer 12 mo · job 12 mo · fraud 24 mo · complaint per policy (default 24 mo). Daily purge job. |
| Audit logs | 24 months, then delete. |
