import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { mediaAssets } from './media';
import { profiles } from './profiles';

/** `[{ title_ar, title_en, body_ar, body_en }]` */
export type TitledBlock = {
  title_ar: string;
  title_en?: string | null;
  body_ar?: string | null;
  body_en?: string | null;
};

/** `[{ text_ar, text_en }]` */
export type BilingualLine = { text_ar: string; text_en?: string | null };

/** `[{ platform, url, is_official }]` */
export type SocialLink = { platform: string; url: string; is_official: boolean };

/**
 * The channels the organisation actually owns, rendered on `/verify` so a
 * reader can check an account against the source. `is_official: false` is a
 * documented impostor, and saying so is the entire point of the page.
 */
export type OfficialChannel = {
  platform: string;
  handle: string;
  url: string;
  is_official: boolean;
  note_ar?: string | null;
  note_en?: string | null;
};

/**
 * Singleton. Every organisational fact the site renders lives here rather than
 * in code — RULE 6. Names, licence numbers, phone numbers and channels are the
 * organisation's to change without a deploy.
 *
 * `id boolean primary key default true check (id)` makes a second row
 * impossible in the database, so every read is one `.limit(1)`.
 */
export const organizationSettings = pgTable(
  'organization_settings',
  {
    id: boolean().primaryKey().default(true),

    legalNameAr: text().notNull(),
    legalNameEn: text().notNull(),
    shortNameAr: text().notNull(),
    shortNameEn: text().notNull(),
    acronym: text().notNull(),
    /** schema.org `alternateName` — spellings the org is also searched by. */
    alternateNames: text().array().notNull().default(sql`'{}'`),
    foundedYear: smallint().notNull(),
    licenseNumber: text().notNull(),
    licenseAuthorityAr: text(),
    licenseAuthorityEn: text(),
    legalFormAr: text(),
    legalFormEn: text(),

    visionAr: text(),
    visionEn: text(),
    missionAr: text(),
    missionEn: text(),

    /**
     * Named `core_values`, not `values`: `VALUES` is a fully reserved keyword
     * in Postgres, so any raw `db.execute(sql\`…\`)` naming the column would
     * fail permanently and for a reason that reads as a syntax error.
     */
    coreValues: jsonb().$type<TitledBlock[]>().notNull().default(sql`'[]'::jsonb`),
    principles: jsonb().$type<TitledBlock[]>().notNull().default(sql`'[]'::jsonb`),
    strategicObjectives: jsonb()
      .$type<BilingualLine[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    primaryPhone: text(),
    additionalPhones: text().array().notNull().default(sql`'{}'`),
    /** Digits only, no leading `+` — this is the `wa.me` link format. */
    whatsappNumber: text(),
    email: text(),
    addressAr: text(),
    addressEn: text(),
    /** DNH-6: the office address is published only on an explicit decision. */
    addressIsPublic: boolean().notNull().default(false),
    officeHoursAr: text(),
    officeHoursEn: text(),
    socials: jsonb().$type<SocialLink[]>().notNull().default(sql`'[]'::jsonb`),
    officialChannels: jsonb()
      .$type<OfficialChannel[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    logoPrimaryId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
    logoMonoId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
    defaultOgId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),

    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid().references(() => profiles.id, { onDelete: 'set null' }),
  },
  (t) => [check('organization_settings_singleton', sql`${t.id}`)],
);

export type OrganizationSettings = typeof organizationSettings.$inferSelect;
export type NewOrganizationSettings = typeof organizationSettings.$inferInsert;
