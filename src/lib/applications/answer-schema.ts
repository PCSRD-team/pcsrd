import { z } from 'zod';
import type {
  ApplicationFieldConfig,
  ApplicationFormField,
  ApplicationVisibleWhen,
} from '@/db/schema/applications';
import type { ApplicationFieldType } from '@/db/schema/enums';
import type { FieldErrors } from '@/lib/errors';

/**
 * Compiles a form's stored field definitions into a Zod schema, per request.
 *
 * This is the piece that makes an admin-authored form as safe as a hand-written
 * one. The six forms in `validation/forms.ts` have their rules written in
 * TypeScript and checked at build time; a form built in the admin has its rules
 * in a table, and *something* has to turn those rows into a validator before
 * anything is stored. That is this file, and it runs on every submission.
 *
 * Three properties it has to hold:
 *
 * 1. **The stored row is the authority.** Not the catalogue. A form's behaviour
 *    must be reproducible from its own rows — if a catalogue entry were
 *    consulted at submission time, editing `field-catalog.ts` would silently
 *    change the validation of forms that were published months earlier, and a
 *    deployment would become a change to a live recruitment. The catalogue's
 *    `config` is **copied into** the row when the admin adds the field; from
 *    then on the row stands alone.
 *
 * 2. **`config.pattern` can only have come from the catalogue.** The admin-side
 *    Zod in `validation/applications.ts` refuses an author-supplied `pattern`,
 *    so a regular expression here was written by a developer, not by whoever is
 *    logged in. That matters: a hand-typed regex is the one field property that
 *    can hang the server, and `(a+)+$` on a 200-character answer is a denial of
 *    service that looks like a typo.
 *
 * 3. **A hidden field cannot block a submission.** `visibleWhen` is evaluated
 *    here, against the values actually submitted — not only in the browser. A
 *    required field whose condition is unmet is dropped from the schema
 *    entirely, because otherwise a visitor is refused for not answering a
 *    question they were never shown; and a value submitted for a field whose
 *    condition is unmet is discarded, because otherwise the condition is
 *    advisory and a crafted POST walks straight past it.
 *
 * Every message is a dictionary key. The server has no locale.
 */

/**
 * The field properties this module needs.
 *
 * Structural rather than `Pick<ApplicationFormField, ...>`, and `options` asks
 * only for `value`. Two callers pass two different shapes — the admin passes
 * stored rows with `labelAr`/`labelEn`, the public renderer passes rows already
 * resolved to one `label` for the locale — and validation looks at neither. It
 * checks that the submitted value is one of the offered values, so requiring a
 * label here would force one caller to carry fields it has deliberately
 * collapsed, purely to satisfy a type.
 */
export type CompilableField = {
  key: string;
  type: ApplicationFieldType;
  required: boolean;
  options: { value: string }[];
  config: ApplicationFieldConfig;
  visibleWhen: ApplicationVisibleWhen | null;
  sensitive: boolean;
};

/** `requireConsent` on a form renders and requires this, even with no such row. */
export const CONSENT_FIELD_KEY = 'data_processing_consent';

/** Field types that carry no answer and take no part in validation. */
const INERT: ReadonlySet<ApplicationFieldType> = new Set(['section', 'file']);

/** HTML posts an unchecked box as nothing at all and a checked one as `on`. */
const TRUTHY = new Set(['on', 'true', '1', 'yes']);

const asString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

const asList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(asString).filter(Boolean);
  const single = asString(value);
  return single ? [single] : [];
};

const isTruthy = (value: unknown): boolean =>
  value === true || TRUTHY.has(asString(value).toLowerCase());

const optionValues = (options: { value: string }[]): string[] =>
  options.map((option) => option.value);

/**
 * Whether a field is shown, given the values submitted alongside it.
 *
 * The controlling field is always declared earlier in the order — the admin
 * validation enforces it — so a single forward pass is enough and a cycle is
 * unrepresentable. A condition naming a field that no longer exists resolves to
 * **visible**: a question that has lost its gate should be asked, not silently
 * dropped from a form the admin believes is complete.
 */
