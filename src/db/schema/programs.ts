import { sql } from 'drizzle-orm';
import {
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
import { programKey, targetGroup } from './enums';
import { mediaAssets } from './media';

/** `[{ title_ar, title_en, body_ar, body_en }]` */
export type ProgramBlock = {
  title_ar: string;
  title_en?: string | null;
  body_ar?: string | null;
  body_en?: string | null;
};

/**
 * Three rows, ever. Modelled as a table rather than constants because the copy
 * is fully CMS-editable and the organisation will rewrite it.
 */
export const programs = pgTable(
  'programs',
  {
    ...blockA(),
    ...blockB(),

    key: programKey().notNull().unique('programs_key_key'),
    titleAr: text().notNull(),
    titleEn: text(),
    taglineAr: text(),
    taglineEn: text(),
    /** A design-token name, not a colour. The palette stays in CSS. */
    accentToken: text().notNull().default('--color-prog-protection'),

    introductionAr: jsonb().$type<RichText>(),
    introductionEn: jsonb().$type<RichText>(),
    rationaleAr: jsonb().$type<RichText>(),
    rationaleEn: jsonb().$type<RichText>(),
    strategicObjectiveAr: text(),
    strategicObjectiveEn: text(),
    specificObjectives: jsonb()
      .$type<ProgramBlock[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    keyInterventions: jsonb()
      .$type<ProgramBlock[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    sustainabilityAr: jsonb().$type<RichText>(),
    sustainabilityEn: jsonb().$type<RichText>(),
    impactStatementAr: jsonb().$type<RichText>(),
    impactStatementEn: jsonb().$type<RichText>(),

    /** Who qualifies for the service. */
    eligibilityAr: jsonb().$type<RichText>(),
    eligibilityEn: jsonb().$type<RichText>(),
    /** How to reach it — the part a beneficiary actually needs. */
    howToAccessAr: jsonb().$type<RichText>(),
    howToAccessEn: jsonb().$type<RichText>(),

    targetGroups: targetGroup().array().notNull().default(sql`'{}'`),
    heroMediaId: uuid(),
    displayOrder: smallint().notNull().default(0),

    ...blockC(),
  },
  (t) => [
    ...blockAForeignKeys('programs', t),
    blockCForeignKey('programs', t),
    fk('programs_hero_media_id_fkey', t.heroMediaId, mediaAssets.id, 'set null'),
    slugShapeCheck('programs', t),
    uniqueIndex('programs_slug_ar_idx').on(t.slugAr),
    uniqueIndex('programs_slug_en_idx').on(t.slugEn),
    index('programs_status_idx').on(t.status, t.displayOrder),
    index('ix_programs_hero').on(t.heroMediaId),
    index('ix_programs_public')
      .on(t.displayOrder, t.publishedAt.desc())
      .where(sql`${t.status} = 'published'`),
    // Live duplicates of the two slug indexes from the hand-written DDL.
    uniqueIndex('ux_programs_slug_ar').on(t.slugAr),
    uniqueIndex('ux_programs_slug_en').on(t.slugEn),
  ],
);

export const programMedia = pgTable(
  'program_media',
  {
    programId: uuid().notNull(),
    mediaId: uuid().notNull(),
    displayOrder: smallint().notNull().default(0),
  },
  (t) => [
    primaryKey({ name: 'program_media_pkey', columns: [t.programId, t.mediaId] }),
    fk('program_media_program_id_fkey', t.programId, programs.id, 'cascade'),
    fk('program_media_media_id_fkey', t.mediaId, mediaAssets.id, 'cascade'),
    index('program_media_media_idx').on(t.mediaId),
  ],
);

export type Program = typeof programs.$inferSelect;
export type NewProgram = typeof programs.$inferInsert;
export type ProgramMedia = typeof programMedia.$inferSelect;
