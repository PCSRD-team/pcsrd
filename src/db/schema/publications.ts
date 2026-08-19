import { boolean, integer, pgTable, smallint, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { blockA, blockB } from './_shared';
import { publicationType } from './enums';
import { mediaAssets } from './media';

/**
 * Reports, policies, strategies and evaluations.
 *
 * No BLOCK C: a publication's SEO surface is the PDF itself plus the listing
 * page, and the spec (§4.13) does not give it one.
 */
export const publications = pgTable(
  'publications',
  {
    ...blockA(),
    ...blockB(),

    type: publicationType().notNull().default('report'),
    titleAr: text().notNull(),
    titleEn: text(),
    descriptionAr: text(),
    descriptionEn: text(),

    /** Separate files per locale — a translated report is a different PDF. */
    fileArId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
    fileEnId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),

    publishedYear: smallint(),
    isFeatured: boolean().notNull().default(false),
    displayOrder: integer().notNull().default(0),
  },
  (t) => [
    uniqueIndex('publications_slug_ar_idx').on(t.slugAr),
    uniqueIndex('publications_slug_en_idx').on(t.slugEn),
  ],
);

export type Publication = typeof publications.$inferSelect;
export type NewPublication = typeof publications.$inferInsert;
