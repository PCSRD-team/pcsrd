import {
  pgEnum,
} from 'drizzle-orm/pg-core';

/**
 * Every enum in `public`, mirroring the live database (01-DATABASE §2).
 *
 * Each one exports a derived TypeScript union next to it. Zod schemas and
 * dictionaries read that union rather than restating the members, so a value
 * added here cannot drift out of sync with validation.
 */

// ── Content lifecycle ──────────────────────────────────────────────────
export const localeCode = pgEnum('locale_code', ['ar', 'en']);
export type LocaleCode = (typeof localeCode.enumValues)[number];

export const contentStatus = pgEnum('content_status', [
  'draft',
  'in_review',
  'published',
  'archived',
]);
export type ContentStatus = (typeof contentStatus.enumValues)[number];

export const translationStatus = pgEnum('translation_status', [
  'ar_only',
  'machine_draft',
  'human_translated',
  'reviewed',
]);
export type TranslationStatus = (typeof translationStatus.enumValues)[number];

export const userRole = pgEnum('user_role', ['admin', 'content_manager', 'editor']);
export type UserRole = (typeof userRole.enumValues)[number];

// ── Programme domain ───────────────────────────────────────────────────
export const programKey = pgEnum('program_key', [
  'protection',
  'humanitarian_response',
  'early_recovery',
]);
export type ProgramKey = (typeof programKey.enumValues)[number];

export const projectStatus = pgEnum('project_status', ['planned', 'active', 'completed']);
export type ProjectStatus = (typeof projectStatus.enumValues)[number];

export const governorate = pgEnum('governorate', [
  'north_gaza',
  'gaza',
  'middle',
  'khan_younis',
  'rafah',
]);
export type Governorate = (typeof governorate.enumValues)[number];

export const themeTag = pgEnum('theme_tag', [
  'women',
  'children',
  'youth_adolescents',
  'psychosocial_health',
  'relief',
]);
export type ThemeTag = (typeof themeTag.enumValues)[number];

export const targetGroup = pgEnum('target_group', [
  'children',
  'youth',
  'women',
  'poor_families',
  'elderly',
  'pwd',
]);
export type TargetGroup = (typeof targetGroup.enumValues)[number];

// ── Partners ───────────────────────────────────────────────────────────
export const partnerType = pgEnum('partner_type', [
  'implementing',
  'donor',
  'network',
  'membership',
]);
export type PartnerType = (typeof partnerType.enumValues)[number];

/** Role *within a project* — narrower than `partner_type` on purpose. */
export const partnerRole = pgEnum('partner_role', ['implementing', 'donor']);
export type PartnerRole = (typeof partnerRole.enumValues)[number];

export const membershipLevel = pgEnum('membership_level', ['full', 'observer']);
export type MembershipLevel = (typeof membershipLevel.enumValues)[number];

export const logoPermission = pgEnum('logo_permission', ['granted', 'pending', 'denied']);
export type LogoPermission = (typeof logoPermission.enumValues)[number];

// ── Content types ──────────────────────────────────────────────────────
export const postCategory = pgEnum('post_category', ['news', 'statement', 'announcement']);
export type PostCategory = (typeof postCategory.enumValues)[number];

export const vacancyType = pgEnum('vacancy_type', ['job', 'volunteer']);
export type VacancyType = (typeof vacancyType.enumValues)[number];

export const metricStatus = pgEnum('metric_status', ['target', 'reported', 'verified']);
export type MetricStatus = (typeof metricStatus.enumValues)[number];

export const personCategory = pgEnum('person_category', ['board', 'executive', 'staff']);
export type PersonCategory = (typeof personCategory.enumValues)[number];

export const publicationType = pgEnum('publication_type', [
  'report',
  'policy',
  'profile',
  'strategy',
  'evaluation',
  'other',
]);
export type PublicationType = (typeof publicationType.enumValues)[number];

export const mediaKind = pgEnum('media_kind', ['image', 'video', 'document']);
export type MediaKind = (typeof mediaKind.enumValues)[number];

export const consentStatus = pgEnum('consent_status', [
  'not_required',
  'obtained',
  'pending',
]);
export type ConsentStatus = (typeof consentStatus.enumValues)[number];

// ── Submissions ────────────────────────────────────────────────────────
export const submissionType = pgEnum('submission_type', [
  'partnership',
  'contact',
  'volunteer',
  'job',
  'complaint',
  'fraud_report',
]);
export type SubmissionType = (typeof submissionType.enumValues)[number];

export const submissionState = pgEnum('submission_state', [
  'new',
  'in_progress',
  'handled',
  'archived',
]);
export type SubmissionState = (typeof submissionState.enumValues)[number];

// ── Careers portal ─────────────────────────────────────────────────────

/**
 * What an application form is *for*.
 *
 * Wider than `vacancy_type` on purpose. A vacancy is a job or a volunteer
 * position; a form may also stand alone — an internship intake, a training
 * cohort, a consultancy roster — with no vacancy row behind it at all.
 */
export const applicationFormKind = pgEnum('application_form_kind', [
  'job',
  'volunteer',
  'internship',
  'training',
  'consultancy',
  'other',
]);
export type ApplicationFormKind = (typeof applicationFormKind.enumValues)[number];

/**
 * The control a form field renders as.
 *
 * `section` renders no control at all — it is a heading with optional prose,
 * so a long form reads as a set of parts rather than forty inputs in a
 * column. It is a field type rather than a separate table because it has to
 * take part in the same ordering.
 *
 * `checkbox` is one box (a consent tick); `multi_select` is a group of them.
 * They are separate because their stored values differ — boolean against an
 * array — and collapsing them would make the export ambiguous.
 */
export const applicationFieldType = pgEnum('application_field_type', [
  'short_text',
  'long_text',
  'email',
  'phone',
  'number',
  'date',
  'select',
  'radio',
  'multi_select',
  'checkbox',
  'file',
  'section',
]);
export type ApplicationFieldType = (typeof applicationFieldType.enumValues)[number];

/**
 * Where an applicant is in the pipeline.
 *
 * `withdrawn` is the applicant's own decision and `rejected` is the
 * organisation's; keeping them apart is what makes the funnel figures honest.
 */
export const applicationStatus = pgEnum('application_status', [
  'new',
  'under_review',
  'shortlisted',
  'interview',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
]);
export type ApplicationStatus = (typeof applicationStatus.enumValues)[number];

/** What happens once `capacity` is reached: refuse, or keep taking names. */
export const applicationCapacityRule = pgEnum('application_capacity_rule', [
  'close',
  'waitlist',
]);
export type ApplicationCapacityRule = (typeof applicationCapacityRule.enumValues)[number];
