import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  foreignKey,
  text,
  timestamp,
  type UpdateDeleteAction,
  uuid,
} from 'drizzle-orm/pg-core';
import { contentStatus, translationStatus } from './enums';
import { mediaAssets } from './media';
import { profiles } from './profiles';

/**
 * A single-column foreign key with an **explicit** constraint name.
 *
 * The live database was created from hand-written DDL, so every foreign key
 * carries Postgres's default name — `<table>_<column>_fkey` — rather than the
 * `<table>_<column>_<ref>_<refcol>_fk` that Drizzle's column-level
 * `.references()` would generate. The name is part of the schema: a mismatch
 * makes every diff against the live database report a drop-and-recreate of
 * fifty-five constraints that are in fact identical. Naming them here is what
 * keeps `drizzle/` a faithful description of production.
 */
export const fk = (
  name: string,
  column: AnyPgColumn,
  foreign: AnyPgColumn,
  onDelete: UpdateDeleteAction,
) => foreignKey({ name, columns: [column], foreignColumns: [foreign] }).onDelete(onDelete);

/**
 * The three shared column blocks from 01-DATABASE §3.
 *
 * These are **functions, not constants**, and that is load-bearing. Drizzle
 * column builders are stateful: `pgTable` mutates each builder as it binds it
 * to a table (name, table reference, primary-key membership). Sharing one
 * frozen object across nine tables would leave every table but the last
 * holding metadata that points at the wrong table, and the failure is silent —
 * queries compile and return wrong column references at runtime.
 *
 * Calling the factory gives every table its own builders.
 */

/** BLOCK A — identity & lifecycle. */
export const blockA = () => ({
  id: uuid().primaryKey().defaultRandom(),
  status: contentStatus().notNull().default('draft'),
  translationStatus: translationStatus().notNull().default('ar_only'),
  /** Set once, by the `set_published_at` trigger, on first publish. */
  publishedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid(),
  updatedBy: uuid(),
});

/** The two BLOCK A foreign keys, named the way the live database names them. */
export const blockAForeignKeys = (
  table: string,
  t: { createdBy: AnyPgColumn; updatedBy: AnyPgColumn },
) => [
  fk(`${table}_created_by_fkey`, t.createdBy, profiles.id, 'set null'),
  fk(`${table}_updated_by_fkey`, t.updatedBy, profiles.id, 'set null'),
];

/**
 * BLOCK B — bilingual slugs.
 *
 * Both are `notNull`: a published page must be reachable in either locale even
 * when its body is Arabic-only, otherwise the `/en/...` route 404s rather than
 * showing the untranslated state (03-FRONTEND §6).
 */
export const blockB = () => ({
  slugAr: text().notNull(),
  slugEn: text().notNull(),
});

/**
 * `<table>_slug_shape` — no whitespace and no `/` in either slug. The Zod
 * `slugSchema` is stricter; this is the database's own floor, and it is what
 * makes a slug usable as one path segment regardless of which client wrote it.
 */
export const slugShapeCheck = (table: string, t: { slugAr: AnyPgColumn; slugEn: AnyPgColumn }) =>
  check(
    `${table}_slug_shape`,
    sql`${t.slugAr} ~ '^[^\\s/]+$' and ${t.slugEn} ~ '^[^\\s/]+$'`,
  );

/** BLOCK C — SEO. */
export const blockC = () => ({
  seoTitleAr: text(),
  seoTitleEn: text(),
  seoDescriptionAr: text(),
  seoDescriptionEn: text(),
  ogMediaId: uuid(),
  noIndex: boolean().notNull().default(false),
});

/** The BLOCK C foreign key, named the way the live database names it. */
export const blockCForeignKey = (table: string, t: { ogMediaId: AnyPgColumn }) =>
  fk(`${table}_og_media_id_fkey`, t.ogMediaId, mediaAssets.id, 'set null');

/** `created_at` / `updated_at` for tables outside the publishing lifecycle. */
export const timestamps = () => ({
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * A TipTap document, stored as JSON rather than HTML.
 *
 * Storing the document instead of rendered markup is what lets the renderer
 * stay a Server Component with no `dangerouslySetInnerHTML` — the node tree is
 * walked and mapped to React elements (03-FRONTEND §7).
 */
export type RichText = {
  type: 'doc';
  content?: RichTextNode[];
};

export type RichTextNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};