export function isFieldVisible(
  field: CompilableField,
  values: Record<string, unknown>,
  known: ReadonlySet<string>,
): boolean {
  const condition = field.visibleWhen;
  if (!condition) return true;
  if (!known.has(condition.field)) return true;

  const raw = values[condition.field];
  // A checkbox controlling a follow-up is the common case: "do you have a
  // relative working here?" → "who?". Its submitted value is `on`, which no
  // author would think to type into the condition, so a boolean tick matches
  // the conventional `true`.
  const candidates = Array.isArray(raw)
    ? raw.map(asString)
    : [asString(raw), isTruthy(raw) ? 'true' : 'false'];

  return condition.equals.some((wanted) => candidates.includes(wanted));
}

/** One field's schema, before `required` is applied. */
function baseSchema(field: CompilableField): z.ZodType {
  const config = field.config ?? {};

  switch (field.type) {
    case 'email':
      return z.email({ message: 'errors.field.email' }).trim().max(160, {
        message: 'errors.field.tooLong',
      });

    case 'phone':
      // The same permissive-about-formatting, strict-about-shape rule as
      // `phoneSchema`: a Gaza number is written half a dozen ways and refusing
      // the wrong one is a lost applicant.
      return z
        .string()
        .trim()
        .regex(/^\+?[1-9]\d{7,14}$/, { message: 'errors.field.phone' });

    case 'number': {
      let schema = z.coerce.number({ message: 'errors.field.number' });
      if (typeof config.min === 'number') {
        schema = schema.min(config.min, { message: 'errors.field.tooSmall' });
      }
      if (typeof config.max === 'number') {
        schema = schema.max(config.max, { message: 'errors.field.tooLarge' });
      }
      return schema;
    }

    case 'date': {
      // Stored and compared as `YYYY-MM-DD`, which sorts lexicographically and
      // has no timezone to be wrong about. `'today'` is resolved per request so
      // a bound like "not in the future" stays true tomorrow.
      const today = new Date().toISOString().slice(0, 10);
      const bound = (value: string | undefined) =>
        value === 'today' ? today : value;
      const min = bound(config.minDate);
      const max = bound(config.maxDate);

      return z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'errors.field.date' })
        .refine((value) => !Number.isNaN(Date.parse(value)), {
          message: 'errors.field.date',
        })
        .refine((value) => !min || value >= min, { message: 'errors.field.dateTooEarly' })
        .refine((value) => !max || value <= max, { message: 'errors.field.dateTooLate' });
    }

    case 'select':
    case 'radio': {
      const allowed = optionValues(field.options ?? []);
      return z.string().refine((value) => allowed.includes(value), {
        message: 'errors.field.invalidChoice',
      });
    }

    case 'multi_select': {
      const allowed = new Set(optionValues(field.options ?? []));
      let schema = z
        .array(z.string())
        .refine((values) => values.every((value) => allowed.has(value)), {
          message: 'errors.field.invalidChoice',
        });
      if (typeof config.minChoices === 'number') {
        schema = schema.refine((values) => values.length >= config.minChoices!, {
          message: 'errors.field.tooFewChoices',
        });
      }
      if (typeof config.maxChoices === 'number') {
        schema = schema.refine((values) => values.length <= config.maxChoices!, {
          message: 'errors.field.tooManyChoices',
        });
      }
      return schema;
    }

    case 'checkbox':
      return z.boolean();

    case 'short_text':
    case 'long_text':
    default: {
      let schema = z.string().trim();
      if (typeof config.minLength === 'number') {
        schema = schema.min(config.minLength, { message: 'errors.field.tooShort' });
      }
      // Always capped. An uncapped text column is a free upload slot: a jsonb
      // answer of ten megabytes costs the same POST as a sentence.
      schema = schema.max(config.maxLength ?? (field.type === 'long_text' ? 3000 : 250), {
        message: 'errors.field.tooLong',
      });
      if (config.pattern) {
        // Safe because the admin layer refuses an author-supplied pattern; see
        // the header. Compiled per request rather than cached, which at one
        // regex per field per submission is not a cost worth a cache.
        schema = schema.regex(new RegExp(config.pattern), {
          message: 'errors.field.pattern',
        });
      }
      return schema;
    }
  }
}

