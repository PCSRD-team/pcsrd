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
import { fk } from './_shared';
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

/** `[{ platform, url, is_official, visible, display_order }]` */
export type SocialLink = {
  platform: string;
  url: string;
  is_official: boolean;
  visible?: boolean;
  display_order?: number | null;
};

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
  visible?: boolean;
  display_order?: number | null;
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
    shortDescriptionAr: text(),
    shortDescriptionEn: text(),
    /** schema.org `alternateName` — spellings the org is also searched by. */
    alternateNames: text().array().notNull().default(sql`'{}'`),
    /** 1900–2100, by `organization_settings_founded_year_check`. */
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
    /**
     * Digits only, no leading `+` — this is the `wa.me` link format, and the
     * `org_whatsapp_digits` CHECK (`^[0-9]{8,15}$`) holds it to that.
     */
    whatsappNumber: text(),
    email: text(),
    secondaryEmail: text(),
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

    footerCtaTitleAr: text(),
    footerCtaTitleEn: text(),
    footerCtaDescriptionAr: text(),
    footerCtaDescriptionEn: text(),
    footerCtaButtonLabelAr: text(),
    footerCtaButtonLabelEn: text(),
    footerCtaUrl: text(),
    footerCtaEnabled: boolean().notNull().default(false),

    logoPrimaryId: uuid(),
    footerLogoId: uuid(),
    logoMonoId: uuid(),
    defaultOgId: uuid(),

    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid(),
  },
  (t) => [
    fk('organization_settings_logo_primary_id_fkey', t.logoPrimaryId, mediaAssets.id, 'set null'),
    // Added by `0004`, so it carries Drizzle's naming rather than Postgres's.
    fk(
      'organization_settings_footer_logo_id_media_assets_id_fk',
      t.footerLogoId,
      mediaAssets.id,
      'set null',
    ),
    fk('organization_settings_logo_mono_id_fkey', t.logoMonoId, mediaAssets.id, 'set null'),
    fk('organization_settings_default_og_id_fkey', t.defaultOgId, mediaAssets.id, 'set null'),
    fk('organization_settings_updated_by_fkey', t.updatedBy, profiles.id, 'set null'),
    check('organization_settings_id_check', sql`${t.id}`),
    check(
      'organization_settings_founded_year_check',
      sql`${t.foundedYear} >= 1900 and ${t.foundedYear} <= 2100`,
    ),
    check(
      'org_whatsapp_digits',
      sql`${t.whatsappNumber} is null or ${t.whatsappNumber} ~ '^[0-9]{8,15}$'`,
    ),
    // The five jsonb columns are edited as JSON text in the admin form; the
    // database refuses anything that parsed but is not an array.
    check(
      'org_json_shapes',
      sql`jsonb_typeof(${t.coreValues}) = 'array' and jsonb_typeof(${t.principles}) = 'array' and jsonb_typeof(${t.strategicObjectives}) = 'array' and jsonb_typeof(${t.socials}) = 'array' and jsonb_typeof(${t.officialChannels}) = 'array'`,
    ),
  ],
);

export type OrganizationSettings = typeof organizationSettings.$inferSelect;
export type NewOrganizationSettings = typeof organizationSettings.$inferInsert;
