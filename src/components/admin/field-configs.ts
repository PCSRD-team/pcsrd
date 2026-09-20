import { ADMIN_OPTIONS } from '@/lib/admin-options';
import { adminUi } from './admin-ui-dict';
import type { FieldSpec } from './content-form';

/**
 * One config per entity — the payoff of the generic form layer.
 *
 * These are the screens. Adding an entity means adding an entry here and a
 * route that renders `ContentForm` with it, not designing another editor.
 *
 * **Structure lives here; words do not.** Which control, which name, which
 * limit, which enum — that is configuration. Every label and hint is read from
 * `adminUi.fields` (RULE 5), so a rename is a dictionary edit and the admin
 * stays translatable even though it renders Arabic today.
 */

const f = adminUi.fields;

const SLUG: FieldSpec = {
  kind: 'bilingual',
  name: 'slug',
  label: f.common.slug,
  required: true,
  hint: f.common.slugHint,
};

/** Programme / project options for the relation selects, loaded per page. */
export type RelationOptions = {
  programs: { value: string; label: string }[];
  projects: { value: string; label: string }[];
};

const GALLERY: FieldSpec = {
  kind: 'gallery',
  name: 'gallery',
  label: f.common.gallery,
  hint: f.common.galleryHint,
};

const relationFields = (options: RelationOptions): FieldSpec[] => [
  { kind: 'select', name: 'programId', label: f.common.program, options: options.programs },
  { kind: 'select', name: 'projectId', label: f.common.project, options: options.projects },
];

export const postFields = (options: RelationOptions): FieldSpec[] => [
  { kind: 'bilingual', name: 'title', label: f.common.title, required: true, max: 200 },
  SLUG,
  {
    kind: 'select',
    name: 'category',
    label: f.common.category,
    options: [...ADMIN_OPTIONS.postCategory],
    required: true,
  },
  { kind: 'bilingual', name: 'excerpt', label: f.post.excerpt, multiline: true, max: 400 },
  { kind: 'richtext', name: 'body', labelAr: f.common.bodyAr, labelEn: f.common.bodyEn },
  ...relationFields(options),
  { kind: 'media', name: 'heroMediaId', label: f.common.heroMedia },
  GALLERY,
  {
    kind: 'text',
    name: 'expiresAt',
    label: f.post.expiresAt,
    type: 'date',
    // The archive cron reads this. Only announcements may carry one — the
    // `posts_expiry_only_announcements` constraint refuses it on a news item.
    hint: f.post.expiresAtHint,
  },
  { kind: 'checkbox', name: 'isFeatured', label: f.common.featured },
];

export const storyFields = (options: RelationOptions): FieldSpec[] => [
  { kind: 'bilingual', name: 'title', label: f.common.title, required: true, max: 200 },
  SLUG,
  { kind: 'bilingual', name: 'summary', label: f.common.summary, multiline: true, max: 600 },
  { kind: 'richtext', name: 'body', labelAr: f.common.bodyAr, labelEn: f.common.bodyEn },
  ...relationFields(options),
  { kind: 'bilingual', name: 'quoteText', label: f.story.quoteText, multiline: true, max: 400 },
  { kind: 'bilingual', name: 'quoteAttribution', label: f.story.quoteAttribution, max: 120 },
  {
    kind: 'checkbox',
    name: 'subjectAnonymized',
    label: f.story.subjectAnonymized,
    // Default-on, and the form says what turning it off costs.
    hint: f.story.subjectAnonymizedHint,
  },
  { kind: 'checkbox', name: 'consentObtained', label: f.story.consentObtained },
  {
    kind: 'text',
    name: 'consentReference',
    label: f.common.consentReference,
    hint: f.story.consentReferenceHint,
  },
  { kind: 'media', name: 'heroMediaId', label: f.common.heroMedia },
  GALLERY,
  { kind: 'checkbox', name: 'isFeatured', label: f.story.featured },
];

