/**
 * The option values of the public forms, with no imports.
 *
 * The Zod schemas in `./forms.ts` build their enums from these, and the form
 * components render their options from them — one list, so a value the server
 * would reject cannot be offered. They live in their own module because the
 * form components are Client Components: importing the constants from
 * `./forms.ts` pulled Zod and every schema into the browser bundle for a few
 * arrays of strings. `./forms.ts` re-exports them, so server code is
 * unchanged.
 */

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

export const ENQUIRY_TYPES = ['general', 'partnership', 'media', 'complaint'] as const;

/**
 * Age band, not date of birth: the band is all the organisation needs to
 * know; a birth date is a permanent identifier collected for no reason.
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

export const COMPLAINT_CATEGORIES = [
  'service_quality',
  'staff_conduct',
  'selection_process',
  'safeguarding',
  'corruption',
  'other',
] as const;

export const CONTACT_PREFERENCES = ['none', 'email', 'phone'] as const;

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
