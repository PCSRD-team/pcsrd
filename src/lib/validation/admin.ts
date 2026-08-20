import { z } from 'zod';
import type { RichText, RichTextNode } from '@/db/schema/_shared';
import {
  consentStatus,
  contentStatus,
  governorate,
  logoPermission,
  membershipLevel,
  mediaKind,
  metricStatus,
  partnerRole,
  partnerType,
  personCategory,
  postCategory,
  programKey,
  projectStatus,
  publicationType,
  targetGroup,
  themeTag,
  translationStatus,
  vacancyType,
} from '@/db/schema/enums';
import { optionalText, shortText, slugSchema } from './common';

/**
 * Admin input schemas.
 *
 * Every enum is derived from its `pgEnum` rather than restated, so a value
 * added to the database cannot fall out of sync with what the form accepts —
 * the mismatch would otherwise surface as a runtime constraint violation
 * instead of a type error.
 */

const enumOf = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values);

const status = enumOf(contentStatus.enumValues).default('draft');
const translation = enumOf(translationStatus.enumValues).default('ar_only');

/**
 * A TipTap document.
 *
 * Validated recursively rather than as `unknown[]`. The looser version would
 * typecheck and then hand the renderer a tree it cannot walk — and since the
 * document arrives from a rich-text editor running in the browser, "the editor
 * produced it" is not a guarantee about its shape.
 */
const richTextNode: z.ZodType<RichTextNode> = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(richTextNode).optional(),
    marks: z
      .array(z.object({ type: z.string(), attrs: z.record(z.string(), z.unknown()).optional() }))
      .optional(),
    text: z.string().optional(),
  }),
);

const richText: z.ZodType<RichText | null | undefined> = z
  .object({ type: z.literal('doc'), content: z.array(richTextNode).optional() })
  .nullable()
  .optional();

const uuid = z.uuid({ message: 'errors.field.uuid' });
const optionalUuid = z.union([uuid, z.literal('')]).nullable().optional();

const seo = {
  seoTitleAr: optionalText(120).nullable(),
  seoTitleEn: optionalText(120).nullable(),
  seoDescriptionAr: optionalText(300).nullable(),
  seoDescriptionEn: optionalText(300).nullable(),
  ogMediaId: optionalUuid,
  noIndex: z.coerce.boolean().default(false),
};

const base = {
  id: uuid.optional(),
  titleAr: shortText(2, 200),
  titleEn: optionalText(200).nullable(),
  slugAr: z.union([slugSchema, z.literal('')]).nullable().optional(),
  slugEn: z.union([slugSchema, z.literal('')]).nullable().optional(),
  status,
  translationStatus: translation,
};

const mediaLink = z.object({
  mediaId: uuid,
  displayOrder: z.coerce.number().int().min(0).optional(),
});

// ── Projects ─────────────────────────────────────────────────────────────

export const projectSchema = z.object({
  ...base,
  ...seo,
  programId: uuid,
  summaryAr: optionalText(600).nullable(),
  summaryEn: optionalText(600).nullable(),
  objectiveAr: richText,
  objectiveEn: richText,
  activitiesAr: richText,
  activitiesEn: richText,
  outcomesAr: richText,
  outcomesEn: richText,
  projectState: enumOf(projectStatus.enumValues).default('active'),
  startDate: z.union([z.iso.date(), z.literal('')]).nullable().optional(),
  endDate: z.union([z.iso.date(), z.literal('')]).nullable().optional(),
  governorates: z.array(enumOf(governorate.enumValues)).default([]),
  localities: z.array(z.string().trim().min(1).max(80)).default([]),
  themes: z.array(enumOf(themeTag.enumValues)).default([]),
  heroMediaId: optionalUuid,
  isFeatured: z.coerce.boolean().default(false),
  sourceNote: optionalText(500).nullable(),
  partners: z
    .array(z.object({ partnerId: uuid, role: enumOf(partnerRole.enumValues) }))
    .optional(),
  media: z.array(mediaLink).optional(),
});

// ── Posts ────────────────────────────────────────────────────────────────

export const postSchema = z.object({
  ...base,
  ...seo,
  category: enumOf(postCategory.enumValues).default('news'),
  excerptAr: optionalText(400).nullable(),
  excerptEn: optionalText(400).nullable(),
  bodyAr: richText,
  bodyEn: richText,
  programId: optionalUuid,
  projectId: optionalUuid,
  heroMediaId: optionalUuid,
  expiresAt: z.coerce.date().nullable().optional(),
  isFeatured: z.coerce.boolean().default(false),
  media: z.array(mediaLink).optional(),
});

// ── Stories ──────────────────────────────────────────────────────────────

export const storySchema = z
  .object({
    ...base,
    ...seo,
    programId: optionalUuid,
    projectId: optionalUuid,
    summaryAr: optionalText(600).nullable(),
    summaryEn: optionalText(600).nullable(),
    bodyAr: richText,
    bodyEn: richText,
    quoteTextAr: optionalText(400).nullable(),
    quoteTextEn: optionalText(400).nullable(),
    quoteAttributionAr: optionalText(120).nullable(),
    quoteAttributionEn: optionalText(120).nullable(),
    subjectAnonymized: z.coerce.boolean().default(true),
    consentObtained: z.coerce.boolean().default(false),
    consentReference: optionalText(120).nullable(),
    heroMediaId: optionalUuid,
    isFeatured: z.coerce.boolean().default(false),
    media: z.array(mediaLink).optional(),
  })
  // The service enforces this too. Repeating it here buys the editor a field
  // error on the right input instead of a form-level failure.
  .refine(
    (v) => v.subjectAnonymized || (v.consentObtained && Boolean(v.consentReference?.trim())),
    { path: ['consentReference'], message: 'errors.story.consentRequired' },
  );

