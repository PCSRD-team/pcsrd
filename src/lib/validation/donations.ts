import { z } from 'zod';
import {
  DONATION_CURRENCIES,
  DONATION_METHODS,
  isValidIban,
  normalizeIban,
} from '@/lib/donations/options';
import {
  emailSchema,
  honeypot,
  localeSchema,
  optionalPhone,
  optionalText,
  shortText,
  turnstileToken,
} from './common';

/**
 * Donation schemas: the public notice, and the admin's three forms.
 *
 * Every message is a dictionary key, like the rest of `lib/validation`.
 */

const uuid = z.uuid({ message: 'errors.field.invalidChoice' });
const optionalUuid = z.union([uuid, z.literal('')]).optional();

/** A ticked checkbox posts `on`; an unticked one posts nothing. */
const checkbox = z
  .union([z.literal('on'), z.literal('true'), z.literal('')])
  .optional()
  .transform((value) => value === 'on' || value === 'true');

/**
 * An amount as a person types it: `1,250.50`, `١٢٥٠` or `1250`.
 *
 * Kept as a string with two decimals because the column is `numeric(12,2)` and
 * a float would turn 0.1 + 0.2 into a different number on the receipt.
 */
const amountSchema = z
  .string()
  .trim()
  .transform((value) =>
    value
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
      .replace(/[,٬\s]/g, '')
      .replace('٫', '.'),
  )
  .pipe(
    z
      .string()
      .min(1, { message: 'errors.field.required' })
      .regex(/^\d{1,9}(\.\d{1,2})?$/, { message: 'errors.donation.amount' })
      .refine((value) => Number(value) > 0, { message: 'errors.donation.amount' })
      .transform((value) => Number(value).toFixed(2)),
  );

/** Not in the future: nobody transfers money tomorrow and tells us today. */
const pastDate = z
  .union([z.iso.date({ message: 'errors.field.date' }), z.literal('')])
  .optional()
  .refine((value) => !value || value <= new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), {
    message: 'errors.donation.futureDate',
  });

// ── The public notice ────────────────────────────────────────────────────

export const donationNoticeSchema = z
  .object({
    amount: amountSchema,
    currency: z.enum(DONATION_CURRENCIES, { message: 'errors.field.required' }),
    method: z.enum(DONATION_METHODS, { message: 'errors.field.required' }),
    accountId: optionalUuid,
    transferredOn: pastDate,
    bankReference: optionalText(100),
    projectId: optionalUuid,

    donorName: optionalText(120),
    isAnonymous: checkbox,
    email: z.union([emailSchema, z.literal('')]).optional(),
    phone: optionalPhone,
    wantsReceipt: checkbox,
    message: optionalText(1000),
    consent: z.literal('on', { message: 'errors.field.consent' }),

    locale: localeSchema,
    turnstileToken,
    website: honeypot,
  })
  // A receipt has to be sent somewhere.
  .refine((input) => !input.wantsReceipt || Boolean(input.email), {
    path: ['email'],
    message: 'errors.donation.emailForReceipt',
  });

export type DonationNoticeInput = z.infer<typeof donationNoticeSchema>;

// ── Admin: one bank account ──────────────────────────────────────────────

export const donationAccountSchema = z.object({
  id: optionalUuid,
  currency: z.enum(DONATION_CURRENCIES, { message: 'errors.field.required' }),
  bankNameAr: shortText(2, 120),
  bankNameEn: optionalText(120),
  branchAr: optionalText(120),
  branchEn: optionalText(120),
  beneficiaryAr: shortText(2, 200),
  beneficiaryEn: optionalText(200),
  accountNumber: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z-]{3,34}$/, { message: 'errors.donation.accountNumber' }),
  iban: z
    .string()
    .transform(normalizeIban)
    .refine(isValidIban, { message: 'errors.donation.iban' }),
  swift: z
    .union([
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, { message: 'errors.donation.swift' }),
      z.literal(''),
    ])
    .optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().default(true),
});

export type DonationAccountInput = z.infer<typeof donationAccountSchema>;

// ── Admin: the page's settings ───────────────────────────────────────────

export const donationSettingsSchema = z.object({
  isEnabled: z.boolean().default(false),
  introAr: optionalText(2000),
  introEn: optionalText(2000),
  iburaqAlias: optionalText(100),
  iburaqQrMediaId: optionalUuid,
  /** The bank's hosted payment page. https only — it is a link donors follow. */
  cardPaymentUrl: z
    .union([
      z.url({ protocol: /^https$/, message: 'errors.donation.cardUrl' }).max(500),
      z.literal(''),
    ])
    .optional(),
  thankYouAr: optionalText(1000),
  thankYouEn: optionalText(1000),
  notifyEmails: z
    .union([z.string(), z.array(z.string())])
    .default([])
    .transform((value) =>
      (Array.isArray(value) ? value : value.split(/[\n,;]/))
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    )
    .pipe(z.array(z.email({ message: 'errors.field.email' })).max(10)),
});

export type DonationSettingsInput = z.infer<typeof donationSettingsSchema>;

// ── Admin: deciding a notice ─────────────────────────────────────────────

export const donationReviewSchema = z
  .object({
    id: uuid,
    decision: z.enum(['confirm', 'reject', 'note'], { message: 'errors.field.invalidChoice' }),
    confirmedAmount: z.union([amountSchema, z.literal('')]).optional(),
    receiptNumber: optionalText(60),
    internalNote: optionalText(2000),
  })
  .refine((input) => input.decision !== 'confirm' || Boolean(input.confirmedAmount), {
    path: ['confirmedAmount'],
    message: 'errors.donation.confirmedAmount',
  });

export type DonationReviewInput = z.infer<typeof donationReviewSchema>;

export const donationFilterSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'rejected', 'all']).catch('pending'),
  q: z.string().trim().max(100).catch(''),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});
