import { eq } from 'drizzle-orm';
import {
  pages,
  postMedia,
  posts,
  programMedia,
  programs,
  publications,
  stories,
  storyMedia,
  vacancies,
} from '@/db/schema';
import type { RichText } from '@/db/schema/_shared';
import type {
  ContentStatus,
  PostCategory,
  ProgramKey,
  PublicationType,
  TargetGroup,
  TranslationStatus,
  VacancyType,
} from '@/db/schema/enums';
import type { Tx } from '@/db';
import { assertStoryConsent } from '../_shared/publish';
import {
  type ContentInputBase,
  createContentService,
  keep,
} from '../_shared/content-service';

/**
 * The six content entities that differ from each other only in their columns.
 *
 * Projects are not here: they carry two junction tables and a `restrict`
 * foreign key, and live in `project.service.ts` written out in full.
 */

type SeoFields = {
  seoTitleAr?: string | null;
  seoTitleEn?: string | null;
  seoDescriptionAr?: string | null;
  seoDescriptionEn?: string | null;
  ogMediaId?: string | null;
  noIndex?: boolean;
};

const seoColumns = (input: SeoFields) => ({
  seoTitleAr: input.seoTitleAr ?? null,
  seoTitleEn: input.seoTitleEn ?? null,
  seoDescriptionAr: input.seoDescriptionAr ?? null,
  seoDescriptionEn: input.seoDescriptionEn ?? null,
  ogMediaId: input.ogMediaId ?? null,
  noIndex: input.noIndex ?? false,
});

const lifecycleColumns = (input: ContentInputBase & { translationStatus?: TranslationStatus }) => ({
  status: input.status ?? ('draft' as ContentStatus),
  translationStatus: input.translationStatus ?? ('ar_only' as TranslationStatus),
});

type MediaLink = { mediaId: string; displayOrder?: number };

/**
 * Replaces a media junction wholesale — see `project.service.ts` for why a
 * delta would make removing the last item impossible.
 *
 * The three junction tables are structurally identical but name their owner
 * column differently, and Drizzle's insert types are per-table, so the branch
 * is on the table itself rather than on a column name passed as a string.
 */
async function replaceMedia(
  tx: Tx,
  table: typeof postMedia | typeof storyMedia | typeof programMedia,
  ownerId: string,
  media: MediaLink[] | undefined,
): Promise<void> {
  if (!media) return;
  const ordered = (m: MediaLink, i: number) => m.displayOrder ?? i;

  if (table === postMedia) {
    await tx.delete(postMedia).where(eq(postMedia.postId, ownerId));
    if (media.length) {
      await tx.insert(postMedia).values(
        media.map((m, i) => ({ postId: ownerId, mediaId: m.mediaId, displayOrder: ordered(m, i) })),
      );
    }
    return;
  }

  if (table === storyMedia) {
    await tx.delete(storyMedia).where(eq(storyMedia.storyId, ownerId));
    if (media.length) {
      await tx.insert(storyMedia).values(
        media.map((m, i) => ({ storyId: ownerId, mediaId: m.mediaId, displayOrder: ordered(m, i) })),
      );
    }
    return;
  }

  await tx.delete(programMedia).where(eq(programMedia.programId, ownerId));
  if (media.length) {
    await tx.insert(programMedia).values(
      media.map((m, i) => ({ programId: ownerId, mediaId: m.mediaId, displayOrder: ordered(m, i) })),
    );
  }
}

// ── Posts ────────────────────────────────────────────────────────────────

export type PostInput = ContentInputBase &
  SeoFields & {
    category?: PostCategory;
    excerptAr?: string | null;
    excerptEn?: string | null;
    bodyAr?: RichText | null;
    bodyEn?: RichText | null;
    programId?: string | null;
    projectId?: string | null;
    heroMediaId?: string | null;
    expiresAt?: Date | null;
    isFeatured?: boolean;
    translationStatus?: TranslationStatus;
    media?: MediaLink[];
  };

export const postService = createContentService<PostInput>({
  table: posts,
  entityType: 'post',
  toColumns: (input, slugs) => ({
    ...lifecycleColumns(input),
    ...slugs,
    category: input.category ?? 'news',
    titleAr: input.titleAr,
    titleEn: input.titleEn ?? null,
    excerptAr: input.excerptAr ?? null,
    excerptEn: input.excerptEn ?? null,
    bodyAr: input.bodyAr ?? null,
    bodyEn: input.bodyEn ?? null,
    programId: input.programId ?? null,
    projectId: input.projectId ?? null,
    heroMediaId: input.heroMediaId ?? null,
    expiresAt: input.expiresAt ?? null,
    isFeatured: input.isFeatured ?? false,
    ...seoColumns(input),
  }),
  mediaIds: (input) => [
    input.heroMediaId,
    input.ogMediaId,
    ...(input.media?.map((m) => m.mediaId) ?? []),
  ],
  afterWrite: (tx, id, input) => replaceMedia(tx, postMedia, id, input.media),
  storedMediaIds: async (tx, row) => {
    const links = await tx
      .select({ mediaId: postMedia.mediaId })
      .from(postMedia)
      .where(eq(postMedia.postId, row.id));
    return [
      row.heroMediaId as string | null,
      row.ogMediaId as string | null,
      ...links.map((l) => l.mediaId),
    ];
  },
});

