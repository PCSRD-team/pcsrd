import { pgEnum } from 'drizzle-orm/pg-core';

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