// ── Programmes ───────────────────────────────────────────────────────────

export const programSchema = z.object({
  ...base,
  ...seo,
  key: enumOf(programKey.enumValues),
  taglineAr: optionalText(200).nullable(),
  taglineEn: optionalText(200).nullable(),
  accentToken: z.string().trim().max(60).optional(),
  introductionAr: richText,
  introductionEn: richText,
  rationaleAr: richText,
  rationaleEn: richText,
  strategicObjectiveAr: optionalText(600).nullable(),
  strategicObjectiveEn: optionalText(600).nullable(),
  specificObjectives: z.array(z.unknown()).default([]),
  keyInterventions: z.array(z.unknown()).default([]),
  sustainabilityAr: richText,
  sustainabilityEn: richText,
  impactStatementAr: richText,
  impactStatementEn: richText,
  eligibilityAr: richText,
  eligibilityEn: richText,
  howToAccessAr: richText,
  howToAccessEn: richText,
  targetGroups: z.array(enumOf(targetGroup.enumValues)).default([]),
  heroMediaId: optionalUuid,
  displayOrder: z.coerce.number().int().min(0).default(0),
  media: z.array(mediaLink).optional(),
});

// ── Vacancies ────────────────────────────────────────────────────────────

export const vacancySchema = z
  .object({
    ...base,
    ...seo,
    type: enumOf(vacancyType.enumValues).default('job'),
    locationAr: optionalText(120).nullable(),
    locationEn: optionalText(120).nullable(),
    employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'VOLUNTEER']).nullable().optional(),
    descriptionAr: richText,
    descriptionEn: richText,
    requirementsAr: richText,
    requirementsEn: richText,
    /** Required. A vacancy without a deadline never closes. */
    deadline: z.iso.date({ message: 'errors.field.required' }),
    applicationMethod: z.enum(['form', 'email']).default('form'),
    applicationEmail: z.union([z.email(), z.literal('')]).nullable().optional(),
    postedAt: z.iso.date().optional(),
  })
  .refine((v) => v.applicationMethod !== 'email' || Boolean(v.applicationEmail), {
    path: ['applicationEmail'],
    message: 'errors.field.required',
  });

// ── Publications ─────────────────────────────────────────────────────────

export const publicationSchema = z.object({
  ...base,
  type: enumOf(publicationType.enumValues).default('report'),
  descriptionAr: optionalText(800).nullable(),
  descriptionEn: optionalText(800).nullable(),
  fileArId: optionalUuid,
  fileEnId: optionalUuid,
  publishedYear: z.coerce.number().int().min(1990).max(2100).nullable().optional(),
  isFeatured: z.coerce.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).default(0),
});

// ── Pages ────────────────────────────────────────────────────────────────

export const pageSchema = z.object({
  ...base,
  ...seo,
  key: z.string().trim().min(1).max(60),
  bodyAr: richText,
  bodyEn: richText,
});

// ── Partners ─────────────────────────────────────────────────────────────

export const partnerSchema = z.object({
  id: uuid.optional(),
  nameAr: shortText(2, 160),
  nameEn: optionalText(160).nullable(),
  type: enumOf(partnerType.enumValues),
  membershipLevel: enumOf(membershipLevel.enumValues).nullable().optional(),
  sectorAr: optionalText(120).nullable(),
  sectorEn: optionalText(120).nullable(),
  descriptionAr: optionalText(800).nullable(),
  descriptionEn: optionalText(800).nullable(),
  website: z.union([z.url(), z.literal('')]).nullable().optional(),
  logoMediaId: optionalUuid,
  logoPermission: enumOf(logoPermission.enumValues).default('pending'),
  isFeatured: z.coerce.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).default(0),
  status,
});

// ── People ───────────────────────────────────────────────────────────────

export const personSchema = z.object({
  id: uuid.optional(),
  nameAr: shortText(2, 120),
  nameEn: optionalText(120).nullable(),
  roleAr: shortText(2, 120),
  roleEn: optionalText(120).nullable(),
  category: enumOf(personCategory.enumValues).default('board'),
  bioAr: optionalText(1200).nullable(),
  bioEn: optionalText(1200).nullable(),
  photoMediaId: optionalUuid,
  isPublic: z.coerce.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).default(0),
});

// ── Impact metrics ───────────────────────────────────────────────────────

export const metricSchema = z
  .object({
    id: uuid.optional(),
    labelAr: shortText(2, 160),
    labelEn: optionalText(160).nullable(),
    /** Kept as a string: a float would round a beneficiary count. */
    value: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, { message: 'errors.field.number' }),
    unit: shortText(1, 40),
    displayPrefix: z.enum(['+', '~']).nullable().optional(),
    programId: optionalUuid,
    projectId: optionalUuid,
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    status: enumOf(metricStatus.enumValues),
    verificationSource: optionalText(300).nullable(),
    isPublic: z.coerce.boolean().default(false),
    isFeatured: z.coerce.boolean().default(false),
    displayOrder: z.coerce.number().int().min(0).default(0),
  })
  .refine((v) => v.periodEnd >= v.periodStart, {
    path: ['periodEnd'],
    message: 'errors.metric.periodOrder',
  });

// ── Media ────────────────────────────────────────────────────────────────

export const mediaMetadataSchema = z.object({
  kind: enumOf(mediaKind.enumValues).default('image'),
  altAr: shortText(2, 300),
  altEn: optionalText(300).nullable(),
  captionAr: optionalText(500).nullable(),
  captionEn: optionalText(500).nullable(),
  credit: optionalText(160).nullable(),
  consent: enumOf(consentStatus.enumValues).default('not_required'),
  consentReference: optionalText(120).nullable(),
  hasIdentifiableMinors: z.coerce.boolean().default(false),
});
