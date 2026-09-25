import { z } from 'zod';
import type { RichText, RichTextNode } from '@/db/schema/_shared';
import {
  applicationCapacityRule,
  applicationFieldType,
  applicationFormKind,
  applicationStatus,
  contentStatus,
} from '@/db/schema/enums';
import { optionalText, shortText, slugSchema } from './common';

/**
 * What the admin may send when building a form.
 *
 * The important half of this file is what it **refuses**. A form builder hands
 * whoever is logged in the ability to define validation, and two of the things
 * they could define are dangerous rather than merely wrong:
 *
 * - **`config.pattern` is not accepted from the client at all.** A hand-typed
 *   regular expression is the one field property that can hang the server:
 *   `(a+)+$` against a 200-character answer backtracks for longer than any
 *   request should live, and it looks like a typo rather than an attack. A
 *   pattern reaches a stored field only by being copied out of
 *   `field-catalog.ts` by the service, where a developer wrote it.
 *
 * - **`catalogKey` is not accepted from the client either.** It is the marker
 *   that says "this field's rules were vetted"; letting the browser set it
 *   would let a hand-built field claim a catalogue field's provenance.
 *
 * Everything else is ordinary shape validation. `services/applications/*` owns
 * the rules that need to look at the database — whether a key may still be
 * renamed, whether a condition points backwards, whether the form may publish.
 */

const enumOf = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values);

const uuid = z.uuid({ message: 'errors.field.uuid' });

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

/** `''` from an untouched `datetime-local` means "no bound", not "the epoch". */
const optionalDateTime = z
  .union([z.iso.datetime({ local: true }), z.iso.datetime(), z.literal('')])
  .nullable()
  .optional();

/** A blank number input posts `''`; `null` is the honest reading of it. */
const optionalPositiveInt = (max: number) =>
  z
    .union([z.coerce.number().int().positive().max(max), z.literal('')])
    .nullable()
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value));

// ── The form ─────────────────────────────────────────────────────────────

export const applicationFormSchema = z
  .object({
    kind: enumOf(applicationFormKind.enumValues).default('job'),
    slug: slugSchema,
    titleAr: shortText(2, 200),
    titleEn: optionalText(200).nullable(),
    introAr: richText,
    introEn: richText,
    status: enumOf(contentStatus.enumValues).default('draft'),

    /** Null means "open from the moment it is published". */
    opensAt: optionalDateTime,
    /**
     * Null means no deadline. Allowed, but the admin has to choose it: a form
     * that never closes collects applications for a post that was filled last
     * year, and every one of them is a person who waited for an answer.
     */
    closesAt: optionalDateTime,

    capacity: optionalPositiveInt(100_000),
    capacityRule: enumOf(applicationCapacityRule.enumValues).default('close'),

    confirmationAr: optionalText(1000).nullable(),
    confirmationEn: optionalText(1000).nullable(),

    /**
     * Where a new application is announced. Parsed from one textarea, one
     * address per line, because a repeating input for three addresses is more
     * machinery than the job needs.
     */
    notifyEmails: z
      .union([z.string(), z.array(z.string())])
      .default([])
      .transform((value) =>
        (Array.isArray(value) ? value : value.split(/[\n,;]/))
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean),
      )
      .pipe(z.array(z.email({ message: 'errors.field.email' })).max(10)),

    retentionMonths: z.coerce
      .number()
      .int()
      .min(1, { message: 'errors.field.tooSmall' })
      .max(60, { message: 'errors.field.tooLarge' })
      .default(12),

    allowMultiplePerEmail: z.coerce.boolean().default(false),
    requireConsent: z.coerce.boolean().default(true),

    vacancyId: z.union([uuid, z.literal('')]).nullable().optional(),
  })
  .refine(
    (form) => !form.opensAt || !form.closesAt || form.closesAt > form.opensAt,
    { path: ['closesAt'], message: 'errors.field.closesBeforeOpens' },
  );

export type ApplicationFormInput = z.infer<typeof applicationFormSchema>;

// ── One field ────────────────────────────────────────────────────────────

const fieldOption = z.object({
  value: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{1,40}$/, { message: 'errors.field.optionValue' }),
  labelAr: shortText(1, 120),
  labelEn: optionalText(120).nullable(),
});

