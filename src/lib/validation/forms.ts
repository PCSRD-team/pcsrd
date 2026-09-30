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

// The option lists live in an import-free module so the Client Component
// forms can read them without pulling Zod into the browser bundle.
import {
  ORGANIZATION_TYPES,
  PARTNERSHIP_INTERESTS,
  PROGRAM_KEYS,
  ENQUIRY_TYPES,
  AGE_BANDS,
  GOVERNORATES,
  VOLUNTEER_AREAS,
  AVAILABILITY,
  COMPLAINT_CATEGORIES,
  FRAUD_CHANNELS,
  CONTACT_PREFERENCES,
} from './form-options';
export {
  ORGANIZATION_TYPES,
  PARTNERSHIP_INTERESTS,
  PROGRAM_KEYS,
  ENQUIRY_TYPES,
  AGE_BANDS,
  GOVERNORATES,
  VOLUNTEER_AREAS,
  AVAILABILITY,
  COMPLAINT_CATEGORIES,
  FRAUD_CHANNELS,
  CONTACT_PREFERENCES,
} from './form-options';

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

export const partnershipSchema = z.object({
  organizationName: shortText(2, 120),
  organizationType: z.enum(ORGANIZATION_TYPES, { message: 'errors.field.required' }),
  /** ISO 3166-1 alpha-2. */
  country: z.string().trim().length(2, { message: 'errors.field.country' }),
  contactName: shortText(2, 80),
  role: shortText(2, 80),
  email: emailSchema,
  phone: optionalPhone,
  interest: z.array(z.enum(PARTNERSHIP_INTERESTS, { message: 'errors.field.invalidChoice' })).min(1, { message: 'errors.field.required' }),
  programs: z.array(z.enum(PROGRAM_KEYS, { message: 'errors.field.invalidChoice' })).default([]),
  message: longText(20, 2000),
  ...envelope,
});
export type PartnershipInput = z.infer<typeof partnershipSchema>;

/** Fields that arrive as repeated form entries. */
export const PARTNERSHIP_MULTI = ['interest', 'programs'] as const;

// ── Contact ──────────────────────────────────────────────────────────────

export const contactSchema = z.object({
  name: shortText(2, 80),
  email: emailSchema,
  phone: optionalPhone,
  enquiryType: z.enum(ENQUIRY_TYPES, { message: 'errors.field.invalidChoice' }).default('general'),
  subject: shortText(3, 150),
  message: longText(20, 2000),
  ...envelope,
});
export type ContactInput = z.infer<typeof contactSchema>;

// ── Volunteer ────────────────────────────────────────────────────────────

export const volunteerSchema = z.object({
  name: shortText(2, 80),
  email: emailSchema,
  phone: phoneSchema,
  ageBand: z.enum(AGE_BANDS, { message: 'errors.field.required' }),
  /** Governorate, not an address. */
  governorate: z.enum(GOVERNORATES, { message: 'errors.field.required' }),
  areas: z.array(z.enum(VOLUNTEER_AREAS, { message: 'errors.field.invalidChoice' })).min(1, { message: 'errors.field.required' }),
  availability: z.enum(AVAILABILITY, { message: 'errors.field.invalidChoice' }).default('flexible'),
  experience: optionalText(1500),
  motivation: longText(20, 1500),
  ...envelope,
});
export type VolunteerInput = z.infer<typeof volunteerSchema>;

export const VOLUNTEER_MULTI = ['areas'] as const;

// ── Complaint (CFM) ──────────────────────────────────────────────────────

/**
 * Every identity field is optional and there is no `email` requirement, because
 * an anonymous complaint is a valid complaint. `contactPreference` exists so a
 * complainant who *does* want a reply can say how — without it, the only way to
 * be reachable would be to fill in fields the form says are optional.
 */
export const complaintSchema = z.object({
  category: z.enum(COMPLAINT_CATEGORIES, { message: 'errors.field.required' }),
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
  contactPreference: z.enum(CONTACT_PREFERENCES, { message: 'errors.field.invalidChoice' }).default('none'),

  ...envelope,
});
export type ComplaintInput = z.infer<typeof complaintSchema>;

// ── Fraud / impersonation report ─────────────────────────────────────────

export const fraudReportSchema = z.object({
  channel: z.enum(FRAUD_CHANNELS, { message: 'errors.field.required' }),
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
