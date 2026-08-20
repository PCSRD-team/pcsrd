import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  smallint,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { contentStatus, logoPermission, membershipLevel, partnerType } from './enums';
import { mediaAssets } from './media';

/**
 * Implementing partners, donors, networks and memberships.
 *
 * `logoPermission` gates rendering: a logo appears only when it is `'granted'`,
 * and that filter lives in the query, not the component (02-API §4.5). A
 * partner whose permission is still `'pending'` renders as a name — honest,
 * and still useful.
 */
export const partners = pgTable(
  'partners',
  {
    id: uuid().primaryKey().defaultRandom(),
    nameAr: text().notNull(),
    nameEn: text(),
    type: partnerType().notNull(),
    /** Null unless `type` is `network` or `membership`. */
    membershipLevel: membershipLevel(),
    sectorAr: text(),
    sectorEn: text(),
    descriptionAr: text(),
    descriptionEn: text(),
    website: text(),
    logoMediaId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
    logoPermission: logoPermission().notNull().default('pending'),
    isFeatured: boolean().notNull().default(false),
    displayOrder: smallint().notNull().default(0),
    status: contentStatus().notNull().default('draft'),
    ...timestamps(),
  },
  (t) => [
    index('partners_type_idx')
      .on(t.type, t.displayOrder)
      .where(sql`${t.status} = 'published'`),
  ],
);

export type Partner = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;
