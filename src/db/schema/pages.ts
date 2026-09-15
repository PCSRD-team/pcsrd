import {
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import {
  blockA,
  blockAForeignKeys,
  blockB,
  blockC,
  blockCForeignKey,
  type RichText,
  slugShapeCheck,
} from './_shared';

/**
 * Generic editable pages: `privacy`, `accessibility`, `terms`, `verify`.
 *
 * `key` is the stable identifier a route looks up by; slugs are what the URL
 * shows. They differ so the organisation can rename a page in either language
 * without breaking the route that renders it.
 */
export const pages = pgTable(
  'pages',
  {
    ...blockA(),
    ...blockB(),

    key: text().notNull().unique('pages_key_key'),
    titleAr: text().notNull(),
    titleEn: text(),
    bodyAr: jsonb().$type<RichText>(),
    bodyEn: jsonb().$type<RichText>(),

    ...blockC(),
  },
  (t) => [
    ...blockAForeignKeys('pages', t),
    blockCForeignKey('pages', t),
    slugShapeCheck('pages', t),
    uniqueIndex('pages_slug_ar_idx').on(t.slugAr),
    uniqueIndex('pages_slug_en_idx').on(t.slugEn),
    // Live duplicates of the two slug indexes from the hand-written DDL.
    uniqueIndex('ux_pages_slug_ar').on(t.slugAr),
    uniqueIndex('ux_pages_slug_en').on(t.slugEn),
  ],
);

export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