/** Whether a submitted value counts as "left blank" for this field type. */
function isBlank(field: CompilableField, value: unknown): boolean {
  if (field.type === 'multi_select') return asList(value).length === 0;
  if (field.type === 'checkbox') return false; // unticked is an answer, not a blank
  if (field.type === 'number') return asString(value) === '';
  return asString(value) === '';
}

/** Normalises one raw `FormData` value into the shape its schema expects. */
function normalize(field: CompilableField, value: unknown): unknown {
  switch (field.type) {
    case 'multi_select':
      return asList(value);
    case 'checkbox':
      return isTruthy(value);
    case 'number':
      return asString(value);
    default:
      return asString(value);
  }
}

export type AnswerParseResult =
  | { ok: true; answers: Record<string, unknown> }
  | { ok: false; fieldErrors: FieldErrors };

/**
 * Validates one submission against one form's fields.
 *
 * Returns the answers keyed by field `key`, ready for `applications.answers` —
 * with the invisible fields removed and nothing that was not asked for. A key
 * the form does not declare is dropped rather than rejected: a stale browser
 * tab posting a field that was deleted an hour ago is a normal event, and
 * refusing the whole application over it would lose a real applicant.
 *
 * `requireConsent` is handled here rather than by a field row so a form cannot
 * lose its consent tick by having a field deleted. When it is on and the form
 * declares no consent field of its own, a synthetic required checkbox is
 * validated under `CONSENT_FIELD_KEY` and stored with the rest — the record
 * that consent was given belongs in the same row as the data it covers.
 */
export function parseAnswers(
  fields: CompilableField[],
  raw: Record<string, unknown>,
  options: { requireConsent?: boolean } = {},
): AnswerParseResult {
  const known = new Set(fields.map((field) => field.key));
  const answers: Record<string, unknown> = {};
  const fieldErrors: FieldErrors = {};

  for (const field of fields) {
    if (INERT.has(field.type)) continue;
    if (!isFieldVisible(field, raw, known)) continue;

    const value = normalize(field, raw[field.key]);

    if (isBlank(field, value)) {
      if (field.required) fieldErrors[field.key] = ['errors.field.required'];
      continue;
    }

    // A required tick that is present but false is "you did not agree", which
    // is a different sentence from "you left this blank".
    if (field.type === 'checkbox' && field.required && value !== true) {
      fieldErrors[field.key] = ['errors.field.mustAgree'];
      continue;
    }

    const parsed = baseSchema(field).safeParse(value);
    if (!parsed.success) {
      fieldErrors[field.key] = parsed.error.issues.map((issue) => issue.message);
      continue;
    }

    answers[field.key] = parsed.data;
  }

  if (options.requireConsent && !known.has(CONSENT_FIELD_KEY)) {
    if (isTruthy(raw[CONSENT_FIELD_KEY])) {
      answers[CONSENT_FIELD_KEY] = true;
    } else {
      fieldErrors[CONSENT_FIELD_KEY] = ['errors.field.mustAgree'];
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, answers };
}

/**
 * The three answers that are copied onto the application row.
 *
 * Read from the fields the catalogue marked with an `identityRole`, which the
 * service records on the row as the catalogue key. Falling back to a key match
 * covers a form whose author rebuilt the name field by hand — a portal whose
 * applicants table shows a blank name column because the admin did not use the
 * catalogue entry is a portal nobody will use.
 */
const IDENTITY_FALLBACK = {
  name: ['full_name_ar', 'full_name', 'full_name_en', 'name'],
  email: ['email', 'email_address'],
  phone: ['mobile_number', 'phone', 'phone_number', 'mobile'],
} as const;

export function extractIdentity(
  fields: Pick<ApplicationFormField, 'key' | 'catalogKey' | 'type'>[],
  answers: Record<string, unknown>,
): { name: string | null; email: string | null; phone: string | null } {
  const pick = (role: keyof typeof IDENTITY_FALLBACK): string | null => {
    for (const candidate of IDENTITY_FALLBACK[role]) {
      const field = fields.find(
        (f) => f.catalogKey === candidate || f.key === candidate,
      );
      if (!field) continue;
      const value = asString(answers[field.key]);
      if (value) return value.slice(0, 200);
    }
    return null;
  };

  return { name: pick('name'), email: pick('email'), phone: pick('phone') };
}
