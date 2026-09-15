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

    programId: uuid(),
    projectId: uuid(),

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

    heroMediaId: uuid(),
    isFeatured: boolean().notNull().default(false),

    ...blockC(),
  },
  (t) => [
    ...blockAForeignKeys('stories', t),
    blockCForeignKey('stories', t),
    fk('stories_program_id_fkey', t.programId, programs.id, 'set null'),
    fk('stories_project_id_fkey', t.projectId, projects.id, 'set null'),
    fk('stories_hero_media_id_fkey', t.heroMediaId, mediaAssets.id, 'set null'),
    slugShapeCheck('stories', t),
    /** A named subject needs consent — the database's floor under the service rule. */
    check('stories_named_needs_consent', sql`${t.subjectAnonymized} or ${t.consentObtained}`),
    uniqueIndex('stories_slug_ar_idx').on(t.slugAr),
    uniqueIndex('stories_slug_en_idx').on(t.slugEn),
    index('stories_published_idx').on(t.status, t.publishedAt.desc()),
    index('stories_program_idx').on(t.programId),
    index('stories_project_idx').on(t.projectId),
    // The `ix_*` / `ux_*` family is the hand-written DDL the live database was
    // built from; all but `ix_stories_public` duplicate an index above.
    index('ix_stories_program').on(t.programId),
    index('ix_stories_project').on(t.projectId),
    index('ix_stories_public')
      .on(t.publishedAt.desc())
      .where(sql`${t.status} = 'published'`),
    uniqueIndex('ux_stories_slug_ar').on(t.slugAr),
    uniqueIndex('ux_stories_slug_en').on(t.slugEn),
  ],
);

export const storyMedia = pgTable(
  'story_media',
  {
    storyId: uuid().notNull(),
    mediaId: uuid().notNull(),
    displayOrder: smallint().notNull().default(0),
  },
  (t) => [
    primaryKey({ name: 'story_media_pkey', columns: [t.storyId, t.mediaId] }),
    fk('story_media_story_id_fkey', t.storyId, stories.id, 'cascade'),
    fk('story_media_media_id_fkey', t.mediaId, mediaAssets.id, 'cascade'),
    index('story_media_media_idx').on(t.mediaId),
  ],
);

export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type StoryMedia = typeof storyMedia.$inferSelect;

