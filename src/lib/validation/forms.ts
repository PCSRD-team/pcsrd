import { z } from 'zod';
import {
  emailSchema,
  honeypot,
  localeSchema,
  longText,
  optionalPhone,
  optionalText,
  optionalUrl,
  phoneSchema,
  shortText,
  turnstileToken,
} from './common';

/**
 * The six public forms (02-API §5.2, §5.3).
 *
 * Kept in one module because they share nine primitives and differ in perhaps
 * five fields each; splitting them across six files would mean six identical
 * import blocks and would hide how similar they are.
 *
 * Two rules run through all of them:
 *
 * - **Minimisation.** The volunteer form asks for an age *band* and a
 *   *governorate*, never a date of birth, a national ID or a street address
 *   (20-PRIVACY §5). A field that is not collected cannot leak.
 * - **Anonymity where it matters.** Every identity field on the complaint and
 *   fraud forms is optional. A complainant who has to name themselves is a
 *   complainant who does not file.
 */

/** Present on every form, stripped before the payload is stored. */
const envelope = {
  locale: localeSchema,
  turnstileToken,
  website: honeypot,
};

// ── Partnership ──────────────────────────────────────────────────────────

export const ORGANIZATION_TYPES = [
  'un',
  'ingo',
  'foundation',
  'government',
  'local_ngo',
  'private',
  'other',
] as const;

export const PARTNERSHIP_INTERESTS = [
  'funding',
  'consortium',
  'implementation',
  'technical',
  'other',
] as const;

export const PROGRAM_KEYS = ['protection', 'humanitarian_response', 'early_recovery'] as const;

export const partnershipSchema = z.object({
  organizationName: shortText(2, 120),
  organizationType: z.enum(ORGANIZATION_TYPES),
  /** ISO 3166-1 alpha-2. */
  country: z.string().trim().length(2, { message: 'errors.field.country' }),
  contactName: shortText(2, 80),
  role: shortText(2, 80),
  email: emailSchema,
  phone: optionalPhone,
  interest: z.array(z.enum(PARTNERSHIP_INTERESTS)).min(1, { message: 'errors.field.required' }),
  programs: z.array(z.enum(PROGRAM_KEYS)).default([]),
  message: longText(20, 2000),
  ...envelope,
});
export type PartnershipInput = z.infer<typeof partnershipSchema>;

/** Fields that arrive as repeated form entries. */
export const PARTNERSHIP_MULTI = ['interest', 'programs'] as const;

// ── Contact ──────────────────────────────────────────────────────────────

export const ENQUIRY_TYPES = ['general', 'partnership', 'media', 'complaint'] as const;

export const contactSchema = z.object({
  name: shortText(2, 80),
  email: emailSchema,
  phone: optionalPhone,
  enquiryType: z.enum(ENQUIRY_TYPES).default('general'),
  subject: shortText(3, 150),
  message: longText(20, 2000),
  ...envelope,
});
export type ContactInput = z.infer<typeof contactSchema>;

// ── Volunteer ────────────────────────────────────────────────────────────

/**
 * An age *band*, not a date of birth. The only thing the organisation needs to
 * know is whether a volunteer is a minor and roughly which cohort they belong
 * to; a birth date is a permanent identifier collected for no reason.
 */
export const AGE_BANDS = ['under_18', '18_24', '25_34', '35_49', '50_plus'] as const;

export const GOVERNORATES = [
  'north_gaza',
  'gaza',
  'middle',
  'khan_younis',
  'rafah',
] as const;

export const VOLUNTEER_AREAS = [
  'psychosocial',
  'education',
  'relief_distribution',
  'media',
  'logistics',
  'administration',
  'other',
] as const;

export const AVAILABILITY = ['weekdays', 'weekends', 'evenings', 'flexible'] as const;

export const volunteerSchema = z.object({
  name: shortText(2, 80),
  email: emailSchema,
  phone: phoneSchema,
  ageBand: z.enum(AGE_BANDS),
  /** Governorate, not an address. */
  governorate: z.enum(GOVERNORATES),
  areas: z.array(z.enum(VOLUNTEER_AREAS)).min(1, { message: 'errors.field.required' }),
  availability: z.enum(AVAILABILITY).default('flexible'),
  experience: optionalText(1500),
  motivation: longText(20, 1500),
  ...envelope,
});
export type VolunteerInput = z.infer<typeof volunteerSchema>;

export const VOLUNTEER_MULTI = ['areas'] as const;

// ── Job application ──────────────────────────────────────────────────────

/**
 * The CV itself is not described here. A `File` cannot be meaningfully
 * validated by Zod — the check that matters reads magic bytes, and that lives
 * in `security/upload.ts`.
 */
export const jobApplicationSchema = z.object({
  vacancyId: z.uuid({ message: 'errors.field.required' }),
  name: shortText(2, 80),
  email: emailSchema,
  phone: phoneSchema,
  coverNote: optionalText(2000),
  portfolioUrl: optionalUrl,
  ...envelope,
});
export type JobApplicationInput = z.infer<typeof jobApplicationSchema>;

// ── Complaint (CFM) ──────────────────────────────────────────────────────

export const COMPLAINT_CATEGORIES = [
  'service_quality',
  'staff_conduct',
  'selection_process',
  'safeguarding',
  'corruption',
  'other',
] as const;

/**
 * Every identity field is optional and there is no `email` requirement, because
 * an anonymous complaint is a valid complaint. `contactPreference` exists so a
 * complainant who *does* want a reply can say how — without it, the only way to
 * be reachable would be to fill in fields the form says are optional.
 */
export const complaintSchema = z.object({
  category: z.enum(COMPLAINT_CATEGORIES),
  incidentDate: z
    .union([z.iso.date({ message: 'errors.field.date' }), z.literal('')])
    .optional(),
  location: optionalText(200),
  description: longText(20, 4000),
  relatedProject: optionalText(200),

  // Optional identity — anonymity is the default posture.
  name: optionalText(80),
  email: z.union([emailSchema, z.literal('')]).optional(),
  phone: optionalPhone,
  contactPreference: z.enum(['none', 'email', 'phone']).default('none'),

  ...envelope,
});
export type ComplaintInput = z.infer<typeof complaintSchema>;

// ── Fraud / impersonation report ─────────────────────────────────────────

export const FRAUD_CHANNELS = [
  'facebook',
  'instagram',
  'whatsapp',
  'telegram',
  'x',
  'website',
  'phone_call',
  'sms',
  'in_person',
  'other',
] as const;

export const fraudReportSchema = z.object({
  channel: z.enum(FRAUD_CHANNELS),
  /** The impostor's handle, number or URL, as the reporter saw it. */
  identifier: shortText(2, 200),
  evidenceUrl: optionalUrl,
  description: longText(20, 2000),
  occurredOn: z
    .union([z.iso.date({ message: 'errors.field.date' }), z.literal('')])
    .optional(),

  // Reporter contact is optional: a report is useful without one.
  reporterName: optionalText(80),
  reporterEmail: z.union([emailSchema, z.literal('')]).optional(),
  reporterPhone: optionalPhone,

  ...envelope,
});
export type FraudReportInput = z.infer<typeof fraudReportSchema>;
