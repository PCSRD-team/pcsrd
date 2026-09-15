import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  blockA,
  blockAForeignKeys,
  blockB,
  blockC,
  blockCForeignKey,
  fk,
  type RichText,
  slugShapeCheck,
} from './_shared';
import { governorate, partnerRole, projectStatus, themeTag } from './enums';
import { mediaAssets } from './media';
import { partners } from './partners';
import { programs } from './programs';

export const projects = pgTable(
  'projects',
  {
    ...blockA(),
    ...blockB(),

    /**
     * `restrict`, not `cascade`: deleting a programme that still has projects
     * would silently delete published content. The admin must move them first.
     */
    programId: uuid().notNull(),

    titleAr: text().notNull(),
    titleEn: text(),
    summaryAr: text(),
    summaryEn: text(),
    objectiveAr: jsonb().$type<RichText>(),
    objectiveEn: jsonb().$type<RichText>(),
    activitiesAr: jsonb().$type<RichText>(),
    activitiesEn: jsonb().$type<RichText>(),
    outcomesAr: jsonb().$type<RichText>(),
    outcomesEn: jsonb().$type<RichText>(),

    /** Named `project_state` because `status` is already the content status. */
    projectState: projectStatus().notNull().default('active'),
    startDate: date(),
    endDate: date(),

    governorates: governorate().array().notNull().default(sql`'{}'`),
    localities: text().array().notNull().default(sql`'{}'`),
    themes: themeTag().array().notNull().default(sql`'{}'`),

    heroMediaId: uuid(),
    isFeatured: boolean().notNull().default(false),
    /** Internal provenance. Never rendered. */
    sourceNote: text(),

    ...blockC(),
  },
  (t) => [
    ...blockAForeignKeys('projects', t),
    blockCForeignKey('projects', t),
    fk('projects_program_id_fkey', t.programId, programs.id, 'restrict'),
    fk('projects_hero_media_id_fkey', t.heroMediaId, mediaAssets.id, 'set null'),
    slugShapeCheck('projects', t),
    uniqueIndex('projects_slug_ar_idx').on(t.slugAr),
    uniqueIndex('projects_slug_en_idx').on(t.slugEn),
    index('projects_program_idx').on(t.programId, t.status),
    index('projects_published_idx').on(t.status, t.publishedAt.desc()),
    // GIN on the two enum arrays is what makes the `/projects` facet query fast
    // with `&&` (array overlap) — 02-API §4.2.
    index('projects_gov_gin').using('gin', t.governorates),
    index('projects_themes_gin').using('gin', t.themes),
    index('projects_featured_idx')
      .on(t.isFeatured)
      .where(sql`${t.status} = 'published'`),
    index('projects_start_year_idx')
      .on(t.startDate)
      .where(sql`${t.status} = 'published'`),
    check(
      'projects_date_order',
      sql`${t.endDate} is null or ${t.startDate} is null or ${t.endDate} >= ${t.startDate}`,
    ),
    // The `ix_*` family is the hand-written DDL the live database was built
    // from. `ix_projects_govs` / `ix_projects_themes` duplicate the two GIN
    // indexes above exactly; the rest are distinct shapes.
    index('ix_projects_program').on(t.programId),
    index('ix_projects_state').on(t.projectState, t.startDate.desc()),
    index('ix_projects_public')
      .on(t.publishedAt.desc())
      .where(sql`${t.status} = 'published'`),
    index('ix_projects_featured')
      .on(t.publishedAt.desc())
      .where(sql`${t.status} = 'published' and ${t.isFeatured}`),
    index('ix_projects_govs').using('gin', t.governorates),
    index('ix_projects_themes').using('gin', t.themes),
    index('ix_projects_search_ar').using(
      'gin',
      sql`to_tsvector('simple'::regconfig, ((COALESCE(${t.titleAr}, ''::text) || ' '::text) || COALESCE(${t.summaryAr}, ''::text)))`,
    ),
    uniqueIndex('ux_projects_slug_ar').on(t.slugAr),
    uniqueIndex('ux_projects_slug_en').on(t.slugEn),
  ],
);

/**
 * The composite primary key includes `role` so one organisation can be both
 * implementer and donor on the same project — which actually occurs.
 */
export const projectPartners = pgTable(
  'project_partners',
  {
    projectId: uuid().notNull(),
    partnerId: uuid().notNull(),
    role: partnerRole().notNull(),
  },
  (t) => [
    primaryKey({ name: 'project_partners_pkey', columns: [t.projectId, t.partnerId, t.role] }),
    fk('project_partners_project_id_fkey', t.projectId, projects.id, 'cascade'),
    fk('project_partners_partner_id_fkey', t.partnerId, partners.id, 'cascade'),
    index('project_partners_partner_idx').on(t.partnerId),
    // Live duplicate of `project_partners_partner_idx` from the hand-written DDL.
    index('ix_project_partners_partner').on(t.partnerId),
  ],
);

export const projectMedia = pgTable(
  'project_media',
  {
    projectId: uuid().notNull(),
    mediaId: uuid().notNull(),
    displayOrder: smallint().notNull().default(0),
  },
  (t) => [
    primaryKey({ name: 'project_media_pkey', columns: [t.projectId, t.mediaId] }),
    fk('project_media_project_id_fkey', t.projectId, projects.id, 'cascade'),
    fk('project_media_media_id_fkey', t.mediaId, mediaAssets.id, 'cascade'),
    index('project_media_media_idx').on(t.mediaId),
  ],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectPartner = typeof projectPartners.$inferSelect;
export type ProjectMedia = typeof projectMedia.$inferSelect;
