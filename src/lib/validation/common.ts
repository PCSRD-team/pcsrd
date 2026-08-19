import { z } from 'zod';
import type { FieldErrors } from '@/lib/errors';
import { LOCALES } from '@/lib/i18n/config';

/**
 * Validation primitives.
 *
 * Zod 4 is installed; the spec was written against Zod 3. Both of the renames
 * that matter are absorbed here rather than repeated across a dozen schemas:
 * `z.string().email()` became the top-level `z.email()`, and `error.flatten()`
 * was removed — see `fieldErrorsFrom` at the bottom of this file.
 *
 * Every message is a **dictionary key**. The server has no locale.
 */

export const localeSchema = z.enum(LOCALES).default('ar');

export const emailSchema = z
  .email({ message: 'errors.field.email' })
  .trim()
  .max(160, { message: 'errors.field.tooLong' });

/**
 * E.164-ish. Deliberately permissive about formatting and strict about shape:
 * a Gaza number is written half a dozen ways and rejecting the wrong one is a
 * lost enquiry, but a field of prose is not a phone number.
 */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{7,14}$/, { message: 'errors.field.phone' });

/** Optional in the HTML sense: an untouched input posts `''`, not `undefined`. */
export const optionalPhone = z.union([phoneSchema, z.literal('')]).optional();

export const optionalUrl = z
  .union([z.url({ message: 'errors.field.url' }).max(300), z.literal('')])
  .optional();

export const shortText = (min = 2, max = 120) =>
  z
    .string()
    .trim()
    .min(min, { message: 'errors.field.tooShort' })
    .max(max, { message: 'errors.field.tooLong' });

export const longText = (min = 20, max = 2000) =>
  z
    .string()
    .trim()
    .min(min, { message: 'errors.field.tooShort' })
    .max(max, { message: 'errors.field.tooLong' });

export const optionalText = (max = 500) =>
  z.union([z.string().trim().max(max, { message: 'errors.field.tooLong' }), z.literal('')]).optional();

/**
 * A URL-safe slug in either script.
 *
 * Arabic letters are permitted because an Arabic slug is the primary one — a
 * transliterated Latin slug on an Arabic-first site is a worse URL, not a safer
 * one. What is excluded is whitespace, `/`, `.` and `%`.
 */
export const slugSchema = z
  .string()
  .trim()
  .min(1, { message: 'errors.field.required' })
  .max(120, { message: 'errors.field.tooLong' })
  .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u, { message: 'errors.field.slug' });

/**
 * The honeypot. Bots fill every field they find; a human never sees this one
 * because it is hidden from both the viewport and the accessibility tree.
 * A non-empty value means "silently accept and discard".
 */
export const honeypot = z.string().max(0).optional();

export const turnstileToken = z.string().min(1, { message: 'errors.captcha' });

// ── FormData → object ────────────────────────────────────────────────────

/**
 * `Object.fromEntries(formData)` keeps only the **last** value of a repeated
 * field, which silently drops every checkbox group down to one selection. This
 * collects repeats into arrays instead.
 *
 * `multi` names the fields that must be arrays even when one box is ticked —
 * without it, a single checked value arrives as a string and Zod's array schema
 * rejects it.
 */
export function formDataToObject(
  formData: FormData,
  multi: readonly string[] = [],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key);
    if (multi.includes(key)) {
      out[key] = values.filter((v) => typeof v === 'string' && v !== '');
    } else if (values.length > 1) {
      out[key] = values;
    } else {
      out[key] = values[0];
    }
  }

  for (const key of multi) if (!(key in out)) out[key] = [];
  return out;
}

/**
 * Groups issues by field.
 *
 * Walks `error.issues` rather than calling `z.flattenError`, which types its
 * result as `{}` for a `ZodError` that is not tied to a concrete schema — the
 * loop is both better typed and one fewer API to track across Zod majors.
 * Issues with an empty path are form-level and collect under `_form`.
 */
export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_form';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
