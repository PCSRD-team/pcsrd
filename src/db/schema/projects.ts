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
import { blockA, blockB, blockC, type RichText } from './_shared';
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
    programId: uuid()
      .notNull()
      .references(() => programs.id, { onDelete: 'restrict' }),

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

    heroMediaId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
    isFeatured: boolean().notNull().default(false),
    /** Internal provenance. Never rendered. */
    sourceNote: text(),

    ...blockC(),
  },
  (t) => [
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
    check(
      'projects_date_order',
      sql`${t.endDate} is null or ${t.startDate} is null or ${t.endDate} >= ${t.startDate}`,
    ),
  ],
);

/**
 * The composite primary key includes `role` so one organisation can be both
 * implementer and donor on the same project — which actually occurs.
 */
export const projectPartners = pgTable(
  'project_partners',
  {
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    partnerId: uuid()
      .notNull()
      .references(() => partners.id, { onDelete: 'cascade' }),
    role: partnerRole().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.partnerId, t.role] }),
    index('project_partners_partner_idx').on(t.partnerId),
  ],
);

export const projectMedia = pgTable(
  'project_media',
  {
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    mediaId: uuid()
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'cascade' }),
    displayOrder: smallint().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.mediaId] })],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectPartner = typeof projectPartners.$inferSelect;
export type ProjectMedia = typeof projectMedia.$inferSelect;
