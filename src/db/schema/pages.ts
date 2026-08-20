import {
  jsonb,
  pgTable,
  text,
} from 'drizzle-orm/pg-core';
import { blockA, blockB, blockC, type RichText } from './_shared';

/**
 * Generic editable pages: `privacy`, `accessibility`, `terms`, `verify`.
 *
 * `key` is the stable identifier a route looks up by; slugs are what the URL
 * shows. They differ so the organisation can rename a page in either language
 * without breaking the route that renders it.
 */
export const pages = pgTable('pages', {
  ...blockA(),
  ...blockB(),

  key: text().notNull().unique(),
  titleAr: text().notNull(),
  titleEn: text(),
  bodyAr: jsonb().$type<RichText>(),
  bodyEn: jsonb().$type<RichText>(),

  ...blockC(),
});

export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
