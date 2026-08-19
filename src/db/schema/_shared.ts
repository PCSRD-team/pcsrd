import { boolean, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { contentStatus, translationStatus } from './enums';
import { mediaAssets } from './media';
import { profiles } from './profiles';

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
  createdBy: uuid().references(() => profiles.id, { onDelete: 'set null' }),
  updatedBy: uuid().references(() => profiles.id, { onDelete: 'set null' }),
});

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

/** BLOCK C — SEO. */
export const blockC = () => ({
  seoTitleAr: text(),
  seoTitleEn: text(),
  seoDescriptionAr: text(),
  seoDescriptionEn: text(),
  ogMediaId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
  noIndex: boolean().notNull().default(false),
});

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