export const VACANCY_FIELDS: FieldSpec[] = [
  { kind: 'bilingual', name: 'title', label: f.vacancy.title, required: true, max: 200 },
  SLUG,
  {
    kind: 'select',
    name: 'type',
    label: f.common.type,
    options: [...ADMIN_OPTIONS.vacancyType],
    required: true,
  },
  { kind: 'bilingual', name: 'location', label: f.vacancy.location, max: 120 },
  {
    kind: 'select',
    name: 'employmentType',
    label: f.vacancy.employmentType,
    options: [
      { value: 'FULL_TIME', label: adminUi.enums.employmentType.FULL_TIME },
      { value: 'PART_TIME', label: adminUi.enums.employmentType.PART_TIME },
      { value: 'VOLUNTEER', label: adminUi.enums.employmentType.VOLUNTEER },
    ],
  },
  {
    kind: 'richtext',
    name: 'description',
    labelAr: f.vacancy.descriptionAr,
    labelEn: f.vacancy.descriptionEn,
  },
  {
    kind: 'richtext',
    name: 'requirements',
    labelAr: f.vacancy.requirementsAr,
    labelEn: f.vacancy.requirementsEn,
  },
  {
    kind: 'text',
    name: 'deadline',
    label: f.vacancy.deadline,
    type: 'date',
    required: true,
    // Not optional anywhere in the system: the column is `not null` and the
    // daily archive job depends on every row having one.
    hint: f.vacancy.deadlineHint,
  },
  {
    kind: 'select',
    name: 'applicationMethod',
    label: f.vacancy.applicationMethod,
    options: [
      { value: 'form', label: adminUi.enums.applicationMethod.form },
      { value: 'email', label: adminUi.enums.applicationMethod.email },
    ],
  },
  {
    kind: 'text',
    name: 'applicationEmail',
    label: f.vacancy.applicationEmail,
    type: 'email',
    hint: f.vacancy.applicationEmailHint,
  },
  {
    // The public vacancy page renders this as the posting date. Without a
    // control it was whatever day the *draft* was created and there was no way
    // to correct it. Blank keeps the stored value — the service writes the
    // column only when a date arrives.
    kind: 'text',
    name: 'postedAt',
    label: f.vacancy.postedAt,
    type: 'date',
    hint: f.vacancy.postedAtHint,
  },
];

export const PUBLICATION_FIELDS: FieldSpec[] = [
  { kind: 'bilingual', name: 'title', label: f.common.title, required: true, max: 200 },
  SLUG,
  {
    kind: 'select',
    name: 'type',
    label: f.common.type,
    options: [...ADMIN_OPTIONS.publicationType],
    required: true,
  },
  { kind: 'bilingual', name: 'description', label: f.common.description, multiline: true, max: 800 },
  { kind: 'media', name: 'fileArId', label: f.publication.fileAr, assetKind: 'document' },
  {
    kind: 'media',
    name: 'fileEnId',
    label: f.publication.fileEn,
    assetKind: 'document',
    hint: f.publication.fileEnHint,
  },
  { kind: 'text', name: 'publishedYear', label: f.publication.publishedYear, type: 'number' },
  { kind: 'checkbox', name: 'isFeatured', label: f.common.featured },
  { kind: 'text', name: 'displayOrder', label: f.common.displayOrder, type: 'number' },
];

export const PAGE_FIELDS: FieldSpec[] = [
  {
    kind: 'text',
    name: 'key',
    label: f.page.key,
    required: true,
    hint: f.page.keyHint,
  },
  { kind: 'bilingual', name: 'title', label: f.common.title, required: true, max: 200 },
  SLUG,
  { kind: 'richtext', name: 'body', labelAr: f.common.bodyAr, labelEn: f.common.bodyEn },
];

