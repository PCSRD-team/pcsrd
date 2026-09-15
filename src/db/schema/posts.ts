import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  blockA,
  blockAForeignKeys,
  blockB,
  blockC,
  blockCForeignKey,
  fk,
  type RichText,
  slugShapeCheck,
} from './_shared';
import { postCategory } from './enums';
import { mediaAssets } from './media';
import { programs } from './programs';
import { projects } from './projects';

/** News, statements and announcements — one table, three categories. */
export const posts = pgTable(
  'posts',
  {
    ...blockA(),
    ...blockB(),

    category: postCategory().notNull().default('news'),
    titleAr: text().notNull(),
    titleEn: text(),
    excerptAr: text(),
    excerptEn: text(),
    bodyAr: jsonb().$type<RichText>(),
    bodyEn: jsonb().$type<RichText>(),

    programId: uuid(),
    projectId: uuid(),
    heroMediaId: uuid(),

    /**
     * Announcements only. The archive cron reads this and flips `status`, then
     * revalidates — an expired announcement still on the homepage is the exact
     * failure this column exists to prevent.
     */
    expiresAt: timestamp({ withTimezone: true }),
    isFeatured: boolean().notNull().default(false),

    ...blockC(),
  },
  (t) => [
    ...blockAForeignKeys('posts', t),
    blockCForeignKey('posts', t),
    fk('posts_program_id_fkey', t.programId, programs.id, 'set null'),
    fk('posts_project_id_fkey', t.projectId, projects.id, 'set null'),
    fk('posts_hero_media_id_fkey', t.heroMediaId, mediaAssets.id, 'set null'),
    slugShapeCheck('posts', t),
    /** Only an announcement expires; a news item with a date would vanish silently. */
    check(
      'posts_expiry_only_announcements',
      sql`${t.expiresAt} is null or ${t.category} = 'announcement'`,
    ),
    uniqueIndex('posts_slug_ar_idx').on(t.slugAr),
    uniqueIndex('posts_slug_en_idx').on(t.slugEn),
    index('posts_category_idx').on(t.category, t.status, t.publishedAt.desc()),
    index('posts_published_idx').on(t.status, t.publishedAt.desc()),
    index('posts_expiring_idx')
      .on(t.expiresAt)
      .where(sql`${t.expiresAt} is not null`),
    // The `ix_*` / `ux_*` family is the hand-written DDL the live database was
    // built from; the two `ux_*` duplicate the slug indexes above.
    index('ix_posts_program').on(t.programId),
    index('ix_posts_project').on(t.projectId),
    index('ix_posts_public')
      .on(t.category, t.publishedAt.desc())
      .where(sql`${t.status} = 'published'`),
    index('ix_posts_search_ar').using(
      'gin',
      sql`to_tsvector('simple'::regconfig, ((COALESCE(${t.titleAr}, ''::text) || ' '::text) || COALESCE(${t.excerptAr}, ''::text)))`,
    ),
    uniqueIndex('ux_posts_slug_ar').on(t.slugAr),
    uniqueIndex('ux_posts_slug_en').on(t.slugEn),
  ],
);

export const postMedia = pgTable(
  'post_media',
  {
    postId: uuid().notNull(),
    mediaId: uuid().notNull(),
    displayOrder: smallint().notNull().default(0),
  },
  (t) => [
    primaryKey({ name: 'post_media_pkey', columns: [t.postId, t.mediaId] }),
    fk('post_media_post_id_fkey', t.postId, posts.id, 'cascade'),
    fk('post_media_media_id_fkey', t.mediaId, mediaAssets.id, 'cascade'),
    index('post_media_media_idx').on(t.mediaId),
  ],
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type PostMedia = typeof postMedia.$inferSelect;
