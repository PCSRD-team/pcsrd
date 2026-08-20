import { sql } from 'drizzle-orm';
import {
  boolean,
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
import { blockA, blockB, blockC, type RichText } from './_shared';
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

    programId: uuid().references(() => programs.id, { onDelete: 'set null' }),
    projectId: uuid().references(() => projects.id, { onDelete: 'set null' }),
    heroMediaId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),

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
    uniqueIndex('posts_slug_ar_idx').on(t.slugAr),
    uniqueIndex('posts_slug_en_idx').on(t.slugEn),
    index('posts_category_idx').on(t.category, t.status, t.publishedAt.desc()),
    index('posts_published_idx').on(t.status, t.publishedAt.desc()),
    index('posts_expiring_idx')
      .on(t.expiresAt)
      .where(sql`${t.expiresAt} is not null`),
  ],
);

export const postMedia = pgTable(
  'post_media',
  {
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    mediaId: uuid()
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'cascade' }),
    displayOrder: smallint().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.postId, t.mediaId] })],
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type PostMedia = typeof postMedia.$inferSelect;