export const PROGRAM_FIELDS: FieldSpec[] = [
  {
    kind: 'select',
    name: 'key',
    label: f.program.key,
    options: [...ADMIN_OPTIONS.programKey],
    required: true,
    hint: f.program.keyHint,
  },
  { kind: 'bilingual', name: 'title', label: f.program.title, required: true, max: 200 },
  SLUG,
  {
    kind: 'bilingual',
    name: 'tagline',
    label: f.program.tagline,
    max: 200,
    hint: f.program.taglineHint,
  },
  {
    kind: 'select',
    name: 'targetGroups',
    label: f.program.targetGroups,
    options: [...ADMIN_OPTIONS.targetGroup],
    multiple: true,
  },
  {
    kind: 'richtext',
    name: 'introduction',
    labelAr: f.program.introductionAr,
    labelEn: f.program.introductionEn,
  },
  {
    kind: 'richtext',
    name: 'eligibility',
    labelAr: f.program.eligibilityAr,
    labelEn: f.program.eligibilityEn,
  },
  {
    kind: 'richtext',
    name: 'howToAccess',
    labelAr: f.program.howToAccessAr,
    labelEn: f.program.howToAccessEn,
  },
  {
    kind: 'richtext',
    name: 'rationale',
    labelAr: f.program.rationaleAr,
    labelEn: f.program.rationaleEn,
  },
  {
    kind: 'richtext',
    name: 'impactStatement',
    labelAr: f.program.impactStatementAr,
    labelEn: f.program.impactStatementEn,
  },
  {
    kind: 'richtext',
    name: 'sustainability',
    labelAr: f.program.sustainabilityAr,
    labelEn: f.program.sustainabilityEn,
  },
  {
    kind: 'bilingual',
    name: 'strategicObjective',
    label: f.program.strategicObjective,
    multiline: true,
    max: 600,
  },
  {
    kind: 'media',
    name: 'heroMediaId',
    label: f.program.heroMedia,
    hint: f.program.heroMediaHint,
  },
  GALLERY,
  {
    kind: 'text',
    name: 'displayOrder',
    label: f.program.displayOrder,
    type: 'number',
    hint: f.program.displayOrderHint,
  },
];

// ── Catalogue entities (STATE-006) ───────────────────────────────────────
// Partners carry a `status` and use the publish bar; people and impact figures
// have no lifecycle — `isPublic` is the decision — and use the single save
// button (`bar="save"`), which also keeps the metric's own `status` select
// from colliding with the bar's `status` buttons.

export const PARTNER_FIELDS: FieldSpec[] = [
  { kind: 'bilingual', name: 'name', label: f.common.name, required: true, max: 160 },
  {
    kind: 'select',
    name: 'type',
    label: f.common.type,
    options: [...ADMIN_OPTIONS.partnerType],
    required: true,
  },
  {
    kind: 'select',
    name: 'membershipLevel',
    label: f.partner.membershipLevel,
    options: [...ADMIN_OPTIONS.membershipLevel],
    hint: f.partner.membershipLevelHint,
  },
  { kind: 'bilingual', name: 'sector', label: f.partner.sector, max: 120 },
  { kind: 'bilingual', name: 'description', label: f.common.description, multiline: true, max: 800 },
  {
    kind: 'text',
    name: 'website',
    label: f.partner.website,
    hint: f.partner.websiteHint,
  },
  { kind: 'media', name: 'logoMediaId', label: f.partner.logoMedia },
  {
    kind: 'select',
    name: 'logoPermission',
    label: f.partner.logoPermission,
    options: [...ADMIN_OPTIONS.logoPermission],
    required: true,
    // The public site renders the logo only when this is `granted`; a
    // published partner with a pending permission appears by name alone.
    hint: f.partner.logoPermissionHint,
  },
  { kind: 'checkbox', name: 'isFeatured', label: f.common.featured },
  { kind: 'text', name: 'displayOrder', label: f.common.displayOrder, type: 'number' },
];

