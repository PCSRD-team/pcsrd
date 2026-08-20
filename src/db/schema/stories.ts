import {
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { blockA, blockB, blockC, type RichText } from './_shared';
import { mediaAssets } from './media';
import { programs } from './programs';
import { projects } from './projects';

/**
 * Beneficiary stories.
 *
 * `subjectAnonymized` defaults to **true** and `consentObtained` to **false**.
 * The safe state is the default state: an editor has to take deliberate action
 * to de-anonymise someone, and publishing an identified story without a consent
 * reference is blocked in `services/_shared/publish.ts`.
 */
export const stories = pgTable(
  'stories',
  {
    ...blockA(),
    ...blockB(),

    programId: uuid().references(() => programs.id, { onDelete: 'set null' }),
    projectId: uuid().references(() => projects.id, { onDelete: 'set null' }),

    titleAr: text().notNull(),
    titleEn: text(),
    summaryAr: text(),
    summaryEn: text(),
    bodyAr: jsonb().$type<RichText>(),
    bodyEn: jsonb().$type<RichText>(),

    quoteTextAr: text(),
    quoteTextEn: text(),
    quoteAttributionAr: text(),
    quoteAttributionEn: text(),

    subjectAnonymized: boolean().notNull().default(true),
    consentObtained: boolean().notNull().default(false),
    consentReference: text(),

    heroMediaId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
    isFeatured: boolean().notNull().default(false),

    ...blockC(),
  },
  (t) => [
    uniqueIndex('stories_slug_ar_idx').on(t.slugAr),
    uniqueIndex('stories_slug_en_idx').on(t.slugEn),
    index('stories_published_idx').on(t.status, t.publishedAt.desc()),
  ],
);

export const storyMedia = pgTable(
  'story_media',
  {
    storyId: uuid()
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    mediaId: uuid()
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'cascade' }),
    displayOrder: smallint().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.mediaId] })],
);

export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type StoryMedia = typeof storyMedia.$inferSelect;

