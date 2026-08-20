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
import { blockA, blockB, blockC, type RichText } from './_shared';
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

    key: programKey().notNull().unique(),
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
    heroMediaId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
    displayOrder: smallint().notNull().default(0),

    ...blockC(),
  },
  (t) => [
    uniqueIndex('programs_slug_ar_idx').on(t.slugAr),
    uniqueIndex('programs_slug_en_idx').on(t.slugEn),
    index('programs_status_idx').on(t.status, t.displayOrder),
  ],
);

export const programMedia = pgTable(
  'program_media',
  {
    programId: uuid()
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    mediaId: uuid()
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'cascade' }),
    displayOrder: smallint().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.programId, t.mediaId] })],
);

export type Program = typeof programs.$inferSelect;
export type NewProgram = typeof programs.$inferInsert;
export type ProgramMedia = typeof programMedia.$inferSelect;