// ── Stories ──────────────────────────────────────────────────────────────

export type StoryInput = ContentInputBase &
  SeoFields & {
    programId?: string | null;
    projectId?: string | null;
    summaryAr?: string | null;
    summaryEn?: string | null;
    bodyAr?: RichText | null;
    bodyEn?: RichText | null;
    quoteTextAr?: string | null;
    quoteTextEn?: string | null;
    quoteAttributionAr?: string | null;
    quoteAttributionEn?: string | null;
    subjectAnonymized?: boolean;
    consentObtained?: boolean;
    consentReference?: string | null;
    heroMediaId?: string | null;
    isFeatured?: boolean;
    translationStatus?: TranslationStatus;
    media?: MediaLink[];
  };

export const storyService = createContentService<StoryInput>({
  table: stories,
  entityType: 'story',
  toColumns: (input, slugs) => {
    // A story that names or shows its subject needs a recorded consent
    // reference, checked here rather than at publish time so an editor cannot
    // save an identified story and forget what it is waiting on.
    assertStoryConsent({
      subjectAnonymized: input.subjectAnonymized ?? true,
      consentObtained: input.consentObtained ?? false,
      consentReference: input.consentReference ?? null,
    });

    return {
      ...lifecycleColumns(input),
      ...slugs,
      programId: input.programId ?? null,
      projectId: input.projectId ?? null,
      titleAr: input.titleAr,
      titleEn: input.titleEn ?? null,
      summaryAr: input.summaryAr ?? null,
      summaryEn: input.summaryEn ?? null,
      bodyAr: input.bodyAr ?? null,
      bodyEn: input.bodyEn ?? null,
      quoteTextAr: input.quoteTextAr ?? null,
      quoteTextEn: input.quoteTextEn ?? null,
      quoteAttributionAr: input.quoteAttributionAr ?? null,
      quoteAttributionEn: input.quoteAttributionEn ?? null,
      subjectAnonymized: input.subjectAnonymized ?? true,
      consentObtained: input.consentObtained ?? false,
      consentReference: input.consentReference ?? null,
      heroMediaId: input.heroMediaId ?? null,
      isFeatured: input.isFeatured ?? false,
      ...seoColumns(input),
    };
  },
  mediaIds: (input) => [
    input.heroMediaId,
    input.ogMediaId,
    ...(input.media?.map((m) => m.mediaId) ?? []),
  ],
  afterWrite: (tx, id, input) => replaceMedia(tx, storyMedia, id, input.media),
  storedMediaIds: async (tx, row) => {
    const links = await tx
      .select({ mediaId: storyMedia.mediaId })
      .from(storyMedia)
      .where(eq(storyMedia.storyId, row.id));
    return [
      row.heroMediaId as string | null,
      row.ogMediaId as string | null,
      ...links.map((l) => l.mediaId),
    ];
  },
});

// ── Programmes ───────────────────────────────────────────────────────────

export type ProgramInput = ContentInputBase &
  SeoFields & {
    key: ProgramKey;
    taglineAr?: string | null;
    taglineEn?: string | null;
    accentToken?: string;
    introductionAr?: RichText | null;
    introductionEn?: RichText | null;
    rationaleAr?: RichText | null;
    rationaleEn?: RichText | null;
    strategicObjectiveAr?: string | null;
    strategicObjectiveEn?: string | null;
    specificObjectives?: unknown[];
    keyInterventions?: unknown[];
    sustainabilityAr?: RichText | null;
    sustainabilityEn?: RichText | null;
    impactStatementAr?: RichText | null;
    impactStatementEn?: RichText | null;
    eligibilityAr?: RichText | null;
    eligibilityEn?: RichText | null;
    howToAccessAr?: RichText | null;
    howToAccessEn?: RichText | null;
    targetGroups?: TargetGroup[];
    heroMediaId?: string | null;
    displayOrder?: number;
    translationStatus?: TranslationStatus;
    media?: MediaLink[];
  };