/**
 * The per-type constraints an admin may set.
 *
 * `pattern` is absent on purpose — see the file header. `accept` is a named
 * catalogue of MIME types rather than a list, so an admin cannot widen a file
 * field to accept every type by typing a wildcard into it.
 */
const fieldConfig = z
  .object({
    minLength: z.coerce.number().int().min(0).max(5000).optional(),
    maxLength: z.coerce.number().int().min(1).max(5000).optional(),
    min: z.coerce.number().optional(),
    max: z.coerce.number().optional(),
    minDate: z.union([z.iso.date(), z.literal('today')]).optional(),
    maxDate: z.union([z.iso.date(), z.literal('today')]).optional(),
    accept: z.enum(['document', 'image', 'any']).optional(),
    minChoices: z.coerce.number().int().min(0).max(50).optional(),
    maxChoices: z.coerce.number().int().min(1).max(50).optional(),
    columns: z.union([z.literal(1), z.literal(2)]).optional(),
  })
  .default({});

const visibleWhen = z
  .object({
    field: z.string().regex(/^[a-z][a-z0-9_]{0,47}$/),
    equals: z.array(z.string().max(60)).min(1).max(20),
  })
  .nullable()
  .optional();

export const applicationFieldSchema = z
  .object({
    /** Present when editing an existing field, absent when adding one. */
    id: z.union([uuid, z.literal('')]).nullable().optional(),
    key: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_]{0,47}$/, { message: 'errors.field.fieldKey' }),
    type: enumOf(applicationFieldType.enumValues),
    labelAr: shortText(1, 200),
    labelEn: optionalText(200).nullable(),
    placeholderAr: optionalText(200).nullable(),
    placeholderEn: optionalText(200).nullable(),
    helpAr: optionalText(500).nullable(),
    helpEn: optionalText(500).nullable(),
    required: z.coerce.boolean().default(false),
    sensitive: z.coerce.boolean().default(false),
    sortOrder: z.coerce.number().int().min(0).max(500).default(0),
    options: z.array(fieldOption).max(60).default([]),
    config: fieldConfig,
    visibleWhen,
  })
  .refine(
    (field) =>
      !['select', 'radio', 'multi_select'].includes(field.type) || field.options.length > 0,
    { path: ['options'], message: 'errors.field.optionsRequired' },
  )
  .refine((field) => field.type !== 'section' || (!field.required && !field.sensitive), {
    path: ['required'],
    message: 'errors.field.sectionCannotBeRequired',
  })
  .refine(
    (field) =>
      field.config.maxLength === undefined ||
      field.config.minLength === undefined ||
      field.config.maxLength >= field.config.minLength,
    { path: ['config'], message: 'errors.field.rangeInverted' },
  )
  .refine(
    (field) =>
      field.config.max === undefined ||
      field.config.min === undefined ||
      field.config.max >= field.config.min,
    { path: ['config'], message: 'errors.field.rangeInverted' },
  )
  /** A field cannot be its own condition; the service checks the rest. */
  .refine((field) => field.visibleWhen?.field !== field.key, {
    path: ['visibleWhen'],
    message: 'errors.field.selfCondition',
  });

export type ApplicationFieldInput = z.infer<typeof applicationFieldSchema>;

/** Adding a catalogue field: the key is all the service needs to build the row. */
export const addCatalogFieldSchema = z.object({
  catalogKey: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{0,47}$/, { message: 'errors.field.fieldKey' }),
  required: z.coerce.boolean().optional(),
});

/** Reordering: the full list of field ids in their new order. */
export const reorderFieldsSchema = z.object({
  ids: z.array(uuid).min(1).max(200),
});

// ── Applicant-side admin actions ─────────────────────────────────────────

export const applicationReviewSchema = z.object({
  status: enumOf(applicationStatus.enumValues),
  rating: z
    .union([z.coerce.number().int().min(1).max(5), z.literal('')])
    .nullable()
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value)),
  internalNote: optionalText(2000).nullable(),
});

export type ApplicationReviewInput = z.infer<typeof applicationReviewSchema>;

/** The applicants table's filters, as they arrive from a `GET` form. */
export const applicantFilterSchema = z.object({
  q: optionalText(120).optional(),
  status: z.union([enumOf(applicationStatus.enumValues), z.literal('')]).optional(),
  waitlisted: z.union([z.literal('1'), z.literal('')]).optional(),
  page: z.coerce.number().int().positive().max(10_000).default(1),
});
