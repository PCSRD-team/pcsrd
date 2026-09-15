import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { fk } from './_shared';
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
    path: text().notNull().unique('media_assets_path_key'),
    mimeType: text().notNull(),
    /** Bytes. `media_assets_file_size_check` refuses an empty file. */
    fileSize: integer().notNull(),
    width: integer(),
    height: integer(),
    /** Base64 LQIP handed to `next/image` as `blurDataURL`. */
    blurDataUrl: text(),

    /** Non-blank, by `media_assets_alt_ar_check` — whitespace is not alt text. */
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
    createdBy: uuid(),
  },
  (t) => [
    fk('media_assets_created_by_fkey', t.createdBy, profiles.id, 'set null'),
    check('media_assets_file_size_check', sql`${t.fileSize} > 0`),
    check('media_assets_alt_ar_check', sql`length(btrim(${t.altAr})) > 0`),
    /**
     * A photograph of an identifiable child needs documented consent — the
     * same rule `services/_shared/publish.ts` applies at publish time, stated
     * once more where no service can skip it.
     */
    check(
      'chk_media_minor_consent',
      sql`${t.hasIdentifiableMinors} = false or (${t.consent} = 'obtained' and ${t.consentReference} is not null)`,
    ),
    index('media_kind_idx').on(t.kind, t.createdAt.desc()),
    index('media_bucket_idx').on(t.bucket),
    index('media_consent_idx').on(t.consent).where(sql`${t.hasIdentifiableMinors}`),
    index('ix_media_created_by').on(t.createdBy),
    // Live duplicates of `media_kind_idx` / `media_consent_idx` from the
    // hand-written DDL the database was built from.
    index('ix_media_kind').on(t.kind, t.createdAt.desc()),
    index('ix_media_consent').on(t.consent).where(sql`${t.hasIdentifiableMinors}`),
  ],
);

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