export const programService = createContentService<ProgramInput>({
  table: programs,
  entityType: 'program',
  toColumns: (input, slugs, existing) => ({
    ...lifecycleColumns(input),
    ...slugs,
    key: input.key,
    titleAr: input.titleAr,
    titleEn: input.titleEn ?? null,
    taglineAr: input.taglineAr ?? null,
    taglineEn: input.taglineEn ?? null,
    // Not on the form — the token follows the programme key and is set once
    // at seed time. Kept as stored rather than reset to the first programme's
    // colour on every save.
    accentToken: keep(input.accentToken, existing, 'accentToken', '--color-prog-protection'),
    introductionAr: input.introductionAr ?? null,
    introductionEn: input.introductionEn ?? null,
    rationaleAr: input.rationaleAr ?? null,
    rationaleEn: input.rationaleEn ?? null,
    strategicObjectiveAr: input.strategicObjectiveAr ?? null,
    strategicObjectiveEn: input.strategicObjectiveEn ?? null,
    // Structured arrays with no editor yet (05-ADMIN §3 `ArrayField`); kept
    // as stored until one exists, so a save does not empty them.
    specificObjectives: keep(input.specificObjectives, existing, 'specificObjectives', []),
    keyInterventions: keep(input.keyInterventions, existing, 'keyInterventions', []),
    sustainabilityAr: input.sustainabilityAr ?? null,
    sustainabilityEn: input.sustainabilityEn ?? null,
    impactStatementAr: input.impactStatementAr ?? null,
    impactStatementEn: input.impactStatementEn ?? null,
    eligibilityAr: input.eligibilityAr ?? null,
    eligibilityEn: input.eligibilityEn ?? null,
    howToAccessAr: input.howToAccessAr ?? null,
    howToAccessEn: input.howToAccessEn ?? null,
    targetGroups: input.targetGroups ?? [],
    heroMediaId: input.heroMediaId ?? null,
    displayOrder: input.displayOrder ?? 0,
    ...seoColumns(input),
  }),
  mediaIds: (input) => [
    input.heroMediaId,
    input.ogMediaId,
    ...(input.media?.map((m) => m.mediaId) ?? []),
  ],
  afterWrite: (tx, id, input) => replaceMedia(tx, programMedia, id, input.media),
});

// ── Vacancies ────────────────────────────────────────────────────────────

export type VacancyInput = ContentInputBase &
  SeoFields & {
    type?: VacancyType;
    locationAr?: string | null;
    locationEn?: string | null;
    employmentType?: string | null;
    descriptionAr?: RichText | null;
    descriptionEn?: RichText | null;
    requirementsAr?: RichText | null;
    requirementsEn?: RichText | null;
    /** `YYYY-MM-DD`. Not optional — a vacancy without one never closes. */
    deadline: string;
    applicationMethod?: 'form' | 'email';
    applicationEmail?: string | null;
    postedAt?: string;
    translationStatus?: TranslationStatus;
  };

export const vacancyService = createContentService<VacancyInput>({
  table: vacancies,
  entityType: 'vacancy',
  toColumns: (input, slugs) => ({
    ...lifecycleColumns(input),
    ...slugs,
    type: input.type ?? 'job',
    titleAr: input.titleAr,
    titleEn: input.titleEn ?? null,
    locationAr: input.locationAr ?? null,
    locationEn: input.locationEn ?? null,
    employmentType: input.employmentType ?? null,
    descriptionAr: input.descriptionAr ?? null,
    descriptionEn: input.descriptionEn ?? null,
    requirementsAr: input.requirementsAr ?? null,
    requirementsEn: input.requirementsEn ?? null,
    deadline: input.deadline,
    applicationMethod: input.applicationMethod ?? 'form',
    applicationEmail: input.applicationEmail ?? null,
    ...(input.postedAt ? { postedAt: input.postedAt } : {}),
    ...seoColumns(input),
  }),
  mediaIds: (input) => [input.ogMediaId],
});

// ── Publications ─────────────────────────────────────────────────────────

export type PublicationInput = ContentInputBase & {
  type?: PublicationType;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  fileArId?: string | null;
  fileEnId?: string | null;
  publishedYear?: number | null;
  isFeatured?: boolean;
  displayOrder?: number;
  translationStatus?: TranslationStatus;
};

export const publicationService = createContentService<PublicationInput>({
  table: publications,
  entityType: 'publication',
  toColumns: (input, slugs) => ({
    ...lifecycleColumns(input),
    ...slugs,
    type: input.type ?? 'report',
    titleAr: input.titleAr,
    titleEn: input.titleEn ?? null,
    descriptionAr: input.descriptionAr ?? null,
    descriptionEn: input.descriptionEn ?? null,
    fileArId: input.fileArId ?? null,
    fileEnId: input.fileEnId ?? null,
    publishedYear: input.publishedYear ?? null,
    isFeatured: input.isFeatured ?? false,
    displayOrder: input.displayOrder ?? 0,
  }),
  mediaIds: (input) => [input.fileArId, input.fileEnId],
  storedMediaIds: async (_tx, row) => [
    row.fileArId as string | null,
    row.fileEnId as string | null,
  ],
});

// ── Generic pages ────────────────────────────────────────────────────────

export type PageInput = ContentInputBase &
  SeoFields & {
    key: string;
    bodyAr?: RichText | null;
    bodyEn?: RichText | null;
    translationStatus?: TranslationStatus;
  };

export const pageService = createContentService<PageInput>({
  table: pages,
  entityType: 'page',
  toColumns: (input, slugs) => ({
    ...lifecycleColumns(input),
    ...slugs,
    key: input.key,
    titleAr: input.titleAr,
    titleEn: input.titleEn ?? null,
    bodyAr: input.bodyAr ?? null,
    bodyEn: input.bodyEn ?? null,
    ...seoColumns(input),
  }),
  mediaIds: (input) => [input.ogMediaId],
});
