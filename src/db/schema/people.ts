import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { personCategory } from './enums';
import { mediaAssets } from './media';

/**
 * Board, executive and staff.
 *
 * `isPublic` defaults to **false** — DNH-5. Naming staff of an organisation
 * working in Gaza is a safety decision, not a content decision, and it is made
 * per person, explicitly, never by a bulk import default.
 */
export const people = pgTable(
  'people',
  {
    id: uuid().primaryKey().defaultRandom(),
    nameAr: text().notNull(),
    nameEn: text(),
    roleAr: text().notNull(),
    roleEn: text(),
    category: personCategory().notNull().default('board'),
    bioAr: text(),
    bioEn: text(),
    photoMediaId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
    isPublic: boolean().notNull().default(false),
    displayOrder: integer().notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index('people_public_idx')
      .on(t.category, t.displayOrder)
      .where(sql`${t.isPublic}`),
  ],
);

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
