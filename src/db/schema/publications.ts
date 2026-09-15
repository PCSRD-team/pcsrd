import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { blockA, blockAForeignKeys, blockB, fk, slugShapeCheck } from './_shared';
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
    fileArId: uuid(),
    fileEnId: uuid(),

    /** 1900–2100 or null — `publications_published_year_check`. */
    publishedYear: smallint(),
    isFeatured: boolean().notNull().default(false),
    displayOrder: smallint().notNull().default(0),
  },
  (t) => [
    ...blockAForeignKeys('publications', t),
    fk('publications_file_ar_id_fkey', t.fileArId, mediaAssets.id, 'set null'),
    fk('publications_file_en_id_fkey', t.fileEnId, mediaAssets.id, 'set null'),
    slugShapeCheck('publications', t),
    check(
      'publications_published_year_check',
      sql`${t.publishedYear} is null or (${t.publishedYear} >= 1900 and ${t.publishedYear} <= 2100)`,
    ),
    uniqueIndex('publications_slug_ar_idx').on(t.slugAr),
    uniqueIndex('publications_slug_en_idx').on(t.slugEn),
    index('publications_type_idx')
      .on(t.type, t.displayOrder)
      .where(sql`${t.status} = 'published'`),
    // The `ix_*` / `ux_*` family is the hand-written DDL the live database was
    // built from; the two `ux_*` duplicate the slug indexes above.
    index('ix_publications_public')
      .on(t.type, t.publishedYear.desc())
      .where(sql`${t.status} = 'published'`),
    uniqueIndex('ux_publications_slug_ar').on(t.slugAr),
    uniqueIndex('ux_publications_slug_en').on(t.slugEn),
  ],
);

export type Publication = typeof publications.$inferSelect;
export type NewPublication = typeof publications.$inferInsert;
