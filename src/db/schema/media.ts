import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { consentStatus, mediaKind } from './enums';
import { profiles } from './profiles';

/**
 * Every image, video and document. Created early because most content tables
 * reference it.
 *
 * `altAr` is `notNull` at the database level, not merely validated in a form:
 * RULE 7 says media without Arabic alt text cannot be published, and the
 * cheapest place to make that true is the column definition.
 */
export const mediaAssets = pgTable(
  'media_assets',
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: mediaKind().notNull().default('image'),
    bucket: text().notNull().default('media'),
    /** Storage object path, unique across the bucket. */
    path: text().notNull().unique(),
    mimeType: text().notNull(),
    /** Bytes. */
    fileSize: integer().notNull(),
    width: integer(),
    height: integer(),
    /** Base64 LQIP handed to `next/image` as `blurDataURL`. */
    blurDataUrl: text(),

    altAr: text().notNull(),
    altEn: text(),
    captionAr: text(),
    captionEn: text(),
    credit: text(),

    /**
     * Consent gate. `hasIdentifiableMinors && consent !== 'obtained'` blocks
     * publication of anything referencing this asset — enforced in
     * `services/_shared/publish.ts`, never in a component.
     */
    consent: consentStatus().notNull().default('not_required'),
    consentReference: text(),
    hasIdentifiableMinors: boolean().notNull().default(false),

    exifStripped: boolean().notNull().default(false),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid().references(() => profiles.id, { onDelete: 'set null' }),
  },
  (t) => [index('media_kind_idx').on(t.kind, t.createdAt.desc())],
);

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