export const PERSON_FIELDS: FieldSpec[] = [
  { kind: 'bilingual', name: 'name', label: f.common.name, required: true, max: 120 },
  { kind: 'bilingual', name: 'role', label: f.person.role, required: true, max: 120 },
  {
    kind: 'select',
    name: 'category',
    label: f.person.category,
    options: [...ADMIN_OPTIONS.personCategory],
    required: true,
  },
  { kind: 'bilingual', name: 'bio', label: f.person.bio, multiline: true, max: 1200 },
  { kind: 'media', name: 'photoMediaId', label: f.person.photo },
  {
    kind: 'checkbox',
    name: 'isPublic',
    label: f.person.isPublic,
    // DNH-5. Naming staff in Gaza is a safety decision made per person.
    hint: f.person.isPublicHint,
  },
  { kind: 'text', name: 'displayOrder', label: f.common.displayOrder, type: 'number' },
];

/**
 * Impact figures take their programme and project options at render time —
 * the relations are rows, not enums — so this is a function of those options
 * rather than a constant.
 */
export function metricFields(options: {
  programs: { value: string; label: string }[];
  projects: { value: string; label: string }[];
}): FieldSpec[] {
  return [
    { kind: 'bilingual', name: 'label', label: f.metric.label, required: true, max: 160 },
    {
      kind: 'text',
      name: 'value',
      label: f.metric.value,
      required: true,
      hint: f.metric.valueHint,
    },
    { kind: 'text', name: 'unit', label: f.metric.unit, required: true, hint: f.metric.unitHint },
    {
      kind: 'select',
      name: 'displayPrefix',
      label: f.metric.displayPrefix,
      options: [
        { value: '+', label: adminUi.enums.metricPrefix['+'] },
        { value: '~', label: adminUi.enums.metricPrefix['~'] },
      ],
    },
    { kind: 'select', name: 'programId', label: f.common.program, options: options.programs },
    { kind: 'select', name: 'projectId', label: f.common.project, options: options.projects },
    { kind: 'text', name: 'periodStart', label: f.metric.periodStart, type: 'date', required: true },
    { kind: 'text', name: 'periodEnd', label: f.metric.periodEnd, type: 'date', required: true },
    {
      kind: 'select',
      name: 'status',
      label: f.metric.status,
      options: [...ADMIN_OPTIONS.metricStatus],
      required: true,
      // The rule: no published figure without its period and verification
      // status. `assertMetricPublishable` refuses `isPublic` on anything but
      // `verified` with a source.
      hint: f.metric.statusHint,
    },
    {
      kind: 'text',
      name: 'verificationSource',
      label: f.metric.verificationSource,
      hint: f.metric.verificationSourceHint,
    },
    { kind: 'checkbox', name: 'isPublic', label: f.metric.isPublic },
    { kind: 'checkbox', name: 'isFeatured', label: f.common.featured },
    { kind: 'text', name: 'displayOrder', label: f.common.displayOrder, type: 'number' },
  ];
}

/** Media metadata. `alt_ar` is required at every layer; this is the first. */
export const MEDIA_FIELDS: FieldSpec[] = [
  { kind: 'bilingual', name: 'alt', label: f.media.alt, required: true, max: 300 },
  { kind: 'bilingual', name: 'caption', label: f.media.caption, multiline: true, max: 500 },
  { kind: 'text', name: 'credit', label: f.media.credit },
  {
    kind: 'select',
    name: 'consent',
    label: f.media.consent,
    options: [...ADMIN_OPTIONS.consentStatus],
    required: true,
    hint: f.media.consentHint,
  },
  {
    kind: 'text',
    name: 'consentReference',
    label: f.common.consentReference,
    hint: f.media.consentReferenceHint,
  },
  {
    // `chk_media_minor_consent` in the database: this may be on only when
    // consent is `obtained` with a reference. The order of the fields above
    // is the order the editor has to fill them in.
    kind: 'checkbox',
    name: 'hasIdentifiableMinors',
    label: f.media.minors,
    hint: f.media.minorsHint,
  },
];
